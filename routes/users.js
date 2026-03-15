const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Message = require("../models/Message");
const { protect } = require("../middleware/auth");

// GET /api/users — get all users sorted by most recent message (messenger style)
router.get("/", protect, async (req, res) => {
  try {
    const myId = req.user._id;

    const users = await User.find({ _id: { $ne: myId } }).select("-password");

    const usersWithLastMsg = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: myId, receiverId: user._id },
            { senderId: user._id, receiverId: myId },
          ],
        }).sort({ createdAt: -1 }); // most recent first

        let msgPreview = "No message available";
        let isMine = false;
        let lastMessageTime = null;

        if (lastMessage) {
          msgPreview =
            lastMessage.message.length > 28
              ? lastMessage.message.substring(0, 28) + "..."
              : lastMessage.message;
          isMine = lastMessage.senderId.toString() === myId.toString();
          lastMessageTime = lastMessage.createdAt;
        }

        return {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          status: user.status,
          lastMessage: msgPreview,
          lastMessageIsYours: isMine,
          lastMessageTime, // used for sorting
        };
      })
    );

    // Sort: users with messages first (newest at top), then users with no messages
    usersWithLastMsg.sort((a, b) => {
      if (!a.lastMessageTime && !b.lastMessageTime) return 0;
      if (!a.lastMessageTime) return 1;  // no message → push to bottom
      if (!b.lastMessageTime) return -1; // no message → push to bottom
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime); // newest first
    });

    res.json(usersWithLastMsg);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get users" });
  }
});

// GET /api/users/search?q=term
router.get("/search", protect, async (req, res) => {
  try {
    const { q } = req.query;
    const myId = req.user._id;

    if (!q || q.trim() === "") return res.json([]);

    const regex = new RegExp(q.trim(), "i");
    const users = await User.find({
      _id: { $ne: myId },
      $or: [{ firstName: regex }, { lastName: regex }],
    }).select("-password");

    if (users.length === 0) {
      return res.json({ message: "No user found related to your search term" });
    }

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Search failed" });
  }
});

// GET /api/users/:id
router.get("/:id", protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Failed to get user" });
  }
});

module.exports = router;