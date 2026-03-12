const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nexuschat',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

let redisClient;
(async () => {
  redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  redisClient.on('error', (err) => console.log('Redis error:', err));
  await redisClient.connect();
  console.log('Redis connected');
})();

// Auth middleware for sockets
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET || 'nexussecret');
    next();
  } catch {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.username}`);

  socket.on('join_room', async (roomId) => {
    socket.join(`room:${roomId}`);
    await redisClient.sAdd(`room:${roomId}:online`, socket.user.username);
    io.to(`room:${roomId}`).emit('presence_update', {
      roomId,
      online: await redisClient.sMembers(`room:${roomId}:online`)
    });
  });

  socket.on('leave_room', async (roomId) => {
    socket.leave(`room:${roomId}`);
    await redisClient.sRem(`room:${roomId}:online`, socket.user.username);
    io.to(`room:${roomId}`).emit('presence_update', {
      roomId,
      online: await redisClient.sMembers(`room:${roomId}:online`)
    });
  });

  socket.on('send_message', async ({ roomId, content }) => {
    if (!content?.trim()) return;
    try {
      const userResult = await pool.query('SELECT id, username, avatar_color FROM users WHERE id=$1', [socket.user.id]);
      const user = userResult.rows[0];
      const msgResult = await pool.query(
        'INSERT INTO messages (room_id, user_id, content) VALUES ($1,$2,$3) RETURNING *',
        [roomId, user.id, content.trim()]
      );
      const message = { ...msgResult.rows[0], username: user.username, avatar_color: user.avatar_color };
      io.to(`room:${roomId}`).emit('new_message', message);
    } catch (err) {
      console.error('Message error:', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing', ({ roomId }) => {
    socket.to(`room:${roomId}`).emit('user_typing', { username: socket.user.username, roomId });
  });

  socket.on('stop_typing', ({ roomId }) => {
    socket.to(`room:${roomId}`).emit('user_stop_typing', { username: socket.user.username, roomId });
  });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.user.username}`);
    const keys = await redisClient.keys('room:*:online');
    for (const key of keys) {
      await redisClient.sRem(key, socket.user.username);
      const roomId = key.split(':')[1];
      const online = await redisClient.sMembers(key);
      io.to(`room:${roomId}`).emit('presence_update', { roomId, online });
    }
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'chat' }));

httpServer.listen(3002, () => console.log('Chat service on port 3002'));