import express from "express";
import multer from "multer";
import mammoth from "mammoth";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number.parseInt(process.env.PORT ?? "8000", 10);

const jieba = Jieba.withDict(dict);
jieba.cut("我来到北京清华大学", true);

// 停用词集合
let stopwords = new Set();
const stopwordsPath = join(__dirname, "..", "data", "stopwords.txt");
if (existsSync(stopwordsPath)) {
  const content = readFileSync(stopwordsPath, "utf-8");
  content.split(/\r?\n/).forEach((line) => {
    const w = line.replace(/#.*$/, "").trim();
    if (w) stopwords.add(w);
  });
}

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(txt|docx)$/i.test(file.originalname);
    cb(null, !!ok);
  },
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "请选择 TXT 或 Word(.docx) 文件上传" });
  }
  const name = (req.file.originalname || "").toLowerCase();
  try {
    if (name.endsWith(".txt")) {
      const text = req.file.buffer.toString("utf-8");
      return res.json({ text });
    }
    if (name.endsWith(".docx")) {
      const { value } = await mammoth.extractRawText({ buffer: req.file.buffer });
      return res.json({ text: value || "" });
    }
    return res.status(400).json({ message: "仅支持 .txt 或 .docx 文件" });
  } catch (e) {
    return res.status(500).json({ message: "文件解析失败：" + (e?.message || String(e)) });
  }
});

app.post("/api/segment", (req, res) => {
  const text = String(req?.body?.text ?? "");
  const mode = String(req?.body?.mode ?? "precise");
  const hmm = Boolean(req?.body?.hmm ?? true);
  const filter_stopwords = Boolean(req?.body?.filter_stopwords ?? false);

  const cleaned = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trim();
  if (!cleaned) {
    return res.status(400).json({ message: "text 不能为空" });
  }
  if (cleaned.length > 20000) {
    return res.status(400).json({ message: "text 过长（最多 20000 字符）" });
  }

  const t0 = performance.now();
  let words = [];
  if (mode === "full") {
    words = jieba.cutAll(cleaned);
  } else if (mode === "search") {
    words = jieba.cutForSearch(cleaned);
  } else {
    words = jieba.cut(cleaned, hmm);
  }
  const elapsedMs = performance.now() - t0;

  let tokens = words
    .filter((w) => typeof w === "string" && w.trim().length > 0)
    .map((w) => ({ word: w, pos: null }));

  if (filter_stopwords && stopwords.size > 0) {
    tokens = tokens.filter((t) => !stopwords.has(t.word));
  }

  res.json({
    mode: mode === "full" || mode === "search" ? mode : "precise",
    count: tokens.length,
    tokens,
    elapsed_ms: Math.round(elapsedMs * 1000) / 1000,
  });
});

app.use(express.static(join(__dirname, "..", "public")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});
