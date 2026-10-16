const http = require("http");
const fs = require("fs");
const path = require("path");

const port = process.env.PORT || 3000;
const root = __dirname;

http.createServer((req, res) => {
  let requested = decodeURIComponent((req.url || "/").split("?")[0]);
  if (requested === "/") requested = "/index.html";
  const filePath = path.join(root, requested.replace(/^\/+/, ""));
  if (!filePath.startsWith(root)) {
    res.writeHead(403, {"Content-Type":"text/plain; charset=utf-8"});
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {"Content-Type":"text/plain; charset=utf-8"});
      return res.end("File not found");
    }
    const ext = path.extname(filePath);
    const types = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".svg":"image/svg+xml"};
    res.writeHead(200, {"Content-Type":types[ext] || "application/octet-stream"});
    res.end(data);
  });
}).listen(port, "0.0.0.0", () => console.log(`Medan Smart City running on port ${port}`));
