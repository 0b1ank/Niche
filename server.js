require("dotenv").config() //uses dotenv to parse the .env file and grab necessary info

// Prefer IPv4 when talking to Google — avoids some TLS/ECONNRESET failures on macOS
const dns = require("dns")
dns.setDefaultResultOrder("ipv4first")

const express = require("express")
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

app.use("/auth", authRouter)
app.use("/cafes", cafesRouter)

// Home page: must be logged in, then load cafes from Postgres and render them
app.get("/", ensureAuthenticated, async (req, res) => {
    try {
        // 1) Ask Postgres for every cafe (newest first).
        //    client.query returns { rows: [ {...}, {...} ] } — each object is one cafe row.
        const result = await client.query(
            `SELECT cid, cname, ccity, cdescription, cafe_img
             FROM cafes
             ORDER BY cid DESC`
        )

        // 2) Send data into the EJS template.
        // user: from Passport session (who is logged in)
        //cafes: array of rows from the SELECT above
        //index.ejs can loop over cafes and print each one.
        res.render("index", {
            user: req.user,
            cafes: result.rows,
        })
    } catch (err) {
        // If the DB is down or the query fails, don't crash — show an error page/status.
        console.error("failed to load home cafes:", err.message)
        res.status(500).send("Could not load cafes.")
    }
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
    // passport checks email/password using the local strategy in config/passport.js
    passport.authenticate("local", {
        // good login -> go to home
        successRedirect: "/",
        // bad login -> back to login page
        failureRedirect: "/login",
    })
)

// log the user out
app.get("/logout", (req, res, next) => {
    // passport clears the session user
    req.logout((err) => {
        // if logout fails pass the error along
        if (err) return next(err)
        // after logout send them to login
        res.redirect("/login")
    })
})

// show the register page
app.get("/register", (req, res) => {
    // already logged in? no need to register again
    if (req.isAuthenticated()) {
        return res.redirect("/")
    }
    // render register.ejs
    res.render("register")
})

// handle register form submit (also takes the optional pfp upload)
app.post("/register", (req, res, next) => {
    // multer grabs the file from the field named pfp
    upload.single("pfp")(req, res, (err) => {
        // if the upload failed show the form again with the error
        if (err) {
            return res.status(400).render("register", { error: err.message })
        }
        // upload ok so continue to the next handler
        next()
    })
}, async (req, res) => {
    try {
        // pull the text fields off the form body
        const { username, email, password, role } = req.body

        // make sure the required stuff is there
        if (!username || !email || !password) {
            return res.status(400).render("register", {
                error: "Username, email, and password are required",
            })
        }

        // figure out role, default to user if they didnt pick owner
        const urole = role === "owner" ? "owner" : "user"
        // if they uploaded a pic save the path otherwise null
        const pfp = req.file ? `/uploads/${req.file.filename}` : null
        // hash the password so we dont store plaintext
        const hashedPassword = await bcrypt.hash(password, 10)

        // insert the new user into postgres
        await client.query(
            `INSERT INTO users (uname, uemail, upassword, pfp, urole)
             VALUES ($1, $2, $3, $4, $5)`,
            [username, email, hashedPassword, pfp, urole]
        )

        // account created, send them to login
        res.redirect("/login")
    } catch (err) {
        // 23505 means unique constraint failed aka email already taken
        if (err.code === "23505") {
            return res.status(400).render("register", {
                error: "That email is already registered",
            })
        }
        // something else went wrong
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
