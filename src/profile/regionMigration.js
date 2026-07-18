export function runRegionMigrations(area, { targetVersion, steps, createDefault }) {
    const sourceVersion = Number.isInteger(area?.schemaVersion) ? area.schemaVersion : 0;
    if (sourceVersion < 0 || sourceVersion > targetVersion) return createDefault();

    let current = area && typeof area === "object" ? area : {};
    for (let version = sourceVersion; version < targetVersion; version += 1) {
        const step = steps.get(version);
        if (typeof step !== "function") return createDefault();
        current = step(current);
        if (!current || current.schemaVersion !== version + 1) return createDefault();
    }
    return current;
}
