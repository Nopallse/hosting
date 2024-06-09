
const express = require("express");
const { verifyToken } = require("../middleware/VerifyToken.js");
const { getMahasiswa } = require("../controllers/auth.js");
const router = express.Router();

router.get('/', (req, res) => {
    res.redirect('/home'); 
  });
  
  
  router.get("/home", verifyToken('mahasiswa'), async function (req, res) {
    const mahasiswa = await getMahasiswa(req, res); 
    res.render("user/home", { mahasiswa , page:'home' });
  });
  
  module.exports = router;
