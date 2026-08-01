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

function formatSpin(values) {
    const field = (key) => decimal(average(values.map((value) => finiteNumber(value[key]))));
    return (
        `평균 충전 ${percent(average(values.map((value) => finiteNumber(value.chargeRatio))))}, ` +
        `계획 구간 ${field("plannedSegments")}, 반사 ${field("bounces")}, 보존 충전 ${percent(
            average(values.map((value) => finiteNumber(value.retainedCharge)))
        )}, 직접 피해 ${field("directDamage")}, 경과 ${field("elapsed")}초, ` +
        `표면 절단 ${percent(booleanRate(values, "surfaceCut"))}, 후면 적중 ${percent(booleanRate(values, "rearHit"))}, ` +
        `방패 반격 ${percent(booleanRate(values, "countered"))}`
    );
}

function formatTrickster(values) {
    const field = (key) => decimal(average(values.map((value) => finiteNumber(value[key]))));
    return (
        `평균 발사 ${field("launched")}, 적 접촉 ${field("enemySeedContacts")}, 본인 발동 ${field(
            "ownerSeedTriggers"
        )}, 폭발 ${field("seedBursts")}, 후속 씨앗 ${field("followupSeeds")}, ` +
        `계획 구간 ${field("plannedSegments")}, 계획 반사 ${field("plannedBounces")}, 경과 ${field("elapsed")}초`
    );
}

function formatBatBall(values) {
    const field = (key) => decimal(average(values.map((value) => finiteNumber(value[key]))));
    return (
        `Slash 피해 ${field("slashDamage")}, Wall Slam ${field("wallSlamImpacts")}회/${field("wallSlamDamage")} 피해, ` +
        `첫 벽 거리 ${field("firstWallDistance")}, HOME RUN ${field("homeRunMultiplier")}배, ` +
        `RESET ${percent(booleanRate(values, "resetTriggered"))}, 계획 구간 ${field("plannedSegments")}, ` +
        `계획 반사 ${field("plannedBounces")}, 경과 ${field("elapsed")}초`
    );
}

function formatDash(values) {
    const field = (key) => decimal(average(values.map((value) => finiteNumber(value[key]))));
    return (
        `시작 단계 ${field("cooldownLevelAtLaunch")}, 종료 단계 ${field("cooldownLevelAfter")}, ` +
        `계획 구간 ${field("plannedSegments")}, 계획 반사 ${field("plannedBounces")}, ` +
        `Dash 적중 ${percent(booleanRate(values, "dashHit"))}, 벽 실패 ${percent(booleanRate(values, "wallFailed"))}, ` +
        `레이저 구간 ${field("laserHitSegments")}, 레이저 피해 ${field("laserDamage")}, ` +
        `점화 ${field("ignitionTargets")}, 경과 ${field("elapsed")}초`
    );
}

function formatEater(values) {
    const field = (key) => decimal(average(values.map((value) => finiteNumber(value[key]))));
    return (
        `소화 ${field("digestionTicksAtLaunch")}틱, Wall Slam ${field("wallSlamDamage")} 피해, ` +
        `Spit Impact ${field("spitImpactDamage")} 피해, 파열 ${percent(booleanRate(values, "ruptureTriggered"))}, ` +
        `파열 대상 ${field("ruptureTargetDamage")}, 주변 ${field("ruptureSplashHits")}회/${field("ruptureSplashDamage")} 피해, ` +
        `계획 구간 ${field("plannedSegments")}, 계획 반사 ${field("plannedBounces")}, 경과 ${field("elapsed")}초`
    );
}

function formatElementalist(values) {
    const average = (key) =>
        values.length ? values.reduce((sum, value) => sum + finiteNumber(value?.[key]), 0) / values.length : 0;
    const recipes = values.length ? values.filter((value) => value?.recipeBuilt).length / values.length : 0;
    const locks = values.length ? values.filter((value) => value?.targetLocked).length / values.length : 0;
    const completed = values.length ? values.filter((value) => value?.channelCompleted).length / values.length : 0;
    return `회수 ${average("selectedOrbs").toFixed(2)}개, 레시피 ${(recipes * 100).toFixed(1)}%, 대상 잠금 ${(locks * 100).toFixed(1)}%, 채널 완료 ${(completed * 100).toFixed(1)}%, 실제 피해 ${average("actualDamage").toFixed(2)}, 경과 ${average("elapsed").toFixed(2)}초`;
}

function formatGrenade(values) {
    const average = (key) =>
        values.length ? values.reduce((sum, value) => sum + finiteNumber(value?.[key]), 0) / values.length : 0;
    const hitRate = values.length
        ? values.filter((value) => finiteNumber(value?.guidedEnemyExplosions) > 0).length / values.length
        : 0;
    return `유도 ${average("guidedLaunched").toFixed(2)}/${average("guidedPlanned").toFixed(2)}발, 전체 ${average("settledGrenades").toFixed(2)}/${average("totalGrenades").toFixed(2)}발, 적중 ${percent(hitRate)}, 초기 대상 ${average("initialTargetExplosions").toFixed(2)}, 점착 ${average("stickyContacts").toFixed(2)}, 유도 ${average("homingActivations").toFixed(2)}, 낭비 ${average("wastedExplosions").toFixed(2)}, 실제 피해 ${average("actualDamage").toFixed(2)}, 계획 반사 ${average("plannedBounces").toFixed(2)}, 경과 ${average("elapsed").toFixed(2)}초`;
}

export function formatAbilityResult(type, result) {
    const base = formatBase(type, result);
    const values = resultValues(result);
    const detail = {
        "rage-command-cashout": formatRage,
        "archer-command-shot": formatArcher,
        "hero-command-core-cycle": formatHero,
        "phantom-command-chain": formatPhantom,
        "orbit-command-volley": formatOrbit,
        "spin-command-gyro-bank": formatSpin,
        "trickster-command-route": formatTrickster,
        "bat-ball-command-called-shot": formatBatBall,
        "dash-command-manual-entry": formatDash,
        "eater-command-spit-route": formatEater,
        "elementalist-command-recall-route": formatElementalist,
        "grenade-command-bombing-line": formatGrenade
    }[type];
    return detail ? `${base}, ${detail(values)}` : base;
}
