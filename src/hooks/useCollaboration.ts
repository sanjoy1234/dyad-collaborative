/**
 * useCollaboration Hook
 * Client-side Socket.IO connection for real-time collaboration
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UserPresence {
  userId: string;
  username: string;
  email: string;
  role: string;
  currentFile?: string;
  lastActivity: number;
  color: string;
}

interface RemoteCursor {
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

interface FileEditEvent {
  fileId: string;
  userId: string;
  username: string;
  changes: any[];
  version: number;
}

interface UseCollaborationOptions {
  projectId: string;
  userId: string;
  enabled?: boolean;
  onRemoteFileSaved?: (data: { fileId: string; filePath: string; newContent: string; username: string }) => void;
}

export function useCollaboration({ 
  projectId, 
  userId, 
  enabled = true,
  onRemoteFileSaved,
}: UseCollaborationOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<UserPresence[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !projectId || !userId) return;

    // Initialize Socket.IO connection
    const socket = io(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Collaboration] Connected to server');
      setIsConnected(true);
      setError(null);

      // Join project room
      socket.emit('join-project', { projectId, userId });
    });

    socket.on('disconnect', () => {
      console.log('[Collaboration] Disconnected from server');
      setIsConnected(false);
    });

    socket.on('error', (data: { message: string }) => {
      console.error('[Collaboration] Error:', data.message);
      setError(data.message);
    });

    socket.on('presence-update', (data: { users: UserPresence[] }) => {
      setActiveUsers(data.users);
      console.log('[Collaboration] Active users:', data.users.length);
    });

    socket.on('remote-cursor', (cursor: RemoteCursor) => {
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.set(cursor.userId, cursor);
        return next;
      });

      // Auto-remove cursor after 3 seconds of inactivity
      setTimeout(() => {
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.delete(cursor.userId);
          return next;
        });
      }, 3000);
    });

    socket.on('user-file-opened', (data: any) => {
      console.log('[Collaboration] User opened file:', data.username, data.filePath);
    });

    socket.on('user-file-closed', (data: any) => {
      console.log('[Collaboration] User closed file:', data.userId);
    });

    socket.on('remote-file-edit', (data: FileEditEvent) => {
      console.log('[Collaboration] Remote edit from:', data.username);
      // This will be handled by Monaco Editor
    });

    socket.on('user-typing', (data: any) => {
      console.log('[Collaboration] User typing:', data.username);
    });

    socket.on('remote-file-saved', (data: any) => {
      console.log('[Collaboration] Remote file saved:', data.username, data.filePath);
      if (onRemoteFileSaved) {
        onRemoteFileSaved({
          fileId: data.fileId,
          filePath: data.filePath,
          newContent: data.newContent,
          username: data.username,
        });
      }
    });

    return () => {
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [projectId, userId, enabled, onRemoteFileSaved]);

  // Methods to emit events
  const openFile = useCallback((fileId: string, filePath: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('file-open', { fileId, filePath });
    }
  }, []);

  const closeFile = useCallback((fileId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('file-close', { fileId });
    }
  }, []);

  const updateCursorPosition = useCallback((fileId: string, position: any, selection?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('cursor-position', {
        fileId,
        position,
        selection,
      });
    }
  }, []);

  const sendFileEdit = useCallback((fileId: string, changes: any[], version: number) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('file-edit', {
        fileId,
        changes,
        version,
      });
    }
  }, []);

  const sendTyping = useCallback((fileId: string, isTyping: boolean) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('typing', { fileId, isTyping });
    }
  }, []);

  const sendFileSaved = useCallback((fileId: string, filePath: string, newContent: string) => {
    if (socketRef.current?.connected) {
      console.log('[Collaboration] Broadcasting file save:', filePath);
      socketRef.current.emit('file-saved', { fileId, filePath, newContent });
    }
  }, []);

  return {
    isConnected,
    activeUsers,
    remoteCursors,
    error,
    openFile,
    closeFile,
    updateCursorPosition,
    sendFileEdit,
    sendTyping,
    sendFileSaved,
  };
}
