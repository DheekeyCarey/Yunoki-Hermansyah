// =========================================================================
// BACKEND API - ADMIN PLATINUM (FINAL VERSION WITH SECURE LOGIN)
// =========================================================================

const SECRET_KEY = "SIAKAD_PLATINUM_2026_SECURE_TOKEN";

// =========================================================================
// OPTIMASI PERFORMA (khusus Scan QR Absensi) — lihat komentar di tiap fungsi
// yang memakainya (initDatabase, getPasswordSistem, getSiswaCacheList).
// =========================================================================
const CACHE_KEY_DB_CHECK = "cache_db_checked_v1";
const CACHE_TTL_DB_CHECK = 3600;   // 1 jam — migrasi skema sheet jarang berubah
const CACHE_KEY_PASSWORD = "cache_password_login_v1";
const CACHE_TTL_PASSWORD = 1800;   // 30 menit
const CACHE_KEY_SISWA = "cache_siswa_list_v1";
const CACHE_TTL_SISWA = 1800;      // 30 menit

const SHEETS = {
  SISWA: { name: "Data_Siswa", headers: ["ID", "NISN", "Nama Siswa", "Kelas", "Tanggal Lahir", "Jenis Kelamin"] },
  MAPEL: { name: "Mapel", headers: ["ID", "Nama Mapel", "Semester", "Tahun Ajaran"] },
  JADWAL: { name: "Jadwal", headers: ["ID", "Hari", "Jam", "Kelas", "Mapel"] },
  ABSENSI: { name: "Log_Absensi", headers: ["Waktu", "Kelas", "Mapel", "ID_Siswa", "Nama Siswa", "Status", "Nama Guru", "Bulan", "Tahun", "Tanggal"] },
  NILAI: { name: "Data_Nilai", headers: ["Waktu", "Jenis", "Mapel", "Kelas", "Semester", "ID_Siswa", "Nama Siswa", "Nilai", "Nama Guru"] },
  TUGAS: { name: "Data_Tugas", headers: ["Waktu", "Jenis", "Mapel", "Kelas", "Semester", "ID_Siswa", "Nama Siswa", "Status", "Nama Guru"] },
  AHUH: { name: "Data_AHUH", headers: ["ID", "Mapel", "Kelas", "Semester", "Tahun Ajaran", "Lingkup Materi", "KKM", "Data Soal", "Data Siswa", "Nama Guru", "Waktu"] },
  LJK_RIWAYAT: { name: "Data_LJK_Riwayat", headers: ["ID", "Mapel", "Kelas", "Semester", "Tahun Ajaran", "Jenis Nilai", "Jumlah Soal", "Kunci Jawaban", "Data Siswa", "Nama Guru", "Waktu"] },
  REMEDIAL: { name: "Remedial_Pengayaan", headers: ["Waktu", "Mapel", "Kelas", "Semester", "ID_Siswa", "Nama Siswa", "Lingkup Materi", "Nilai Sebelum", "Nilai Sesudah", "Pengayaan", "Bentuk Pengayaan", "Remedial", "Bentuk Remedial", "Nama Guru"] },
  AGENDA: { name: "Jurnal_Mengajar", headers: ["ID", "Tanggal", "Jam", "Kelas", "Mapel", "Materi", "Status", "Absen Siswa", "Ket", "Nama Guru"] },
  SISWA_BIMBINGAN: { name: "Siswa_Bimbingan", headers: ["ID", "Nama Siswa", "Kelas"] },
  BIMBINGAN: { name: "Bimbingan_Wali", headers: ["ID", "Tanggal", "Nama Siswa", "Kelas", "Jenis", "Kasus", "Tindak Lanjut", "Guru Wali"] },
  EKSTRAKURIKULER: { name: "Ekstrakurikuler", headers: ["ID", "Nama Ekstrakurikuler", "Tahun Ajaran", "Semester", "Bulan Laporan", "Tempat Kegiatan", "Jumlah Hari Kegiatan", "Tanggal Kegiatan", "Uraian Laporan Umum", "Kendala", "Tindak Lanjut", "Data Peserta", "Foto1", "Foto2", "Foto3", "Foto4", "Foto5", "Foto6", "Nama Guru"] },
  KOKURIKULER: { name: "Kokurikuler", headers: ["ID", "Kelas", "Tahun Ajaran", "Semester", "Bulan Laporan", "Data Tema", "Foto1", "Foto2", "Foto3", "Foto4", "Foto5", "Foto6", "Nama Guru"] },
  PIKET: { name: "Piket_Harian", headers: ["ID", "Tanggal", "Nama Sekolah", "Alamat Sekolah", "Nama Guru", "Kelas", "Tahun Ajaran", "Semester", "Bulan Laporan", "Data Kegiatan", "Total Murid Telat", "Total Murid Tidak Hadir", "Foto1", "Foto2"] },
  PIKET_KELAS: { name: "Piket_Kelas", headers: ["ID", "Kelas", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Nama Guru"] },
  ARSIP: { name: "Arsip_Digital", headers: ["ID", "Kelas", "Nama Sekolah", "Alamat Sekolah", "Nama Guru", "Data Arsip"] },
  MUTASI: { name: "Mutasi_Siswa", headers: ["ID", "ID_Siswa", "Nama Siswa", "Kelas", "Semester", "Tanggal Mutasi", "Jenis Mutasi", "Keterangan", "Nama Guru"] },
  INVENTARIS: { name: "Inventaris_Kelas", headers: ["ID", "Kelas", "Semester", "Kode Barang", "Nama Barang", "Jumlah", "Kondisi", "Keterangan", "Nama Guru"] },
  CONFIG: { name: "Pengaturan", headers: ["Key", "Value"] }
};

function initDatabase() {
  // OPTIMASI: fungsi ini aslinya dipanggil di SETIAP doGet/doPost (termasuk tiap scan QR), padahal
  // isinya cuma perlu cek "apakah sheet/kolom sudah lengkap" -- yang hasilnya nyaris selalu sama
  // berkali-kali dalam waktu singkat. Cache guard ini membuatnya benar-benar mengecek ulang paling
  // sering 1x/jam (CACHE_TTL_DB_CHECK), sisanya langsung return. Kalau Anda baru saja menambah
  // sheet/kolom baru secara manual dan ingin migrasi langsung jalan tanpa menunggu 1 jam, jalankan
  // clearDbCheckCache() sekali dari editor Apps Script (menu Run), atau tunggu cache expired sendiri.
  const cache = CacheService.getScriptCache();
  if (cache.get(CACHE_KEY_DB_CHECK)) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const key in SHEETS) {
    const sInfo = SHEETS[key];
    let sheet = ss.getSheetByName(sInfo.name);
    if (!sheet) {
      sheet = ss.insertSheet(sInfo.name);
      sheet.appendRow(sInfo.headers);
      sheet.getRange(1, 1, 1, sInfo.headers.length).setFontWeight("bold").setBackground("#16a34a").setFontColor("white"); // Excel Green Theme
      sheet.setFrozenRows(1);
      
      // Jika membuat sheet pengaturan baru, tambahkan default password
      if(sInfo.name === "Pengaturan") {
         sheet.appendRow(["Password_Login", "admin123"]);
      }
    }
  }
  migrateAddIdColumn();
  migrateAddBentukRemedialColumns();
  migrateAddSemesterColumns();
  migrateAddTanggalLahirColumn();
  migrateAddJenisKelaminColumn();
  migrateRemedialLingkupMateriNilai();
  migrateEnsureAllColumns();

  cache.put(CACHE_KEY_DB_CHECK, "1", CACHE_TTL_DB_CHECK);
}

// PERBAIKAN BUG: sheet seperti Mutasi_Siswa/Inventaris_Kelas yang sudah dibuat SEBELUM kolom
// tertentu (mis. "Tanggal Mutasi", "Jenis Mutasi") ditambahkan ke definisi SHEETS di atas tidak
// pernah otomatis mendapat kolom itu -- initDatabase() cuma membuat sheet BARU kalau sheet-nya
// belum ada sama sekali; sheet yang sudah ada tidak pernah disinkronkan ulang strukturnya.
// Akibatnya processMutasiSiswaMulti()/processInventarisKelasMulti() membaca header ASLI dari
// sheet (bukan dari SHEETS.MUTASI.headers), dan kalau kolom itu tidak ada di header asli, nilai
// yang diisi guru "hilang" begitu saja saat ditulis (headers.map() tidak punya kolom tujuan) --
// tanpa error apa pun. Inilah penyebab guru mengira Tanggal Mutasi/Jenis Mutasi/data Inventaris
// "tidak tersimpan". Fungsi ini menambahkan SETIAP kolom yang hilang (dibandingkan SHEETS di
// atas) di AKHIR sheet yang sudah ada, TANPA mengubah urutan/isi kolom yang sudah ada -- aman
// karena seluruh sistem ini membaca/menulis kolom berdasarkan NAMA header, bukan posisi kolom.
function migrateEnsureAllColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const key in SHEETS) {
    const sInfo = SHEETS[key];
    const sheet = ss.getSheetByName(sInfo.name);
    if (!sheet) continue;
    const lastCol = sheet.getLastColumn();
    let headerRow = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    sInfo.headers.forEach(h => {
      if (headerRow.indexOf(h) === -1) {
        const newColIdx = sheet.getLastColumn() + 1;
        const cell = sheet.getRange(1, newColIdx);
        cell.setValue(h).setFontWeight("bold").setBackground("#16a34a").setFontColor("white");
        headerRow.push(h); // supaya cek berikutnya dalam loop yang sama tetap akurat
      }
    });
  }
}

// Jalankan fungsi ini SEKALI secara manual dari editor Apps Script (pilih fungsi ini di dropdown,
// klik Run) setiap kali Anda baru saja menambah sheet/kolom baru dan ingin migrasinya langsung
// diperiksa ulang saat itu juga, tanpa menunggu cache 1 jam habis.
function clearDbCheckCache() {
  CacheService.getScriptCache().remove(CACHE_KEY_DB_CHECK);
}

// Jalankan fungsi ini SEKALI secara manual dari editor Apps Script (pilih fungsi ini di dropdown,
// klik Run) untuk langsung menambahkan kolom yang hilang (mis. "Tanggal Mutasi"/"Jenis Mutasi" di
// Mutasi_Siswa) hari ini juga, tanpa menunggu cache 1 jam initDatabase() habis. Setelah dijalankan,
// coba lagi Simpan Data Mutasi / Simpan Data Inventaris dari halaman guru.
function jalankanPerbaikanKolomSekarang() {
  migrateEnsureAllColumns();
  clearDbCheckCache();
}

// Untuk sheet Data_Siswa yang sudah dibuat sebelum kolom "Tanggal Lahir" ditambahkan (dipakai oleh
// menu Analisis Umur): tambahkan kolom tersebut di akhir supaya data NISN/Nama/Kelas yang sudah ada
// tidak perlu digeser urutannya. Kolom ini akan tetap kosong ("") untuk siswa lama sampai gurunya
// mengisi tanggal lahir lewat menu Analisis Umur.
function migrateAddTanggalLahirColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SISWA.name);
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headerRow.indexOf("Tanggal Lahir") !== -1) return; // sudah punya kolom Tanggal Lahir

  const newColIdx = lastCol + 1;
  const cell = sheet.getRange(1, newColIdx);
  cell.setValue("Tanggal Lahir").setFontWeight("bold").setBackground("#16a34a").setFontColor("white");
  // Kolom ini menyimpan tanggal sebagai teks "yyyy-MM-dd" (sama seperti kolom tanggal lain di
  // sistem ini), jadi format kolomnya dipaksa Teks dari awal supaya Google Sheets tidak diam-diam
  // mengonversinya jadi tipe Date saat data mulai diisi.
  const lastRow = sheet.getLastRow();
  if (lastRow > 0) sheet.getRange(1, newColIdx, lastRow, 1).setNumberFormat("@");
}

