const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const libre = require("libreoffice-convert");
const Users = require("../models/UserModel.js");
const Permintaan = require("../models/PermintaanModel.js");
const StatusPermintaan = require("../models/StatusPermintaanModel.js");
const Surat = require("../models/SuratModel.js");
const Mahasiswa = require("../models/MahasiswaModel.js");
const Notification = require("../models/NotificationModel.js")
const { getAdmin, getMahasiswa, getUser } = require("./auth.js");
const { get } = require("http");

const getDashboard = async (req, res) => {
  const admin = await getAdmin(req, res);
  const permintaan = await Permintaan.findAll();
  res.render("admin/dashboard", { admin, permintaan, page: "Dashboard" });
};

const getAdminProfile = async (req, res) => {
  const admin = await getAdmin(req, res);
  res.render("admin/profile", { admin, page: "Profile" });
};

const getAdminChangeProfile = async (req, res) => {
  const admin = await getAdmin(req, res);
  res.render("admin/change-profile", { admin, page: "Profile" });
};

const getAdminChangePassword = async (req, res) => {
  const admin = await getAdmin(req, res);
  res.render("admin/change-password", { admin, page: "change password" });
};

const getAdminMahasiswa = async (req, res) => {
  const admin = await getAdmin(req, res);
  const mahasiswa = await Mahasiswa.findAll({ order: [["id", "ASC"]] });
  res.render("admin/mahasiswa", { admin, mahasiswa, page: "Mahasiswa" });
};

const getDetailMahasiswa = async (req, res) => {
  const userId = req.params.id;
  const admin = await getAdmin(req, res);
  const mahasiswa = await getMahasiswaById(userId);
  console.log(mahasiswa);
  res.render("admin/mahasiswaDetail", { admin, mahasiswa, page: "permintaan" });
};

const getDetailPermintaanUnverified = async (req, res) => {
  const admin = await getAdmin(req, res);
  const idPermintaan = req.params.idPermintaan;
  const permintaan = await Permintaan.findByPk(idPermintaan);
  const nimMahasiswa = permintaan.nim;
  const mahasiswa = await Mahasiswa.findOne({
    where: { nim: nimMahasiswa },
    include: {
      model: Users,
      attributes: ["email"],
    },
  });
  if (permintaan) {
    res.render("admin/permintaan-unverified-detail", {
      admin,
      mahasiswa,
      permintaan,
      page: "permintaan",
    });
  }
};

const getDetailPermintaanVerify = async (req, res) => {
  const admin = await getAdmin(req, res);
  const id = req.params.idPermintaan;
  const permintaan = await Permintaan.findOne({
    where: { idPermintaan: id },
    include: {
      model: Mahasiswa,
      attributes: ["name", "nim", "departemen"],
    },
  });

  if (permintaan) {
    res.render("admin/permintaan-verify-detail", {
      admin,
      permintaan,
      page: "permintaan",
    });
  }
};

const getDetail = async (req, res) => {
  const admin = await getUser(req, res);
  const user = await getUser(req, res);
  const idPermintaan = req.params.idPermintaan;

  // Fetch the specific permintaan detail by id
  const permintaan = await Permintaan.findByPk(idPermintaan);

  if (permintaan) {
    res.render("admin/suratDetail", { admin, user, permintaan, page: "surat" });
  } else {
    res.status(404).send("Surat not found");
  }
};

const formatDate = (date) => {
  const pad = (n) => (n < 10 ? '0' + n : n);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};


