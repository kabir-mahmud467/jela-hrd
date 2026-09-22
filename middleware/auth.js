// Login guards — single login page at /login for both roles
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.redirect('/login');
}

function requireUser(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

module.exports = { requireAdmin, requireUser };