// Untuk sheet Data_Nilai, Data_Tugas, Remedial_Pengayaan, Mutasi_Siswa & Inventaris_Kelas yang
// sudah dibuat sebelum kolom "Semester" ditambahkan: sisipkan kolom tersebut tepat setelah kolom
// "Kelas", supaya urutan header tetap sama persis dengan SHEETS.NILAI.headers / SHEETS.TUGAS.headers /
// SHEETS.REMEDIAL.headers / SHEETS.MUTASI.headers / SHEETS.INVENTARIS.headers di atas
// (processPenilaianMulti() / processTugasMulti() / processRemedialPengayaan() /
// processMutasiSiswa() / processInventarisKelas() menulis/membaca nilai berdasarkan
// headers.indexOf, jadi posisi kolom di Sheet harus konsisten dengan definisi header-nya).
function migrateAddSemesterColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [SHEETS.NILAI, SHEETS.TUGAS, SHEETS.REMEDIAL, SHEETS.MUTASI, SHEETS.INVENTARIS].forEach(sInfo => {
    const sheet = ss.getSheetByName(sInfo.name);
    if (!sheet) return;
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return;
    const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    if (headerRow.indexOf("Semester") !== -1) return; // sudah punya kolom Semester

    const idxKelas = headerRow.indexOf("Kelas");
    if (idxKelas === -1) return;
    sheet.insertColumnAfter(idxKelas + 1);
    const cell = sheet.getRange(1, idxKelas + 2);
    cell.setValue("Semester").setFontWeight("bold").setBackground("#16a34a").setFontColor("white");
  });
}

// Untuk sheet Remedial_Pengayaan yang sudah dibuat sebelum kolom "Bentuk Pengayaan" & "Bentuk Remedial"
// ditambahkan: sisipkan kedua kolom teks bebas tersebut di posisi yang benar (setelah "Pengayaan" dan
// setelah "Remedial") supaya urutan header tetap sama persis dengan SHEETS.REMEDIAL.headers di atas,
// karena processRemedialPengayaan() menulis nilai berdasarkan urutan kolom yang berdekatan (headers.indexOf).
function migrateAddBentukRemedialColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.REMEDIAL.name);
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  let headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  if (headerRow.indexOf("Bentuk Pengayaan") === -1) {
    const idxPengayaan = headerRow.indexOf("Pengayaan");
    if (idxPengayaan > -1) {
      sheet.insertColumnAfter(idxPengayaan + 1);
      const cell = sheet.getRange(1, idxPengayaan + 2);
      cell.setValue("Bentuk Pengayaan").setFontWeight("bold").setBackground("#16a34a").setFontColor("white");
    }
    headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  }

  if (headerRow.indexOf("Bentuk Remedial") === -1) {
    const idxRemedial = headerRow.indexOf("Remedial");
    if (idxRemedial > -1) {
      sheet.insertColumnAfter(idxRemedial + 1);
      const cell = sheet.getRange(1, idxRemedial + 2);
      cell.setValue("Bentuk Remedial").setFontWeight("bold").setBackground("#16a34a").setFontColor("white");
    }
  }
}

// Untuk sheet Jurnal_Mengajar & Bimbingan_Wali yang sudah dibuat sebelum kolom ID ditambahkan:
// sisipkan kolom ID di posisi pertama dan isi ID unik untuk setiap baris data yang sudah ada,
// supaya penghapusan baris bisa dilakukan berdasarkan ID (bukan mencocokkan seluruh isi baris,
// yang rawan gagal karena Google Sheets otomatis mengubah teks tanggal menjadi tipe Date).
function migrateAddIdColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [SHEETS.AGENDA, SHEETS.BIMBINGAN].forEach(sInfo => {
    const sheet = ss.getSheetByName(sInfo.name);
    if (!sheet) return;
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return;
    const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    if (headerRow.indexOf("ID") !== -1) return; // sudah punya kolom ID

    sheet.insertColumnBefore(1);
    const idCell = sheet.getRange(1, 1);
    idCell.setValue("ID").setFontWeight("bold").setBackground("#16a34a").setFontColor("white");

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const baseTime = Date.now();
      const ids = [];
      for (let i = 0; i < lastRow - 1; i++) {
        ids.push(["MIG" + (baseTime + i).toString()]);
      }
      sheet.getRange(2, 1, ids.length, 1).setValues(ids);
    }
  });
}

// Untuk sheet Data_Siswa yang sudah dibuat sebelum kolom "Jenis Kelamin" ditambahkan (dipakai oleh
// menu Mutasi Siswa): tambahkan kolom tersebut di akhir, sama seperti pola
// migrateAddTanggalLahirColumn() di atas. Kolom ini akan tetap kosong ("") untuk siswa lama sampai
// gurunya mengisi lewat menu Mutasi Siswa.
function migrateAddJenisKelaminColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.SISWA.name);
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  if (headerRow.indexOf("Jenis Kelamin") !== -1) return; // sudah punya kolom Jenis Kelamin

  const newColIdx = lastCol + 1;
  const cell = sheet.getRange(1, newColIdx);
  cell.setValue("Jenis Kelamin").setFontWeight("bold").setBackground("#16a34a").setFontColor("white");
}

// Untuk sheet Remedial_Pengayaan yang sudah dibuat SEBELUM perubahan ini: (1) kolom header "TP"
// (Tujuan Pembelajaran) diganti namanya menjadi "Lingkup Materi" DI TEMPAT -- data yang sudah
// pernah diisi guru di kolom itu TETAP ada, cuma label header-nya yang berubah teksnya, sama
// seperti istilah "Lingkup Materi" yang sudah dipakai di menu AHUH. (2) kolom "Nilai Sebelum" &
// "Nilai Sesudah" disisipkan tepat SETELAH kolom "Lingkup Materi", supaya urutan header sheet
// tetap sama persis dengan SHEETS.REMEDIAL.headers di atas -- processRemedialPengayaan() menulis
// 7 kolom (Lingkup Materi s.d. Bentuk Remedial) sekaligus secara berdampingan berdasarkan urutan itu.
function migrateRemedialLingkupMateriNilai() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEETS.REMEDIAL.name);
  if (!sheet) return;
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  let headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  const idxTP = headerRow.indexOf("TP");
  if (idxTP > -1 && headerRow.indexOf("Lingkup Materi") === -1) {
    sheet.getRange(1, idxTP + 1).setValue("Lingkup Materi");
    headerRow[idxTP] = "Lingkup Materi";
  }

  const idxLingkupMateri = headerRow.indexOf("Lingkup Materi");
  if (idxLingkupMateri > -1 && headerRow.indexOf("Nilai Sebelum") === -1) {
    sheet.insertColumnAfter(idxLingkupMateri + 1);
    sheet.getRange(1, idxLingkupMateri + 2).setValue("Nilai Sebelum").setFontWeight("bold").setBackground("#16a34a").setFontColor("white");
    headerRow.splice(idxLingkupMateri + 1, 0, "Nilai Sebelum");
  }

  if (headerRow.indexOf("Nilai Sesudah") === -1) {
    const idxNilaiSebelum = headerRow.indexOf("Nilai Sebelum");
    if (idxNilaiSebelum > -1) {
      sheet.insertColumnAfter(idxNilaiSebelum + 1);
      sheet.getRange(1, idxNilaiSebelum + 2).setValue("Nilai Sesudah").setFontWeight("bold").setBackground("#16a34a").setFontColor("white");
    }
  }
}

function doGet(e) {
  try {
    initDatabase();
    if (e.parameter.action === "all") {
      return responseJson("success", "Sinkronisasi server berhasil", getAllData());
    }
    return responseJson("error", "Parameter GET tidak valid", null);
  } catch (err) {
    return responseJson("error", err.message, null);
  }
}

function doPost(e) {
  try {
    initDatabase();
    let req = {};
    if(e.postData && e.postData.contents) {
       req = JSON.parse(e.postData.contents);
    } else {
       throw new Error("Tidak ada data payload yang diterima.");
    }

    const action = req.action;
    const payload = req.payload || {};
    let result = null;

    // Mengambil password dari Sheet Pengaturan (di-cache, lihat getPasswordSistem() di bawah --
    // OPTIMASI: sebelumnya sheet Pengaturan dibaca ulang di SETIAP request termasuk tiap scan QR)
    let passwordSistem = getPasswordSistem();

    // Membuat Token Server Murni
    const serverToken = Utilities.base64Encode(String(passwordSistem).trim() + SECRET_KEY);

    // BLOK 1: Menangani Permintaan Login Khusus
    if (action === 'login') {
      if (String(passwordSistem).trim() === String(payload.password).trim()) {
        return responseJson("success", "Login Berhasil", serverToken);
      } else {
        throw new Error("Password Salah!");
      }
    }

    // BLOK 2: Validasi Sesi/Token untuk setiap request lain (Keamanan Penuh)
    if (req.token !== serverToken) {
      throw new Error("Akses Ditolak! Sesi login tidak valid.");
    }

    // Routing aksi lainnya
    // OPTIMASI: ketiga aksi ini mengubah ID/NISN/Nama Siswa yang dipakai untuk pencocokan scan QR
    // (lihat getSiswaCacheList()), jadi cache-nya wajib dihapus setelah berhasil supaya scan QR
    // berikutnya tidak memakai data siswa yang sudah usang. saveTanggalLahir/saveJenisKelamin/
    // saveMutasiSiswa TIDAK perlu invalidasi ini karena tidak mengubah kolom ID/NISN/Nama Siswa.
    if (action === "saveSiswa") { result = saveData(SHEETS.SISWA.name, payload); invalidateSiswaCache(); }
    else if (action === "saveSiswaBulk") { result = saveBulkData(SHEETS.SISWA.name, payload); invalidateSiswaCache(); }
    else if (action === "deleteSiswa") { result = deleteDataById(SHEETS.SISWA.name, payload.id); invalidateSiswaCache(); }
    else if (action === "updateSiswa") { result = processUpdateSiswa(payload); invalidateSiswaCache(); }
    else if (action === "saveTanggalLahir") result = processTanggalLahir(payload);
    else if (action === "saveJenisKelamin") result = processJenisKelamin(payload);
    else if (action === "saveMutasiSiswa") result = processMutasiSiswa(payload);
    else if (action === "saveMutasiSiswaMulti") result = processMutasiSiswaMulti(payload);
    else if (action === "deleteMutasiSiswa") result = deleteDataById(SHEETS.MUTASI.name, payload.id);
    else if (action === "saveInventarisKelas") result = processInventarisKelas(payload);
    else if (action === "saveInventarisKelasMulti") result = processInventarisKelasMulti(payload);
    else if (action === "deleteInventarisKelas") result = deleteDataById(SHEETS.INVENTARIS.name, payload.id);
    else if (action === "saveMapel") result = saveData(SHEETS.MAPEL.name, payload);
    else if (action === "deleteMapel") result = deleteDataById(SHEETS.MAPEL.name, payload.id);
    else if (action === "saveJadwal") result = saveData(SHEETS.JADWAL.name, payload);
    else if (action === "deleteJadwal") result = deleteDataById(SHEETS.JADWAL.name, payload.id);
    else if (action === "saveAbsensi") result = processAbsensiManual(payload);
    else if (action === "scanAbsen") result = processScanAbsen(payload);
    else if (action === "savePenilaian") result = processPenilaian(payload);
    else if (action === "savePenilaianMulti") result = processPenilaianMulti(payload);
    else if (action === "saveTugasMulti") result = processTugasMulti(payload);
    else if (action === "saveRemedialPengayaan") result = processRemedialPengayaan(payload);
    else if (action === "saveAHUH") result = processAHUH(payload);
    else if (action === "deleteAHUH") result = deleteDataById(SHEETS.AHUH.name, payload.id);
    else if (action === "saveLJKRiwayat") result = processLJKRiwayat(payload);
    else if (action === "deleteLJKRiwayat") result = deleteDataById(SHEETS.LJK_RIWAYAT.name, payload.id);
    else if (action === "saveAgenda") result = saveData(SHEETS.AGENDA.name, payload);
    else if (action === "deleteAgenda") result = deleteDataById(SHEETS.AGENDA.name, payload.id);
    else if (action === "saveSiswaBimbingan") result = saveData(SHEETS.SISWA_BIMBINGAN.name, payload);
    else if (action === "saveBimbingan") result = saveData(SHEETS.BIMBINGAN.name, payload);
    else if (action === "deleteBimbingan") result = deleteDataById(SHEETS.BIMBINGAN.name, payload.id);
    else if (action === "saveEkstrakurikuler") result = processEkstrakurikuler(payload);
    else if (action === "deleteEkstrakurikuler") result = deleteDataById(SHEETS.EKSTRAKURIKULER.name, payload.id);
    else if (action === "saveKokurikuler") result = processKokurikuler(payload);
    else if (action === "deleteKokurikuler") result = deleteDataById(SHEETS.KOKURIKULER.name, payload.id);
    else if (action === "savePiket") result = processPiket(payload);
    else if (action === "deletePiket") result = deleteDataById(SHEETS.PIKET.name, payload.id);
    else if (action === "savePiketKelas") result = processPiketKelas(payload);
    else if (action === "saveArsip") result = processArsip(payload);
    else if (action === "saveConfig") result = saveConfig(payload);
    else if (action === "ambilFotoBase64") result = processAmbilFotoBase64(payload);
    else throw new Error("Aksi tidak dikenali");

    return responseJson("success", "Berhasil menyimpan", result);
  } catch (err) {
    return responseJson("error", err.message, null);
  }
}

