import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const CHECK_DIRS = ["scripts", "src", "tests"];
const EXTENSIONS = new Set([".js", ".mjs"]);

function listFiles(dir) {
    const files = [];
    for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        const stat = statSync(path);
        if (stat.isDirectory()) {
            files.push(...listFiles(path));
            continue;
        }

        if (EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) {
            files.push(path);
        }
    }
    return files;
}

const files = CHECK_DIRS.flatMap(listFiles).sort();

for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

console.log(`syntax ok (${files.length} files)`);
