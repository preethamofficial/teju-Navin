const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 4173);
const workspaceDir = process.cwd();
const distDir = path.join(workspaceDir, "dist");
const rootDir = fs.existsSync(distDir) ? distDir : workspaceDir;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webm": "video/webm",
};

function sendError(res, statusCode, message) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

function getSafePath(urlPath) {
  const normalizedPath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const resolvedPath = path.resolve(rootDir, `.${normalizedPath}`);

  if (!resolvedPath.startsWith(rootDir)) {
    return null;
  }

  return resolvedPath;
}

function streamFile(req, res, filePath, stats) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";
  const rangeHeader = req.headers.range;

  if (!rangeHeader) {
    res.writeHead(200, {
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
      "Content-Length": stats.size,
      "Content-Type": contentType,
    });

    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);

  if (!match) {
    sendError(res, 416, "Requested range is invalid.");
    return;
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : stats.size - 1;

  if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= stats.size) {
    sendError(res, 416, "Requested range is invalid.");
    return;
  }

  res.writeHead(206, {
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    "Content-Length": end - start + 1,
    "Content-Range": `bytes ${start}-${end}/${stats.size}`,
    "Content-Type": contentType,
  });

  fs.createReadStream(filePath, { start, end }).pipe(res);
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    sendError(res, 400, "Bad request.");
    return;
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const pathname = requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname;
  const filePath = getSafePath(pathname);

  if (!filePath) {
    sendError(res, 403, "Forbidden.");
    return;
  }

  fs.stat(filePath, (error, stats) => {
    if (error) {
      sendError(res, error.code === "ENOENT" ? 404 : 500, error.code === "ENOENT" ? "Not found." : "Server error.");
      return;
    }

    if (stats.isDirectory()) {
      const indexPath = path.join(filePath, "index.html");
      fs.stat(indexPath, (indexError, indexStats) => {
        if (indexError) {
          sendError(res, 404, "Not found.");
          return;
        }

        streamFile(req, res, indexPath, indexStats);
      });
      return;
    }

    streamFile(req, res, filePath, stats);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Wedding website available at http://127.0.0.1:${port}`);
});
