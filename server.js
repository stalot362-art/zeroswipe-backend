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

// ===== WAITING QUEUE (SOCKETS) =====
let waitingQueue = [];

// ===== SOCKET MATCHING =====
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // 🔥 FIND MATCH
  socket.on("find-match", (userId) => {
    console.log("Looking for match:", userId);

    // Ensure user exists
    if (!users[userId]) {
      users[userId] = { unmatched: 0, mustPay: false };
    }

    // Block if payment required
    if (users[userId].mustPay) {
      socket.emit("payment-required");
      return;
    }

    // If someone is waiting → match instantly
    if (waitingQueue.length > 0) {
      const partnerSocket = waitingQueue.shift();

      const roomId = "room_" + Date.now();

      socket.join(roomId);
      partnerSocket.join(roomId);

      console.log("MATCHED:", socket.id, "with", partnerSocket.id);

      socket.emit("match-found", { roomId });
      partnerSocket.emit("match-found", { roomId });

    } else {
      // Otherwise → wait
      waitingQueue.push(socket);
      socket.emit("waiting");

      console.log("Added to queue:", socket.id);
    }
  });

  // 🔥 WEBRTC SIGNALING
  socket.on("offer", ({ roomId, offer }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ roomId, answer }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ roomId, candidate }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  // 🔥 DISCONNECT
  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    // Remove from queue if waiting
    waitingQueue = waitingQueue.filter(s => s !== socket);
  });
});

// ===== UNMATCH =====
app.post("/unmatch", (req, res) => {
  const { userId } = req.body;

  if (!users[userId]) {
    users[userId] = { unmatched: 0, mustPay: false };
  }

  users[userId].unmatched += 1;
  users[userId].mustPay = true;

  res.json({
    message: "Unmatched. Pay $1 to continue."
  });
});

// ===== PAYMENT =====
app.post("/pay", async (req, res) => {
  const { userId, reference } = req.body;

  console.log("PAY:", userId, reference);

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
    console.log("PAY ERROR:", err.response?.data || err.message);

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
  console.log("Running on port", PORT);
});