// OPTIMASI: dipakai doPost() untuk validasi token/login di SETIAP request tanpa baca ulang sheet
// Pengaturan tiap kali (kecuali cache-nya kosong/expired). Kalau password diganti lewat menu
// Pengaturan, cache ini otomatis dihapus di dalam saveConfig() di bawah, supaya password baru
// langsung berlaku pada request berikutnya (tidak perlu tunggu 30 menit expired sendiri).
function getPasswordSistem() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY_PASSWORD);
  if (cached !== null) return cached;

  const sheetConfig = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CONFIG.name);
  const configData = sheetConfig.getDataRange().getValues();
  let passwordSistem = "admin123"; // Default fallback
  for (let i = 1; i < configData.length; i++) {
    if (configData[i][0] === "Password_Login") {
      passwordSistem = configData[i][1];
      break;
    }
  }
  cache.put(CACHE_KEY_PASSWORD, String(passwordSistem), CACHE_TTL_PASSWORD);
  return passwordSistem;
}

function responseJson(status, message, data) {
  return ContentService.createTextOutput(JSON.stringify({ status: status, message: message, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAllData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let db = {};
  
  for (const key in SHEETS) {
    const sInfo = SHEETS[key];
    const sheet = ss.getSheetByName(sInfo.name);
    if (!sheet) continue;
    
    const data = sheet.getDataRange().getValues();
    let dbKey = sInfo.name.toLowerCase(); 
    if (dbKey === 'pengaturan') dbKey = 'config_raw';
    
    if (data.length <= 1) {
      db[dbKey] = [];
    } else {
      const headers = data[0];
      const rows = [];
      for (let i = 1; i < data.length; i++) {
        let obj = {};
        for (let j = 0; j < headers.length; j++) {
          let v = data[i][j];
          // Jika sel ini sudah dikonversi otomatis oleh Google Sheets menjadi tipe Date (umum terjadi
          // pada kolom tanggal seperti "Waktu"/"Tanggal"), kirim ke client sebagai teks "yyyy-MM-dd"
          // yang konsisten -- bukan string ISO datetime panjang -- supaya tidak salah cocok saat
          // dibandingkan dengan tanggal dari <input type="date"> (mis. di tabel Input Manual).
          if (v instanceof Date) {
            v = Utilities.formatDate(v, Session.getScriptTimeZone() || "Asia/Jakarta", "yyyy-MM-dd");
          }
          obj[headers[j]] = v !== undefined ? v : "";
        }
        rows.push(obj);
      }
      db[dbKey] = rows;
    }
  }
  
  let configObj = {};
  if (db.config_raw) { 
    db.config_raw.forEach(row => { configObj[row.Key] = row.Value; }); 
    delete db.config_raw;
  }
  db.config = configObj;
  
  return db;
}

function saveData(sheetName, payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : "");

  // Kalau sheet ini punya kolom "Kelas" (mis. Data_Siswa, Jadwal), format dulu sel tujuannya
  // sebagai Teks SEBELUM ditulis. Ini mencegah Google Sheets diam-diam mengubah nama kelas yang
  // berbentuk angka murni (mis. "7.10" jadi "7.1", atau "07" jadi "7") sejak awal data disimpan.
  const kelasIdx = headers.indexOf("Kelas");
  if (kelasIdx > -1) sheet.getRange(sheet.getLastRow() + 1, kelasIdx + 1).setNumberFormat("@");

  // PERBAIKAN: form "Simpan Manual" di menu Data Siswa sekarang juga bisa langsung mengisi
  // "Tanggal Lahir" (opsional). Format dulu sel tujuannya sebagai Teks, sama seperti kolom Kelas
  // di atas, supaya Google Sheets tidak diam-diam mengubahnya jadi tipe Date -- konsisten dengan
  // updateSatuKolomSiswa()/processTanggalLahir() yang dipakai menu Analisis Umur & Mutasi Siswa.
  const tglLahirIdx = headers.indexOf("Tanggal Lahir");
  if (tglLahirIdx > -1) sheet.getRange(sheet.getLastRow() + 1, tglLahirIdx + 1).setNumberFormat("@");

  sheet.appendRow(rowData);
  return "Tersimpan";
}

function cellToCompareString(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || "Asia/Jakarta", "yyyy-MM-dd");
  }
  let s = String(v).trim();
  // Google Sheets sering mengubah teks tanggal (mis. dari <input type="date">) menjadi tipe Date.
  // Saat data itu disinkron ulang ke client lalu dikirim balik untuk pencocokan hapus, ia sudah
  // berbentuk string ISO datetime (mis. "2026-07-24T00:00:00.000Z"). Ambil bagian tanggalnya saja
  // supaya tetap cocok dengan cell bertipe Date yang diformat "yyyy-MM-dd" di atas.
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch) return isoMatch[1];
  return s;
}

// Setelah menambah baris baru berisi kolom "Waktu"/"Tanggal"/"Tanggal Mutasi"/"Kelas", paksa ulang
// kolom tersebut ke format Teks (bukan "Automatic") lalu tulis ulang nilainya. Ini mencegah Google
// Sheets otomatis mengonversi teks tanggal atau nama kelas yang berbentuk angka (mis. "7", "7.1")
// menjadi tipe Date/Number untuk baris-baris baru ke depannya (akar masalah salah-cocok yang
// membuat absensi bisa tersimpan berkali-kali di hari yang sama).
// PERBAIKAN BUG: sebelumnya kolom "Tanggal Mutasi" (dipakai di menu Mutasi Siswa) tidak ikut
// masuk daftar target di bawah ini (yang ada cuma "Tanggal" tanpa "Mutasi"), jadi cell-nya tetap
// berformat Automatic dan rawan salah tampil balik ke <input type="date"> setelah disimpan --
// inilah yang membuat guru mengira Tanggal Mutasi "tidak tersimpan".
function fixDateColumnsAsText(sheet, headers, rowNumber, tanggalValue, kelasValue) {
  const targets = { "Waktu": tanggalValue, "Tanggal": tanggalValue, "Tanggal Mutasi": tanggalValue, "Kelas": kelasValue };
  Object.keys(targets).forEach(colName => {
    const idx = headers.indexOf(colName);
    if (idx > -1 && targets[colName] !== undefined) sheet.getRange(rowNumber, idx + 1).setNumberFormat("@").setValue(targets[colName]);
  });
}

// Menghapus 1 baris berdasarkan kecocokan penuh pada beberapa kolom sekaligus.
// Dipakai untuk sheet yang tidak punya kolom ID (Jurnal_Mengajar, Bimbingan_Wali).
// Mencari dari baris paling bawah agar entri yang paling baru ditambahkan yang lebih dulu cocok.
function deleteDataByMatch(sheetName, matchObj) {
  if (!matchObj || Object.keys(matchObj).length === 0) {
    throw new Error("Data pencocokan tidak valid, gagal menghapus data.");
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keys = Object.keys(matchObj);

  for (let i = data.length - 1; i >= 1; i--) {
    let match = true;
    for (let k = 0; k < keys.length; k++) {
      const colIdx = headers.indexOf(keys[k]);
      if (colIdx === -1) { match = false; break; }
      const cellVal = cellToCompareString(data[i][colIdx]);
      const targetVal = cellToCompareString(matchObj[keys[k]]);
      if (cellVal !== targetVal) { match = false; break; }
    }
    if (match) {
      sheet.deleteRow(i + 1);
      return "Data terhapus";
    }
  }
  throw new Error("Data tidak ditemukan (mungkin sudah berubah). Silakan muat ulang halaman lalu coba lagi.");
}

function deleteDataById(sheetName, id) {
  if (id === undefined || id === null || String(id).trim() === "") {
    throw new Error("ID tidak valid, gagal menghapus data.");
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("ID");
  if (idCol === -1) throw new Error("Kolom ID tidak ditemukan di sheet " + sheetName);

  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return "Data terhapus";
    }
  }
  throw new Error("Data dengan ID tersebut tidak ditemukan.");
}

function saveBulkData(sheetName, payloadArray) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowsData = payloadArray.map(payload => headers.map(h => payload[h] !== undefined ? payload[h] : ""));
  if (rowsData.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    // Sama seperti di saveData(): format kolom Kelas sebagai Teks dulu sebelum ditulis, supaya
    // import massal (mis. dari file NISN/kelas) tidak ikut mengubah nama kelas berbentuk angka.
    const kelasIdx = headers.indexOf("Kelas");
    if (kelasIdx > -1) sheet.getRange(startRow, kelasIdx + 1, rowsData.length, 1).setNumberFormat("@");
    // PERBAIKAN: Upload Excel di menu Data Siswa sekarang juga bisa ikut mengisi "Tanggal Lahir"
    // (opsional). Format dulu sebagai Teks, sama seperti kolom Kelas di atas.
    const tglLahirIdx = headers.indexOf("Tanggal Lahir");
    if (tglLahirIdx > -1) sheet.getRange(startRow, tglLahirIdx + 1, rowsData.length, 1).setNumberFormat("@");
    sheet.getRange(startRow, 1, rowsData.length, headers.length).setValues(rowsData);
  }
  return "Bulk tersimpan";
}

// OPTIMASI: dipakai processScanAbsen() supaya TIDAK perlu getDataRange().getValues() pada seluruh
// sheet Data_Siswa di SETIAP scan QR. Hanya menyimpan 3 kolom yang dipakai untuk pencocokan
// (ID, NISN, Nama Siswa) -- bukan menggantikan getAllData() yang dipakai sinkronisasi awal halaman.
// PENTING: kalau ukuran cache melebihi batas CacheService (~100KB/key, jarang tercapai kecuali
// jumlah siswa sangat banyak), cache.put() akan gagal -- ditangkap oleh try/catch di bawah supaya
// TIDAK error, hanya berarti fitur cache-nya dilewati dan balik baca sheet langsung tiap saat.
// DIPERBARUI: sekarang juga menyimpan "Kelas" (bukan cuma ID/NISN/Nama) supaya processScanAbsen()
// bisa tahu siapa saja teman sekelas siswa yang scan (dipakai utk auto-isi Alpa massal saat scan
// pertama hari itu), tanpa perlu baca ulang seluruh Data_Siswa.
function getSiswaCacheList() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CACHE_KEY_SISWA);
  if (cached !== null) return JSON.parse(cached);

  const sheetSiswa = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SISWA.name);
  const dataSiswa = sheetSiswa.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < dataSiswa.length; i++) {
    list.push({ ID: String(dataSiswa[i][0]), NISN: String(dataSiswa[i][1]), Nama: dataSiswa[i][2], Kelas: String(dataSiswa[i][3]) });
  }
  try {
    cache.put(CACHE_KEY_SISWA, JSON.stringify(list), CACHE_TTL_SISWA);
  } catch (eCacheGagal) {
    // Data siswa terlalu besar untuk di-cache -- tidak fatal, lanjut tanpa cache.
  }
  return list;
}

// Dipanggil setiap kali data Data_Siswa berubah (tambah/edit/hapus siswa) supaya scan QR
// berikutnya langsung memakai data terbaru, bukan data lama yang masih ter-cache sampai 30 menit.
function invalidateSiswaCache() {
  CacheService.getScriptCache().remove(CACHE_KEY_SISWA);
}

