import { BattleSimulation } from "../src/simulation/battleSimulation.js";
import { aggregateBattleMetrics, BattleMetricsRecorder } from "../src/simulation/battleMetrics.js";
import { createHuntingMobEncounter } from "../src/hunting/huntingMonsters.js";
import { getHuntingBattleArena } from "../src/hunting/huntingEncounters.js";
import { createRoster } from "../src/roster.js";
import { createDragTrajectoryScene } from "../src/combat-drag/trajectoryScene.js";
import { Vector2 } from "../src/core.js";
import { createDragAbilityMetricsConfig } from "./dragAbilityMetricsConfig.mjs";
import { formatAbilityResult } from "./dragAbilityMetricFormatters.mjs";

const POLICIES = ["무입력", "직선 반복", "궤적 예측 기반 반사 탐색"];
const ROSTER = createRoster();
const ROSTER_MAP = Object.fromEntries(ROSTER.map((fighter) => [fighter.id, fighter]));
const CONFIG = createDragAbilityMetricsConfig(
    process.env,
    ROSTER.map((fighter) => fighter.id)
);

function createSeededRng(seed) {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    };
}

function disableVisualEffects(simulation) {
    for (const method of [
        "addSparkBurst",
        "spawnExplosion",
        "spawnPulse",
        "spawnDeathExplosion",
        "updateOvertimeParticles"
    ]) {
        simulation[method] = () => {};
    }
}

function nearestEnemyDirection(player, enemies) {
    const alive = enemies.filter((fighter) => !fighter.flags.defeated && !fighter.flags.destroyed);
    if (!alive.length) return null;
    const target = alive.reduce((closest, candidate) => {
        const closestDistance = Vector2.subtract(closest.position, player.position).length();
        const candidateDistance = Vector2.subtract(candidate.position, player.position).length();
        return candidateDistance < closestDistance ? candidate : closest;
    });
    return Vector2.subtract(target.position, player.position).normalize();
}

function scoreTrajectory(simulation, snapshot, direction) {
    const chargeRatio = snapshot?.drag?.chargeRatio ?? 0;
    const scene = createDragTrajectoryScene({
        simulation,
        runtimeSnapshot: {
            ...snapshot,
            drag: {
                ...snapshot.drag,
                state: "aiming",
                vector: { active: true, vector: { x: direction.x, y: direction.y } },
                chargeRatio
            }
        }
    });
    if (!scene.active) return -Infinity;
    const terminal = scene.terminal?.shieldResult;
    const terminalScore = terminal === "rear-hit" ? 100 : terminal === "front-counter" ? -50 : terminal ? 50 : 0;
    return terminalScore + scene.bounces.length + scene.strength * 5;
}

function chooseDirection(simulation, policy) {
    if (policy === "무입력") return null;
    const player = simulation.playerBall;
    const enemies = simulation.fighters.filter(
        (fighter) => fighter !== player && simulation.isHostile(player, fighter)
    );
    const direct = nearestEnemyDirection(player, enemies);
    if (!direct || policy === "직선 반복") return direct;
    const snapshot = simulation.dragCombat.getSnapshot();
    const baseAngle = Math.atan2(direct.y, direct.x);
    return Array.from({ length: CONFIG.candidateAngles }, (_, index) => {
        const angle = baseAngle + (index / CONFIG.candidateAngles) * Math.PI * 2;
        return new Vector2(Math.cos(angle), Math.sin(angle));
    }).reduce((best, candidate) =>
        scoreTrajectory(simulation, snapshot, candidate) > scoreTrajectory(simulation, snapshot, best)
            ? candidate
            : best
    );
}

function decideTimedOutResult(player, enemies) {
    const playerRatio = player.maxHp ? player.hp / player.maxHp : 0;
    const enemyRatio = enemies.length
        ? enemies.reduce((sum, enemy) => sum + (enemy.maxHp ? enemy.hp / enemy.maxHp : 0), 0) / enemies.length
        : 0;
    if (playerRatio === enemyRatio) return { winner: null, loser: null };
    return playerRatio > enemyRatio ? { winner: player, loser: enemies[0] ?? null } : { winner: null, loser: player };
}

