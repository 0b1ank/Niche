// block pages that need a logged in user
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.redirect("/login")
}

// only cafe owners can add cafes, regular users get blocked
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
