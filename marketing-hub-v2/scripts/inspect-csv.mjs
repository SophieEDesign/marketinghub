import fs from "fs";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inQuotes) {
      if (c === '"' && n === '"') {
        field += '"';
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = false;
        continue;
      }
      field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && n === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    if (row.some((x) => x !== "")) rows.push(row);
  }
  return rows;
}

const path = process.argv[2];
const rows = parseCsv(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
const header = rows[0];
console.log("rows", rows.length - 1, "cols", header.length);
console.log(header.join("\n"));
const payloadIdx = header.findIndex((h) =>
  /payload/i.test(h)
);
console.log("payload col index", payloadIdx, payloadIdx >= 0 ? header[payloadIdx] : null);
if (payloadIdx >= 0 && rows[1]) {
  const sample = rows[1][payloadIdx] || "";
  console.log("payload sample length", sample.length);
  try {
    const j = JSON.parse(sample);
    console.log("payload keys", Object.keys(j).slice(0, 40).join(", "));
  } catch {
    console.log("payload not json", sample.slice(0, 200));
  }
}
