const express = require('express');
const path = require('path');
const db = require('./config/database.js');
const cookieParser = require('cookie-parser');
const indexRouter = require('./routes/index.js');
const userRouter = require('./routes/userRoute.js');
const adminRouter = require('./routes/adminRoute.js');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
app.use((req, res, next) => {
    console.log(`Request received: ${req.method} ${req.url}`);
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'assets')));
app.use('/preline', express.static(path.join(__dirname, 'node_modules/preline/dist')));
app.use('/sweet', express.static(path.join(__dirname, 'node_modules/sweetalert2/dist')));

app.set('view engine', 'ejs');

const testDatabaseConnection = async () => {
    try {
        await db.authenticate();
        console.log('Koneksi database berhasil.');
    } catch (error) {
        console.error('Gagal terkoneksi ke database:', error);
    }
};

testDatabaseConnection();

app.use('/', indexRouter);
app.use('/', userRouter);
app.use('/admin', adminRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});
