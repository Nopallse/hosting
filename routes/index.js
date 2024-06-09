const express = require("express");
const { Login, Logout } = require("../controllers/auth.js");
const { refreshToken } = require("../controllers/RefreshToken.js");

const router = express.Router();

router.post('/login', Login);
router.get('/login', (req, res) => {
  res.render('login');
});
router.delete('/logout', Logout);
router.get('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.redirect('/login');
});

module.exports = router;
