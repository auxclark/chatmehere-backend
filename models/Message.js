const mongoose = require("mongoose");

// Replaces chatapp.sql messages table:
// msg_id          → _id (MongoDB auto)
// incoming_msg_id → receiverId (ref to User)
// outgoing_msg_id → senderId (ref to User)
// msg             → message

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
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
