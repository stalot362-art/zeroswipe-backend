const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const users = {};
const activeMatches = {};
let waitingQueue = [];

app.get("/", (req, res) => {
  res.send("Rindera backend running");
});

io.on("connection", (socket) => {
  console.log("NEW SOCKET CONNECTION:", socket.id);

  socket.on("register-user", async ({ userId, name }) => {
    let finalUserId = userId;

    if (!finalUserId) {
      finalUserId = "user_" + Date.now();
    }

    await supabase.from("users").upsert({
      id: finalUserId,
      name
    });

    users[finalUserId] = {
      userId: finalUserId,
      name,
      socketId: socket.id,
      status: "online",
      currentMatchId: null
    };

    socket.userId = finalUserId;

    socket.emit("registered", users[finalUserId]);

    socket.emit("user-status-updated", {
      userId: finalUserId,
      status: "online",
      matchId: null
    });
  });

  socket.on("find-match", async ({ userId }) => {
    if (!users[userId]) {
      socket.emit("error-message", "User not registered");
      return;
    }

    waitingQueue = waitingQueue.filter(id => id !== userId);

    const partnerId = waitingQueue.find(id => id !== userId);

    if (!partnerId) {
      waitingQueue.push(userId);
      users[userId].status = "waiting";

      socket.emit("waiting-for-match");

      socket.emit("user-status-updated", {
        userId,
        status: "waiting"
      });

      return;
    }

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
    users[userId].currentMatchId = matchId;
    users[partnerId].currentMatchId = matchId;

    const partnerSocketId = users[partnerId].socketId;

    const { error } = await supabase.from("matches").insert({
      id: matchId,
      user1_id: userId,
      user2_id: partnerId,
      status: "matched",
      active: true
    });

    if (error) {
      console.log("MATCH SAVE ERROR:", error);
    } else {
      console.log("MATCH SAVED:", matchId);
    }

    socket.join(matchId);
    io.sockets.sockets.get(partnerSocketId)?.join(matchId);

    socket.emit("user-status-updated", {
      userId,
      status: "matched",
      matchId
    });

    io.to(partnerSocketId).emit("user-status-updated", {
      userId: partnerId,
      status: "matched",
      matchId
    });

    io.to(matchId).emit("match-found", activeMatches[matchId]);
  });

  socket.on("request-video-date", ({ matchId, fromUserId }) => {
    const match = activeMatches[matchId];
    if (!match) return;

    const receiverId = match.users.find(id => id !== fromUserId);
    const receiverSocketId = users[receiverId]?.socketId;

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("video-date-request", {
        matchId,
        fromUserId
      });
    }
  });

  socket.on("accept-video-date", ({ matchId }) => {
    const match = activeMatches[matchId];
    if (!match) return;

    const roomId = "video_" + matchId;

    match.users.forEach(userId => {
      const socketId = users[userId]?.socketId;

      if (socketId) {
        io.to(socketId).emit("video-date-started", {
          matchId,
          roomId
        });
      }
    });
  });

  socket.on("request-game-date", ({ matchId, fromUserId }) => {
    const match = activeMatches[matchId];
    if (!match) return;

    const receiverId = match.users.find(id => id !== fromUserId);
    const receiverSocketId = users[receiverId]?.socketId;

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("game-date-request", {
        matchId,
        fromUserId
      });
    }
  });

  socket.on("accept-game-date", ({ matchId }) => {
    const match = activeMatches[matchId];
    if (!match) return;

    const gameSessionId = "game_" + matchId;

    match.users.forEach(userId => {
      const socketId = users[userId]?.socketId;

      if (socketId) {
        io.to(socketId).emit("game-date-started", {
          matchId,
          gameSessionId
        });
      }
    });
  });

  socket.on("request-scheduled-date", ({ matchId, fromUserId, dateTime }) => {
    const match = activeMatches[matchId];
    if (!match) return;

    const receiverId = match.users.find(id => id !== fromUserId);
    const receiverSocketId = users[receiverId]?.socketId;

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("scheduled-date-request", {
        matchId,
        fromUserId,
        dateTime
      });
    }
  });

  socket.on("accept-scheduled-date", async ({ matchId, dateTime }) => {
    const match = activeMatches[matchId];
    if (!match) return;

    match.scheduledDate = dateTime;
    match.status = "date_scheduled";

    await supabase.from("scheduled_dates").insert({
      match_id: matchId,
      proposed_by: socket.userId,
      scheduled_time: dateTime,
      status: "confirmed"
    });

    match.users.forEach(userId => {
      const socketId = users[userId]?.socketId;

      if (socketId) {
        io.to(socketId).emit("scheduled-date-confirmed", {
          matchId,
          dateTime
        });
      }
    });
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
