const path = require("path")
const multer = require("multer")

// Shared image upload (profile pics, cafe images)
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) =>
      cb(null, path.join(__dirname, "..", "public", "uploads")),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
      cb(null, unique + path.extname(file.originalname))
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true)
    else cb(new Error("Only image files are allowed"))
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

module.exports = { upload }
