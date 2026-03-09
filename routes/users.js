const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Message = require("../models/Message");
const { protect } = require("../middleware/auth");

// ─────────────────────────────────────────────
// GET /api/users
// Replaces: php/users.php + data.php
// Changes:  SQL → Mongoose | HTML output → JSON | includes last message preview
// Original SQL:
//   SELECT * FROM users WHERE NOT unique_id = $outgoing_id ORDER BY user_id DESC
// ─────────────────────────────────────────────
router.get("/", protect, async (req, res) => {
  try {
    const myId = req.user._id;

    // Replaces: SELECT * FROM users WHERE NOT unique_id = $outgoing_id
    const users = await User.find({ _id: { $ne: myId } })
      .select("-password")
      .sort({ createdAt: -1 }); // ORDER BY user_id DESC

    // Replaces: data.php — gets last message for each user
    // Original SQL:
    //   SELECT * FROM messages WHERE
    //   (incoming_msg_id = $row['unique_id'] OR outgoing_msg_id = $row['unique_id'])
    //   AND (outgoing_msg_id = $outgoing_id OR incoming_msg_id = $outgoing_id)
    //   ORDER BY msg_id DESC LIMIT 1
    const usersWithLastMsg = await Promise.all(
      users.map(async (user) => {
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: myId, receiverId: user._id },
            { senderId: user._id, receiverId: myId },
          ],
        }).sort({ createdAt: -1 });

        // Replaces: (strlen($result) > 28) ? substr($result, 0, 28).'...' : $msg = $result
        let msgPreview = "No message available";
        let isMine = false;

        if (lastMessage) {
          msgPreview =
            lastMessage.message.length > 28
              ? lastMessage.message.substring(0, 28) + "..."
              : lastMessage.message;
          // Replaces: ($outgoing_id == $row2['outgoing_msg_id']) ? $you = "You: " : $you = ""
          isMine = lastMessage.senderId.toString() === myId.toString();
        }

        return {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          status: user.status,
          lastMessage: msgPreview,
          lastMessageIsYours: isMine,
        };
      })
    );

    res.json(usersWithLastMsg);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get users" });
  }
});

// ─────────────────────────────────────────────
// GET /api/users/search?q=term
// Replaces: php/search.php
// Changes:  SQL LIKE → MongoDB $regex | returns JSON not HTML
// Original SQL:
//   SELECT * FROM users WHERE NOT unique_id = $outgoing_id
//   AND (fname LIKE '%$searchTerm%' OR lname LIKE '%$searchTerm%')
// ─────────────────────────────────────────────
router.get("/search", protect, async (req, res) => {
  try {
    const { q } = req.query;
    const myId = req.user._id;

    if (!q || q.trim() === "") {
      return res.json([]);
    }

    // Replaces: fname LIKE '%$searchTerm%' OR lname LIKE '%$searchTerm%'
    const regex = new RegExp(q.trim(), "i"); // case-insensitive
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

// GET /api/users/:id — get a single user by ID (used in chat.php header)
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
