// bcrypt for checking the password hash
const bcrypt = require("bcrypt")
// passport handles login sessions
const passport = require("passport")
// local strategy = email + password login
const LocalStrategy = require("passport-local").Strategy
// our postgres client
const { client } = require("./db")

// set up email/password login
passport.use(
  new LocalStrategy(
    // the form field is called email not username so tell passport that
    { usernameField: "email" },
    // this runs when someone posts to /login
    async (email, password, done) => {
      try {
        // look up the user by email
        const result = await client.query(
          "SELECT uid, uname, uemail, upassword, pfp, urole, google_id FROM users WHERE uemail = $1",
          [email]
        )
        // grab the first row if there is one
        const user = result.rows[0]

        // no user with that email
        if (!user) {
          return done(null, false, { message: "Incorrect email or password" })
        }

        // google only accounts dont have a password so block normal login
        if (!user.upassword) {
          return done(null, false, {
            message: "This account uses Google sign-in",
          })
        }

        // compare typed password to the hash in the db
        const match = await bcrypt.compare(password, user.upassword)
        // wrong password
        if (!match) {
          return done(null, false, { message: "Incorrect email or password" })
        }

        // dont keep the hash hanging around on req.user
        delete user.upassword
        // login succeeded, pass the user object along
        return done(null, user)
      } catch (err) {
        // db or whatever blew up
        return done(err)
      }
    }
  )
)

// google oauth lives in routes/auth.js now (fetch instead of passport-google)

// save just the user id into the session
passport.serializeUser((user, done) => {
  done(null, user.uid)
})

// every request, load the full user from that id
passport.deserializeUser(async (uid, done) => {
  try {
    // pull the user row from postgres
    const result = await client.query(
      "SELECT uid, uname, uemail, pfp, urole, google_id FROM users WHERE uid = $1",
      [uid]
    )
    // if theyre gone return false so passport treats them as logged out
    done(null, result.rows[0] || false)
  } catch (err) {
    // query failed
    done(err)
  }
})

// export the configured passport
module.exports = passport
