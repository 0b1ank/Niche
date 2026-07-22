// cafe routes - only owners can add new cafes
const express = require("express")
const { client } = require("../config/db")
const { upload } = require("../config/upload")
const { ensureAuthenticated, ensureOwner } = require("../middleware/auth")

const router = express.Router()

// show the form to create a new cafe (owners only)
router.get("/new", ensureAuthenticated, ensureOwner, (req, res) => {
  res.render("createPost", { user: req.user })
})

// save the new cafe to the database
router.post("/", ensureAuthenticated, ensureOwner, (req, res, next) => {
  // handle the optional cafe image upload first
  upload.single("cafe_img")(req, res, (err) => {
    if (err) {
      return res.status(400).render("createPost", {
        user: req.user,
        cafes: [],
        error: err.message,
      })
    }
    next()
  })
}, async (req, res) => {
  try {
    const { cname, caddress, ccity, czip, cphonenum, cdescription } = req.body

    if (!cname) {
      return res.status(400).render("createPost", {
        user: req.user,
        cafes: [],
        error: "Cafe name is required",
      })
    }

    const cafeImg = req.file ? `/uploads/${req.file.filename}` : null

    // tie this cafe to whoever is logged in as the owner
    await client.query(
      `INSERT INTO cafes
        (owner_id, cname, caddress, ccity, czip, cphonenum, cdescription, cafe_img)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        req.user.uid,
        cname,
        caddress || null,
        ccity || null,
        czip || null,
        cphonenum || null,
        cdescription || null,
        cafeImg,
      ]
    )

    res.redirect("/")
  } catch (err) {
    console.error("create cafe failed:", err.message)
    res.status(500).render("create-cafe", {
      user: req.user,
      error: "Could not create cafe. Please try again.",
    })
  }
})

module.exports = router
