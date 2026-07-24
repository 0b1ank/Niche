const express = require("express")
const { client } = require("../config/db")
const { upload } = require("../config/upload")
const { ensureAuthenticated } = require("../middleware/auth")

const router = express.Router()
// special feature
const { getUserLevel } = require('../utils/userLevel');

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
            //gets cafeId desc and rating
            const { cafeId, description, rating } = req.body
            //verifies the above is valid
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

            //inserts review into posts dB 
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

//Like or unlike a review post 
router.post("/:id/like", ensureAuthenticated, async (req, res) => {
    try {
        //get post and user id
        const postId = Number(req.params.id)
        const userId = req.user.uid

        //verify you got a valid post id number
        if(!Number.isInteger(postId)) {
            return res.status(400).send("Invalid post.")
        }

        //checks if a like already exists
        const existingLike = await client.query(
            `SELECT lid
            FROM likes
            WHERE post_id = $1
            AND user_id = $2
            `,
            [postId, userId]
        )

        // removes a like
        if(existingLike.rows.length > 0) {
            await client.query(
                `DELETE FROM likes
                WHERE post_id = $1
                AND user_id = $2`,
                [postId, userId]
            )
        } else {
            //adds a like
            await client.query(
                `INSERT INTO likes (post_id, user_id)
                VALUES ($1,$2)`,
                [postId,userId]
            )
        }
        
        res.redirect("/posts")
    } catch(err) {
        console.error("like failed:", err.message)
        res.status(500).send("Could not update like.")
    } 
})

// Show the community review feed
router.get("/", async (req, res) => {
    try {
        // gets search value in the search bar
        const search = (req.query.search || "").trim()

        //stores values that will replace placeholders in SQL
        const values = []
        //stores SQL conditions
        const conditions = []
        
        //checks if search value is there only look for a user if there was 
        if(search) {
            // add symbols to actually be able to search in usernames and add its condition
            values.push(`%${search}%`)
            conditions.push(`users.uname ILIKE $${values.length}`)
        }

        // gets current user (null if not logged in)
        const currentUserId = req.user ? req.user.uid : null
        // adds id for the SQL values array 
        values.push(currentUserId)
        
        //creates an SQL placeholder for the current users id
        const currentUserPlaceholder = `$${values.length}`

        // builds WHERE for SQL query
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""

        // run SQL and save result for the Db
        const result = await client.query(
            `SELECT
                posts.pid,
                posts.image,
                posts.description,
                posts.rating,
                posts.created_at,
                users.uid,
                users.uname,
                users.pfp,
                cafes.cid,
                cafes.cname,

                COUNT(likes.lid)::int AS like_count,

                EXISTS (
                    SELECT 1 
                    FROM likes user_likes
                    WHERE user_likes.post_id = posts.pid
                    AND user_likes.user_id = ${currentUserPlaceholder}
                ) AS liked_by_user
            FROM posts
            JOIN users
                ON posts.user_id = users.uid
            JOIN cafes
                ON posts.cafe_id = cafes.cid
            LEFT JOIN likes
                ON likes.post_id = posts.pid
            ${whereClause}
            GROUP BY
                posts.pid,
                posts.image,
                posts.description,
                posts.rating,
                posts.created_at,
                users.uid,
                users.uname,
                users.pfp,
                cafes.cid,
                cafes.cname
            ORDER BY posts.pid DESC`,
            values
        )

        res.render("feed", {
            user: req.user || null,
            posts: result.rows, 
            search,
        })
    } catch(err) {
        console.error("failed to load community feed:", err.message)
        res.status(500).send("Could not load the community feed.")
    }
})

// // Show the user profile (with both posts and owned cafes)
// router.get("/profile", ensureAuthenticated, async (req, res) => {
//     try {
//         const userId = req.user.uid;

//         // 1. Fetch user's posts
//         const postsResult = await client.query(
//             `SELECT posts.*, cafes.cname 
//              FROM posts 
//              JOIN cafes ON posts.cafe_id = cafes.cid 
//              WHERE posts.user_id = $1 
//              ORDER BY posts.pid DESC`,
//             [userId]
//         );

//         // 2. Fetch cafes owned by this user
//         const cafesResult = await client.query(
//             `SELECT * FROM cafes WHERE owner_id = $1`,
//             [userId]
//         );

//         // 3. Pass both userPosts and userCafes to profile.ejs
//         res.render("profile", {
//             user: req.user,
//             userPosts: postsResult.rows,
//             userCafes: cafesResult.rows
//         });
//     } catch (err) {
//         console.error("failed to load profile:", err.message);
//         res.status(500).send("Could not load profile.");
//     }
// });

// Show the user profile (with posts, owned cafes, and dynamic level badge)
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

        // 3. Calculate level badge based on total review post count
        const postCount = postsResult.rows.length;
        const userBadge = getUserLevel(postCount);

        // 4. Pass userPosts, userCafes, and userBadge to profile.ejs
        res.render("profile", {
            user: req.user,
            userPosts: postsResult.rows,
            userCafes: cafesResult.rows,
            userBadge: userBadge
        });
    } catch (err) {
        console.error("failed to load profile:", err.message);
        res.status(500).send("Could not load profile.");
    }
});

module.exports = router