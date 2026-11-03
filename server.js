const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const port = process.env.PORT || 3000;
const root = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(root, "data");
const DATA_FILE = path.join(DATA_DIR, "pengaduan.json");

// ===== Kunci admin =====
let ADMIN_KEY = process.env.ADMIN_KEY;
if (!ADMIN_KEY) {
  ADMIN_KEY = crypto.randomBytes(6).toString("hex");
  console.log("ADMIN_KEY belum diatur. Kunci sementara untuk /admin.html: " + ADMIN_KEY);
}
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT = process.env.TELEGRAM_CHAT_ID;

// ===== Berkas statis yang boleh diakses (server.js & data/ tidak dilayani) =====
const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/admin.html": ["admin.html", "text/html; charset=utf-8"],
  "/pengaduan.js": ["pengaduan.js", "text/javascript; charset=utf-8"]
};

const weatherUrl =
  "https://api.open-meteo.com/v1/forecast?latitude=3.5897&longitude=98.6738" +
  "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m" +
  "&timezone=Asia%2FJakarta";

// ===== Penyimpanan JSON =====
let db = { complaints: [] };
try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DATA_FILE)) db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
} catch (e) {
  console.error("Gagal memuat data pengaduan:", e.message);
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DATA_FILE + ".tmp";
    fs.writeFile(tmp, JSON.stringify(db), err => {
      if (err) return console.error("Simpan gagal:", err.message);
      fs.rename(tmp, DATA_FILE, e => e && console.error("Rename gagal:", e.message));
    });
  }, 150);
}

// ===== Utilitas =====
const KATEGORI = ["Lalu lintas", "Banjir / genangan", "Sampah", "Kualitas udara", "Lainnya"];
const WILAYAH = ["Pusat Kota", "Medan Sunggal", "Medan Johor", "Medan Tembung", "Medan Denai", "Lainnya"];
const STATUS = ["baru", "diproses", "selesai"];

const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
const json = (res, code, obj) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
};
function readBody(req, limit = 20000) {
  return new Promise((resolve, reject) => {
    let size = 0, chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > limit) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); }
      catch { reject(new Error("bad json")); }
    });
    req.on("error", reject);
  });
}
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const isAdmin = req => safeEq(req.headers["x-admin-key"] || "", ADMIN_KEY);

// Pembatas laju sederhana per IP
const hits = new Map();
function limited(req, key, max, windowMs) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
  const k = key + ":" + ip, now = Date.now();
  const arr = (hits.get(k) || []).filter(t => now - t < windowMs);
  arr.push(now);
  hits.set(k, arr);
  return arr.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 600000)) hits.delete(k); }, 300000).unref();

async function notify(text) {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT, text: text.slice(0, 3500) }),
      signal: AbortSignal.timeout(8000)
    });
  } catch (e) { console.error("Notifikasi Telegram gagal:", e.message); }
}

const publicView = c => ({
  id: c.id, nama: c.nama, kategori: c.kategori, wilayah: c.wilayah, status: c.status,
  createdAt: c.createdAt, messages: c.messages.map(m => ({ from: m.from, text: m.text, at: m.at }))
});
const summary = c => {
  const last = c.messages[c.messages.length - 1];
  return {
    id: c.id, nama: c.nama, kontak: c.kontak, kategori: c.kategori, wilayah: c.wilayah, status: c.status,
    createdAt: c.createdAt, updatedAt: c.updatedAt, unread: c.unread || 0, count: c.messages.length,
    preview: last ? last.text.slice(0, 90) : ""
  };
};
const findC = id => db.complaints.find(c => c.id === id);
const tokenOk = (c, token) => c && typeof token === "string" && safeEq(token, c.token);

