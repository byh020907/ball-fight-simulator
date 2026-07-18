import { runRegionMigrations } from "../profile/regionMigration.js";
import { migrateRebirthV0ToV1 } from "./migrations/v0ToV1.js";

export const REBIRTH_SCHEMA_VERSION = 1;

export const REBIRTH_MIGRATION_STEPS = new Map([[0, migrateRebirthV0ToV1]]);

export function createDefaultRebirthArea() {
    return { schemaVersion: REBIRTH_SCHEMA_VERSION, byCharacter: {} };
}

export function migrateRebirthArea(area, steps = REBIRTH_MIGRATION_STEPS) {
    return runRegionMigrations(area, {
        targetVersion: REBIRTH_SCHEMA_VERSION,
        steps,
        createDefault: createDefaultRebirthArea
    });
}
