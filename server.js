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
  io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);

    // 🔥 Notify other user
    socket.to(roomId).emit("user-joined");

    // Offer
    socket.on("offer", (offer) => {
      socket.to(roomId).emit("offer", offer);
    });

    // Answer
    socket.on("answer", (answer) => {
      socket.to(roomId).emit("answer", answer);
    });

    // ICE Candidate
    socket.on("ice-candidate", (candidate) => {
      socket.to(roomId).emit("ice-candidate", candidate);
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});
});
