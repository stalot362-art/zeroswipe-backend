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

// ================= SOCKET =================
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

// ================= USERS =================
const users = {};

// ================= MATCH =================
app.post("/match", (req, res) => {
  const { userId } = req.body;

  if (!users[userId]) {
    users[userId] = { unmatched: 0, mustPay: false };
  }

  if (users[userId].mustPay) {
    return res.status(403).json({
      error: "Payment required before next match"
    });
  }

  res.json({
    matchId: "room_" + Date.now()
  });
});

// ================= UNMATCH =================
app.post("/unmatch", (req, res) => {
  const { userId } = req.body;

  if (!users[userId]) {
    users[userId] = { unmatched: 0, mustPay: false };
  }

  users[userId].unmatched += 1;
  users[userId].mustPay = true;

  res.json({ message: "Unmatched" });
});

// ================= PAYMENT =================
app.post("/pay", async (req, res) => {
  const { userId, reference } = req.body;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    if (response.data.data.status === "success") {
      users[userId].mustPay = false;

      return res.json({
        message: "Payment verified"
      });
    } else {
      return res.status(400).json({
        error: "Payment failed"
      });
    }
  } catch (err) {
    return res.status(500).json({
      error: "Verification error"
    });
  }
});

// ================= START =================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running");
});
