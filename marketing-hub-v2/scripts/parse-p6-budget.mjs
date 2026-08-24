import fs from "fs";
import path from "path";

const csvPath =
  "C:/Users/Sophie.Edgerley/Downloads/P6 - Marketing breakdown(Marketing).csv";
const outPath = path.resolve(
  "src/lib/budget/p6-marketing-2026.json"
);

function parseAmount(s) {
  if (!s || !String(s).trim()) return null;
  const n = Number(String(s).replace(/[^0-9.-]/g, "").trim());
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function toIsoDate(s) {
  const m = String(s || "")
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function parseCSV(src) {
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') inQ = false;
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function shouldSkip(code, job) {
  const jobL = (job || "").toLowerCase();
  if (/^credit card$/i.test(code)) return true;
  if (/accrual|accural|month end journal/i.test(jobL)) return true;
  if (/^mp3$/i.test(code)) return true;
  return false;
}

const text = fs.readFileSync(csvPath, "utf8");
const rows = parseCSV(text);
const items = [];

for (const r of rows.slice(1)) {
  if (!r || r.length < 8) continue;
  const [date, codeRaw, jobRaw, period, , , , amount] = r;
  const code = (codeRaw || "").trim();
  const job = (jobRaw || "").trim();
  const amt = parseAmount(amount);
  if (amt == null || amt === 0) continue;
  if (shouldSkip(code, job)) continue;
  const paid_at = toIsoDate(date);
  items.push({
    paid_at,
    code,
    job,
    period: (period || "").trim(),
    amount: amt,
  });
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(items, null, 2) + "\n");
console.log(`wrote ${items.length} rows to ${outPath}`);
