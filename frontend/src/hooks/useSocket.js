import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const CHAT_URL = process.env.REACT_APP_CHAT_URL || 'http://localhost:3002';

export const useSocket = (token) => {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    socketRef.current = io(CHAT_URL, { auth: { token } });
    socketRef.current.on('connect', () => setConnected(true));
    socketRef.current.on('disconnect', () => setConnected(false));
    return () => socketRef.current?.disconnect();
  }, [token]);

  return { socket: socketRef.current, connected };
};