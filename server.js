require("dotenv").config() // uses dotenv to parse the .env file and grab necessary info

// Prefer IPv4 when talking to Google — avoids some TLS/ECONNRESET failures on macOS
const dns = require("dns")
dns.setDefaultResultOrder("ipv4first")

const express = require("express")
const path = require("path") // <-- Added path module for clean static routing
const bcrypt = require("bcrypt")
const session = require("express-session")
const passport = require("./config/passport")
const { upload } = require("./config/upload")
const { client } = require("./config/db")
const { ensureAuthenticated } = require("./middleware/auth")
const cafesRouter = require("./routes/cafes")
const authRouter = require("./routes/auth")

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// FIX: Serves static files (CSS, JS, images) using an absolute path to /public
app.use(express.static(path.join(__dirname, "public")))

// Session must come before passport.session()
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

app.use("/auth", authRouter)
app.use("/cafes", cafesRouter)

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
app.get("/create-post", (req, res) => {
    res.render("createPost", {
        user: req.user || null,
    })
})

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

// handle register form submit (also takes the optional pfp upload)
app.post("/register", (req, res, next) => {
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