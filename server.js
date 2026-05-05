const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");

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

  // 🚨 Block if payment required
  if (users[userId].mustPay) {
    return res.status(403).json({
      error: "Payment required before next match",
    });
  }

  // ✅ Temporary match system
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

// ================= PAY (SECURE VERIFICATION) =================
app.post("/pay", async (req, res) => {
  const { userId, reference } = req.body;

  if (!userId || !reference) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = response.data;

    if (data.data.status === "success") {
      if (!users[userId]) {
        users[userId] = { unmatched: 0, mustPay: false };
      }

      // ✅ Unlock user after real payment
      users[userId].mustPay = false;

      return res.json({
        message: "Payment verified. You can match again.",
      });
    } else {
      return res.status(400).json({
        error: "Payment not successful",
      });
    }
  } catch (error) {
    console.error(error.message);

    return res.status(500).json({
      error: "Payment verification failed",
    });
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
