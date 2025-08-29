import { io, Socket } from 'socket.io-client';

// Singleton socket instance
let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // In production, connect to same origin (works for any port)
    // In development (port 8080), use port 3001 for separate dev server
    const isDevMode = window.location.port === '8080';
    const socketUrl = isDevMode
      ? 'http://localhost:3001' // Development server on different port
      : ''; // Production - use same origin (works with any port)
    
    console.log('Creating socket connection to:', socketUrl || `same origin (port ${window.location.port})`);
    
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true,
      multiplex: false
    });
  }
  
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};