require("dotenv").config() //uses dotenv to parse the .env file and grab necessary info
const express = require("express")
const bcrypt = require("bcrypt")
const session = require("express-session")
const passport = require("./config/passport")
const { upload } = require("./config/upload")
const { client } = require("./config/db")
const { ensureAuthenticated } = require("./middleware/auth")
const cafesRouter = require("./routes/cafes")

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(express.static("public"))

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

app.use("/cafes", cafesRouter)

app.get("/", ensureAuthenticated, (req, res) => {
    res.render("index", { user: req.user })
})

app.get("/login", (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/")
    }
    res.render("login")
})

app.post(
    "/login",
    passport.authenticate("local", {
        successRedirect: "/",
        failureRedirect: "/login",
    })
)

app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err)
        res.redirect("/login")
    })
})

app.get("/register", (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect("/")
    }
    res.render("register")
})

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

        // Owners can do everything users can; only cafe-create differs later
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
        // Postgres unique_violation — email already taken
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