function processAbsensiManual(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ABSENSI.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let [thn, bln] = payload.tanggal.split('-');
  const existingData = sheet.getDataRange().getValues();
  
  payload.records.forEach(rec => {
    let rowIdx = -1;
    for(let i = 1; i < existingData.length; i++) {
      let r = existingData[i];
      // cellToCompareString() dipakai untuk SEMUA kolom pembanding (Waktu, Kelas, Mapel) karena
      // Google Sheets bisa saja otomatis mengonversi sel "Waktu" jadi tipe Date, atau sel "Kelas"
      // jadi tipe Number kalau nama kelasnya berbentuk angka (mis. "7", "7.1") -- perbandingan
      // langsung (===) akan selalu gagal cocok kalau tidak dinormalkan dulu ke teks.
      if(cellToCompareString(r[0]) === payload.tanggal && cellToCompareString(r[1]) === String(payload.kelas).trim() && cellToCompareString(r[2]) === String(payload.mapel).trim() && String(r[3]) === String(rec.ID_Siswa)) {
        rowIdx = i + 1; break;
      }
    }
    if(rowIdx > -1) {
      sheet.getRange(rowIdx, headers.indexOf("Status") + 1).setValue(rec.Status);
    } else {
      let newRec = { Waktu: payload.tanggal, Tanggal: payload.tanggal, Kelas: payload.kelas, Mapel: payload.mapel, ID_Siswa: rec.ID_Siswa, "Nama Siswa": rec.Nama_Siswa, Status: rec.Status, "Nama Guru": payload.guru, Bulan: bln, Tahun: thn };
      sheet.appendRow(headers.map(h => newRec[h] !== undefined ? newRec[h] : ""));
      fixDateColumnsAsText(sheet, headers, sheet.getLastRow(), payload.tanggal, payload.kelas);
    }
  });
  return "Absensi manual tersimpan";
}

// LOGIKA ABSEN QR (REVISI):
// 1) Scan QR PERTAMA hari itu untuk 1 kelas -> otomatis mengisi status "Alpa" untuk SEMUA siswa
//    lain sekelas yang belum tercatat, supaya guru tidak wajib membuka Input Manual & klik Simpan
//    kalau ternyata cuma 1-2 siswa yang tidak hadir.
// 2) Kalau siswa yang scan SUDAH punya record hari itu (dari auto-Alpa, atau dari Input Manual
//    berstatus Izin/Sakit) -> statusnya DITIMPA jadi "Hadir" (siswa ternyata datang & scan
//    terlambat). Ini BUKAN dianggap duplikat.
// 3) Satu-satunya status yang menolak scan ulang (DUPLIKAT_ABSEN) adalah kalau siswa itu SUDAH
//    berstatus "Hadir" -- supaya 1 siswa tidak bisa scan berkali-kali di hari yang sama.
// 4) Input Manual tetap bebas mengubah status kapan pun (lihat processAbsensiManual() yang memang
//    tidak punya pengecekan duplikat sama sekali) -- jadi guru & scan QR bisa saling menimpa status
//    Alpa/Izin/Sakit tanpa pernah kena error, KECUALI status yang sudah "Hadir" saat mau discan ulang.
function processScanAbsen(payload) {
  // LockService ditambahkan karena sekarang 1 scan bisa menulis BANYAK baris sekaligus (auto-Alpa
  // massal) -- tanpa lock, 2 siswa yang scan nyaris bersamaan bisa sama-sama mengira dirinya "scan
  // pertama hari itu" dan sama-sama menulis Alpa massal, sehingga datanya dobel.
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetAbsen = ss.getSheetByName(SHEETS.ABSENSI.name);

    // OPTIMASI: sebelumnya baris ini baca SELURUH sheet Data_Siswa (semua kolom, semua baris) tiap
    // kali ada 1 scan QR. Sekarang pakai getSiswaCacheList() yang di-cache 30 menit dan otomatis
    // di-invalidate saat data siswa berubah (lihat invalidateSiswaCache() di doPost). Cache ini
    // sekarang juga menyimpan "Kelas" tiap siswa (lihat komentar di getSiswaCacheList()).
    const siswaList = getSiswaCacheList();
    let namaSiswa = null;
    let idSiswaAsli = null; // ID kanonik siswa (kolom "ID" di Data_Siswa), BUKAN nilai NISN hasil scan QR
    for (let i = 0; i < siswaList.length; i++) {
      if (siswaList[i].NISN === String(payload.nisn) || siswaList[i].ID === String(payload.nisn)) {
        namaSiswa = siswaList[i].Nama;
        idSiswaAsli = siswaList[i].ID;
        break;
      }
    }
    if (!namaSiswa) throw new Error("Gagal: NISN tidak ada di database!");

    const headers = sheetAbsen.getRange(1, 1, 1, sheetAbsen.getLastColumn()).getValues()[0];
    const statusCol = headers.indexOf("Status");
    let [thn, bln] = payload.tanggal.split('-');
    const kelas = String(payload.kelas).trim();
    const mapel = String(payload.mapel).trim();

    // OPTIMASI: tetap ambil hanya 4 kolom pertama (Waktu, Kelas, Mapel, ID_Siswa) dulu utk
    // pencocokan cepat -- sama seperti sebelumnya, mengurangi data yang ditransfer dari Sheets.
    const lastRowAbsen = sheetAbsen.getLastRow();
    const existingData = lastRowAbsen > 1 ? sheetAbsen.getRange(2, 1, lastRowAbsen - 1, 4).getValues() : [];

    // Cari record siswa yang scan ini, SEKALIGUS cek apakah sudah ada record LAIN utk kelas+mapel+
    // tanggal ini (dari scan sebelumnya ATAU dari Input Manual) -- dipakai sebagai penanda "apakah
    // ini scan pertama hari ini utk kelas ini".
    let rowIdxSiswaIni = -1;
    let adaRecordLainDiKelasIni = false;
    for (let i = 0; i < existingData.length; i++) {
      if (cellToCompareString(existingData[i][0]) === payload.tanggal && cellToCompareString(existingData[i][1]) === kelas && cellToCompareString(existingData[i][2]) === mapel) {
        adaRecordLainDiKelasIni = true;
        if (String(existingData[i][3]) === String(idSiswaAsli)) rowIdxSiswaIni = i + 2; // +2: offset header + array mulai baris ke-2
      }
    }

    if (rowIdxSiswaIni > -1) {
      const statusSekarang = sheetAbsen.getRange(rowIdxSiswaIni, statusCol + 1).getValue();
      if (statusSekarang === "Hadir") {
        // Siswa ini sudah tercatat Hadir hari ini (sudah pernah scan) -> tolak, cegah scan ganda.
        throw new Error(`DUPLIKAT_ABSEN: ${namaSiswa} sudah mengambil absen hari ini!`);
      }
      // Status sekarang Alpa (auto-isi sistem) ATAU Izin/Sakit (Input Manual guru) -> siswa
      // ternyata datang & scan terlambat, timpa jadi Hadir. Bukan duplikat.
      sheetAbsen.getRange(rowIdxSiswaIni, statusCol + 1).setValue("Hadir");
      return `BERHASIL: Absen ${namaSiswa} Tercatat`;
    }

    if (!adaRecordLainDiKelasIni) {
      // INI SCAN PERTAMA hari ini utk kelas ini -> auto-isi Alpa utk semua siswa lain sekelas yang
      // belum tercatat, supaya guru tidak wajib membuka Input Manual kalau cuma 1-2 siswa absen.
      const siswaSekelasLain = siswaList.filter(s => s.Kelas === kelas && String(s.ID) !== String(idSiswaAsli));
      const alpaRows = siswaSekelasLain.map(s => {
        const rec = { Waktu: payload.tanggal, Tanggal: payload.tanggal, Kelas: kelas, Mapel: mapel, ID_Siswa: s.ID, "Nama Siswa": s.Nama, Status: "Alpa", "Nama Guru": "Sistem (Auto)", Bulan: bln, Tahun: thn };
        return headers.map(h => rec[h] !== undefined ? rec[h] : "");
      });
      if (alpaRows.length > 0) {
        const startRow = sheetAbsen.getLastRow() + 1;
        sheetAbsen.getRange(startRow, 1, alpaRows.length, headers.length).setValues(alpaRows);
        for (let i = 0; i < alpaRows.length; i++) {
          fixDateColumnsAsText(sheetAbsen, headers, startRow + i, payload.tanggal, kelas);
        }
      }
    }

    // Catat siswa yang scan sebagai Hadir.
    const newRec = { Waktu: payload.tanggal, Tanggal: payload.tanggal, Kelas: kelas, Mapel: mapel, ID_Siswa: idSiswaAsli, "Nama Siswa": namaSiswa, Status: "Hadir", "Nama Guru": "Scanner", Bulan: bln, Tahun: thn };
    sheetAbsen.appendRow(headers.map(h => newRec[h] !== undefined ? newRec[h] : ""));
    fixDateColumnsAsText(sheetAbsen, headers, sheetAbsen.getLastRow(), payload.tanggal, kelas);

    return `BERHASIL: Absen ${namaSiswa} Tercatat`;
  } finally {
    lock.releaseLock();
  }
}

function processPenilaian(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.NILAI.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  let tgl = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  const existingData = sheet.getDataRange().getValues();
  
  payload.records.forEach(rec => {
    let rowIdx = -1;
    for(let i = 1; i < existingData.length; i++) {
      if(cellToCompareString(existingData[i][1]) === String(payload.jenis).trim() && cellToCompareString(existingData[i][2]) === String(payload.mapel).trim() && cellToCompareString(existingData[i][3]) === String(payload.kelas).trim() && cellToCompareString(existingData[i][4]) === String(rec.ID_Siswa).trim()) {
        rowIdx = i + 1; break;
      }
    }
    if(rowIdx > -1) {
      sheet.getRange(rowIdx, headers.indexOf("Nilai") + 1).setValue(rec.Nilai);
    } else {
      let newRec = { Waktu: tgl, Jenis: payload.jenis, Mapel: payload.mapel, Kelas: payload.kelas, ID_Siswa: rec.ID_Siswa, "Nama Siswa": rec.Nama_Siswa, Nilai: rec.Nilai, "Nama Guru": payload.guru };
      sheet.appendRow(headers.map(h => newRec[h] !== undefined ? newRec[h] : ""));
    }
  });
  return "Nilai disimpan";
}

