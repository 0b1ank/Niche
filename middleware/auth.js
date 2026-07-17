// Redirect guests to login; call next() if a session user exists
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.redirect("/login")
}

// Only cafe owners may create cafes (owners can still do everything users can)
function ensureOwner(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect("/login")
  }
  if (req.user.urole !== "owner") {
    return res.status(403).send("Only cafe owners can create a cafe.")
  }
  next()
}

module.exports = { ensureAuthenticated, ensureOwner }
