/**
 * Socket.IO Real-Time Collaboration Server
 * Handles live cursors, presence, and collaborative editing
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from '@/lib/db';
import { projectCollaborators, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

interface UserPresence {
  userId: string;
  username: string;
  email: string;
  role: string;
  currentFile?: string;
  lastActivity: number;
  color: string; // Unique color for cursor
}

interface CursorPosition {
  userId: string;
  username: string;
  fileId: string;
  position: {
    lineNumber: number;
    column: number;
  };
  selection?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  color: string;
}

interface FileEdit {
  fileId: string;
  userId: string;
  username: string;
  changes: any[]; // Monaco editor content changes
  version: number;
}

// Store active users by project
const projectRooms = new Map<string, Map<string, UserPresence>>();

// Generate consistent color for user
function getUserColor(userId: string): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
  ];
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

export function initializeCollaborationServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/socket.io/',
  });

  io.on('connection', async (socket: Socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

    let currentProjectId: string | null = null;
    let currentUser: any = null;

    // Join project room
    socket.on('join-project', async (data: { projectId: string; userId: string }) => {
      try {
        const { projectId, userId } = data;

        // Verify user has access to this project
        const collaboration = await db.query.projectCollaborators.findFirst({
          where: and(
            eq(projectCollaborators.project_id, projectId),
            eq(projectCollaborators.user_id, userId)
          ),
        });

        if (!collaboration) {
          socket.emit('error', { message: 'Access denied to this project' });
          return;
        }

        // Get user details
        const userDetails = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });

        if (!userDetails) {
          socket.emit('error', { message: 'User not found' });
          return;
        }

        currentProjectId = projectId;
        currentUser = userDetails;

        // Join Socket.IO room
        socket.join(`project:${projectId}`);

        // Initialize presence for this project if needed
        if (!projectRooms.has(projectId)) {
          projectRooms.set(projectId, new Map());
        }

        const projectPresence = projectRooms.get(projectId)!;
        const userPresence: UserPresence = {
          userId: userDetails.id,
          username: userDetails.username,
          email: userDetails.email,
          role: collaboration.role,
          lastActivity: Date.now(),
          color: getUserColor(userDetails.id),
        };

        // Use userId as key to prevent duplicate entries per user
        projectPresence.set(userDetails.id, userPresence);

        // Broadcast updated presence to all users in project
        io.to(`project:${projectId}`).emit('presence-update', {
          users: Array.from(projectPresence.values()),
        });

        console.log(`[Socket.IO] User ${userDetails.username} joined project ${projectId}`);

        // Send current presence to the joining user
        socket.emit('presence-update', {
          users: Array.from(projectPresence.values()),
        });
      } catch (error) {
        console.error('[Socket.IO] Join project error:', error);
        socket.emit('error', { message: 'Failed to join project' });
      }
    });

    // User started viewing a file
    socket.on('file-open', (data: { fileId: string; filePath: string }) => {
      if (!currentProjectId || !currentUser) return;

      const projectPresence = projectRooms.get(currentProjectId);
      if (!projectPresence) return;

      const presence = projectPresence.get(socket.id);
      if (presence) {
        presence.currentFile = data.fileId;
        presence.lastActivity = Date.now();

        // Broadcast to others viewing the same file
        socket.to(`project:${currentProjectId}`).emit('user-file-opened', {
          userId: currentUser.id,
          username: currentUser.username,
          fileId: data.fileId,
          filePath: data.filePath,
          color: presence.color,
        });
      }
    });

    // User closed a file
    socket.on('file-close', (data: { fileId: string }) => {
      if (!currentProjectId || !currentUser) return;

      const projectPresence = projectRooms.get(currentProjectId);
      if (!projectPresence) return;

      const presence = projectPresence.get(socket.id);
      if (presence) {
        presence.currentFile = undefined;
        presence.lastActivity = Date.now();

        socket.to(`project:${currentProjectId}`).emit('user-file-closed', {
          userId: currentUser.id,
          fileId: data.fileId,
        });
      }
    });

    // Cursor position update
    socket.on('cursor-position', (data: CursorPosition) => {
      if (!currentProjectId || !currentUser) return;

      const projectPresence = projectRooms.get(currentProjectId);
      if (!projectPresence) return;

      const presence = projectPresence.get(socket.id);
      if (presence) {
        presence.lastActivity = Date.now();

        // Broadcast cursor position to others viewing the same file
        socket.to(`project:${currentProjectId}`).emit('remote-cursor', {
          ...data,
          userId: currentUser.id,
          username: currentUser.username,
          color: presence.color,
        });
      }
    });

    // File content change (collaborative editing)
    socket.on('file-edit', (data: FileEdit) => {
      if (!currentProjectId || !currentUser) return;

      // Broadcast changes to other users in real-time
      socket.to(`project:${currentProjectId}`).emit('remote-file-edit', {
        ...data,
        userId: currentUser.id,
        username: currentUser.username,
      });
    });

    // File saved event (broadcast to all users)
    socket.on('file-saved', (data: { fileId: string; filePath: string; newContent: string }) => {
      if (!currentProjectId || !currentUser) return;

      console.log(`[Socket.IO] File saved by ${currentUser.username}: ${data.filePath}`);

      // Broadcast to all other users in the project
      socket.to(`project:${currentProjectId}`).emit('remote-file-saved', {
        fileId: data.fileId,
        filePath: data.filePath,
        newContent: data.newContent,
        userId: currentUser.id,
        username: currentUser.username,
        timestamp: Date.now(),
      });
    });

    // Typing indicator
    socket.on('typing', (data: { fileId: string; isTyping: boolean }) => {
      if (!currentProjectId || !currentUser) return;

      socket.to(`project:${currentProjectId}`).emit('user-typing', {
        userId: currentUser.id,
        username: currentUser.username,
        fileId: data.fileId,
        isTyping: data.isTyping,
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);

      if (currentProjectId && currentUser) {
        const projectPresence = projectRooms.get(currentProjectId);
        if (projectPresence) {
          // Delete by userId instead of socket.id to handle reconnections properly
          projectPresence.delete(currentUser.id);

          // Broadcast updated presence
          io.to(`project:${currentProjectId}`).emit('presence-update', {
            users: Array.from(projectPresence.values()),
          });

          // Clean up empty project rooms
          if (projectPresence.size === 0) {
            projectRooms.delete(currentProjectId);
          }
        }
      }
    });
  });

  console.log('[Socket.IO] Collaboration server initialized');

  return io;
}