// Menyimpan nilai untuk beberapa jenis penilaian sekaligus (Sumatif1-Sumatif8, NonTes, Tes) dalam satu kali panggilan.
// Kolom "Jenis" bersifat generik (string bebas) sehingga tidak perlu perubahan skema/kode saat nama jenis penilaian berubah di frontend.
// payload = { kelas, mapel, semester, guru, siswa: [ { ID_Siswa, Nama_Siswa, nilai: { TP1: 80, TP2: '', PTS: 90, ... } } ] }
// Baris hanya dibuat jika sebelumnya sudah ada ATAU nilainya diisi (tidak kosong), agar sheet tidak dipenuhi baris kosong.
// Kunci pencocokan baris sekarang juga menyertakan "Semester" (selain Jenis/Mapel/Kelas/ID_Siswa)
// supaya data nilai Semester Ganjil & Genap tidak saling menimpa.
function processPenilaianMulti(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.NILAI.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colJenis = headers.indexOf("Jenis");
  const colMapel = headers.indexOf("Mapel");
  const colKelas = headers.indexOf("Kelas");
  const colSemester = headers.indexOf("Semester");
  const colSiswa = headers.indexOf("ID_Siswa");
  let tgl = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  const existingData = sheet.getDataRange().getValues();
  const kelas = String(payload.kelas).trim();
  const mapel = String(payload.mapel).trim();
  const semester = String(payload.semester || "").trim();
  const guru = payload.guru;
  const newRows = [];

  (payload.siswa || []).forEach(s => {
    const sid = String(s.ID_Siswa).trim();
    const nama = s.Nama_Siswa;
    const jenisMap = s.nilai || {};

    Object.keys(jenisMap).forEach(jenis => {
      const val = jenisMap[jenis];
      let rowIdx = -1;
      for (let i = 1; i < existingData.length; i++) {
        if (cellToCompareString(existingData[i][colJenis]) === String(jenis).trim() && cellToCompareString(existingData[i][colMapel]) === mapel && cellToCompareString(existingData[i][colKelas]) === kelas && cellToCompareString(existingData[i][colSemester]) === semester && cellToCompareString(existingData[i][colSiswa]) === sid) {
          rowIdx = i + 1; break;
        }
      }
      if (rowIdx > -1) {
        sheet.getRange(rowIdx, headers.indexOf("Nilai") + 1).setValue(val);
      } else if (val !== '' && val !== null && val !== undefined) {
        let newRec = { Waktu: tgl, Jenis: jenis, Mapel: mapel, Kelas: kelas, Semester: semester, ID_Siswa: sid, "Nama Siswa": nama, Nilai: val, "Nama Guru": guru };
        newRows.push(headers.map(h => newRec[h] !== undefined ? newRec[h] : ""));
      }
    });
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }
  return "Nilai tersimpan";
}

// Menyimpan nilai Tugas (PR) untuk beberapa jenis PR (PR1, PR2, dst) sekaligus, diketik manual
// oleh guru per siswa per jenis PR (bukan ceklis lagi). Kolom "Status" tetap dipakai sebagai
// tempat penyimpanan (supaya struktur sheet Data_Tugas tidak berubah), tapi sekarang isinya
// adalah nilai/angka yang diketik guru, bukan cuma "1"/"" seperti sebelumnya.
// payload = { kelas, mapel, semester, guru, siswa: [ { ID_Siswa, Nama_Siswa, tugas: { PR1: "85", PR2: "90", ... } } ] }
// Sama pola dengan processPenilaianMulti (val disimpan apa adanya). Kunci pencocokan baris
// tetap menyertakan "Semester" (selain Jenis/Mapel/Kelas/ID_Siswa) supaya data PR Semester
// Ganjil & Genap tidak saling menimpa.
function processTugasMulti(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.TUGAS.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colJenis = headers.indexOf("Jenis");
  const colMapel = headers.indexOf("Mapel");
  const colKelas = headers.indexOf("Kelas");
  const colSemester = headers.indexOf("Semester");
  const colSiswa = headers.indexOf("ID_Siswa");
  let tgl = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  const existingData = sheet.getDataRange().getValues();
  const kelas = String(payload.kelas).trim();
  const mapel = String(payload.mapel).trim();
  const semester = String(payload.semester || "").trim();
  const guru = payload.guru;
  const newRows = [];

  (payload.siswa || []).forEach(s => {
    const sid = String(s.ID_Siswa).trim();
    const nama = s.Nama_Siswa;
    const tugasMap = s.tugas || {};

    Object.keys(tugasMap).forEach(jenis => {
      const statusVal = tugasMap[jenis] !== undefined && tugasMap[jenis] !== null ? String(tugasMap[jenis]).trim() : "";
      let rowIdx = -1;
      for (let i = 1; i < existingData.length; i++) {
        if (cellToCompareString(existingData[i][colJenis]) === String(jenis).trim() && cellToCompareString(existingData[i][colMapel]) === mapel && cellToCompareString(existingData[i][colKelas]) === kelas && cellToCompareString(existingData[i][colSemester]) === semester && cellToCompareString(existingData[i][colSiswa]) === sid) {
          rowIdx = i + 1; break;
        }
      }
      if (rowIdx > -1) {
        sheet.getRange(rowIdx, headers.indexOf("Status") + 1).setValue(statusVal);
      } else if (statusVal !== '') {
        let newRec = { Waktu: tgl, Jenis: jenis, Mapel: mapel, Kelas: kelas, Semester: semester, ID_Siswa: sid, "Nama Siswa": nama, Status: statusVal, "Nama Guru": guru };
        newRows.push(headers.map(h => newRec[h] !== undefined ? newRec[h] : ""));
      }
    });
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }
  return "Tugas tersimpan";
}

// Menyimpan data Remedial & Pengayaan, 1 baris per siswa per kelas, mapel & semester (bukan per
// jenis seperti Nilai/Tugas), berisi kolom Lingkup Materi (teks bebas diketik guru), Nilai Sebelum
// & Nilai Sesudah (angka, opsional), Pengayaan (ceklis), Bentuk Pengayaan (teks bebas diketik
// guru), Remedial (ceklis), Bentuk Remedial (teks bebas diketik guru).
// payload = { kelas, mapel, semester, guru, siswa: [ { ID_Siswa, Nama_Siswa, Lingkup_Materi, Nilai_Sebelum, Nilai_Sesudah, Pengayaan, Bentuk_Pengayaan, Remedial, Bentuk_Remedial } ] }
// Kunci pencocokan baris sekarang juga menyertakan "Semester" (selain Mapel/Kelas/ID_Siswa)
// supaya data Semester Ganjil & Genap tidak saling menimpa.
function processRemedialPengayaan(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.REMEDIAL.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colMapel = headers.indexOf("Mapel");
  const colKelas = headers.indexOf("Kelas");
  const colSemester = headers.indexOf("Semester");
  const colSiswa = headers.indexOf("ID_Siswa");
  let tgl = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  const existingData = sheet.getDataRange().getValues();
  const kelas = String(payload.kelas).trim();
  const mapel = String(payload.mapel).trim();
  const semester = String(payload.semester || "").trim();
  const guru = payload.guru;
  const newRows = [];

  (payload.siswa || []).forEach(s => {
    const sid = String(s.ID_Siswa).trim();
    const nama = s.Nama_Siswa;
    const lingkupMateri = s.Lingkup_Materi || "";
    const nilaiSebelum = s.Nilai_Sebelum || "";
    const nilaiSesudah = s.Nilai_Sesudah || "";
    const pengayaan = s.Pengayaan ? "1" : "";
    const bentukPengayaan = s.Bentuk_Pengayaan || "";
    const remedial = s.Remedial ? "1" : "";
    const bentukRemedial = s.Bentuk_Remedial || "";
    const isKosong = lingkupMateri === "" && nilaiSebelum === "" && nilaiSesudah === "" && pengayaan === "" && remedial === "" && bentukPengayaan === "" && bentukRemedial === "";

    let rowIdx = -1;
    for (let i = 1; i < existingData.length; i++) {
      if (cellToCompareString(existingData[i][colMapel]) === mapel && cellToCompareString(existingData[i][colKelas]) === kelas && cellToCompareString(existingData[i][colSemester]) === semester && cellToCompareString(existingData[i][colSiswa]) === sid) {
        rowIdx = i + 1; break;
      }
    }
    if (rowIdx > -1) {
      // Tulis 7 kolom sekaligus (Lingkup Materi, Nilai Sebelum, Nilai Sesudah, Pengayaan, Bentuk
      // Pengayaan, Remedial, Bentuk Remedial) yang berurutan berdampingan di header, bukan pakai
      // indeks kolom satu-satu, supaya konsisten dengan urutan definisi SHEETS.REMEDIAL.headers.
      sheet.getRange(rowIdx, headers.indexOf("Lingkup Materi") + 1, 1, 7).setValues([[lingkupMateri, nilaiSebelum, nilaiSesudah, pengayaan, bentukPengayaan, remedial, bentukRemedial]]);
    } else if (!isKosong) {
      let newRec = { Waktu: tgl, Mapel: mapel, Kelas: kelas, Semester: semester, ID_Siswa: sid, "Nama Siswa": nama, "Lingkup Materi": lingkupMateri, "Nilai Sebelum": nilaiSebelum, "Nilai Sesudah": nilaiSesudah, Pengayaan: pengayaan, "Bentuk Pengayaan": bentukPengayaan, Remedial: remedial, "Bentuk Remedial": bentukRemedial, "Nama Guru": guru };
      newRows.push(headers.map(h => newRec[h] !== undefined ? newRec[h] : ""));
    }
  });

  if (newRows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
  }
  return "Remedial & Pengayaan tersimpan";
}

// Menyimpan 1 tabel Analisis Hasil Ulangan Harian/Asesmen (AHUH) -- setara sheet "Data AHUH" pada
// file Excel AHUH plus.xlsm. Data soal (skor maks tiap nomor soal) & data siswa (skor perolehan
// tiap siswa per nomor soal) dikirim sebagai JSON string di kolom "Data Soal" / "Data Siswa" --
// pola sama dengan processKokurikuler()/processEkstrakurikuler() (kolom "Data Tema"/"Data Peserta"),
// karena jumlah kolom soal per mapel bisa berbeda-beda (tidak tetap) sehingga tidak cocok disimpan
// sebagai 1 baris per siswa per soal seperti Data_Nilai/Data_Tugas.
// Kunci unik 1 tabel AHUH adalah kombinasi Mapel + Kelas + Semester + Tahun Ajaran -- supaya
// "setiap mapel punya tabel AHUH masing-masing" dan otomatis ter-update (bukan duplikat baris baru)
// setiap kali guru menyimpan ulang tabel AHUH mapel/kelas/semester/tahun ajaran yang sama.
function processAHUH(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.AHUH.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colMapel = headers.indexOf("Mapel");
  const colKelas = headers.indexOf("Kelas");
  const colSemester = headers.indexOf("Semester");
  const colTA = headers.indexOf("Tahun Ajaran");
  const existingData = sheet.getDataRange().getValues();

  const mapel = String(payload.Mapel || "").trim();
  const kelas = String(payload.Kelas || "").trim();
  const semester = String(payload.Semester || "").trim();
  const ta = String(payload["Tahun Ajaran"] || "").trim();

  let rowIdx = -1;
  for (let i = 1; i < existingData.length; i++) {
    if (cellToCompareString(existingData[i][colMapel]) === mapel && cellToCompareString(existingData[i][colKelas]) === kelas &&
        cellToCompareString(existingData[i][colSemester]) === semester && cellToCompareString(existingData[i][colTA]) === ta) {
      rowIdx = i + 1; break;
    }
  }
  if (!payload.ID) payload.ID = "AHUH" + Date.now();
  payload.Waktu = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");

  const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : "");
  if (rowIdx > -1) {
    sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return { message: "Tabel AHUH tersimpan", ID: payload.ID };
}

// Menyimpan 1 tabel Riwayat Scan LJK (Tab "Riwayat Scan" di menu Scan LJK) -- hasil scan mentah per
// siswa (Jawaban Terdeteksi) ditambah nilai Esai/Isian yang diketik manual oleh guru, disimpan
// sebagai JSON string di kolom "Data Siswa" (pola identik processAHUH() di atas, kolom "Data Soal"/
// "Data Siswa"), karena jumlah soal & jumlah siswa per kelas bervariasi sehingga tidak cocok
// disimpan sebagai 1 baris per siswa per soal seperti Data_Nilai/Data_Tugas.
// Kunci unik 1 tabel Riwayat Scan LJK adalah kombinasi Mapel + Kelas + Semester + Tahun Ajaran --
// otomatis ter-update (bukan duplikat baris baru) setiap kali guru menekan "Simpan Riwayat" untuk
// mapel/kelas/semester/tahun ajaran yang sama (mis. menambah scan siswa baru / mengedit Esai/Isian).
// Data Nilai Akhir (hasil PG+Esai+Isian) yang benar-benar masuk ke rapor TETAP lewat
// processPenilaianMulti() (tombol "Simpan ke Nilai Tujuan") -- fungsi ini murni penyimpanan riwayat/
// draft supaya guru bisa membuka & melanjutkan pekerjaannya kapan saja tanpa scan ulang dari kamera.
// PERBAIKAN BUG: sebelumnya HANYA "Jumlah Soal" (angkanya saja) yang disimpan, "Kunci Jawaban"
// (teks huruf ABCDE...) TIDAK pernah ikut disimpan. Akibatnya setiap kali guru login ulang/refresh,
// input Kunci Jawaban di frontend kosong lagi -> tabel Riwayat Scan tidak bisa menghitung ulang
// Benar/Salah/Kosong/Ganda/Nilai PG (semuanya tampil 0/"-") walau Nama Siswa & Jawaban mentah hasil
// scan sudah tersimpan dengan benar di kolom "Data Siswa". Sekarang "Kunci Jawaban" ikut disimpan
// sebagai kolom sendiri (lihat SHEETS.LJK_RIWAYAT.headers di atas) dan dikirim balik ke frontend
// lewat getAllData() seperti kolom lain, sehingga bisa dipulihkan otomatis (lihat loadRiwayatLJK()
// di file frontend).
function processLJKRiwayat(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.LJK_RIWAYAT.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colMapel = headers.indexOf("Mapel");
  const colKelas = headers.indexOf("Kelas");
  const colSemester = headers.indexOf("Semester");
  const colTA = headers.indexOf("Tahun Ajaran");
  const existingData = sheet.getDataRange().getValues();

  const mapel = String(payload.Mapel || "").trim();
  const kelas = String(payload.Kelas || "").trim();
  const semester = String(payload.Semester || "").trim();
  const ta = String(payload["Tahun Ajaran"] || "").trim();

  let rowIdx = -1;
  for (let i = 1; i < existingData.length; i++) {
    if (cellToCompareString(existingData[i][colMapel]) === mapel && cellToCompareString(existingData[i][colKelas]) === kelas &&
        cellToCompareString(existingData[i][colSemester]) === semester && cellToCompareString(existingData[i][colTA]) === ta) {
      rowIdx = i + 1; break;
    }
  }
  if (!payload.ID) payload.ID = "LJKR" + Date.now();
  payload.Waktu = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");

  const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : "");
  if (rowIdx > -1) {
    sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return { message: "Riwayat Scan LJK tersimpan", ID: payload.ID };
}

// Menyimpan 1 laporan Ekstrakurikuler (data umum kegiatan + tabel peserta yang dikirim sebagai
// JSON string di kolom "Data Peserta" + sampai 6 foto dokumentasi base64 di kolom Foto1..Foto6).
// Kalau payload.ID sudah ada & cocok dengan baris yang sudah tersimpan -> baris itu di-UPDATE
// (dipakai saat guru mengedit ulang laporan yang sama). Kalau ID belum ada / belum ditemukan ->
// buat ID baru & tambahkan baris baru, supaya guru bisa punya banyak laporan ekstrakurikuler
// (per kegiatan, per bulan/semester) sekaligus.
function processEkstrakurikuler(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.EKSTRAKURIKULER.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idCol = headers.indexOf("ID");
  const existingData = sheet.getDataRange().getValues();

  let rowIdx = -1;
  if (payload.ID) {
    for (let i = 1; i < existingData.length; i++) {
      if (String(existingData[i][idCol]) === String(payload.ID)) { rowIdx = i + 1; break; }
    }
  }
  if (!payload.ID) payload.ID = "EKSKUL" + Date.now();

  // OPTIMASI: upload Foto1..Foto6 (kalau ada base64 baru) ke Drive & ganti isinya jadi link Drive
  // saja sebelum ditulis ke Sheet -- lihat prosesFotoDokumentasi() di atas.
  const existingRowValues = rowIdx > -1 ? existingData[rowIdx - 1] : null;
  prosesFotoDokumentasi(payload, ["Foto1", "Foto2", "Foto3", "Foto4", "Foto5", "Foto6"], "Ekstrakurikuler", existingRowValues, headers);

  const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : "");
  if (rowIdx > -1) {
    sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  // Kirim balik link Drive Foto1..Foto6 hasil upload ke client, supaya client bisa memperbarui
  // preview foto ("Lihat Foto") tanpa perlu sinkronisasi ulang seluruh data (pola sama seperti
  // processArsip() mengembalikan "Data Arsip").
  return {
    message: "Laporan Ekstrakurikuler tersimpan", ID: payload.ID,
    Foto1: payload.Foto1, Foto2: payload.Foto2, Foto3: payload.Foto3,
    Foto4: payload.Foto4, Foto5: payload.Foto5, Foto6: payload.Foto6
  };
}

// Menyimpan 1 laporan Kokurikuler (data umum kegiatan + tabel tema/kegiatan yang dikirim sebagai
// JSON string di kolom "Data Tema" + sampai 6 foto dokumentasi base64 di kolom Foto1..Foto6).
// Pola persis sama dengan processEkstrakurikuler(): kalau payload.ID sudah ada & cocok dengan baris
// yang sudah tersimpan -> baris itu di-UPDATE (dipakai saat guru mengedit ulang laporan yang sama).
// Kalau ID belum ada / belum ditemukan -> buat ID baru & tambahkan baris baru, supaya guru bisa
// punya banyak laporan kokurikuler (per kelas, per bulan/semester) sekaligus.
function processKokurikuler(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.KOKURIKULER.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idCol = headers.indexOf("ID");
  const existingData = sheet.getDataRange().getValues();

  let rowIdx = -1;
  if (payload.ID) {
    for (let i = 1; i < existingData.length; i++) {
      if (String(existingData[i][idCol]) === String(payload.ID)) { rowIdx = i + 1; break; }
    }
  }
  if (!payload.ID) payload.ID = "KOKUR" + Date.now();

  // OPTIMASI: upload Foto1..Foto6 (kalau ada base64 baru) ke Drive & ganti isinya jadi link Drive
  // saja sebelum ditulis ke Sheet -- lihat prosesFotoDokumentasi() di atas.
  const existingRowValues = rowIdx > -1 ? existingData[rowIdx - 1] : null;
  prosesFotoDokumentasi(payload, ["Foto1", "Foto2", "Foto3", "Foto4", "Foto5", "Foto6"], "Kokurikuler", existingRowValues, headers);

  const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : "");
  if (rowIdx > -1) {
    sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }
  return {
    message: "Laporan Kokurikuler tersimpan", ID: payload.ID,
    Foto1: payload.Foto1, Foto2: payload.Foto2, Foto3: payload.Foto3,
    Foto4: payload.Foto4, Foto5: payload.Foto5, Foto6: payload.Foto6
  };
}

// Menyimpan 1 laporan Piket Harian (data umum piket per tanggal + tabel kegiatan yang dikirim
// sebagai JSON string di kolom "Data Kegiatan" + sampai 2 foto dokumentasi base64 di kolom
// Foto1..Foto2). Pola persis sama dengan processEkstrakurikuler()/processKokurikuler(): kalau
// payload.ID sudah ada & cocok dengan baris yang sudah tersimpan -> baris itu di-UPDATE (dipakai
// saat guru mengedit ulang laporan piket hari yang sama). Kalau ID belum ada / belum ditemukan ->
// buat ID baru & tambahkan baris baru, supaya guru bisa punya banyak laporan piket (per tanggal).
function processPiket(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.PIKET.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idCol = headers.indexOf("ID");
  const existingData = sheet.getDataRange().getValues();

  let rowIdx = -1;
  if (payload.ID) {
    for (let i = 1; i < existingData.length; i++) {
      if (String(existingData[i][idCol]) === String(payload.ID)) { rowIdx = i + 1; break; }
    }
  }
  if (!payload.ID) payload.ID = "PIKET" + Date.now();

  // OPTIMASI: upload Foto1..Foto2 (kalau ada base64 baru) ke Drive & ganti isinya jadi link Drive
  // saja sebelum ditulis ke Sheet -- lihat prosesFotoDokumentasi() di atas.
  const existingRowValues = rowIdx > -1 ? existingData[rowIdx - 1] : null;
  prosesFotoDokumentasi(payload, ["Foto1", "Foto2"], "Piket", existingRowValues, headers);

  const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : "");
  if (rowIdx > -1) {
    sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
    // Pastikan kolom "Tanggal" tetap tersimpan sebagai teks (bukan otomatis jadi tipe Date),
    // sama seperti pola fixDateColumnsAsText() dipakai di modul Absensi.
    fixDateColumnsAsText(sheet, headers, rowIdx, payload['Tanggal'], payload['Kelas']);
  } else {
    sheet.appendRow(rowData);
    fixDateColumnsAsText(sheet, headers, sheet.getLastRow(), payload['Tanggal'], payload['Kelas']);
  }
  return {
    message: "Laporan Piket Harian tersimpan", ID: payload.ID,
    Foto1: payload.Foto1, Foto2: payload.Foto2
  };
}

