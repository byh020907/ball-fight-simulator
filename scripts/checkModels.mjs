// scripts/checkModels.mjs — 모델 성능 일괄 확인
import fs from "fs";
import path from "path";

const dir = "models";
const rows = [];
for (const d of fs.readdirSync(dir)) {
    const sub = path.join(dir, d);
    if (!fs.statSync(sub).isDirectory()) continue;
    for (const f of fs.readdirSync(sub)) {
        if (!f.endsWith(".json")) continue;
        const j = JSON.parse(fs.readFileSync(path.join(sub, f), "utf-8"));
        rows.push({
            action: j.actionId,
            char: j.charId,
            win: j.trainWinRate,
            eps: j.config.episodes,
            sizeKB: (fs.statSync(path.join(sub, f)).size / 1024).toFixed(1),
        });
    }
}
rows.sort((a, b) => b.win - a.win);

console.log("Action           Char            WinRate  Episodes  Size");
console.log("─".repeat(60));
for (const r of rows) {
    console.log(
        r.action.padEnd(16) +
            r.char.padEnd(16) +
            (r.win * 100).toFixed(1).padStart(7) +
            "%" +
            r.eps.toString().padStart(8) +
            "  " +
            r.sizeKB.padStart(5) +
            " KB"
    );
}

const avg = rows.reduce((s, r) => s + r.win, 0) / rows.length;
const above50 = rows.filter((r) => r.win >= 0.5).length;
const above40 = rows.filter((r) => r.win >= 0.4).length;
console.log("─".repeat(60));
console.log(`총 ${rows.length}개 모델`);
console.log(`평균 승률: ${(avg * 100).toFixed(1)}%`);
console.log(`50% 이상: ${above50}개  |  40% 이상: ${above40}개`);
