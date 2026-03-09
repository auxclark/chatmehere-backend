const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { upload } = require("../config/cloudinary");
const { protect } = require("../middleware/auth");

// Helper: generate JWT token (replaces $_SESSION['unique_id'])
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// ─────────────────────────────────────────────
// POST /api/auth/signup
// Replaces: php/signup.php
// Changes:  md5() → bcrypt | rand() → MongoDB _id | move_uploaded_file → Cloudinary
// ─────────────────────────────────────────────
router.post("/signup", upload.single("image"), async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Replaces: if(!empty($fname) && !empty($lname) && !empty($email) && !empty($password))
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All input fields are required!" });
    }

    // Replaces: filter_var($email, FILTER_VALIDATE_EMAIL)
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: `${email} is not a valid email!` });
    }

    // Replaces: SELECT * FROM users WHERE email = '{$email}'  → mysqli_num_rows > 0
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: `${email} - This email already exists!` });
    }

    // Replaces: move_uploaded_file($tmp_name, "images/".$new_img_name)
    if (!req.file) {
      return res.status(400).json({ message: "Please upload a profile image (jpeg, png, jpg)" });
    }
    const avatarUrl = req.file.path; // Cloudinary URL

    // Replaces: $encrypt_pass = md5($password)  ← md5 is insecure, using bcrypt instead
    const hashedPassword = await bcrypt.hash(password, 12);

    // Replaces: INSERT INTO users (unique_id, fname, lname, email, password, img, status)
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      avatar: avatarUrl,
      status: "Active now",
    });

    // Replaces: $_SESSION['unique_id'] = $result['unique_id']; echo "success";
    res.status(201).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again!" });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// Replaces: php/login.php
// Changes:  md5 compare → bcrypt.compare | $_SESSION → JWT
// ─────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Replaces: if(!empty($email) && !empty($password))
    if (!email || !password) {
      return res.status(400).json({ message: "All input fields are required!" });
    }

    // Replaces: SELECT * FROM users WHERE email = '{$email}'
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ message: `${email} - This email does not exist!` });
    }

    // Replaces: $user_pass = md5($password); if($user_pass === $enc_pass)
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Email or Password is Incorrect!" });
    }

    // Replaces: UPDATE users SET status = 'Active now' WHERE unique_id = ...
    user.status = "Active now";
    await user.save();

    // Replaces: $_SESSION['unique_id'] = $row['unique_id']; echo "success";
    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again!" });
  }
});

// ─────────────────────────────────────────────
// POST /api/auth/logout
// Replaces: php/logout.php
// Changes:  session_destroy() → frontend clears JWT | still updates status to Offline
// ─────────────────────────────────────────────
router.post("/logout", protect, async (req, res) => {
  try {
    // Replaces: UPDATE users SET status = 'Offline now' WHERE unique_id = ...
    await User.findByIdAndUpdate(req.user._id, { status: "Offline now" });

    // Replaces: session_unset(); session_destroy(); header("location: login.php");
    // JWT is stateless — frontend removes token from localStorage
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong. Please try again!" });
  }
});

// GET /api/auth/me  — get current logged-in user
router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  res.json(user);
});

module.exports = router;
