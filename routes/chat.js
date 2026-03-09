const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const { protect } = require("../middleware/auth");

// ─────────────────────────────────────────────
// GET /api/chat/:userId
// Replaces: php/get-chat.php
// Changes:  SQL JOIN → Mongoose .populate() | returns JSON not HTML
// Original SQL:
//   SELECT * FROM messages LEFT JOIN users ON users.unique_id = messages.outgoing_msg_id
//   WHERE (outgoing_msg_id = $outgoing_id AND incoming_msg_id = $incoming_id)
//   OR    (outgoing_msg_id = $incoming_id AND incoming_msg_id = $outgoing_id)
//   ORDER BY msg_id
// ─────────────────────────────────────────────
router.get("/:userId", protect, async (req, res) => {
  try {
    const myId = req.user._id;
    const theirId = req.params.userId;

    // Replaces the big SQL JOIN query above
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: theirId },
        { senderId: theirId, receiverId: myId },
      ],
    })
      .populate("senderId", "firstName lastName avatar")
      .sort({ createdAt: 1 }); // ORDER BY msg_id ASC

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get messages" });
  }
});

// ─────────────────────────────────────────────
// POST /api/chat/send
// Replaces: php/insert-chat.php
// Changes:  SQL INSERT → mongoose .create() | Socket.io emits after save
// Original SQL:
//   INSERT INTO messages (incoming_msg_id, outgoing_msg_id, msg)
//   VALUES ($incoming_id, $outgoing_id, '$message')
// ─────────────────────────────────────────────
router.post("/send", protect, async (req, res) => {
  try {
    const { receiverId, message } = req.body;

    // Replaces: if(!empty($message))
    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    // Replaces: INSERT INTO messages (incoming_msg_id, outgoing_msg_id, msg)
    const newMessage = await Message.create({
      senderId: req.user._id,
      receiverId,
      message: message.trim(),
    });

    // Populate sender info for the response (for Socket.io broadcast)
    const populated = await newMessage.populate("senderId", "firstName lastName avatar");

    // Socket.io emit is handled in server.js — we attach io to req via middleware
    // This returns the saved message so frontend can update optimistically
    res.status(201).json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

module.exports = router;
