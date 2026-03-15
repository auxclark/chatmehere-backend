const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Message = require("../models/Message");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ─── Admin Auth Middleware ─────────────────────────────────────────────────
// Simple token-based admin auth — separate from user JWT
const adminAuth = (req, res, next) => {
  const token = req.headers["x-admin-token"];
  if (!token || token !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ message: "Unauthorized — admin access only" });
  }
  next();
};

// ─── STATS ────────────────────────────────────────────────────────────────

// GET /api/admin/stats — dashboard overview numbers
router.get("/stats", adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: "Active now" });
    const totalMessages = await Message.countDocuments();

    // New users today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });

    // New messages today
    const newMessagesToday = await Message.countDocuments({ createdAt: { $gte: today } });

    // Users registered per day for last 7 days
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const count = await User.countDocuments({
        createdAt: { $gte: date, $lt: nextDate },
      });
      last7Days.push({
        date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        users: count,
      });
    }

    // Messages per day for last 7 days
    const msgLast7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const count = await Message.countDocuments({
        createdAt: { $gte: date, $lt: nextDate },
      });
      msgLast7Days.push({
        date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        messages: count,
      });
    }

    res.json({
      totalUsers,
      activeUsers,
      totalMessages,
      newUsersToday,
      newMessagesToday,
      userGrowth: last7Days,
      messageActivity: msgLast7Days,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get stats" });
  }
});

// ─── USERS CRUD ───────────────────────────────────────────────────────────

// GET /api/admin/users — get all users with pagination + search
router.get("/users", adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const query = search
      ? {
          $or: [
            { firstName: new RegExp(search, "i") },
            { lastName: new RegExp(search, "i") },
            { email: new RegExp(search, "i") },
          ],
        }
      : {};

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ users, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: "Failed to get users" });
  }
});

// GET /api/admin/users/:id — single user
router.get("/users/:id", adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to get user" });
  }
});

// PUT /api/admin/users/:id — update user (name, email, status)
router.put("/users/:id", adminAuth, async (req, res) => {
  try {
    const { firstName, lastName, email, status, password } = req.body;
    const updateData = {};
    if (firstName) updateData.firstName = firstName.trim();
    if (lastName) updateData.lastName = lastName.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (status) updateData.status = status;
    if (password) updateData.password = await bcrypt.hash(password, 12);

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to update user" });
  }
});

// DELETE /api/admin/users/:id — delete user + their messages
router.delete("/users/:id", adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Delete all messages involving this user
    await Message.deleteMany({
      $or: [{ senderId: req.params.id }, { receiverId: req.params.id }],
    });

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: `User ${user.firstName} ${user.lastName} and their messages deleted` });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user" });
  }
});

// ─── MESSAGES CRUD ────────────────────────────────────────────────────────

// GET /api/admin/messages — all messages with pagination + search
router.get("/messages", adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = "", userId = "" } = req.query;

    let query = {};
    if (userId) {
      query = {
        $or: [{ senderId: userId }, { receiverId: userId }],
      };
    }
    if (search) {
      query.message = new RegExp(search, "i");
    }

    const total = await Message.countDocuments(query);
    const messages = await Message.find(query)
      .populate("senderId", "firstName lastName avatar email")
      .populate("receiverId", "firstName lastName avatar email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ messages, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: "Failed to get messages" });
  }
});

// DELETE /api/admin/messages/:id — delete single message
router.delete("/messages/:id", adminAuth, async (req, res) => {
  try {
    const msg = await Message.findByIdAndDelete(req.params.id);
    if (!msg) return res.status(404).json({ message: "Message not found" });
    res.json({ message: "Message deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete message" });
  }
});

// DELETE /api/admin/messages/bulk — delete multiple messages
router.post("/messages/bulk-delete", adminAuth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !ids.length) return res.status(400).json({ message: "No message IDs provided" });
    await Message.deleteMany({ _id: { $in: ids } });
    res.json({ message: `${ids.length} messages deleted` });
  } catch (err) {
    res.status(500).json({ message: "Failed to bulk delete messages" });
  }
});

// DELETE /api/admin/messages/user/:userId — delete all messages of a user
router.delete("/messages/user/:userId", adminAuth, async (req, res) => {
  try {
    const result = await Message.deleteMany({
      $or: [{ senderId: req.params.userId }, { receiverId: req.params.userId }],
    });
    res.json({ message: `${result.deletedCount} messages deleted` });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete user messages" });
  }
});

module.exports = router;