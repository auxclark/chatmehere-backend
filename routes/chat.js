const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const { protect } = require("../middleware/auth");
const { uploadFile } = require("../config/cloudinary");

// GET /api/chat/:userId — get messages, populate replyTo
router.get("/:userId", protect, async (req, res) => {
  try {
    const myId = req.user._id;
    const theirId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: theirId },
        { senderId: theirId, receiverId: myId },
      ],
    })
      .populate("senderId", "firstName lastName avatar")
      .populate({
        path: "replyTo",
        populate: { path: "senderId", select: "firstName lastName avatar" },
      })
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get messages" });
  }
});

// POST /api/chat/send — send text message (with optional replyTo)
router.post("/send", protect, async (req, res) => {
  try {
    const { receiverId, message, replyTo } = req.body;

    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    const newMessage = await Message.create({
      senderId: req.user._id,
      receiverId,
      message: message.trim(),
      replyTo: replyTo || null,
    });

    const populated = await Message.findById(newMessage._id)
      .populate("senderId", "firstName lastName avatar")
      .populate({
        path: "replyTo",
        populate: { path: "senderId", select: "firstName lastName avatar" },
      });

    res.status(201).json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send message" });
  }
});

// POST /api/chat/send-file — send file (with optional replyTo)
router.post("/send-file", protect, uploadFile.single("file"), async (req, res) => {
  try {
    const { receiverId, message, replyTo } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const mimeType = req.file.mimetype;
    let fileType = "document";
    if (mimeType.startsWith("image/")) fileType = "image";
    else if (mimeType.startsWith("video/")) fileType = "video";
    else if (mimeType.startsWith("audio/")) fileType = "audio";

    const newMessage = await Message.create({
      senderId: req.user._id,
      receiverId,
      message: message || "",
      fileUrl: req.file.path,
      fileType,
      fileName: req.file.originalname,
      replyTo: replyTo || null,
    });

    const populated = await Message.findById(newMessage._id)
      .populate("senderId", "firstName lastName avatar")
      .populate({
        path: "replyTo",
        populate: { path: "senderId", select: "firstName lastName avatar" },
      });

    res.status(201).json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send file" });
  }
});

// PUT /api/chat/react/:messageId — react to message
router.put("/react/:messageId", protect, async (req, res) => {
  try {
    const { emoji } = req.body;
    const userId = req.user._id.toString();
    const msg = await Message.findById(req.params.messageId);

    if (!msg) return res.status(404).json({ message: "Message not found" });

    if (msg.reactions.get(userId) === emoji) {
      msg.reactions.delete(userId);
    } else {
      msg.reactions.set(userId, emoji);
    }

    await msg.save();

    const populated = await Message.findById(msg._id)
      .populate("senderId", "firstName lastName avatar")
      .populate({
        path: "replyTo",
        populate: { path: "senderId", select: "firstName lastName avatar" },
      });

    res.json(populated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to react to message" });
  }
});

module.exports = router;