const fs = require("fs");
const path = require("path");

const inputPath = path.resolve("C:\\Users\\ErnestoJTorresGuzmán\\Downloads\\bos.sql");
const outputPath = path.resolve(__dirname, "..", "src", "data", "db-schema.ts");

const raw = fs.readFileSync(inputPath, "utf8");

const tables = {};
const tupleRegex = /\('([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*'([^']*)',\s*(?:NULL|'[^']*'),\s*'([^']*)'\)/g;
let match;
while ((match = tupleRegex.exec(raw)) !== null) {
  const tableName = match[1];
  const colName = match[2];

  if (!tables[tableName]) tables[tableName] = [];
  tables[tableName].push(colName);
}

const sorted = Object.keys(tables).sort();

// Ultra-compact: just table(col1,col2,col3) — no types, no spaces
let schemaText = "Database: bos\nTables:\n";
for (const t of sorted) {
  schemaText += t + "(" + tables[t].join(",") + ")\n";
}

console.log("Tables:", sorted.length);
console.log("Compact schema chars:", schemaText.length);
console.log("Estimated tokens:", Math.round(schemaText.length / 4));

// Write as TypeScript module
const tsContent = `// Auto-generated compact schema from bos.sql
// Format: table(col1,col2,...) — column names only
// Run: node scripts/compact-schema.js to regenerate

export const DB_SCHEMA = \`${schemaText.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`;
`;

fs.writeFileSync(outputPath, tsContent);
console.log("Written to:", outputPath);
