const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      default: "",
      maxlength: 1000,
    },
    // File/image attachment
    fileUrl:  { type: String, default: null },
    fileType: { type: String, default: null },
    fileName: { type: String, default: null },

    // Reply to another message
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // Emoji reactions: { userId: emoji }
    reactions: {
      type: Map,
      of: String,
      default: {},
    },

    status: {
      type: String,
      enum: ["delivered", "seen"],
      default: "delivered",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);