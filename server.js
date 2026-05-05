const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 Create HTTP server
const server = http.createServer(app);

// 🔥 Attach socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// ================= SOCKET =================
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);

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

// ================= API =================
app.get("/", (req, res) => {
  res.send("ZeroSwipe backend running");
});
let waitingUser = null;

app.post("/match", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId required" });
  }

  // ✅ If someone is waiting → match them FIRST
  if (waitingUser && waitingUser !== userId) {
    const partner = waitingUser;
    waitingUser = null;

    const matchId = "room_" + Date.now();

    return res.json({
      matchId,
      partner,
    });
  }

  // ✅ Otherwise → store this user
  waitingUser = userId;

  return res.json({
    message: "Waiting for a match...",
  });
});


// ⚠️ IMPORTANT: use server.listen NOT app.listen
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
