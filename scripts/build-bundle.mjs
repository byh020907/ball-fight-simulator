import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
const order = [
  "src/core.js",
  "src/audio.js",
  "src/effects.js",
  "src/abilities/Ability.js",
  "src/abilities/ArcherAbility.js",
  "src/abilities/OrbitAbility.js",
  "src/abilities/CloneAbility.js",
  "src/abilities/GrenadeAbility.js",
  "src/abilities/FrostySwordAbility.js",
  "src/abilities/BerserkerAbility.js",
  "src/abilities/EaterAbility.js",
  "src/entities.js",
  "src/simulation.js",
  "src/ui.js",
  "src/tournament.js",
  "src/roster.js",
  "src/app.js",
  "src/main.js"
];

function cleanModule(source) {
  return source
    .replace(/^\uFEFF/, "")
    .replace(/^import .*?;\r?\n/gm, "")
    .replace(/^export \{[\s\S]*?\};\r?\n/gm, "")
    .replace(/\bexport\s+(class|function|const|let|var)\s+/g, "$1 ");
}

const chunks = order.map((relativePath) => {
  const absolutePath = new URL(relativePath, root);
  return `// ${relativePath}\n${cleanModule(fs.readFileSync(absolutePath, "utf8"))}`;
});

const output = `"use strict";\n\n(() => {\n${chunks.join("\n\n")}\n})();\n`;
const distDir = new URL("dist/", root);
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(fileURLToPath(distDir), "app.bundle.js"), output, "utf8");
console.log("dist/app.bundle.js generated");
