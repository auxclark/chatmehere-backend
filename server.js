require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");

// Routes
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const userRoutes = require("./routes/users");

// Connect to MongoDB Atlas (replaces mysqli_connect in config.php)
connectDB();

const app = express();
const server = http.createServer(app);

// Socket.io setup — replaces setInterval polling in chat.js and users.js
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach io to every request (used in chat route to emit after saving)
app.use((req, res, next) => {
  req.io = io;
  next();
});

// API Routes
// Replaces: php/login.php, php/signup.php, php/logout.php
app.use("/api/auth", authRoutes);
// Replaces: php/get-chat.php, php/insert-chat.php
app.use("/api/chat", chatRoutes);
// Replaces: php/users.php, php/search.php, data.php
app.use("/api/users", userRoutes);

app.get("/", (req, res) => res.send("ChatMeHere API is running"));

// ─────────────────────────────────────────────
// Socket.io Real-time Logic
// Replaces: setInterval() polling in chat.js (every 500ms)
// and:      setInterval() polling in users.js (every 500ms)
// Now:      Instant push — no polling needed
// ─────────────────────────────────────────────
const onlineUsers = new Map(); // userId → socketId

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // User comes online — replaces status = "Active now" only on login
  // Now updates in real-time whenever they open the app
  socket.on("user_online", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });

  // Join a private chat room
  // Replaces: incoming_id hidden input in chat.php form
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
  });

  // Send a message in real-time
  // Replaces: sendBtn.onclick → XHR POST to insert-chat.php
  //           + setInterval GET to get-chat.php
  socket.on("send_message", (data) => {
    // data: { roomId, message (saved message object from API) }
    io.to(data.roomId).emit("receive_message", data.message);
  });

  // Typing indicator (bonus feature - wasn't in original)
  socket.on("typing", (data) => {
    socket.to(data.roomId).emit("user_typing", data.userId);
  });

  socket.on("stop_typing", (data) => {
    socket.to(data.roomId).emit("user_stop_typing", data.userId);
  });

  // User goes offline
  // Replaces: php/logout.php → UPDATE users SET status = 'Offline now'
  socket.on("disconnect", () => {
    onlineUsers.forEach((socketId, userId) => {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
      }
    });
    io.emit("online_users", Array.from(onlineUsers.keys()));
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
