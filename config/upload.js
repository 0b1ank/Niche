// handles saving uploaded images for profile pics and cafe photos
const path = require("path")
const multer = require("multer")

const upload = multer({
  storage: multer.diskStorage({
    // put files in public/uploads so the browser can load them
    destination: (_req, _file, cb) =>
      cb(null, path.join(__dirname, "..", "public", "uploads")),
    filename: (_req, file, cb) => {
      // add a timestamp so two uploads with the same name dont clash
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
      cb(null, unique + path.extname(file.originalname))
    },
  }),
  fileFilter: (_req, file, cb) => {
    // only allow image files
    if (file.mimetype.startsWith("image/")) cb(null, true)
    else cb(new Error("Only image files are allowed"))
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
})

module.exports = { upload }
