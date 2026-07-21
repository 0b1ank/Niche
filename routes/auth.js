// google sign-in flow: redirect to google, come back with a code, create or link the user
const express = require("express")
const passport = require("../config/passport")
const { client } = require("../config/db")

const router = express.Router()

// read google oauth settings from .env
function googleConfig() {
  const clientID = (process.env.GOOGLE_CLIENT_ID || "").trim()
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim()
  const callbackURL = (
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:3000/auth/google/callback"
  ).trim()
  return { clientID, clientSecret, callbackURL }
}

function googleEnabled() {
  const { clientID, clientSecret } = googleConfig()
  return Boolean(clientID && clientSecret)
}

// figure out what to do with someone who just signed in with google
async function handleGoogleProfile(req, profile) {
  const googleId = profile.id
  const email = profile.email
  const displayName =
    profile.name || (email ? email.split("@")[0] : "user")
  const photo = profile.picture || null

  if (!email) {
    throw new Error("Google account did not provide an email")
  }

  // already signed up with google before
  const byGoogle = await client.query(
    `SELECT uid, uname, uemail, pfp, urole, google_id
     FROM users WHERE google_id = $1`,
    [googleId]
  )
  if (byGoogle.rows[0]) {
    return { user: byGoogle.rows[0] }
  }

  // same email exists from normal signup, just link google to that account
  const byEmail = await client.query(
    `SELECT uid, uname, uemail, pfp, urole, google_id
     FROM users WHERE uemail = $1`,
    [email]
  )
  if (byEmail.rows[0]) {
    const linked = await client.query(
      `UPDATE users SET google_id = $1, pfp = COALESCE(pfp, $2)
       WHERE uid = $3
       RETURNING uid, uname, uemail, pfp, urole, google_id`,
      [googleId, photo, byEmail.rows[0].uid]
    )
    return { user: linked.rows[0] }
  }

  // brand new person, save their google info in session and ask for username + role
  req.session.pendingGoogle = {
    googleId,
    email,
    displayName,
    photo,
  }
  await new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()))
  })
  return { user: null, pending: true }
}

// kick off google login by sending them to google's login page
router.get("/google", (req, res) => {
  if (!googleEnabled()) {
    return res.status(503).send(
      "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env"
    )
  }

  const { clientID, callbackURL } = googleConfig()
  const params = new URLSearchParams({
    client_id: clientID,
    redirect_uri: callbackURL,
    response_type: "code",
    scope: "profile email",
    prompt: "select_account",
  })
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

// google sends the user back here with a code we trade for their profile
router.get("/google/callback", async (req, res, next) => {
  if (!googleEnabled()) {
    return res.redirect("/login")
  }

  try {
    const code = req.query.code
    if (!code || req.query.error) {
      console.error("Google callback missing code:", req.query.error || "no code")
      return res.redirect("/login")
    }

    const { clientID, clientSecret, callbackURL } = googleConfig()

    // swap the code for an access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: clientID,
        client_secret: clientSecret,
        redirect_uri: callbackURL,
        grant_type: "authorization_code",
      }),
    })
    const tokenData = await tokenRes.json()

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Google token exchange failed:", tokenData)
      return res.redirect("/login")
    }

    // use the token to get name, email, and photo
    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    )
    const profile = await profileRes.json()

    if (!profileRes.ok) {
      console.error("Google userinfo failed:", profile)
      return res.redirect("/login")
    }

    const result = await handleGoogleProfile(req, profile)

    if (result.user) {
      return req.login(result.user, (loginErr) => {
        if (loginErr) return next(loginErr)
        return res.redirect("/")
      })
    }

    return res.redirect("/auth/finish-signup")
  } catch (err) {
    console.error("Google OAuth callback error:", err.message)
    return res.redirect("/login")
  }
})

// new google users pick a username and whether they are an owner or regular user
router.get("/finish-signup", (req, res) => {
  const pending = req.session.pendingGoogle
  if (!pending) {
    return res.redirect("/login")
  }

  res.render("finish-signup", {
    email: pending.email,
    username: pending.displayName,
    error: null,
  })
})

// save the new google user to the db and log them in
router.post("/finish-signup", async (req, res, next) => {
  const pending = req.session.pendingGoogle
  if (!pending) {
    return res.redirect("/login")
  }

  try {
    const username = (req.body.username || "").trim()
    const urole = req.body.role === "owner" ? "owner" : "user"

    if (!username) {
      return res.status(400).render("finish-signup", {
        email: pending.email,
        username: "",
        error: "Username is required",
      })
    }

    const inserted = await client.query(
      `INSERT INTO users (uname, uemail, upassword, pfp, google_id, urole)
       VALUES ($1, $2, NULL, $3, $4, $5)
       RETURNING uid, uname, uemail, pfp, urole, google_id`,
      [username, pending.email, pending.photo, pending.googleId, urole]
    )

    const user = inserted.rows[0]
    delete req.session.pendingGoogle

    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr)
      res.redirect("/")
    })
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).render("finish-signup", {
        email: pending.email,
        username: req.body.username || pending.displayName,
        error: "That email or Google account is already registered",
      })
    }
    console.error("finish-signup failed:", err.message)
    res.status(500).render("finish-signup", {
      email: pending.email,
      username: req.body.username || pending.displayName,
      error: "Could not finish signup. Please try again.",
    })
  }
})

module.exports = router
