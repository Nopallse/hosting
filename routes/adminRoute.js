
const express = require("express");
const { verifyToken } = require("../middleware/VerifyToken.js");

const router = express.Router();

router.get('/', (req, res) => {
    res.redirect('/admin/dashboard'); 
  });
  
  
  router.get("/dashboard", verifyToken('admin'), async function (req, res) {
      res.render("admin/dashboard");
  });
  

  module.exports = router;
