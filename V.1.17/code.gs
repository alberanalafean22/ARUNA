/* ===============================
   KONFIGURASI SPREADSHEET
================================*/
const SPREADSHEET_ID = "1kG5-tWtdXAfmkgqOO2g7ZYWIdWRFTa4zOgLZFaeS6yw";
const SHEET_NAME = "user";
const ANGGARAN_SPREADSHEET_ID = "1Ca60NgNBwAcRIPheRFLbXRzCBRFAxqe07Vjf4vSleqY";
const ANGGARAN_SHEET = "ANGGARAN";
const TOTAL_SHEET = "TOTAL";

function doGet(e) {
  const page = e.parameter.page || "login";
  return HtmlService.createTemplateFromFile(page)
    .evaluate()
    .setTitle("ARUNA - BPS Kota Solok")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ===============================
   LOGIKA LOGIN & SESSION
================================*/
function loginUser(username, password) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username && data[i][1] === password) {
      const user = { username: data[i][0], nama: data[i][2], jabatan: data[i][3], role: data[i][4] };
      PropertiesService.getUserProperties().setProperty("user", JSON.stringify(user));
      return { status: "success", url: ScriptApp.getService().getUrl() + "?page=dashboard" };
    }
  }
  return { status: "error" };
}

function getUser() {
  const user = PropertiesService.getUserProperties().getProperty("user");
  return user ? JSON.parse(user) : { nama: "Guest", jabatan: "-", role: "guest", username: "" };
}

function logout() {
  PropertiesService.getUserProperties().deleteAllProperties();
  return HtmlService.createHtmlOutputFromFile("login").getContent();
}

/* ===============================
   USER MANAGEMENT (KODE ASLI ANDA)
================================*/
function getAllUsers() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME).getDataRange().getValues();
}

function addUser(data) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  sh.appendRow([data.username, data.password, data.nama, data.jabatan, data.role]);
}

function deleteUser(username) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === username) { sh.deleteRow(i + 1); break; }
  }
}

function updateUser(u, p, n, j, r) {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === u) {
      sh.getRange(i + 1, 2, 1, 4).setValues([[p, n, j, r]]);
      break;
    }
  }
}

/* ===============================
   LOGIKA ANGGARAN & MONITORING
================================*/
function simpanAnggaran(data) {
  const ss = SpreadsheetApp.openById(ANGGARAN_SPREADSHEET_ID);
  let sh = ss.getSheetByName(ANGGARAN_SHEET);
  const user = getUser();
  // Format: Timestamp, Nama PJ, Item, Jumlah, Keterangan, Username, Status
  sh.appendRow([new Date(), data.pj, data.item, data.jumlah, data.ket || "", user.username, "Proses"]);
}

function getMonitoringData() {
  const ss = SpreadsheetApp.openById(ANGGARAN_SPREADSHEET_ID);
  const sh = ss.getSheetByName(ANGGARAN_SHEET);
  const shTotal = ss.getSheetByName(TOTAL_SHEET);
  const lastRow = sh.getLastRow();
  
  let rows = (lastRow > 1) ? sh.getRange(2, 1, lastRow - 1, 7).getDisplayValues() : [];
  let totalVal = shTotal ? shTotal.getRange("B2").getDisplayValue() : "0";
  
  return { rows: rows, total: totalVal };
}

/* LOGIKA UPDATE STATUS & CATATAN */

function updateStatus(r, v) {
  // Simpan data baris dan status ke hidden input
  document.getElementById('tempRow').value = r;
  document.getElementById('tempStatus').value = v;

  if (v === "Ditolak") {
    // Jika ditolak, pindah ke panel catatan (mirip alur simpanFinal)
    document.getElementById('monitoring').style.display = 'none';
    document.getElementById('panelCatatanAdmin').style.display = 'block';
    document.getElementById('catatanAdminInput').value = ""; // Kosongkan input
    document.getElementById('msgCatatan').style.display = 'none';
  } else {
    // Jika 'Proses' atau 'Disetujui', langsung simpan tanpa catatan (atau catatan kosong)
    if(confirm("Ubah status menjadi " + v + "?")) {
      executeUpdateStatus(r, v, "");
    } else {
      loadMonitoring(); // Reset dropdown
    }
  }
}

// Fungsi yang dipanggil saat tombol "Simpan Status & Catatan" diklik
function prosesSimpanCatatan() {
  const r = document.getElementById('tempRow').value;
  const v = document.getElementById('tempStatus').value;
  const catatan = document.getElementById('catatanAdminInput').value;

  if (v === "Ditolak" && !catatan) {
    const msg = document.getElementById('msgCatatan');
    msg.className = "msg error";
    msg.innerText = "Alasan penolakan wajib diisi!";
    msg.style.display = "block";
    return;
  }

  executeUpdateStatus(r, v, catatan);
}

// Fungsi eksekusi ke Google Script
function executeUpdateStatus(r, v, catatan) {
  google.script.run.withSuccessHandler(() => {
    // Sembunyikan panel catatan jika sedang terbuka
    document.getElementById('panelCatatanAdmin').style.display = 'none';
    // Kembali ke monitoring
    document.getElementById('monitoring').style.display = 'block';
    loadMonitoring(); // Refresh tabel
    alert("Status berhasil diperbarui!");
  }).updateStatusAnggaran(r, v, catatan);
}

function batalCatatan() {
  document.getElementById('panelCatatanAdmin').style.display = 'none';
  document.getElementById('monitoring').style.display = 'block';
  loadMonitoring(); // Reset dropdown di tabel
}

function updateStatusAnggaran(row, newStatus, catatan) {
  try {
    const ss = SpreadsheetApp.openById(ANGGARAN_SPREADSHEET_ID);
    const sh = ss.getSheetByName(ANGGARAN_SHEET);
    
    // Update Status di Kolom G (7)
    sh.getRange(row, 7).setValue(newStatus);
    
    // Update Catatan di Kolom H (8)
    sh.getRange(row, 8).setValue(catatan || "");
    
    return { status: "success" }; // Mengembalikan status success
  } catch (e) {
    return { status: "error", message: e.toString() };
  }
}

function getMonitoringData() {
  const ss = SpreadsheetApp.openById(ANGGARAN_SPREADSHEET_ID);
  const sh = ss.getSheetByName(ANGGARAN_SHEET);
  const shTotal = ss.getSheetByName(TOTAL_SHEET);
  const lastRow = sh.getLastRow();
  
  // Ambil sampai kolom 8 (Kolom H - Catatan Admin)
  let rows = (lastRow > 1) ? sh.getRange(2, 1, lastRow - 1, 8).getDisplayValues() : [];
  let totalVal = shTotal ? shTotal.getRange("B2").getDisplayValue() : "0";
  
  return { rows: rows, total: totalVal };
}

function deleteAnggaran(row) {
  const sh = SpreadsheetApp.openById(ANGGARAN_SPREADSHEET_ID).getSheetByName(ANGGARAN_SHEET);
  sh.deleteRow(row);
}
