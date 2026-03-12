const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

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

const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      avatar_color VARCHAR(7) DEFAULT '#6366f1',
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      room_id INTEGER REFERENCES rooms(id),
      user_id INTEGER REFERENCES users(id),
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS room_members (
      room_id INTEGER REFERENCES rooms(id),
      user_id INTEGER REFERENCES users(id),
      joined_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (room_id, user_id)
    );
  `);
  await pool.query(`
    INSERT INTO rooms (name, description) VALUES
      ('general', 'General discussion for everyone'),
      ('engineering', 'Tech talk, PRs, and deployment chaos'),
      ('random', 'Memes, life, and everything else')
    ON CONFLICT (name) DO NOTHING;
  `);
};

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'nexussecret');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const colors = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, avatar_color) VALUES ($1,$2,$3,$4) RETURNING id, username, email, avatar_color',
      [username, email, hash, color]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'nexussecret', { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Username or email already taken' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET || 'nexussecret', { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar_color: user.avatar_color } });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rooms', auth, async (req, res) => {
  const result = await pool.query('SELECT * FROM rooms ORDER BY created_at ASC');
  res.json(result.rows);
});

app.post('/api/rooms', auth, async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO rooms (name, description, created_by) VALUES ($1,$2,$3) RETURNING *',
      [name.toLowerCase().replace(/\s+/g, '-'), description, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Room already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/rooms/:roomId/messages', auth, async (req, res) => {
  const result = await pool.query(
    `SELECT m.*, u.username, u.avatar_color 
     FROM messages m JOIN users u ON m.user_id = u.id 
     WHERE m.room_id=$1 ORDER BY m.created_at ASC LIMIT 100`,
    [req.params.roomId]
  );
  res.json(result.rows);
});

app.get('/api/rooms/:roomId/online', auth, async (req, res) => {
  try {
    const members = await redisClient.sMembers(`room:${req.params.roomId}:online`);
    res.json(members);
  } catch {
    res.json([]);
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'api' }));

const start = async () => {
  try {
    await initDB();
    console.log('DB initialized');
    app.listen(3001, () => console.log('API service on port 3001'));
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
};

start();