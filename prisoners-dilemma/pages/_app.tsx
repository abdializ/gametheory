import { AppProps } from 'next/app';
import { io, Socket } from 'socket.io-client';
import { createContext } from 'react';
import '../app/globals.css';

// Initialize socket with proper configuration
let socket: Socket | undefined;
if (typeof window !== 'undefined') {
  socket = io(window.location.origin, {
    path: '/api/socket',
    transports: ['polling', 'websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 20000
  });
}

// Create a socket context
export const SocketContext = createContext<Socket | undefined>(socket);

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SocketContext.Provider value={socket}>
      <Component {...pageProps} />
    </SocketContext.Provider>
  );
} 