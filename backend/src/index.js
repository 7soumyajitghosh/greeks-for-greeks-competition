require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");

const analyze = require("./routes/analyze");
const followup = require("./routes/followup");
const upload = require("./routes/upload");
const history = require("./routes/history");

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const limiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 100 });
app.use("/api/", limiter);

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "devfix-ai-backend" }));
app.use("/api/analyze", analyze);
app.use("/api/followup", followup);
app.use("/api/upload", upload);
app.use("/api/history", history);
app.use("/uploads", express.static(path.resolve(process.env.UPLOAD_DIR || "./uploads")));
app.use(express.static(path.join(__dirname, "../public")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`DevFix AI backend on :${PORT}`));
}
module.exports = app;
