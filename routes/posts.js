const express = require("express")
const { client } = require("../config/db")
const { upload } = require("../config/upload")
const { ensureAuthenticated } = require("../middleware/auth")

const router = express.Router()

// Post to /posts/review
router.post(
    "/review",
    ensureAuthenticated,
    (req, res, next) => {
        upload.single("image")(req, res, (err) => {
            if (err) {
                return res.status(400).send(err.message)
            }

            next()
        })
    },
    async (req, res) => {
        try {
            const { cafeId, description, rating } = req.body

            if (!cafeId || !description || !rating) {
                return res.status(400).send("Cafe, description, and rating are required.")
            }

            const numericCafeId = Number(cafeId)
            const numericRating = Number(rating)

            if (!Number.isInteger(numericCafeId)) {
                return res.status(400).send("Invalid cafe.")
            }

            if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
                return res.status(400).send(
                    "Rating must be between 1 and 5."
                )
            } 

            // const imagePath = req.file ? `/uploads/$(req.file.filename)` : null
           
            const imagePath = req.file ? `/uploads/${req.file.filename}` : null

            await client.query(
                `INSERT INTO posts
                    (cafe_id, user_id, image, description, rating)
                VALUES($1, $2, $3, $4, $5)`,
                [
                    numericCafeId,
                    req.user.uid,
                    imagePath,
                    description.trim(),
                    numericRating,
                ]
            )
            res.redirect("/profile")
        } catch (err) {
            console.error("create review post failed:", err.message)
            res.status(500).send("Couldn't create the review post.")
        }
    }
)

// Show the community review feed
router.get("/", async (req, res) => {
    try {
        const result = await client.query(
            `SELECT
                posts.pid,
                posts.image,
                posts.description,
                posts.rating,
                users.uid,
                users.uname,
                users.pfp,
                cafes.cid,
                cafes.cname
            FROM posts
            JOIN users
                ON posts.user_id = users.uid
            JOIN cafes
                ON posts.cafe_id = cafes.cid
            ORDER BY posts.pid DESC`
        )

        res.render("feed", {
            user: req.user || null,
            posts: result.rows, 
        })
    } catch(err) {
        console.error("failed to load community feed:", err.message)
        res.status(500).send("Could not load the community feed.")
    }
})

// Show the user profile (with both posts and owned cafes)
router.get("/profile", ensureAuthenticated, async (req, res) => {
    try {
        const userId = req.user.uid;

        // 1. Fetch user's posts
        const postsResult = await client.query(
            `SELECT posts.*, cafes.cname 
             FROM posts 
             JOIN cafes ON posts.cafe_id = cafes.cid 
             WHERE posts.user_id = $1 
             ORDER BY posts.pid DESC`,
            [userId]
        );

        // 2. Fetch cafes owned by this user
        const cafesResult = await client.query(
            `SELECT * FROM cafes WHERE owner_id = $1`,
            [userId]
        );

        // 3. Pass both userPosts and userCafes to profile.ejs
        res.render("profile", {
            user: req.user,
            userPosts: postsResult.rows,
            userCafes: cafesResult.rows
        });
    } catch (err) {
        console.error("failed to load profile:", err.message);
        res.status(500).send("Could not load profile.");
    }
});

module.exports = router