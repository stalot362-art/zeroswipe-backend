const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ================= HTTP SERVER =================
const server = http.createServer(app);

// ================= SOCKET.IO =================
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);

    socket.to(roomId).emit("user-joined");

    socket.on("offer", (offer) => {
      socket.to(roomId).emit("offer", offer);
    });

    socket.on("answer", (answer) => {
      socket.to(roomId).emit("answer", answer);
    });

    socket.on("ice-candidate", (candidate) => {
      socket.to(roomId).emit("ice-candidate", candidate);
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// ================= USER STORAGE =================
const users = {};

// ================= ROUTES =================

// Health check
app.get("/", (req, res) => {
  res.send("ZeroSwipe backend running");
});

// ================= MATCH =================
app.post("/match", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  if (!users[userId]) {
    users[userId] = {
      unmatched: 0,
      mustPay: false,
    };
  }

  // 🚨 BLOCK if user must pay
  if (users[userId].mustPay) {
    return res.status(403).json({
      error: "Payment required before next match",
    });
  }

  // ✅ Always match (test mode)
  const matchId = "room_" + Date.now();

  return res.json({
    matchId,
    partner: "demo_user",
  });
});

// ================= UNMATCH =================
app.post("/unmatch", (req, res) => {
  const { userId } = req.body;

  if (!users[userId]) {
    users[userId] = {
      unmatched: 0,
      mustPay: false,
    };
  }

  users[userId].unmatched += 1;
  users[userId].mustPay = true;

  return res.json({
    message: "You unmatched. Pay $1 to continue.",
  });
});

// ================= PAY =================
app.post("/pay", (req, res) => {
  const { userId } = req.body;

  if (!users[userId]) {
    return res.status(400).json({ error: "User not found" });
  }

  users[userId].mustPay = false;

  return res.json({
    message: "Payment successful. You can match again.",
  });
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
