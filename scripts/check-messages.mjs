// Fails if messages/kk.json and messages/ru.json don't have the same keys
// and the same {placeholders}. Run: npm run check:i18n
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "messages");
const load = (l) => JSON.parse(readFileSync(join(dir, `${l}.json`), "utf8"));

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

const placeholders = (s) => [...s.matchAll(/\{(\w+)/g)].map((m) => m[1]).sort().join(",");

const kk = flatten(load("kk"));
const ru = flatten(load("ru"));
const problems = [];

for (const key of Object.keys(kk)) {
  if (!(key in ru)) problems.push(`missing in ru: ${key}`);
  else if (placeholders(kk[key]) !== placeholders(ru[key]))
    problems.push(`placeholder mismatch: ${key}`);
  if (!kk[key].trim()) problems.push(`empty in kk: ${key}`);
}
for (const key of Object.keys(ru)) {
  if (!(key in kk)) problems.push(`missing in kk: ${key}`);
  if (!ru[key].trim()) problems.push(`empty in ru: ${key}`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`OK: ${Object.keys(kk).length} keys in kk and ru`);
