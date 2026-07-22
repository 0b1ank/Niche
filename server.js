// load env vars from .env file
require("dotenv").config()

// helps google login work better on mac
const dns = require("dns")
dns.setDefaultResultOrder("ipv4first")

const express = require("express")
const path = require("path")
const bcrypt = require("bcrypt")
const session = require("express-session")
const passport = require("./config/passport")
const { upload } = require("./config/upload")
const { client } = require("./config/db")
const { ensureAuthenticated } = require("./middleware/auth")
const cafesRouter = require("./routes/cafes")
const authRouter = require("./routes/auth")
const postsRouter = require("./routes/posts")
// ranks cafes for the home page based on the user's taste (or popularity for guests)
const { rankForUser } = require("./services/recommend")

const app = express()
const PORT = process.env.PORT || 3000

// parse json and form data from requests
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// serve css, images, and uploaded files from the public folder
app.use(express.static(path.join(__dirname, "public")))

app.use('/uploads', express.static('uploads'));

// session has to be set up before passport can use it
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
    })
)
app.use(passport.initialize())
app.use(passport.session())

app.set("view engine", "ejs")

// google login and finish-signup live under /auth
app.use("/auth", authRouter)
// owners create cafes through /cafes
app.use("/cafes", cafesRouter)
// users create review posts through /posts
app.use("/posts", postsRouter)

// Home page: shows recommended cafes (accessible to everyone)
// logged in users get a list ranked by their ratings/favorites/tags
// guests get a popularity-based ranking instead
app.get("/", async (req, res) => {
    try {
        // optional city filter from the url, ex: /?city=Riverside
        // if it's missing, rankForUser looks at every cafe
        const city =
            req.query.city && req.query.city !== "all"
                ? req.query.city
                : null

        // rankForUser mixes content + collaborative + personal scores
        // req.user is set by passport when someone is logged in
        // if nobody is logged in, pass null so it falls back to popularity
        const cafes = await rankForUser(req.user ? req.user.uid : null, {
            city,
            limit: 50,
        })

        // send the ranked list into index.ejs
        // the template still lets people filter by city in the browser too
        res.render("index", {
            user: req.user || null,
            cafes,
            selectedCity: city || "all",
        })
    } catch (err) {
        console.error("failed to load home cafes:", err.message)
        res.status(500).send("Could not load cafes.")
    }
})

//Create Post page
app.get("/create-post", ensureAuthenticated, async (req, res) => {
    try {
        const result = await client.query(
            `Select cid, cname 
            FROM cafes
            ORDER BY cname ASC`
        )

        res.render("createPost", {
            user: req.user,
            cafes: result.rows,
        });
    } catch (err) {
        console.error("failed to load create post page:", err.message)
        res.status(500).send("Could not load the create post page.")
    }
});

// show the login page
app.get("/login", (req, res) => {
    // if theyre already logged in just send them home
    if (req.isAuthenticated()) {
        return res.redirect("/")
    }
    // render the login.ejs form
    res.render("login")
})

// handle the login form submit
app.post(
    "/login",
    passport.authenticate("local", {
        successRedirect: "/",
        failureRedirect: "/login",
    })
)

// log the user out
app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err)
        res.redirect("/login")
    })
})

// show the register page
app.get("/register", (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/")
    }
    res.render("register")
})

// register: hash password, save user, optional profile pic upload
app.post("/register", (req, res, next) => {
    // multer runs first so we can grab the uploaded image if there is one
    upload.single("pfp")(req, res, (err) => {
        if (err) {
            return res.status(400).render("register", { error: err.message })
        }
        next()
    })
}, async (req, res) => {
    try {
        const { username, email, password, role } = req.body

        if (!username || !email || !password) {
            return res.status(400).render("register", {
                error: "Username, email, and password are required",
            })
        }

        // owner can add cafes later, user can just browse and review
        const urole = role === "owner" ? "owner" : "user"
        const pfp = req.file ? `/uploads/${req.file.filename}` : null
        const hashedPassword = await bcrypt.hash(password, 10)

        await client.query(
            `INSERT INTO users (uname, uemail, upassword, pfp, urole)
             VALUES ($1, $2, $3, $4, $5)`,
            [username, email, hashedPassword, pfp, urole]
        )

        res.redirect("/login")
    } catch (err) {
        if (err.code === "23505") {
            return res.status(400).render("register", {
                error: "That email is already registered",
            })
        }
        console.error("register failed:", err.message)
        res.status(500).render("register", {
            error: "Registration failed. Please try again.",
        })
    }
})


app.get("/profile", ensureAuthenticated, async (req, res) => {
    try {
        // 1. Fetch user posts
        const postsResult = await client.query(
            `SELECT
                p.pid AS id,
                c.cname AS title,
                c.ccity AS city,
                p.image AS "imageUrl",
                p.description,
                p.rating
            FROM posts p
            JOIN cafes c ON p.cafe_id = c.cid
            WHERE p.user_id = $1
            ORDER BY p.pid DESC`,
            [req.user.uid]
        );

        // 2. Fetch owned cafes
        const cafesResult = await client.query(
            `SELECT * FROM cafes WHERE owner_id = $1`,
            [req.user.uid]
        );

        // 3. Render profile template and pass both results in the object
        res.render("profile", {
            user: req.user,
            userPosts: postsResult.rows,
            userCafes: cafesResult.rows   // <-- Must be inside res.render({ ... })
        });

    } catch (err) {
        console.error("failed to load profile:", err.message);
        res.status(500).send("Could not load profile.");
    }
});



app.get("/db-check", async (req, res) => {
    try {
        const result = await client.query("SELECT NOW() AS now")
        res.json({ ok: true, now: result.rows[0].now })
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message })
    }
})

app.listen(PORT, () => {
    console.log(`listening on ${PORT}`)
})