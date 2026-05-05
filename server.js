const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// ===== USERS =====
const users = {};

// ===== SOCKET =====
io.on("connection", (socket) => {
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
});

// ===== MATCH =====
app.post("/match", (req, res) => {
  const { userId } = req.body;

  if (!users[userId]) {
    users[userId] = { unmatched: 0, mustPay: false };
  }

  if (users[userId].mustPay) {
    return res.status(403).json({ error: "Payment required" });
  }

  const roomId = "room_" + Date.now();

  res.json({ message: "Match found", roomId });
});

// ===== UNMATCH =====
app.post("/unmatch", (req, res) => {
  const { userId } = req.body;

  if (!users[userId]) {
    users[userId] = { unmatched: 0, mustPay: false };
  }

  users[userId].unmatched += 1;
  users[userId].mustPay = true;

  res.json({ message: "Pay $1 to continue" });
});

// ===== PAYMENT =====
app.post("/pay", async (req, res) => {
  console.log("BODY:", req.body);

  const { userId, reference } = req.body;

  if (!reference) {
    return res.status(400).json({ error: "No reference provided" });
  }

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    const data = response.data.data;

    if (data.status === "success") {
      if (!users[userId]) {
        users[userId] = { unmatched: 0, mustPay: false };
      }

      users[userId].mustPay = false;

      console.log("USER UNLOCKED:", userId);

      return res.json({ message: "Payment verified" });
    }

    return res.status(400).json({ error: "Payment failed" });

  } catch (err) {
    console.log("ERROR:", err.response?.data || err.message);

    return res.status(500).json({
      error: "Server update failed"
    });
  }
});

// ===== ROOT =====
app.get("/", (req, res) => {
  res.send("ZeroSwipe backend running");
});

// ===== START =====
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