function beginOrUpdateAim(simulation, pointerId, direction) {
    const player = simulation.playerBall;
    const start = { x: player.position.x, y: player.position.y };
    const current = {
        x: start.x - direction.x * CONFIG.pullPixels,
        y: start.y - direction.y * CONFIG.pullPixels
    };
    if (simulation.dragCombat.getSnapshot().drag.state === "idle" && !simulation.beginDragCombat(pointerId, start))
        return false;
    simulation.moveDragCombat(pointerId, current);
    return true;
}

function runMatch({ seed, characterId, stageId, floor, policy, abilityTier = 0 }) {
    const originalRandom = Math.random;
    const rng = createSeededRng(seed);
    Math.random = rng;
    try {
        const enemies = createHuntingMobEncounter({ floor, stageId, rng });
        const arena = getHuntingBattleArena(stageId, enemies.length);
        const recorder = new BattleMetricsRecorder();
        const playerSpec = ROSTER_MAP[characterId];
        if (!playerSpec) throw new Error(`Unknown character: ${characterId}`);
        const simulation = new BattleSimulation(
            [{ ...playerSpec }, ...enemies],
            {
                onLog() {},
                onSound() {},
                onDamageResolved: (event) => recorder.recordDamage(event),
                onEquipmentPassiveTriggered: (event) => recorder.recordEquipmentPassiveTrigger(event),
                onAbilityUsed: (event) => recorder.recordAbilityUsed(event),
                onAbilityResult: (event) => recorder.recordAbilityResult(event),
                onDragCombatMetric: (event) => recorder.recordDragEvent(event)
            },
            null,
            {
                assignActions: false,
                rng,
                width: arena.WIDTH,
                height: arena.HEIGHT,
                dragCombatEnabled: true,
                commandResourceEnabled: CONFIG.commandResourcePrototype || CONFIG.abilityCommandPrototype,
                abilityCommandEnabled: CONFIG.abilityCommandPrototype
            }
        );
        disableVisualEffects(simulation);
        simulation.setPlayerBall(simulation.fighters[0]);
        const player = simulation.playerBall;
        player.progression.abilityTier = abilityTier;
        let pointerId = 0;
        let aimStartedAt = null;
        let activePointerId = null;
        const tickCeiling = Math.ceil(CONFIG.maxSeconds / CONFIG.step);
        let ticks = 0;
        while (!simulation.finished && simulation.elapsed < CONFIG.maxSeconds && ticks < tickCeiling) {
            const snapshot = simulation.dragCombat.getSnapshot();
            const commandState = player.abilities.getPrimaryCommandState?.({ simulation, player }) ?? {};
            const reserveResource =
                CONFIG.abilityCommandPrototype && commandState.reserveResource && !commandState.available;
            if (
                policy !== "무입력" &&
                !reserveResource &&
                snapshot.drag.state === "idle" &&
                !snapshot.playerShot.active
            ) {
                const direction = chooseDirection(simulation, policy);
                if (direction) {
                    const nextPointerId = ++pointerId;
                    if (beginOrUpdateAim(simulation, nextPointerId, direction)) {
                        activePointerId = nextPointerId;
                        aimStartedAt = simulation.elapsed;
                    }
                }
            } else if (activePointerId && snapshot.drag.state === "aiming") {
                const direction = chooseDirection(simulation, policy);
                if (direction) beginOrUpdateAim(simulation, activePointerId, direction);
                if (simulation.elapsed - aimStartedAt >= CONFIG.holdSeconds) {
                    simulation.releaseDragCombat(activePointerId);
                    activePointerId = null;
                    aimStartedAt = null;
                }
            }
            simulation.update(CONFIG.step, CONFIG.step);
            ticks += 1;
        }
        const timeoutResult = simulation.finished ? null : decideTimedOutResult(player, simulation.fighters.slice(1));
        return recorder.snapshot({
            elapsed: simulation.elapsed,
            winner: simulation.winner ?? timeoutResult?.winner,
            loser: simulation.loser ?? timeoutResult?.loser,
            fighters: simulation.fighters,
            timedOut: !simulation.finished,
            focalFighterId: player.id,
            focalAbilityIds: player.abilities.all.map((ability) => ability.abilityId).filter(Boolean),
            focalAbilityResultTypes: CONFIG.abilityCommandPrototype
                ? ({
                      rage: ["rage-command-cashout"],
                      archer: ["archer-command-shot"],
                      hero: ["hero-command-core-cycle"],
                      phantom: ["phantom-command-chain"],
                      orbit: ["orbit-command-volley"],
                      spin: ["spin-command-gyro-bank"],
                      trickster: ["trickster-command-route"],
                      bat_ball: ["bat-ball-command-called-shot"],
                      dash: ["dash-command-manual-entry"],
                      eater: ["eater-command-spit-route"],
                      elementalist: ["elementalist-command-recall-route"]
                  }[characterId] ?? [])
                : []
        });
    } finally {
        Math.random = originalRandom;
    }
}

