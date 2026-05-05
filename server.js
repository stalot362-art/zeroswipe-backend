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

// ================= DEBUG =================
console.log("Server starting...");
console.log("User store initialized");

// ================= IN-MEMORY STORE =================
const users = {};

// ================= SOCKET (VIDEO CALL) =================
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

// ================= MATCH =================
app.post("/match", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  // Create user if not exists
  if (!users[userId]) {
    users[userId] = {
      unmatched: 0,
      mustPay: false
    };
  }

  // Block if payment required
  if (users[userId].mustPay) {
    return res.status(403).json({
      error: "Payment required before next match"
    });
  }

  const roomId = "room_" + Date.now();

  res.json({
    message: "Match found",
    roomId
  });
});

// ================= UNMATCH =================
app.post("/unmatch", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  if (!users[userId]) {
    users[userId] = {
      unmatched: 0,
      mustPay: false
    };
  }

  users[userId].unmatched += 1;
  users[userId].mustPay = true;

  console.log(`User ${userId} unmatched. Payment now required.`);

  res.json({
    message: "Unmatched successfully. Payment required for next match."
  });
});

// ================= PAYMENT VERIFY =================
app.post("/pay", async (req, res) => {
  const { userId, reference } = req.body;

  console.log("PAY REQUEST:", { userId, reference });

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    console.log("PAYSTACK RESPONSE:", JSON.stringify(response.data));

    const data = response.data?.data;

    if (!data) {
      throw new Error("No data from Paystack");
    }

    if (data.status === "success") {

      if (!users[userId]) {
        users[userId] = {
          unmatched: 0,
          mustPay: false
        };
      }

      users[userId].mustPay = false;

      console.log("USER UNLOCKED:", userId);

      return res.json({
        message: "Payment verified and unlocked"
      });

    } else {
      return res.status(400).json({
        error: "Payment not successful"
      });
    }

  } catch (err) {
    console.error("FULL PAYMENT ERROR:");
    console.error(err.response?.data || err.message || err);

    return res.status(500).json({
      error: "Server update failed"
    });
  }
});

// ================= HEALTH CHECK =================
app.get("/", (req, res) => {
  res.send("ZeroSwipe backend running");
});

// ================= START SERVER =================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
