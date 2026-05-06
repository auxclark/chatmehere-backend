const express = require("express");
const router = express.Router();
const { protect: auth } = require("../middleware/auth");
const Post = require("../models/Post");
const { uploadFile } = require("../config/cloudinary");

// ── GET /api/posts — get all posts (feed) ──────────────────────
router.get("/", auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate("author", "firstName lastName avatar email")
      .populate("comments.author", "firstName lastName avatar")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(posts);
  } catch (err) {
    console.error("GET /api/posts error:", err);
    res.status(500).json({ message: "Failed to fetch posts" });
  }
});

// ── POST /api/posts — create a post ───────────────────────────
router.post("/", auth, uploadFile.single("media"), async (req, res) => {
  try {
    const { text } = req.body;

    if (!text?.trim() && !req.file) {
      return res.status(400).json({ message: "Post must have text or media" });
    }

    let mediaUrl = "";
    let mediaType = "";

    if (req.file) {
      mediaUrl = req.file.path; // Cloudinary URL
      mediaType = req.file.mimetype.startsWith("video/") ? "video" : "image";
    }

    const post = await Post.create({
      author: req.user._id,
      text: text?.trim() || "",
      mediaUrl,
      mediaType,
    });

    const populated = await Post.findById(post._id)
      .populate("author", "firstName lastName avatar email");

    res.status(201).json(populated);
  } catch (err) {
    console.error("POST /api/posts error:", err);
    res.status(500).json({ message: "Failed to create post", error: err.message });
  }
});

// ── POST /api/posts/:id/like — toggle like ────────────────────
router.post("/:id/like", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const userId = req.user._id.toString();
    const liked = post.likes.some(id => id.toString() === userId);

    if (liked) {
      post.likes = post.likes.filter(id => id.toString() !== userId);
    } else {
      post.likes.push(req.user._id);
    }
    await post.save();
    res.json({ likes: post.likes });
  } catch (err) {
    console.error("Like error:", err);
    res.status(500).json({ message: "Failed to toggle like" });
  }
});

// ── POST /api/posts/:id/comment — add comment ─────────────────
router.post("/:id/comment", auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Comment text required" });

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({ author: req.user._id, text: text.trim() });
    await post.save();

    const populated = await Post.findById(post._id)
      .populate("comments.author", "firstName lastName avatar");
    res.json({ comments: populated.comments });
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ message: "Failed to add comment" });
  }
});

// ── DELETE /api/posts/:id — delete own post ───────────────────
router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }
    await post.deleteOne();
    res.json({ message: "Post deleted" });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Failed to delete post" });
  }
});

module.exports = router;