// Menyimpan Daftar Piket Kelas: 1 baris PER KELAS berisi jadwal piket 6 hari (Senin-Sabtu), tiap
// kolom hari berisi JSON string array 6 nama siswa (boleh ada slot kosong ''). Beda dari
// processPiket()/processKokurikuler() di atas (yang kunci upsert-nya pakai "ID" supaya guru bisa
// punya banyak baris/laporan): di sini kunci upsert-nya pakai "Kelas", karena satu kelas cukup
// punya SATU daftar piket yang terus-menerus diperbarui (bukan riwayat berkala seperti laporan).
function processPiketKelas(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.PIKET_KELAS.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const kelasCol = headers.indexOf("Kelas");
  const existingData = sheet.getDataRange().getValues();

  let rowIdx = -1;
  for (let i = 1; i < existingData.length; i++) {
    if (cellToCompareString(existingData[i][kelasCol]) === String(payload.Kelas).trim()) { rowIdx = i + 1; break; }
  }
  if (!payload.ID) payload.ID = "PIKETKELAS" + Date.now();

  const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : "");
  if (rowIdx > -1) {
    sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
    sheet.getRange(rowIdx, kelasCol + 1).setNumberFormat("@").setValue(payload.Kelas);
  } else {
    sheet.appendRow(rowData);
    sheet.getRange(sheet.getLastRow(), kelasCol + 1).setNumberFormat("@").setValue(payload.Kelas);
  }
  return { message: "Daftar Piket Kelas tersimpan", ID: payload.ID };
}

