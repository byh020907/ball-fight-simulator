import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultHost = "127.0.0.1";
const defaultPort = 4173;

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".ico", "image/x-icon"]
]);

function readOption(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function resolveRequestPath(rootPath, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://local").pathname);
  } catch {
    return null;
  }

  const normalizedPath = pathname === "/" ? "/index.html" : pathname;
  const relativePath = path.normalize(normalizedPath).replace(/^[/\\]+/, "");
  const filePath = path.resolve(rootPath, relativePath);
  const rootWithSeparator = rootPath.endsWith(path.sep) ? rootPath : `${rootPath}${path.sep}`;

  if (filePath !== rootPath && !filePath.startsWith(rootWithSeparator)) {
    return null;
  }

  return filePath;
}

export function createStaticServer(options = {}) {
  const rootPath = path.resolve(options.rootPath ?? defaultRoot);

  return http.createServer(async (request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end("Method Not Allowed");
      return;
    }

    const requestedPath = resolveRequestPath(rootPath, request.url ?? "/");
    if (!requestedPath) {
      response.writeHead(400);
      response.end("Bad Request");
      return;
    }

    let filePath = requestedPath;
    try {
      const stats = await fs.promises.stat(filePath);
      if (stats.isDirectory()) {
        filePath = path.join(filePath, "index.html");
      }
    } catch {
      response.writeHead(404);
      response.end("Not Found");
      return;
    }

    try {
      const stats = await fs.promises.stat(filePath);
      if (!stats.isFile()) {
        response.writeHead(404);
        response.end("Not Found");
        return;
      }

      response.writeHead(200, {
        "Content-Type": mimeTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream",
        "Content-Length": stats.size,
        "Cache-Control": "no-store"
      });

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      fs.createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(500);
      response.end("Internal Server Error");
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const host = readOption("host", process.env.HOST || defaultHost);
  const port = Number(readOption("port", process.env.PORT || defaultPort));
  const server = createStaticServer();

  server.listen(port, host, () => {
    console.log(`Ball Fight Simulator running at http://${host}:${port}/`);
  });
}
