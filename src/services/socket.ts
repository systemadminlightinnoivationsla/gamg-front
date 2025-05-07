import { io, Socket } from 'socket.io-client';

// Socket.io client configuration
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || window.location.origin;
const RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY = 1000;

// Create socket instance with reconnection options
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: RECONNECTION_ATTEMPTS,
  reconnectionDelay: RECONNECTION_DELAY,
  timeout: 10000,
  // Automatically send the auth token with connection
  auth: {
    token: localStorage.getItem('auth_token')
  }
});

// Setup socket event listeners
const setupSocketListeners = () => {
  // Connection events
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
  
  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });
  
  // Reconnection events
  socket.on('reconnect', (attempt) => {
    console.log(`Socket reconnected after ${attempt} attempts`);
  });
  
  socket.on('reconnect_attempt', (attempt) => {
    console.log(`Socket reconnection attempt: ${attempt}/${RECONNECTION_ATTEMPTS}`);
    
    // Get fresh token in case it was updated
    socket.auth = {
      token: localStorage.getItem('auth_token')
    };
  });
  
  socket.on('reconnect_error', (error) => {
    console.error('Socket reconnection error:', error);
  });
  
  socket.on('reconnect_failed', () => {
    console.error('Socket reconnection failed after all attempts');
    
    // Could show a UI prompt to manually reconnect
    // Or schedule a retry with exponential backoff
    setTimeout(() => {
      socket.connect();
    }, RECONNECTION_DELAY * 5);
  });
};

// Initialize listeners
setupSocketListeners();

// Socket service for components to use
export const socketService = {
  // Check connection status
  isConnected: (): boolean => {
    return socket.connected;
  },
  
  // Manually connect
  connect: (): void => {
    if (!socket.connected) {
      socket.connect();
    }
  },
  
  // Manually disconnect
  disconnect: (): void => {
    if (socket.connected) {
      socket.disconnect();
    }
  },
  
  // Join a room
  joinRoom: (room: string): void => {
    socket.emit('join', room);
  },
  
  // Leave a room
  leaveRoom: (room: string): void => {
    socket.emit('leave', room);
  },
  
  // Update auth token (e.g. after login/logout)
  updateToken: (token: string | null): void => {
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
    
    // Update socket auth for next connection
    socket.auth = {
      token: token
    };
    
    // If connected, reconnect with new token
    if (socket.connected) {
      socket.disconnect().connect();
    }
  }
};

export default socketService; 