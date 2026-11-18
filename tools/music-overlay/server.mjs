import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const HOST = "127.0.0.1";
const PORT = Number(process.env.MUSIC_BRIDGE_PORT || 4317);
const TOKEN_FILE = join(ROOT, ".music-bridge-token");
const STALE_AFTER_MS = 20_000;
const MAX_BODY_BYTES = 12 * 1024;
const ALLOWED_SOURCES = new Set(["youtube", "youtube_music"]);
const ALLOWED_ARTWORK_HOSTS = new Set([
  "i.ytimg.com",
  "yt3.ggpht.com",
  "yt4.ggpht.com",
  "lh3.googleusercontent.com",
  "yt3.googleusercontent.com",
]);

let nowPlaying = null;

async function loadToken() {
  if (process.env.MUSIC_BRIDGE_TOKEN?.trim()) {
    return process.env.MUSIC_BRIDGE_TOKEN.trim();
  }

  try {
    return (await readFile(TOKEN_FILE, "utf8")).trim();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  const generated = randomBytes(32).toString("hex");
  try {
    await writeFile(TOKEN_FILE, generated + "\n", { flag: "wx", mode: 0o600 });
    return generated;
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    return (await readFile(TOKEN_FILE, "utf8")).trim();
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    let tooLarge = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      size += Buffer.byteLength(chunk, "utf8");
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      if (!tooLarge) raw += chunk;
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(new Error("body_too_large"));
        return;
      }
      try {
        resolve(JSON.parse(raw || "{}"));
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    request.on("error", reject);
  });
}

function tokenMatches(request, expected) {
  const supplied = (request.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!supplied || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function safeArtworkUrl(value) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && ALLOWED_ARTWORK_HOSTS.has(parsed.hostname) ? parsed.href : "";
  } catch {
    return "";
  }
}

function safeTrackUrl(value) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const allowed = parsed.protocol === "https:" &&
      (parsed.hostname === "youtube.com" ||
       parsed.hostname === "www.youtube.com" ||
       parsed.hostname === "music.youtube.com" ||
       parsed.hostname.endsWith(".youtube.com"));
    return allowed ? parsed.href : "";
  } catch {
    return "";
  }
}

function boundedNumber(value, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(max, Math.floor(number))) : 0;
}

async function serveStatic(response, filename, contentType) {
  try {
    const content = await readFile(join(ROOT, filename));
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    response.end(content);
  } catch {
    sendJson(response, 500, { error: "asset_unavailable" });
  }
}

async function main() {
  const token = await loadToken();

  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://" + HOST);

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Cache-Control": "no-store",
      });
      response.end();
      return;
    }

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/overlay")) {
      await serveStatic(response, "overlay.html", "text/html; charset=utf-8");
      return;
    }
    if (request.method === "GET" && url.pathname === "/overlay.css") {
      await serveStatic(response, "overlay.css", "text/css; charset=utf-8");
      return;
    }
    if (request.method === "GET" && url.pathname === "/overlay.js") {
      await serveStatic(response, "overlay.js", "text/javascript; charset=utf-8");
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/now-playing") {
      const fresh = nowPlaying && Date.now() - nowPlaying.updatedAt <= STALE_AFTER_MS;
      sendJson(response, 200, { track: fresh ? nowPlaying : null });
      return;
    }

    if (url.pathname === "/api/now-playing" && request.method === "POST") {
      if (!tokenMatches(request, token)) {
        sendJson(response, 401, { error: "unauthorized" });
        return;
      }

      let payload;
      try {
        payload = await readJson(request);
      } catch (error) {
        sendJson(response, error.message === "body_too_large" ? 413 : 400, { error: error.message });
        return;
      }

      const title = typeof payload.title === "string" ? payload.title.trim().slice(0, 180) : "";
      if (!title) {
        nowPlaying = null;
        sendJson(response, 200, { ok: true, cleared: true });
        return;
      }

      const source = typeof payload.source === "string" ? payload.source : "";
      if (!ALLOWED_SOURCES.has(source)) {
        sendJson(response, 400, { error: "unsupported_source" });
        return;
      }

      nowPlaying = {
        source,
        title,
        artist: typeof payload.artist === "string" ? payload.artist.trim().slice(0, 180) : "",
        artworkUrl: safeArtworkUrl(payload.artworkUrl),
        trackUrl: safeTrackUrl(payload.trackUrl),
        durationMs: boundedNumber(payload.durationMs, 86_400_000),
        progressMs: boundedNumber(payload.progressMs, 86_400_000),
        isPlaying: payload.isPlaying === true,
        updatedAt: Date.now(),
      };

      if (nowPlaying.durationMs > 0 && nowPlaying.progressMs > nowPlaying.durationMs) {
        nowPlaying.progressMs = nowPlaying.durationMs;
      }

      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  });

  server.listen(PORT, HOST, () => {
    console.log("");
    console.log("Hot Coffee Music Bridge listo.");
    console.log("Overlay de OBS: http://" + HOST + ":" + PORT + "/overlay");
    console.log("Vista de prueba: http://" + HOST + ":" + PORT + "/overlay?demo=1");
    console.log("Token para la extensión (guárdalo en sus opciones):");
    console.log(token);
    console.log("");
    console.log("El servidor escucha solo en 127.0.0.1. Pulsa Ctrl+C para detenerlo.");
  });
}

main().catch((error) => {
  console.error("No se pudo iniciar Music Bridge:", error);
  process.exitCode = 1;
});
