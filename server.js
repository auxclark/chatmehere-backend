require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const Message = require("./models/Message");

const authRoutes  = require("./routes/auth");
const chatRoutes  = require("./routes/chat");
const userRoutes  = require("./routes/users");
const adminRoutes = require("./routes/admin");
const postRoutes  = require("./routes/posts");

connectDB();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => { req.io = io; next(); });

app.use("/api/auth",  authRoutes);
app.use("/api/chat",  chatRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/posts", postRoutes);
app.get("/", (req, res) => res.send("ChatMeHere API is running"));

// Track online users: userId → socketId
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // ── Online status ────────────────────────────────────────────────────
  socket.on("user_online", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });

  socket.on("join_room", (roomId) => {
    socket.join(roomId);
  });

  // ── Chat messaging ───────────────────────────────────────────────────
  socket.on("send_message", (data) => {
    socket.to(data.roomId).emit("receive_message", data.message);
  });

  socket.on("mark_seen", async ({ roomId, userId }) => {
    try {
      await Message.updateMany(
        { status: "delivered", receiverId: userId },
        { status: "seen" }
      );
      io.to(roomId).emit("messages_seen", { by: userId });
    } catch (err) { console.error("mark_seen error:", err); }
  });

  socket.on("reaction_update", (data) => {
    socket.to(data.roomId).emit("reaction_updated", data.message);
  });

  socket.on("typing", (data) => {
    socket.to(data.roomId).emit("user_typing", data.userId);
  });

  socket.on("stop_typing", (data) => {
    socket.to(data.roomId).emit("user_stop_typing", data.userId);
  });

  // ── WebRTC Video/Voice Call Signaling ────────────────────────────────
  // These events just relay signals between two users.
  // The actual video/audio goes directly peer-to-peer (not through server).

  // Step 1: Caller initiates a call to a specific user
  socket.on("call_offer", ({ to, offer, callType, callerInfo }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      // Tell the receiver someone is calling them
      io.to(targetSocketId).emit("incoming_call", {
        from: callerInfo,       // caller's user info { _id, firstName, lastName, avatar }
        offer,                  // WebRTC offer
        callType,               // "video" or "audio"
      });
    } else {
      // Target user is offline — notify caller
      socket.emit("call_unavailable", { message: "User is not available" });
    }
  });

  // Step 2: Receiver accepts and sends back an answer
  socket.on("call_answer", ({ to, answer }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call_answered", { answer });
    }
  });

  // Step 3: Either user sends ICE candidates to establish best connection
  socket.on("ice_candidate", ({ to, candidate }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("ice_candidate", { candidate });
    }
  });

  // Step 4a: Receiver declines the call
  socket.on("call_rejected", ({ to }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call_rejected");
    }
  });

  // Step 4b: Either user ends the call
  socket.on("call_ended", ({ to }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call_ended");
    }
  });

  // Step 4c: Call not answered (timeout)
  socket.on("call_missed", ({ to }) => {
    const targetSocketId = onlineUsers.get(to);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call_missed");
    }
  });

  // ── Disconnect ───────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    // If user was in a call, notify the other person
    onlineUsers.forEach((socketId, userId) => {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        // Notify everyone this user went offline (could end ongoing call)
        io.emit("user_offline", userId);
      }
    });
    io.emit("online_users", Array.from(onlineUsers.keys()));
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));