// Mengambil (atau membuat kalau belum ada) folder Google Drive khusus tempat menyimpan file PDF
// Arsip Digital yang diupload guru. Dipakai supaya file PDF tidak disimpan sebagai teks base64
// panjang di dalam sel Spreadsheet (yang punya batas ~50.000 karakter per sel dan bisa membuat
// Spreadsheet menjadi sangat berat) -- hanya link Drive-nya saja yang disimpan di Sheet.
function getOrCreateArsipFolderDigital() {
  const folderName = "Arsip_Digital_GuruKelas";
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

// Mengubah 1 file PDF yang dikirim client sebagai data URL base64 (mis. "data:application/pdf;
// base64,....") menjadi file sungguhan di folder Drive di atas, lalu mengatur aksesnya supaya bisa
// dibuka lewat link (Anyone with link - View only). Mengembalikan ID & URL file tersebut untuk
// disimpan di kolom "Data Arsip".
function simpanFileArsipKeDrive(base64DataUrl, namaFile) {
  const match = String(base64DataUrl).match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Format file PDF tidak valid, gagal mengupload ke Drive.");
  const mimeType = match[1];
  const rawBase64 = match[2];
  const bytes = Utilities.base64Decode(rawBase64);
  const blob = Utilities.newBlob(bytes, mimeType, namaFile || ("Arsip_" + Date.now() + ".pdf"));

  const folder = getOrCreateArsipFolderDigital();
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { id: file.getId(), url: file.getUrl() };
}

// =========================================================================
// OPTIMASI PERFORMA: Foto Dokumentasi (Ekstrakurikuler, Kokurikuler, Piket Harian) -> Google Drive
// =========================================================================
// Sebelumnya foto dokumentasi disimpan sebagai TEKS BASE64 langsung di kolom Foto1..Foto6 (atau
// Foto1..Foto2 untuk Piket). Base64 1 foto bisa >100-200KB teks, dikali sampai 6 slot & dikali
// jumlah baris laporan, sel Sheet jadi sangat berat & payload request/response saveEkstrakurikuler/
// saveKokurikuler/savePiket ikut membengkak drastis (memperlambat kirim & muat data). Polanya
// sekarang disamakan dengan Arsip Digital di atas (simpanFileArsipKeDrive()): foto diupload ke
// folder Drive khusus, lalu yang disimpan di kolom Foto1/Foto2/dst HANYA LINK Drive-nya saja.

// Mengambil (atau membuat kalau belum ada) folder Google Drive khusus tempat menyimpan foto
// dokumentasi 1 modul (namaModul: "Ekstrakurikuler" / "Kokurikuler" / "Piket"). Dipisah per modul
// (folder sendiri-sendiri) supaya foto tidak bercampur & lebih mudah ditelusuri manual di Drive.
function getOrCreateFotoFolder(namaModul) {
  const folderName = "Foto_" + namaModul + "_GuruKelas";
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

// Mengubah 1 foto yang dikirim client sebagai data URL base64 (mis. "data:image/jpeg;base64,....")
// menjadi file sungguhan di folder Drive modul terkait, lalu mengatur aksesnya supaya bisa dibuka/
// ditampilkan lewat link (Anyone with link - View only). Mengembalikan URL dalam format
// "uc?export=view&id=..." (bukan file.getUrl() bawaan) supaya link ini bisa langsung dipakai
// sebagai src <img> di frontend untuk thumbnail, sekaligus tetap bisa dibuka langsung di tab baru.
function simpanFotoKeDrive(base64DataUrl, namaModul, namaFile) {
  const match = String(base64DataUrl).match(/^data:(.+);base64,(.*)$/);
  if (!match) return base64DataUrl; // bukan base64 baru -> biarkan apa adanya (harusnya tidak terjadi, dicek dulu oleh pemanggil)
  const mimeType = match[1];
  const rawBase64 = match[2];
  const bytes = Utilities.base64Decode(rawBase64);
  const blob = Utilities.newBlob(bytes, mimeType, namaFile || (namaModul + "_" + Date.now()));

  const folder = getOrCreateFotoFolder(namaModul);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return "https://drive.google.com/uc?export=view&id=" + file.getId();
}

// Mengambil ID file Drive dari sebuah link Drive yang tersimpan di Sheet (format
// "uc?export=view&id=FILE_ID" yang dipakai simpanFotoKeDrive() di atas, atau format lain seperti
// ".../d/FILE_ID/..." untuk jaga-jaga). Dipakai supaya file foto LAMA di Drive bisa dipindah ke
// Trash saat guru mengganti foto di slot yang sama (persis pola trash file lama di processArsip()),
// supaya tidak menumpuk file yatim di folder Drive tiap kali foto diganti.
function ambilIdFileDariUrlDrive(url) {
  if (!url) return null;
  const m = String(url).match(/[?&]id=([a-zA-Z0-9_-]+)/) || String(url).match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

// Memproses semua kolom foto 1 laporan (fotoKeys, mis. ["Foto1",...,"Foto6"]): kalau isi kolom foto
// adalah data URL base64 BARU (guru baru saja pilih/ganti foto lewat file input), upload ke Drive
// folder modul terkait lalu GANTI isi payload[fotoKey] jadi link Drive-nya saja -- supaya yang
// akhirnya ditulis ke Sheet cuma link, bukan base64. Kalau slot yang sama SEBELUMNYA sudah berupa
// link Drive (guru mengedit ulang laporan lama & mengganti fotonya), file lama di Drive dipindah ke
// Trash dulu supaya tidak menumpuk file yatim. Kalau isi kolom foto kosong / sudah berupa link Drive
// yang TIDAK diubah (guru tidak menyentuh slot itu saat mengedit), dibiarkan apa adanya -- artinya
// frontend WAJIB tetap mengirim link Drive lama tersebut di payload untuk slot yang tidak diubah
// (bukan dikosongkan), persis seperti pola FileUrl pada slot Arsip Digital yang tidak diganti.
function prosesFotoDokumentasi(payload, fotoKeys, namaModul, existingRowValues, headers) {
  fotoKeys.forEach(function(fotoKey) {
    const val = payload[fotoKey];
    if (val && String(val).indexOf("data:") === 0) {
      if (existingRowValues) {
        const idxKolom = headers.indexOf(fotoKey);
        const nilaiLama = idxKolom > -1 ? existingRowValues[idxKolom] : "";
        const idLama = ambilIdFileDariUrlDrive(nilaiLama);
        if (idLama) {
          try { DriveApp.getFileById(idLama).setTrashed(true); } catch (eHapus) {}
        }
      }
      payload[fotoKey] = simpanFotoKeDrive(val, namaModul, payload.ID ? (payload.ID + "_" + fotoKey) : undefined);
    }
    // kalau val kosong / sudah berupa link Drive (bukan "data:..." base64 baru), biarkan apa adanya.
  });
}

// Dipanggil frontend saat Cetak PDF (action "ambilFotoBase64", lihat ambilFotoUntukCetak() di
// frontend) untuk menukar balik link Drive Foto1..Foto6/Foto1..Foto2 (hasil simpanFotoKeDrive() di
// atas) menjadi base64, karena jsPDF (doc.addImage) hanya menerima gambar dalam bentuk base64/data
// URL, bukan link biasa. payload.urls berisi array link Drive yang perlu ditukar. Mengembalikan
// array {url, base64} (base64 "" kalau file tidak ditemukan/sudah dihapus/error lain) supaya
// frontend bisa memetakan balik ke slot foto yang sesuai lewat ambilIdFileDariUrlDrive()/peta url.
// PENTING: sebelumnya action "ambilFotoBase64" ini TIDAK terdaftar di router doPost() sama sekali,
// sehingga tiap kali dipanggil selalu gagal dengan error "Aksi tidak dikenali" -- akibatnya foto
// pada laporan yang sudah memakai skema link Drive SELALU kosong saat dicetak ke PDF (bukan cuma
// setelah laporan diedit ulang).
function processAmbilFotoBase64(payload) {
  const urls = (payload && payload.urls) || [];
  return urls.map(function(url) {
    try {
      const id = ambilIdFileDariUrlDrive(url);
      if (!id) return { url: url, base64: "" };
      const blob = DriveApp.getFileById(id).getBlob();
      const base64 = "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
      return { url: url, base64: base64 };
    } catch (eAmbil) {
      // File mungkin sudah dihapus/di-trash manual dari Drive, atau ID tidak valid -- lewati slot
      // ini (base64 kosong) daripada menggagalkan seluruh proses ambil foto untuk slot lain.
      return { url: url, base64: "" };
    }
  });
}

// Menyimpan 1 record Arsip Digital PER KELAS (pola upsert-nya sama seperti processPiketKelas():
// kunci upsert-nya "Kelas", karena satu kelas cukup punya SATU arsip yang terus diperbarui, bukan
// riwayat berkala). payload["Data Arsip"] dikirim client sebagai JSON string berisi array slot,
// masing-masing slot: { Nama (nama arsip yang diketik manual guru), FileName (nama file asli),
// FileBase64 (HANYA ADA kalau guru baru saja memilih/mengganti file di slot ini -- kalau slot belum
// diubah, field ini tidak dikirim lagi supaya payload tidak membengkak), FileUrl, FileId (link & ID
// Drive dari upload sebelumnya, kalau ada) }. Untuk setiap slot yang membawa FileBase64, file
// tersebut diupload ke Drive dulu (menggantikan file lama di slot yang sama kalau ada), lalu
// FileBase64 dihapus dari objek sebelum disimpan ke Sheet -- yang tersimpan di Sheet hanya
// FileUrl/FileId-nya saja.
function processArsip(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ARSIP.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const kelasCol = headers.indexOf("Kelas");
  const existingData = sheet.getDataRange().getValues();

  let slots = [];
  try { slots = JSON.parse(payload["Data Arsip"] || "[]"); } catch (e) { slots = []; }

  slots = slots.map(function(slotAsli) {
    const slot = slotAsli || {};
    if (slot.FileBase64) {
      // Kalau slot ini sebelumnya sudah punya file di Drive & sekarang diganti file baru,
      // pindahkan file lama ke Trash dulu supaya tidak menumpuk file yatim di folder Drive.
      if (slot.FileId) {
        try { DriveApp.getFileById(slot.FileId).setTrashed(true); } catch (eHapus) {}
      }
      const uploaded = simpanFileArsipKeDrive(slot.FileBase64, slot.FileName);
      slot.FileId = uploaded.id;
      slot.FileUrl = uploaded.url;
      delete slot.FileBase64;
    }
    return slot;
  });

  payload["Data Arsip"] = JSON.stringify(slots);

  let rowIdx = -1;
  for (let i = 1; i < existingData.length; i++) {
    if (cellToCompareString(existingData[i][kelasCol]) === String(payload.Kelas).trim()) { rowIdx = i + 1; break; }
  }
  if (!payload.ID) payload.ID = "ARSIP" + Date.now();

  const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : "");
  if (rowIdx > -1) {
    sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
    sheet.getRange(rowIdx, kelasCol + 1).setNumberFormat("@").setValue(payload.Kelas);
  } else {
    sheet.appendRow(rowData);
    sheet.getRange(sheet.getLastRow(), kelasCol + 1).setNumberFormat("@").setValue(payload.Kelas);
  }

  // Kirim balik "Data Arsip" yang sudah berisi FileUrl/FileId hasil upload ke client, supaya
  // client bisa memperbarui tampilan (link "Lihat PDF") tanpa perlu sinkronisasi ulang seluruh data.
  return { message: "Arsip Digital tersimpan", ID: payload.ID, "Data Arsip": payload["Data Arsip"] };
}

// Mencari nomor baris (1-based, siap dipakai di getRange) untuk 1 siswa di sheet Data_Siswa
// berdasarkan ID ATAU fallback NISN (lihat s['ID'] || s['NISN'] di beberapa tempat sisi Frontend
// seperti renderSiswa()/loadAnalisisUmur()/loadMutasiSiswa()). Dipakai bersama oleh
// processTanggalLahir() & processJenisKelamin() di bawah supaya logika pencarian tidak diulang.
function cariRowSiswa(headers, data, idSiswa) {
  const idCol = headers.indexOf("ID");
  const nisnCol = headers.indexOf("NISN");
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(idSiswa) || (nisnCol > -1 && String(data[i][nisnCol]) === String(idSiswa))) {
      return i + 1;
    }
  }
  return -1;
}

// Memperbarui HANYA 1 kolom tertentu (namaKolom) untuk 1 siswa di sheet Data_Siswa, dicari
// berdasarkan ID/NISN. Beda dari saveData() (yang hanya menambah baris baru): di sini kolom lain
// pada baris yang sama TIDAK ikut diubah. Dipakai oleh processTanggalLahir() & processJenisKelamin().
function updateSatuKolomSiswa(idSiswa, namaKolom, nilaiBaru) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SISWA.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const kolomIdx = headers.indexOf(namaKolom);
  if (kolomIdx === -1) throw new Error("Kolom " + namaKolom + " tidak ditemukan di sheet Data_Siswa.");

  const data = sheet.getDataRange().getValues();
  const rowIdx = cariRowSiswa(headers, data, idSiswa);
  if (rowIdx === -1) throw new Error("Data siswa tidak ditemukan, gagal menyimpan " + namaKolom + ".");

  sheet.getRange(rowIdx, kolomIdx + 1).setNumberFormat("@").setValue(nilaiBaru || "");
}

// Dipakai oleh menu Analisis Umur & Mutasi Siswa setiap kali guru mengisi/mengubah tanggal lahir
// lewat datepicker di tabel. Disimpan sebagai Teks (bukan tipe Date) supaya konsisten dengan kolom
// tanggal lain di sistem ini dan tidak salah geser zona waktu saat dibaca ulang oleh getAllData().
function processTanggalLahir(payload) {
  updateSatuKolomSiswa(payload.ID, "Tanggal Lahir", payload["Tanggal Lahir"]);
  return { message: "Tanggal lahir tersimpan", ID: payload.ID };
}

// Dipakai oleh menu Mutasi Siswa setiap kali guru memilih Jenis Kelamin lewat dropdown di tabel.
function processJenisKelamin(payload) {
  updateSatuKolomSiswa(payload.ID, "Jenis Kelamin", payload["Jenis Kelamin"]);
  return { message: "Jenis kelamin tersimpan", ID: payload.ID };
}

