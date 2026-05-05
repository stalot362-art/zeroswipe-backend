const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// ================= MOCK DATABASE =================
let users = [];
let matches = [];

// ================= CREATE USER =================
app.post('/create-user', (req, res) => {
  const { userId } = req.body;

  const user = {
    userId,
    matches: 0,
    unmatches: 0,
    paid: true // first match free
  };

  users.push(user);
  res.json(user);
});

// ================= MATCH =================
app.post('/match', (req, res) => {
  const { userId } = req.body;

  const user = users.find(u => u.userId === userId);

  if (!user) return res.status(404).json({ error: 'User not found' });

  // payment enforcement
  if (!user.paid) {
    return res.status(402).json({ message: 'Payment required' });
  }

  const match = {
    id: Date.now().toString(),
    users: [userId]
  };

  matches.push(match);

  user.matches += 1;
  user.paid = false;

  res.json({ match });
});

// ================= UNMATCH =================
app.post('/unmatch', (req, res) => {
  const { userId } = req.body;

  const user = users.find(u => u.userId === userId);

  user.unmatches += 1;

  // each unmatch costs $1
  user.paid = false;

  res.json({ message: 'Unmatched. Payment required for next match.' });
});

// ================= PAY =================
app.post('/pay', (req, res) => {
  const { userId } = req.body;

  const user = users.find(u => u.userId === userId);

  // simulate payment success
  user.paid = true;

  res.json({
    message: 'Payment successful'
  });
});

// ================= VIDEO SIGNALING =================
io.on('connection', socket => {
  console.log('User connected');

  socket.on('join-room', roomId => {
    socket.join(roomId);
  });

  socket.on('offer', data => {
    socket.to(data.roomId).emit('offer', data);
  });

  socket.on('answer', data => {
    socket.to(data.roomId).emit('answer', data);
  });

  socket.on('ice-candidate', data => {
    socket.to(data.roomId).emit('ice-candidate', data);
  });
});

// ================= START SERVER =================
const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
