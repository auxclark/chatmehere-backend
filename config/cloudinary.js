const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for chat files — images, videos, documents
const chatStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    let folder = "chatmehere/files";
    let resource_type = "auto"; // auto-detect image/video/raw

    if (file.mimetype.startsWith("image/")) {
      folder = "chatmehere/images";
    } else if (file.mimetype.startsWith("video/")) {
      folder = "chatmehere/videos";
    }

    return {
      folder,
      resource_type,
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "pdf", "doc", "docx", "txt", "zip"],
    };
  },
});

// Storage for avatars
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "chatmehere/avatars",
    allowed_formats: ["jpg", "jpeg", "png"],
    transformation: [{ width: 200, height: 200, crop: "fill" }],
  },
});

const upload = multer({ storage: avatarStorage });
const uploadFile = multer({
  storage: chatStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

module.exports = { cloudinary, upload, uploadFile };