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

const app = express()
const PORT = process.env.PORT || 3000

// parse json and form data from requests
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// serve css, images, and uploaded files from the public folder
app.use(express.static(path.join(__dirname, "public")))

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

// Home page: loads cafes from Postgres and renders them (accessible to everyone)
app.get("/", async (req, res) => {
    try {
        // 1) Ask Postgres for every cafe (newest first).
        const result = await client.query(
            `SELECT cid, cname, ccity, cdescription, cafe_img
             FROM cafes
             ORDER BY cid DESC`
        )

        // 2) Send data into the EJS template.
        res.render("index", {
            user: req.user || null,
            cafes: result.rows,
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

// GET /profile - renders profile for the logged in user
app.get("/profile", ensureAuthenticated, async (req, res) => {
    try {
        // Query Postgres for fresh user data using req.user.id (or req.user.uid)
        const result = await client.query(
            `SELECT uid, uname, uemail, pfp, urole FROM users WHERE uid = $1`,
            [req.user.uid]
        )

        const currentUser = result.rows[0]

        // Render profile.ejs and pass user object
        res.render("profile", {
            user: currentUser
        })
    } catch (err) {
        console.error("Failed to fetch profile:", err.message)
        res.status(500).send("Server error loading profile.")
    }
})

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