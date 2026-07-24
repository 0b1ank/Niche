// cafe routes - only owners can add new cafes
const express = require("express")
const { client } = require("../config/db")
const { upload } = require("../config/upload")
const { ensureAuthenticated, ensureOwner } = require("../middleware/auth")
const { similarToCafe } = require("../services/recommend")

const router = express.Router()

// show the form to create a new cafe (owners only)
// keep this ABOVE /:id so "new" doesn't get treated like a cafe id
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
    res.status(500).render("createPost", {
      user: req.user,
      error: "Could not create cafe. Please try again.",
    })
  }
})

// show one cafe's detail page + similar cafes (Airbnb-style)
// anyone can view this, logged in or not
router.get("/:id", async (req, res) => {
  try {
    const cafeId = Number(req.params.id)

    // make sure the id in the url is actually a number
    if (!Number.isInteger(cafeId)) {
      return res.status(400).send("Invalid cafe id.")
    }

    // 1) load the cafe itself + average rating + how many reviews it has
    const cafeResult = await client.query(
      `SELECT c.*,
              COALESCE(AVG(p.rating), 0) AS avg_rating,
              COUNT(p.pid)::int AS review_count
       FROM cafes c
       LEFT JOIN posts p ON p.cafe_id = c.cid
       WHERE c.cid = $1
       GROUP BY c.cid`,
      [cafeId]
    )

    // if that cafe id doesn't exist, show a 404
    if (!cafeResult.rows.length) {
      return res.status(404).send("Cafe not found.")
    }

    const cafe = cafeResult.rows[0]
    cafe.avg_rating = Number(cafe.avg_rating)
    cafe.review_count = Number(cafe.review_count)

    // 2) load the tags for this cafe (wifi, study, patio, etc.)
    const tagsResult = await client.query(
      `SELECT t.tname
       FROM cafe_tags ct
       JOIN tags t ON t.tid = ct.tag_id
       WHERE ct.cafe_id = $1
       ORDER BY t.tname`,
      [cafeId]
    )
    const tags = tagsResult.rows.map((row) => row.tname)

    // 3) load reviews so people can see what others thought
    const reviewsResult = await client.query(
      `SELECT p.pid, p.image, p.description, p.rating,
              u.uid, u.uname, u.pfp
       FROM posts p
       JOIN users u ON u.uid = p.user_id
       WHERE p.cafe_id = $1
       ORDER BY p.pid DESC`,
      [cafeId]
    )

    // 4) ask the recommendation system for cafes like this one
    // if they're logged in, personal taste can nudge the similar list a bit
    const similar = await similarToCafe(cafeId, {
      userId: req.user ? req.user.uid : null,
      limit: 6,
    })

    // 5) send everything into the ejs page
    res.render("cafe-details", {
      user: req.user || null,
      cafe,
      tags,
      reviews: reviewsResult.rows,
      similar,
    })
  } catch (err) {
    console.error("load cafe details failed:", err.message)
    res.status(500).send("Could not load cafe details.")
  }
})

module.exports = router