function finiteOrThrow(value, path = "metrics") {
    if (value !== null && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) finiteOrThrow(child, `${path}.${key}`);
    } else if (typeof value === "number" && !Number.isFinite(value)) {
        throw new Error(`Non-finite metric: ${path}=${value}`);
    }
}

function percent(value) {
    return `${(value * 100).toFixed(1)}%`;
}

function main() {
    const mode = CONFIG.abilityCommandPrototype
        ? "능력 커맨드 인프라 프로토타입"
        : CONFIG.commandResourcePrototype
          ? "커맨드 자원 프로토타입"
          : "기준선";
    console.log(`=== 드래그·능력 계측 (${mode}) ===`);
    for (const abilityTier of CONFIG.abilityTiers) {
        for (const [index, stageId] of CONFIG.stages.entries()) {
            const floor = CONFIG.floors[index % CONFIG.floors.length];
            console.log(`\n--- ability tier=${abilityTier} | ${stageId} floor=${floor} ---`);
            for (const characterId of CONFIG.characters) {
                for (const policy of POLICIES) {
                    const snapshots = Array.from({ length: CONFIG.seeds }, (_, seedIndex) =>
                        runMatch({
                            seed: CONFIG.seed + index * 10000 + seedIndex,
                            characterId,
                            stageId,
                            floor,
                            policy,
                            abilityTier
                        })
                    );
                    const metrics = aggregateBattleMetrics(snapshots);
                    finiteOrThrow(metrics);
                    const abilityText = Object.entries(metrics.abilities)
                        .map(
                            ([id, ability]) =>
                                `${id}: ${ability.usesPerMatch.toFixed(2)}회, 미사용 ${percent(ability.noUseRate)}`
                        )
                        .join("; ");
                    const resultText = Object.entries(metrics.abilityResults)
                        .map(([type, result]) => formatAbilityResult(type, result))
                        .join("; ");
                    const directDamagePerMatch = metrics.focalDealtByOrigin.drag?.damagePerMatch ?? 0;
                    const counterTakenPerMatch = metrics.focalTakenByOrigin["drag-counter"]?.damagePerMatch ?? 0;
                    console.log(
                        `${characterId} | ${policy} | 승률 ${percent(metrics.winRate)} | ` +
                            `시간 중앙 ${metrics.duration.median.toFixed(2)}초 | 능력 ${abilityText || "없음"} | ` +
                            `결과 ${resultText || "없음"} | 발사 ${metrics.dragDetail.launchesPerMatch.toFixed(2)} | ` +
                            `경기당 직접 드래그 피해 ${directDamagePerMatch.toFixed(2)} (${percent(metrics.focalDealtDragRatio)}) | ` +
                            `경기당 방패 반격 피격 ${counterTakenPerMatch.toFixed(2)}`
                    );
                }
            }
        }
    }
}

main();
