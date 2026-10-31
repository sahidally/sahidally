const http = require("http");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || 3000;
const root = __dirname;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const weatherUrl =
  "https://api.open-meteo.com/v1/forecast?latitude=3.5897&longitude=98.6738" +
  "&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m" +
  "&timezone=Asia%2FJakarta";

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
  let requested;

  try {
    requested = decodeURIComponent(
      new URL(req.url || "/", "http://localhost").pathname
    );
  } catch {
    res.writeHead(400);
    return res.end("Bad Request");
  }

  if (requested === "/api/cuaca") return sendWeather(res);

  const safePath = requested === "/" ? "/index.html" : requested;
  const filePath = path.resolve(root, "." + safePath);

  if (
    filePath !== root &&
    !filePath.startsWith(root + path.sep)
  ) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      return res.end("File not found");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType =
      contentTypes[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType
    });

    res.end(data);
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`Medan Smart City running on port ${port}`);
});
