const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Temporary memory storage for version 1
const users = {};
const activeMatches = {};
let waitingQueue = [];

// Health check
app.get("/", (req, res) => {
  res.send("Rindera backend running");
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // User joins with a basic userId
  socket.on("register-user", ({ userId, name }) => {
    users[userId] = {
      userId,
      name,
      socketId: socket.id,
      status: "online"
    };

    socket.userId = userId;

    console.log("Registered:", userId, name);
    socket.emit("registered", users[userId]);
  });

  // Find basic match
  socket.on("find-match", ({ userId }) => {
    if (!users[userId]) {
      socket.emit("error-message", "User not registered");
      return;
    }

    // Remove same user from queue first
    waitingQueue = waitingQueue.filter(id => id !== userId);

    const partnerId = waitingQueue.find(id => id !== userId);

    if (!partnerId) {
      waitingQueue.push(userId);
      users[userId].status = "waiting";
      socket.emit("waiting-for-match");
      return;
    }

    // Remove partner from queue
    waitingQueue = waitingQueue.filter(id => id !== partnerId);

    const matchId = "match_" + Date.now();

    activeMatches[matchId] = {
      matchId,
      users: [userId, partnerId],
      status: "matched",
      createdAt: new Date().toISOString()
    };

    users[userId].status = "matched";
    users[partnerId].status = "matched";

    const partnerSocketId = users[partnerId].socketId;

    socket.join(matchId);
    io.sockets.sockets.get(partnerSocketId)?.join(matchId);

    io.to(matchId).emit("match-found", activeMatches[matchId]);
  });

  // Request video date
  socket.on("request-video-date", ({ matchId, fromUserId }) => {
    const match = activeMatches[matchId];
    if (!match) return;

    socket.to(matchId).emit("video-date-request", {
      matchId,
      fromUserId
    });
  });

  // Accept video date
  socket.on("accept-video-date", ({ matchId }) => {
    const roomId = "video_" + matchId;

    io.to(matchId).emit("video-date-started", {
      matchId,
      roomId
    });
  });

  // Request game date
  socket.on("request-game-date", ({ matchId, fromUserId }) => {
    const match = activeMatches[matchId];
    if (!match) return;

    socket.to(matchId).emit("game-date-request", {
      matchId,
      fromUserId
    });
  });

  // Accept game date
  socket.on("accept-game-date", ({ matchId }) => {
    const gameSessionId = "game_" + matchId;

    io.to(matchId).emit("game-date-started", {
      matchId,
      gameSessionId
    });
  });

  // Request scheduled date
  socket.on("request-scheduled-date", ({ matchId, fromUserId, dateTime }) => {
    const match = activeMatches[matchId];
    if (!match) return;

    socket.to(matchId).emit("scheduled-date-request", {
      matchId,
      fromUserId,
      dateTime
    });
  });

  // Accept scheduled date
  socket.on("accept-scheduled-date", ({ matchId, dateTime }) => {
    const match = activeMatches[matchId];
    if (!match) return;

    match.scheduledDate = dateTime;
    match.status = "date_scheduled";

    io.to(matchId).emit("scheduled-date-confirmed", {
      matchId,
      dateTime
    });
  });

  // WebRTC signaling
  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    if (socket.userId && users[socket.userId]) {
      users[socket.userId].status = "offline";
    }

    waitingQueue = waitingQueue.filter(id => id !== socket.userId);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Rindera backend running on port", PORT);
});
