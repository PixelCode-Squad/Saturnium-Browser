const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const lockRoot = lock.packages && lock.packages[""];
const errors = [];

if (!lockRoot) errors.push("package-lock.json não contém packages[''].");
if (lock.name !== pkg.name) errors.push("name divergente entre package.json e package-lock.json.");
if (lock.version !== pkg.version) errors.push("version divergente entre package.json e package-lock.json.");
if (lockRoot && lockRoot.name !== pkg.name) errors.push("packages[''].name divergente.");
if (lockRoot && lockRoot.version !== pkg.version) errors.push("packages[''].version divergente.");

if (errors.length) {
  console.error("Falha na validação de metadados:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Metadados consistentes: ${pkg.name} ${pkg.version}.`);
