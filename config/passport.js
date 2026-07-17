const bcrypt = require("bcrypt")
const passport = require("passport")
const LocalStrategy = require("passport-local").Strategy
const { client } = require("./db")

// Email/password login — usernameField maps the form's "email" input
passport.use(
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const result = await client.query(
          "SELECT uid, uname, uemail, upassword, pfp, urole FROM users WHERE uemail = $1",
          [email]
        )
        const user = result.rows[0]

        if (!user) {
          return done(null, false, { message: "Incorrect email or password" })
        }

        const match = await bcrypt.compare(password, user.upassword)
        if (!match) {
          return done(null, false, { message: "Incorrect email or password" })
        }

        // Don't keep the hash on req.user
        delete user.upassword
        return done(null, user)
      } catch (err) {
        return done(err)
      }
    }
  )
)

// Store only the user id in the session cookie store
passport.serializeUser((user, done) => {
  done(null, user.uid)
})

// On each request, load the full user from the id in the session
passport.deserializeUser(async (uid, done) => {
  try {
    const result = await client.query(
      "SELECT uid, uname, uemail, pfp, urole FROM users WHERE uid = $1",
      [uid]
    )
    done(null, result.rows[0] || false)
  } catch (err) {
    done(err)
  }
})

module.exports = passport
