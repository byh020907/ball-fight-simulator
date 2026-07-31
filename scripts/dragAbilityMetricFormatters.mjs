function finiteNumber(value) {
    return Number.isFinite(value) ? value : 0;
}

function average(values) {
    const finiteValues = values.filter(Number.isFinite);
    return finiteValues.length ? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length : 0;
}

function percent(value) {
    return `${(finiteNumber(value) * 100).toFixed(1)}%`;
}

function decimal(value) {
    return finiteNumber(value).toFixed(2);
}

function resultValues(result) {
    return Array.isArray(result?.values) ? result.values.filter((value) => value && typeof value === "object") : [];
}

function booleanRate(values, key) {
    return average(values.map((value) => (value[key] === true ? 1 : 0)));
}

function chargeTierNumber(value) {
    return typeof value === "string"
        ? ["none", "ignite", "explosion", "aftershock"].indexOf(value)
        : finiteNumber(value);
}

function formatBase(type, result) {
    return `${type}: ${decimal(result?.attemptsPerMatch)}회, 성공 ${percent(result?.successRate)}`;
}

function formatRage(values) {
    return (
        `평균 충전 ${percent(average(values.map((value) => finiteNumber(value.chargeRatio))))}, ` +
        `충전 단계 ${decimal(average(values.map((value) => chargeTierNumber(value.chargeTier))))}, ` +
        `능력 피해 ${decimal(average(values.map((value) => finiteNumber(value.abilityDamage))))}, ` +
        `직접 피해 ${decimal(average(values.map((value) => finiteNumber(value.directDamage))))}, ` +
        `조기 초기화 ${percent(booleanRate(values, "earlyReset"))}`
    );
}

function formatArcher(values) {
    const followUpSamples = values.filter((value) => value.secondShotHit !== null && value.secondShotHit !== undefined);
    return (
        `평균 벽 구간 ${decimal(average(values.map((value) => finiteNumber(value.wallSegmentsFollowed))))}, ` +
        `계획 구간 ${decimal(average(values.map((value) => finiteNumber(value.plannedSegments))))}, ` +
        `경과 ${decimal(average(values.map((value) => finiteNumber(value.elapsed))))}초, ` +
        `후속 적중 ${percent(booleanRate(followUpSamples, "secondShotHit"))} (표본 ${followUpSamples.length})`
    );
}

function formatHero(values) {
    const released = values.map((value) => finiteNumber(value.released));
    const collected = values.map((value) => finiteNumber(value.collected));
    const totalReleased = released.reduce((sum, value) => sum + value, 0);
    const totalCollected = collected.reduce((sum, value) => sum + value, 0);
    return (
        `평균 방출 ${decimal(average(released))}, 회수 ${decimal(average(collected))}, ` +
        `방패 ${decimal(average(values.map((value) => finiteNumber(value.shield))))}, ` +
        `회복 ${decimal(average(values.map((value) => finiteNumber(value.heal))))}, ` +
        `회수율 ${percent(totalReleased ? totalCollected / totalReleased : 0)}`
    );
}

function formatPhantom(values) {
    return (
        `안전 출현 ${percent(booleanRate(values, "safeAppear"))}, ` +
        `기본 적중 ${percent(booleanRate(values, "baseHit"))}, ` +
        `연쇄 ${decimal(average(values.map((value) => finiteNumber(value.chainDepth))))}, ` +
        `종결 적중 ${percent(booleanRate(values, "finishHit"))}`
    );
}

function formatOrbit(values) {
    const field = (key) => decimal(average(values.map((value) => finiteNumber(value[key]))));
    return (
        `평균 방출 ${field("released")}, 적중 ${field("hits")}, 동기화 적중 ${field("synchronizedHits")}, ` +
        `회수 ${field("catches")}, 계획 구간 ${field("plannedSegments")}, 경과 ${field("elapsed")}초`
    );
}

export function formatAbilityResult(type, result) {
    const base = formatBase(type, result);
    const values = resultValues(result);
    const detail = {
        "rage-command-cashout": formatRage,
        "archer-command-shot": formatArcher,
        "hero-command-core-cycle": formatHero,
        "phantom-command-chain": formatPhantom,
        "orbit-command-volley": formatOrbit
    }[type];
    return detail ? `${base}, ${detail(values)}` : base;
}