const verifikasi = async (req, res) => {
  try {
    const { idPermintaan } = req.body;
    const permintaan = await Permintaan.findByPk(idPermintaan);
    const nim = permintaan.nim;
    console.log(permintaan.nim);
    await permintaan.update({ status: "Proses" });

    await StatusPermintaan.findAll({
      where: { idPermintaan: idPermintaan },
    });

    await StatusPermintaan.update(
      { status: "Selesai", tanggal: new Date().toISOString() },
      { where: { idPermintaan: idPermintaan, idStatus: "2" } }
    );

    await StatusPermintaan.update(
      { status: "Sedang Berlangsung" },
      { where: { idPermintaan: idPermintaan, idStatus: "3" } }
    );

    const currentDate = new Date();
    const formattedDate = formatDate(new Date());
    const href = `http://localhost:3000/riwayat/${idPermintaan}`;

    const notification = await Notification.create({
      userId: nim,
      title: "Kemahasiswaan",
      message: "Permintaan Anda telah diverifikasi",
      href: href,
      tanggal: formattedDate,
    });
    
    const io = req.app.get("io");
    io.to(nim).emit("new_permintaan", {
      message: "Kemahasiswaan",
      permintaan: { isi: "Permintaan Anda telah diverifikasi", href: href , tanggal: formattedDate},
    });

    res.status(200).json({ message: "Permintaan berhasil di verifikasi" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};



const generate = async (req, res) => {
  try {
    const { idPermintaan } = req.body;

    const permintaan = await Permintaan.findByPk(idPermintaan);

    let target = permintaan.target === "Pribadi" ? "pribadi" : "orangtua";

    let templatePath = path.resolve(
      "public/template",
      `template_${target}.docx`
    );
    const content = fs.readFileSync(templatePath);
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    const admin = await getAdmin(req, res);
    await Surat.create({
      idPermintaan: idPermintaan,
      nip: admin.nip,
      qr: "qr",
      tanggal_terbit: new Date(),
      valid_until: new Date(
        new Date().setFullYear(new Date().getFullYear() + 1)
      ),
    });

    const surat = await Surat.findOne({
      where: { idPermintaan: idPermintaan },
    });

    console.log(surat);
    console.log(surat.nomorSurat);

    doc.setData({
      nomor: surat.nomorSurat,
      nama: permintaan.namaMahasiswa,
      nim: permintaan.nim,
      departemen: permintaan.departemen,
      semester: "genap",
      tahunAkademik: "2023/2024",
      namaOrtu: permintaan.namaOrangtua,
      nip: permintaan.nip,
      pangkatGolongan: permintaan.pangkatGolongan,
      unitKerja: permintaan.unitKerja,
      instansiInduk: permintaan.instansiInduk,
      tujuan: permintaan.tujuan,
    });

    const mahasiswa = await Mahasiswa.findOne({
      where: { nim: permintaan.nim },
    });

    doc.render();

    const buf = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    const fileName = `Surat Keterangan Aktif.docx`;
    const userDir = path.resolve("public", "data", `surat`);
    const outputPath = path.join(userDir, fileName);

    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, buf);

    const pdfDir = path.resolve("public", "data", "surat");
    const pdfPath = path.join(
      pdfDir,
      `Surat Keterangan Aktif (${surat.nomorSurat}).pdf`
    );

    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }

    libre.convert(
      fs.readFileSync(outputPath),
      "pdf",
      undefined,
      async (err, result) => {
        if (err) {
          console.error("Error converting DOCX to PDF:", err);
          return res.status(500).send("Error converting DOCX to PDF");
        }

        fs.writeFileSync(pdfPath, result);
        console.log("File converted successfully");

        await fs.promises.unlink(outputPath);

        await permintaan.update({ status: "Selesai" });

        await StatusPermintaan.update(
          { status: "Selesai", tanggal: new Date().toISOString() },
          { where: { idPermintaan: idPermintaan, idStatus: "3" } }
        );

        res.status(200).json({ message: "Surat berhasil di terbitkan" });
      }
    );
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

const getMahasiswaById = async (mahasiswaId) => {
  try {
    const mahasiswa = await Mahasiswa.findOne({
      where: { id: mahasiswaId },
      include: {
        model: Users,
        attributes: ["email"],
      },
    });
    if (!mahasiswa) {
      return { message: "Mahasiswa not found" };
    }
    console.log("Mahasiswa:", mahasiswa);
    return mahasiswa;
  } catch (error) {
    console.error(error);
    throw new Error("Error fetching mahasiswa");
  }
};

const getPermintaanUnverified = async (req, res) => {
  try {
    const admin = await getAdmin(req, res);
    const user = await getUser(req, res);

    const perPage = 10; // Number of entries per page
    const page = req.query.page ? parseInt(req.query.page) : 1; // Current page, default to 1 if not specified

    const totalEntries = await Permintaan.count({
      where: { status: "Diajukan" },
    }); // Get total number of entries with status "Diajukan"
    const totalPages = Math.ceil(totalEntries / perPage); // Calculate total number of pages

    // Fetch only the entries for the current page with status "Diajukan"
    const permintaan = await Permintaan.findAll({
      where: { status: "Diajukan" },
      offset: (page - 1) * perPage,
      limit: perPage,
    });

    // Iterate over permintaan to fetch additional mahasiswa details
    const permintaanWithMahasiswa = await Promise.all(
      permintaan.map(async (entry) => {
        const mahasiswa = await Mahasiswa.findOne({
          where: { nim: entry.nim },
          include: {
            model: Users,
            attributes: ["email"],
          },
        });
        return {
          ...entry.toJSON(), // Convert Sequelize instance to plain object
          mahasiswa,
        };
      })
    );

    res.render("admin/permintaan-unverified", {
      admin,
      user,
      permintaan: permintaanWithMahasiswa,
      currentPage: page,
      totalPages: totalPages,
      totalEntries: totalEntries,
      page: "permintaan unverified",
    });
  } catch (error) {
    console.error("Error fetching permintaan:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getPermintaanVerify = async (req, res) => {
  try {
    const admin = await getAdmin(req, res);
    const user = await getUser(req, res);

    const perPage = 10; // Number of entries per page
    const page = req.query.page ? parseInt(req.query.page) : 1; // Current page, default to 1 if not specified

    const totalEntries = await Permintaan.count({
      where: { status: "Proses" },
    }); // Get total number of entries with status 'Proses'
    const totalPages = Math.ceil(totalEntries / perPage); // Calculate total number of pages

    // Fetch only the entries for the current page with status 'Proses'
    const permintaan = await Permintaan.findAll({
      where: { status: "Proses" },
      offset: (page - 1) * perPage,
      limit: perPage,
    });

    // Iterate over permintaan to fetch additional mahasiswa details
    const permintaanWithMahasiswa = await Promise.all(
      permintaan.map(async (entry) => {
        const mahasiswa = await Mahasiswa.findOne({
          where: { nim: entry.nim },
          include: {
            model: Users,
            attributes: ["email"],
          },
        });
        return {
          ...entry.toJSON(), // Convert Sequelize instance to plain object
          mahasiswa,
        };
      })
    );

    res.render("admin/permintaan-verify", {
      admin,
      user,
      permintaan: permintaanWithMahasiswa,
      currentPage: page,
      totalPages: totalPages,
      totalEntries: totalEntries,
      page: "surat",
    });
  } catch (error) {
    console.error("Error fetching permintaan:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getSurat = async (req, res) => {
  try {
    const admin = await getAdmin(req, res);
    const user = await getUser(req, res);

    const perPage = 10; // Number of entries per page
    const page = req.query.page ? parseInt(req.query.page) : 1; // Current page, default to 1 if not specified

    const totalEntries = await Permintaan.count({
      where: { status: "Selesai" },
    }); // Get total number of entries with status 'Proses'
    const totalPages = Math.ceil(totalEntries / perPage); // Calculate total number of pages

    // Fetch only the entries for the current page with status 'Proses'
    const permintaan = await Permintaan.findAll({
      where: { status: "Selesai" },
      offset: (page - 1) * perPage,
      limit: perPage,
    });

    // Iterate over permintaan to fetch additional mahasiswa details
    const permintaanWithMahasiswa = await Promise.all(
      permintaan.map(async (entry) => {
        const mahasiswa = await Mahasiswa.findOne({
          where: { nim: entry.nim },
          include: {
            model: Users,
            attributes: ["email"],
          },
        });
        return {
          ...entry.toJSON(), // Convert Sequelize instance to plain object
          mahasiswa,
        };
      })
    );

    res.render("admin/surat", {
      admin,
      user,
      permintaan: permintaanWithMahasiswa,
      currentPage: page,
      totalPages: totalPages,
      totalEntries: totalEntries,
      page: "surat",
    });
  } catch (error) {
    console.error("Error fetching permintaan:", error);
    res.status(500).send("Internal Server Error");
  }
};

module.exports = {
  getDashboard,
  getAdminProfile,
  getAdminChangeProfile,
  getAdminChangePassword,
  getAdminMahasiswa,
  getDetailMahasiswa,
  getDetailPermintaanUnverified,
  getDetailPermintaanVerify,
  getDetail,
  verifikasi,
  generate,
  getPermintaanUnverified,
  getPermintaanVerify,
  getSurat,
};
