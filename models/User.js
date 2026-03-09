const mongoose = require("mongoose");

// Replaces chatapp.sql users table:
// unique_id  → _id (MongoDB auto)
// fname      → firstName
// lname      → lastName
// email      → email
// password   → password (bcrypt hashed, NOT md5)
// img        → avatar (Cloudinary URL)
// status     → status

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    avatar: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active now", "Offline now"],
      default: "Offline now",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
