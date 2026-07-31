const PROFILE_DEFAULTS = Object.freeze({
    standard: Object.freeze({ seeds: 1, maxSeconds: 75 }),
    long: Object.freeze({ seeds: 10, maxSeconds: 120 })
});

function readNumber(environment, name, fallback, minimum = 0) {
    const value = Number(environment[name]);
    return Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;
}

function readList(environment, name, fallback) {
    return (
        environment[name]
            ?.split(",")
            .map((value) => value.trim())
            .filter(Boolean) ?? fallback
    ).filter(Boolean);
}

function readBoolean(environment, name) {
    return environment[name] === "1" || environment[name] === "true";
}

function readProfile(environment) {
    const profile = environment.METRICS_PROFILE ?? "standard";
    if (!PROFILE_DEFAULTS[profile]) {
        throw new Error(`Unknown METRICS_PROFILE: ${profile}. Expected standard or long.`);
    }
    return profile;
}

function readAbilityTiers(environment) {
    if (environment.METRICS_ABILITY_TIERS === undefined) return Object.freeze([0]);
    const values = environment.METRICS_ABILITY_TIERS.split(",").map((value) => value.trim());
    if (!values.length || values.some((value) => value === "")) {
        throw new Error("METRICS_ABILITY_TIERS must be a non-empty comma-separated list of 0, 1, 2, or 3.");
    }
    const tiers = values.map((value) => {
        if (!/^[0-3]$/.test(value)) {
            throw new Error(`Invalid METRICS_ABILITY_TIERS value: ${value}. Expected an integer from 0 to 3.`);
        }
        return Number(value);
    });
    return Object.freeze([...new Set(tiers)]);
}

export function createDragAbilityMetricsConfig(environment, rosterIds) {
    const profile = readProfile(environment);
    const profileDefaults = PROFILE_DEFAULTS[profile];
    return Object.freeze({
        profile,
        seeds: readNumber(environment, "METRICS_SEEDS", profileDefaults.seeds, 1),
        maxSeconds: readNumber(environment, "METRICS_MAX_SECONDS", profileDefaults.maxSeconds, 1),
        seed: readNumber(environment, "METRICS_SEED", 20260730),
        characters: Object.freeze(readList(environment, "METRICS_CHARACTERS", rosterIds)),
        stages: Object.freeze(readList(environment, "METRICS_STAGES", ["cave", "forest", "desert"])),
        floors: Object.freeze(
            readList(environment, "METRICS_FLOORS", ["6", "20", "36"]).map((value) => Math.max(1, Number(value) || 1))
        ),
        abilityTiers: readAbilityTiers(environment),
        step: 1 / 60,
        candidateAngles: 12,
        holdSeconds: 0.35,
        pullPixels: 130,
        commandResourcePrototype: readBoolean(environment, "METRICS_COMMAND_RESOURCE_PROTOTYPE"),
        abilityCommandPrototype: readBoolean(environment, "METRICS_ABILITY_COMMAND_PROTOTYPE")
    });
}
