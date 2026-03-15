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
      required: true,
      maxlength: 1000,
    },
    // Delivered = saved to DB, Seen = receiver opened the chat
    status: {
      type: String,
      enum: ["delivered", "seen"],
      default: "delivered",
    },
  },
  { timestamps: true } // createdAt used for sorting users by recent message
);

module.exports = mongoose.model("Message", messageSchema);