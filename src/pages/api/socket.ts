/**
 * Socket.IO Initialization API Route
 * Sets up WebSocket server for real-time collaboration
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { initializeCollaborationServer } from '@/lib/collaboration/socket-server';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket || !res.socket.server) {
    res.status(500).json({ error: 'Socket server not available' });
    return;
  }

  const httpServer = res.socket.server as any;

  // Initialize Socket.IO only once
  if (!httpServer.io) {
    console.log('[Socket.IO] Initializing collaboration server...');
    const io = initializeCollaborationServer(httpServer);
    httpServer.io = io;
    console.log('[Socket.IO] Server initialized successfully');
  } else {
    console.log('[Socket.IO] Server already running');
  }

  res.status(200).json({ success: true, message: 'Socket.IO server running' });
}