// Dipakai oleh tombol Edit (pop up SweetAlert2) di kolom Aksi menu Data Siswa pada frontend
// (editSiswa()) -- memperbarui NISN, Nama Siswa, Kelas, Jenis Kelamin, DAN Tanggal Lahir
// sekaligus dalam satu baris yang sama, dicari berdasarkan ID/NISN (pakai cariRowSiswa() yang
// sama dipakai processTanggalLahir()/processJenisKelamin()). Beda dari updateSatuKolomSiswa()
// yang cuma mengubah 1 kolom: di sini beberapa kolom diubah sekaligus dalam 1 kali simpan.
// Kolom "ID" pada baris tsb SENGAJA tidak pernah ditimpa oleh payload -- ID adalah identitas
// baris yang dipakai untuk mencari baris ini sendiri, jadi harus tetap sama persis seperti
// sebelumnya walau kebetulan payload.ID berisi fallback NISN (siswa lama yang belum punya ID).
// payload = { ID, NISN, "Nama Siswa", Kelas, "Jenis Kelamin", "Tanggal Lahir" }
function processUpdateSiswa(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.SISWA.name);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const data = sheet.getDataRange().getValues();
  const rowIdx = cariRowSiswa(headers, data, payload.ID);
  if (rowIdx === -1) throw new Error("Data siswa tidak ditemukan, gagal menyimpan perubahan.");

  const existingRow = data[rowIdx - 1];
  const rec = {
    NISN: payload.NISN,
    "Nama Siswa": payload["Nama Siswa"],
    Kelas: payload.Kelas,
    "Jenis Kelamin": payload["Jenis Kelamin"],
    "Tanggal Lahir": payload["Tanggal Lahir"]
  };
  const rowData = headers.map((h, i) => {
    if (h === "ID") return existingRow[i]; // ID tidak pernah diubah lewat form Edit ini
    return rec[h] !== undefined ? rec[h] : existingRow[i];
  });
  sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);

  // Sama seperti saveData()/updateSatuKolomSiswa(): paksa kolom Kelas & Tanggal Lahir tetap
  // berformat Teks supaya nilai seperti "7.1"/"07" atau tanggal tidak diam-diam diubah Google
  // Sheets jadi tipe Number/Date setelah ditulis ulang.
  const kelasIdx = headers.indexOf("Kelas");
  if (kelasIdx > -1) sheet.getRange(rowIdx, kelasIdx + 1).setNumberFormat("@").setValue(rec.Kelas);
  const tglLahirIdx = headers.indexOf("Tanggal Lahir");
  if (tglLahirIdx > -1) sheet.getRange(rowIdx, tglLahirIdx + 1).setNumberFormat("@").setValue(rec["Tanggal Lahir"] || "");

  return { message: "Data siswa berhasil diperbarui", ID: payload.ID };
}

// Menyimpan 1 record Mutasi Siswa (upsert berdasarkan "ID" -- sama seperti pola processPiket():
// kalau payload.ID sudah ada di sheet, baris itu diperbarui; kalau belum/baru, baris baru
// ditambahkan). Dipakai oleh menu Mutasi Siswa setiap kali guru mengisi/mengubah Tanggal Mutasi,
// Jenis Mutasi, Semester, atau Keterangan pada salah satu baris siswa di tabel -- 1 request per
// siswa yang datanya diubah, BUKAN dikirim sekaligus borongan 1 kelas, supaya siswa lain di kelas
// yang sama yang belum diubah datanya tidak ikut tertimpa.
// PERBAIKAN BUG: guru sering mengubah 2-3 kolom (Tanggal Mutasi, Jenis Mutasi, Keterangan) pada
// baris yang sama secara berurutan cepat -- tiap onchange langsung mengirim request sendiri-sendiri
// (lihat onChangeMutasiSiswa() di frontend), jadi 2 request bisa hampir bersamaan sampai ke server.
// Tanpa penguncian, request kedua bisa membaca existingData SEBELUM request pertama selesai menulis
// baris barunya -- akibatnya rowIdx pada request kedua tidak ditemukan (-1) padahal baris itu
// sebenarnya baru saja dibuat, sehingga malah menambah baris baru duplikat dengan ID yang sama,
// dan salah satu kolom (mis. Jenis Mutasi) jadi terlihat kosong/"tidak tersimpan" karena yang
// terbaca balik ke tabel cuma baris pertama yang belum lengkap. LockService di bawah memaksa
// proses simpan berjalan satu per satu (serial), bukan tumpang tindih.
function processMutasiSiswa(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.MUTASI.name);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idCol = headers.indexOf("ID");
    const existingData = sheet.getDataRange().getValues();

    let rowIdx = -1;
    if (payload.ID) {
      for (let i = 1; i < existingData.length; i++) {
        if (String(existingData[i][idCol]) === String(payload.ID)) { rowIdx = i + 1; break; }
      }
    }
    if (!payload.ID) payload.ID = "MUTASI" + Date.now();

    const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : "");
    if (rowIdx > -1) {
      sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
      fixDateColumnsAsText(sheet, headers, rowIdx, payload['Tanggal Mutasi'], payload['Kelas']);
    } else {
      sheet.appendRow(rowData);
      fixDateColumnsAsText(sheet, headers, sheet.getLastRow(), payload['Tanggal Mutasi'], payload['Kelas']);
    }
    return { message: "Data mutasi tersimpan", ID: payload.ID };
  } finally {
    lock.releaseLock();
  }
}

// Menyimpan 1 baris barang Inventaris Kelas (upsert berdasarkan "ID", sama seperti pola
// processMutasiSiswa() di atas). Dipakai oleh menu Inventaris Kelas setiap kali guru
// menambah/mengubah salah satu baris barang di tabel -- 1 request per baris yang datanya diubah,
// supaya baris barang lain di kelas yang sama tidak ikut tertimpa.
// PERBAIKAN BUG: sama seperti processMutasiSiswa(), dikunci dengan LockService supaya 2 perubahan
// cepat berturut-turut pada baris yang sama (mis. Kode Barang lalu Jumlah) tidak diproses tumpang
// tindih dan menimbulkan baris duplikat/data hilang.
function processInventarisKelas(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.INVENTARIS.name);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idCol = headers.indexOf("ID");
    const existingData = sheet.getDataRange().getValues();

    let rowIdx = -1;
    if (payload.ID) {
      for (let i = 1; i < existingData.length; i++) {
        if (String(existingData[i][idCol]) === String(payload.ID)) { rowIdx = i + 1; break; }
      }
    }
    if (!payload.ID) payload.ID = "INV" + Date.now();

    const rowData = headers.map(h => payload[h] !== undefined ? payload[h] : "");
    if (rowIdx > -1) {
      sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }
    const kelasCol = headers.indexOf("Kelas");
    const targetRow = rowIdx > -1 ? rowIdx : sheet.getLastRow();
    if (kelasCol > -1) sheet.getRange(targetRow, kelasCol + 1).setNumberFormat("@");

    return { message: "Data inventaris tersimpan", ID: payload.ID };
  } finally {
    lock.releaseLock();
  }
}

// Menyimpan SELURUH baris siswa di tabel Mutasi Siswa (1 kelas) sekaligus dalam satu kali
// panggilan, dipicu oleh tombol "Simpan Data Mutasi" di frontend (saveMutasiSiswaAll()) -- pola
// batch yang sama seperti processPenilaianMulti()/processTugasMulti(), menggantikan
// processMutasiSiswa() yang sebelumnya dipanggil 1x per baris/per kolom. Setiap baris di-upsert
// berdasarkan "ID" (ID mutasi dibuat di sisi client kalau baris tsb baru). LockService tetap
// dipakai supaya proses simpan tidak tumpang tindih dengan request lain yang mengubah sheet yang
// sama (mis. hapusMutasiSiswa yang jalan hampir bersamaan).
// payload = { kelas, semester, guru, siswa: [ { ID, ID_Siswa, "Nama Siswa", "Tanggal Mutasi", "Jenis Mutasi", Keterangan } ] }
function processMutasiSiswaMulti(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.MUTASI.name);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idCol = headers.indexOf("ID");
    const tglMutasiCol = headers.indexOf("Tanggal Mutasi");
    const existingData = sheet.getDataRange().getValues();
    const kelas = String(payload.kelas).trim();
    const semester = String(payload.semester || "").trim();
    const guru = payload.guru;
    const newRows = [];

    (payload.siswa || []).forEach(s => {
      const mutasiId = String(s.ID).trim();
      let rowIdx = -1;
      for (let i = 1; i < existingData.length; i++) {
        if (String(existingData[i][idCol]) === mutasiId) { rowIdx = i + 1; break; }
      }
      const rec = {
        ID: mutasiId,
        ID_Siswa: s.ID_Siswa,
        "Nama Siswa": s["Nama Siswa"],
        Kelas: kelas,
        Semester: semester,
        "Tanggal Mutasi": s["Tanggal Mutasi"],
        "Jenis Mutasi": s["Jenis Mutasi"],
        Keterangan: s.Keterangan,
        "Nama Guru": guru
      };
      const rowData = headers.map(h => rec[h] !== undefined ? rec[h] : "");
      if (rowIdx > -1) {
        sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
        fixDateColumnsAsText(sheet, headers, rowIdx, rec["Tanggal Mutasi"], kelas);
      } else {
        newRows.push(rowData);
      }
    });

    if (newRows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
      for (let i = 0; i < newRows.length; i++) {
        fixDateColumnsAsText(sheet, headers, startRow + i, newRows[i][tglMutasiCol], kelas);
      }
    }
    return { message: "Data mutasi tersimpan" };
  } finally {
    lock.releaseLock();
  }
}

// Menyimpan SELURUH baris barang di tabel Inventaris Kelas (1 kelas) sekaligus dalam satu kali
// panggilan, dipicu oleh tombol "Simpan Data Inventaris" di frontend (saveInventarisKelasAll()) --
// pola batch yang sama seperti processMutasiSiswaMulti() di atas, menggantikan
// processInventarisKelas() yang sebelumnya dipanggil 1x per baris/per kolom. Setiap baris
// di-upsert berdasarkan "ID" (ID barang dibuat di sisi client kalau baris tsb baru).
// payload = { kelas, semester, guru, barang: [ { ID, "Kode Barang", "Nama Barang", Jumlah, Kondisi, Keterangan } ] }
function processInventarisKelasMulti(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.INVENTARIS.name);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idCol = headers.indexOf("ID");
    const kelasCol = headers.indexOf("Kelas");
    const existingData = sheet.getDataRange().getValues();
    const kelas = String(payload.kelas).trim();
    const semester = String(payload.semester || "").trim();
    const guru = payload.guru;
    const newRows = [];

    (payload.barang || []).forEach(b => {
      const barangId = String(b.ID).trim();
      let rowIdx = -1;
      for (let i = 1; i < existingData.length; i++) {
        if (String(existingData[i][idCol]) === barangId) { rowIdx = i + 1; break; }
      }
      const rec = {
        ID: barangId,
        Kelas: kelas,
        Semester: semester,
        "Kode Barang": b["Kode Barang"],
        "Nama Barang": b["Nama Barang"],
        Jumlah: b.Jumlah,
        Kondisi: b.Kondisi,
        Keterangan: b.Keterangan,
        "Nama Guru": guru
      };
      const rowData = headers.map(h => rec[h] !== undefined ? rec[h] : "");
      if (rowIdx > -1) {
        sheet.getRange(rowIdx, 1, 1, headers.length).setValues([rowData]);
        if (kelasCol > -1) sheet.getRange(rowIdx, kelasCol + 1).setNumberFormat("@");
      } else {
        newRows.push(rowData);
      }
    });

    if (newRows.length > 0) {
      const startRow = sheet.getLastRow() + 1;
      if (kelasCol > -1) sheet.getRange(startRow, kelasCol + 1, newRows.length, 1).setNumberFormat("@");
      sheet.getRange(startRow, 1, newRows.length, headers.length).setValues(newRows);
    }
    return { message: "Data inventaris tersimpan" };
  } finally {
    lock.releaseLock();
  }
}

function saveConfig(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.CONFIG.name);
  const existingData = sheet.getDataRange().getValues();
  
  // Update jika ada, tambah jika baru
  for(const key in payload) {
      let found = false;
      for(let i=1; i<existingData.length; i++) {
          if(existingData[i][0] === key) {
              sheet.getRange(i+1, 2).setValue(payload[key]);
              found = true;
              break;
          }
      }
      if(!found) {
          sheet.appendRow([key, payload[key]]);
      }
  }

  // OPTIMASI: kalau salah satu key yang disimpan adalah Password_Login, hapus cache-nya supaya
  // password baru langsung berlaku untuk validasi login/token berikutnya (lihat getPasswordSistem()).
  if (Object.prototype.hasOwnProperty.call(payload, "Password_Login")) {
    CacheService.getScriptCache().remove(CACHE_KEY_PASSWORD);
  }

  return "Pengaturan tersimpan";
}