const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const pkg = require("../package.json");

function fail(message) {
  console.error(message);
  process.exit(1);
}

const [signedExeArg, outputArg, sbomArg] = process.argv.slice(2);
if (!signedExeArg || !outputArg) {
  fail("Uso: node scripts/prepare-signed-release.js <instalador-assinado.exe> <pasta-saida> [sbom.cdx.json]");
}

const signedExe = path.resolve(signedExeArg);
const outputDir = path.resolve(outputArg);
const sbomPath = sbomArg ? path.resolve(sbomArg) : null;

if (!fs.existsSync(signedExe) || !fs.statSync(signedExe).isFile()) fail(`Instalador não encontrado: ${signedExe}`);
if (path.extname(signedExe).toLowerCase() !== ".exe") fail("O artefato assinado precisa ser um instalador .exe.");
if (sbomPath && !fs.existsSync(sbomPath)) fail(`SBOM não encontrado: ${sbomPath}`);

const fileName = path.basename(signedExe);
const bytes = fs.readFileSync(signedExe);
const sha512 = crypto.createHash("sha512").update(bytes).digest("base64");
const size = bytes.length;
const version = String(pkg.version);
const releaseDate = new Date().toISOString();
const yamlFileName = JSON.stringify(fileName);

// electron-updater 6.x lê files[] e também os campos legados path/sha512.
// O hash e o tamanho são calculados sobre o instalador JÁ ASSINADO.
const metadata = [
  `version: ${version}`,
  "files:",
  `  - url: ${yamlFileName}`,
  `    sha512: ${sha512}`,
  `    size: ${size}`,
  `path: ${yamlFileName}`,
  `sha512: ${sha512}`,
  `releaseDate: '${releaseDate}'`,
  ""
].join("\n");

fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(signedExe, path.join(outputDir, fileName));
fs.writeFileSync(path.join(outputDir, "latest.yml"), metadata, "utf8");
if (sbomPath) fs.copyFileSync(sbomPath, path.join(outputDir, path.basename(sbomPath)));

console.log(`Pacote de release preparado em: ${outputDir}`);
console.log(`Produto: ${pkg.build?.productName || pkg.name}`);
console.log(`Versão: ${version}`);
console.log(`Instalador: ${fileName}`);
console.log(`SHA-512 (base64): ${sha512}`);
console.log(`Tamanho: ${size} bytes`);
console.log("latest.yml foi gerado com o hash do instalador assinado.");
console.log("O blockmap diferencial foi omitido; o atualizador deverá usar download completo do instalador.");
