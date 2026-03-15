require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const Message = require("./models/Message");

const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const userRoutes = require("./routes/users");
const adminRoutes = require("./routes/admin");

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

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.get("/", (req, res) => res.send("ChatMeHere API is running"));

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("user_online", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });

  socket.on("join_room", (roomId) => {
    socket.join(roomId);
  });

  //added new socket
    socket.on("reaction_update", (data) => {
    socket.to(data.roomId).emit("reaction_updated", data.message);
  });

  // Send message to room — receiver gets it, sender already added it optimistically
  socket.on("send_message", (data) => {
    // Emit to everyone in the room EXCEPT the sender
    socket.to(data.roomId).emit("receive_message", data.message);
  });

  // Mark messages as seen — when receiver opens the chat
  socket.on("mark_seen", async ({ roomId, userId }) => {
    try {
      // Update all delivered messages in this room that were sent TO this user
      await Message.updateMany(
        {
          status: "delivered",
          receiverId: userId,
        },
        { status: "seen" }
      );

      // Notify the sender that their messages have been seen
      io.to(roomId).emit("messages_seen", { by: userId });
    } catch (err) {
      console.error("mark_seen error:", err);
    }
  });

  socket.on("typing", (data) => {
    socket.to(data.roomId).emit("user_typing", data.userId);
  });

  socket.on("stop_typing", (data) => {
    socket.to(data.roomId).emit("user_stop_typing", data.userId);
  });

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