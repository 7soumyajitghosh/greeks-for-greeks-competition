// Persistent localtunnel client with auto-reconnect + self-heal.
// Writes the working public URL to tunnel-url.txt (repo root).
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");
const localtunnel = require("localtunnel");

const PORT = process.env.PORT || 4000;
const URL_FILE = path.join(__dirname, "..", "tunnel-url.txt");

let tunnel = null;
let currentUrl = null;
let connecting = false;

function check(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(`${url}/api/health`, { timeout: 15000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

async function connect() {
  if (connecting) return;
  connecting = true;
  try {
    if (tunnel) { try { tunnel.close(); } catch {} tunnel = null; }
    tunnel = await localtunnel({ port: PORT });
    currentUrl = tunnel.url;
    fs.writeFileSync(URL_FILE, currentUrl);
    console.log(`PUBLIC_URL=${currentUrl}`);
    tunnel.on("close", () => {
      console.log("tunnel closed, reconnecting in 5s...");
      currentUrl = null;
      setTimeout(() => { connecting = false; connect(); }, 5000);
    });
    tunnel.on("error", (e) => console.log("tunnel error:", e.message));
  } catch (e) {
    console.log("connect failed:", e.message, "- retrying in 10s...");
    setTimeout(() => { connecting = false; connect(); }, 10000);
  }
  connecting = false;
}

// Self-heal: if the public URL stops serving, grab a fresh one.
setInterval(async () => {
  if (!currentUrl) return;
  const ok = await check(currentUrl);
  console.log(`self-check ${currentUrl} -> ${ok ? "OK" : "FAIL"}`);
  if (!ok) {
    console.log("public URL unhealthy, reconnecting for a fresh URL...");
    connecting = false;
    connect();
  }
}, 60_000);

setInterval(() => {}, 60_000);
connect();
