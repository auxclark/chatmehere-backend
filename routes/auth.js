const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { upload } = require("../config/cloudinary");
const { protect } = require("../middleware/auth");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password)
      return res.status(400).json({ message: "All input fields are required!" });

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email))
      return res.status(400).json({ message: `${email} is not a valid email!` });

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser)
      return res.status(400).json({ message: `${email} - This email already exists!` });

    const avatarUrl = `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=89253E&color=fff&size=200`;
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      firstName, lastName,
      email: email.toLowerCase(),
      password: hashedPassword,
      avatar: avatarUrl,
      status: "Active now",
    });

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

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "All input fields are required!" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(400).json({ message: `${email} - This email does not exist!` });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Email or Password is Incorrect!" });

    user.status = "Active now";
    await user.save();

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

// POST /api/auth/logout
router.post("/logout", protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { status: "Offline now" });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong. Please try again!" });
  }
});

// GET /api/auth/me
router.get("/me", protect, async (req, res) => {
  const user = await User.findById(req.user._id).select("-password");
  res.json(user);
});

// PUT /api/auth/name — update first and last name
router.put("/name", protect, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName)
      return res.status(400).json({ message: "First and last name are required." });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { firstName: firstName.trim(), lastName: lastName.trim() },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update name. Please try again." });
  }
});

// PUT /api/auth/avatar — upload profile photo
router.put("/avatar", protect, upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "Please upload an image file." });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: req.file.path },
      { new: true }
    ).select("-password");

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong. Please try again!" });
  }
});

module.exports = router;