// ===== API pengaduan =====
async function api(req, res, pathname, query) {
  try {
    // --- Warga: kirim pengaduan baru ---
    if (pathname === "/api/pengaduan" && req.method === "POST") {
      if (limited(req, "new", 5, 600000)) return json(res, 429, { error: "Terlalu banyak pengaduan, coba lagi nanti." });
      const b = await readBody(req);
      const nama = clean(b.nama, 60) || "Warga";
      const kontak = clean(b.kontak, 80);
      const kategori = KATEGORI.includes(b.kategori) ? b.kategori : "Lainnya";
      const wilayah = WILAYAH.includes(b.wilayah) ? b.wilayah : "Lainnya";
      const pesan = clean(b.pesan, 1000);
      if (pesan.length < 5) return json(res, 400, { error: "Isi pengaduan minimal 5 karakter." });
      const now = Date.now();
      const c = {
        id: crypto.randomBytes(4).toString("hex"), token: crypto.randomBytes(16).toString("hex"),
        nama, kontak, kategori, wilayah, status: "baru", createdAt: now, updatedAt: now, unread: 1,
        messages: [{ from: "warga", text: pesan, at: now }]
      };
      db.complaints.push(c);
      save();
      notify(`📢 Pengaduan baru #${c.id}\n${nama} · ${wilayah} · ${kategori}${kontak ? "\nKontak: " + kontak : ""}\n\n${pesan}`);
      return json(res, 201, { id: c.id, token: c.token, complaint: publicView(c) });
    }

    let m;
    // --- Warga: baca percakapan ---
    if ((m = pathname.match(/^\/api\/pengaduan\/([a-f0-9]{8})$/)) && req.method === "GET") {
      const c = findC(m[1]);
      if (!tokenOk(c, query.get("token"))) return json(res, 404, { error: "Pengaduan tidak ditemukan." });
      return json(res, 200, publicView(c));
    }
    // --- Warga: kirim pesan lanjutan ---
    if ((m = pathname.match(/^\/api\/pengaduan\/([a-f0-9]{8})\/pesan$/)) && req.method === "POST") {
      if (limited(req, "msg", 30, 600000)) return json(res, 429, { error: "Terlalu cepat, tunggu sebentar." });
      const b = await readBody(req);
      const c = findC(m[1]);
      if (!tokenOk(c, b.token)) return json(res, 404, { error: "Pengaduan tidak ditemukan." });
      const text = clean(b.text, 1000);
      if (!text) return json(res, 400, { error: "Pesan kosong." });
      if (c.messages.length >= 300) return json(res, 400, { error: "Percakapan terlalu panjang." });
      const now = Date.now();
      c.messages.push({ from: "warga", text, at: now });
      c.updatedAt = now; c.unread = (c.unread || 0) + 1;
      if (c.status === "selesai") c.status = "diproses";
      save();
      notify(`💬 Pesan baru di #${c.id} (${c.nama})\n\n${text}`);
      return json(res, 200, publicView(c));
    }

    // --- Admin ---
    if (pathname.startsWith("/api/admin/")) {
      if (limited(req, "admin", 300, 60000)) return json(res, 429, { error: "Terlalu banyak permintaan." });
      if (!isAdmin(req)) return json(res, 401, { error: "Kunci admin salah." });

      if (pathname === "/api/admin/pengaduan" && req.method === "GET") {
        const list = db.complaints.slice().sort((a, b) => b.updatedAt - a.updatedAt).map(summary);
        return json(res, 200, { list, unread: list.reduce((s, c) => s + c.unread, 0) });
      }
      if ((m = pathname.match(/^\/api\/admin\/pengaduan\/([a-f0-9]{8})$/)) && req.method === "GET") {
        const c = findC(m[1]);
        if (!c) return json(res, 404, { error: "Tidak ditemukan." });
        if (c.unread) { c.unread = 0; save(); }
        return json(res, 200, { ...summary(c), messages: c.messages });
      }
      if ((m = pathname.match(/^\/api\/admin\/pengaduan\/([a-f0-9]{8})\/balas$/)) && req.method === "POST") {
        const c = findC(m[1]);
        if (!c) return json(res, 404, { error: "Tidak ditemukan." });
        const b = await readBody(req);
        const text = clean(b.text, 1000);
        if (!text) return json(res, 400, { error: "Balasan kosong." });
        const now = Date.now();
        c.messages.push({ from: "admin", text, at: now });
        c.updatedAt = now; c.unread = 0;
        if (c.status === "baru") c.status = "diproses";
        save();
        return json(res, 200, { ...summary(c), messages: c.messages });
      }
      if ((m = pathname.match(/^\/api\/admin\/pengaduan\/([a-f0-9]{8})\/status$/)) && req.method === "POST") {
        const c = findC(m[1]);
        if (!c) return json(res, 404, { error: "Tidak ditemukan." });
        const b = await readBody(req);
        if (!STATUS.includes(b.status)) return json(res, 400, { error: "Status tidak valid." });
        c.status = b.status; c.updatedAt = Date.now();
        save();
        return json(res, 200, summary(c));
      }
    }
    return json(res, 404, { error: "Endpoint tidak ditemukan." });
  } catch (e) {
    if (e.message === "too large") return json(res, 413, { error: "Data terlalu besar." });
    if (e.message === "bad json") return json(res, 400, { error: "Format data tidak valid." });
    console.error(e);
    return json(res, 500, { error: "Kesalahan server." });
  }
}

async function sendWeather(res) {
  try {
    const r = await fetch(weatherUrl, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error("Open-Meteo HTTP " + r.status);
    const data = await r.json();
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  } catch (e) {
    console.error("Cuaca gagal:", e.message);
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: e.message }));
  }
}

http.createServer((req, res) => {
  let url;
  try {
    url = new URL(req.url || "/", "http://localhost");
  } catch {
    res.writeHead(400);
    return res.end("Bad Request");
  }
  const pathname = url.pathname;

  if (pathname === "/api/cuaca") return sendWeather(res);
  if (pathname.startsWith("/api/")) return api(req, res, pathname, url.searchParams);

  const entry = STATIC[pathname];
  if (!entry) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("File not found");
  }
  fs.readFile(path.join(root, entry[0]), (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("File not found");
    }
    res.writeHead(200, { "Content-Type": entry[1] });
    res.end(data);
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`Medan Smart City running on port ${port}`);
  console.log(TG_TOKEN && TG_CHAT ? "Notifikasi Telegram: aktif" : "Notifikasi Telegram: nonaktif (atur TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID)");
});
