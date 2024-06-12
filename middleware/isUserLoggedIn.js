// Middleware untuk memeriksa apakah pengguna sudah login
const isUserLoggedIn = async (req, res, next) => {
  const refreshToken = req.cookies.refreshToken;
  
  if (refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      if (decoded) {
        // Jika token valid, arahkan pengguna ke beranda atau dashboard
        return res.redirect('/');
      }
    } catch (error) {
      console.error('Error verifying token:', error.message);
      // Jika token tidak valid, hapus token dari cookie
      res.clearCookie('refreshToken');
    }
  }

  // Jika tidak ada token, lanjutkan ke halaman login
  next();
};

// Middleware untuk memeriksa dan memperbarui token
const verifyToken = (role) => (req, res, next) => {
  const accessToken = req.cookies.token;
  const refreshToken = req.cookies.refreshToken;

  // Jika tidak ada refresh token, arahkan pengguna ke halaman login
  if (!refreshToken) {
    console.log("No refresh token found, redirecting to login");
    return res.redirect('/login');
  }

  // Jika tidak ada access token, arahkan pengguna ke halaman login
  if (!accessToken) {
    console.log("No access token found, redirecting to login");
    return res.redirect('/login');
  }

  // Proses verifikasi access token
  jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      // Jika access token expired
      if (err.name === 'TokenExpiredError') {
        console.log("Access token expired, verifying refresh token");
        // Proses verifikasi refresh token
        jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, decodedRefresh) => {
          if (err) {
            console.log("Refresh token verification failed:", err);
            return res.redirect('/login');
          }

          // Generate new access token
          const newAccessToken = jwt.sign({ userId: decodedRefresh.userId, role: decodedRefresh.role }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: '15m'
          });

          console.log("New access token generated:", newAccessToken);

          // Set cookie baru dengan access token yang baru
          res.cookie('token', newAccessToken, { httpOnly: true, secure: true });

          req.userId = decodedRefresh.userId;
          req.userRole = decodedRefresh.role;

          // Redirect sesuai peran pengguna jika perlu
          if (role && req.userRole !== role) {
            if (req.userRole === "mahasiswa") {
              return res.redirect("/home");
            } else if (req.userRole === "admin") {
              return res.redirect("/admin/dashboard");
            }
          }
          return next();
        });
      } else {
        console.log("Access token verification failed:", err);
        return res.redirect('/login');
      }
    } else {
      req.userId = decoded.userId;
      req.userRole = decoded.role;

      // Redirect sesuai peran pengguna jika perlu
      if (role && req.userRole !== role) {
        if (req.userRole === "mahasiswa") {
          return res.redirect("/home");
        } else if (req.userRole === "admin") {
          return res.redirect("/admin/dashboard");
        }
      }

      next();
    }
  });
};

module.exports = { isUserLoggedIn, verifyToken };
