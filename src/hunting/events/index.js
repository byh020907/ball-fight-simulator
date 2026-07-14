import { HUNTING_EVENT_TYPES } from "../huntingConfig.js";
import { BoonEvent } from "./boonEvent.js";
import { ChampionIntrusionEvent } from "./championIntrusionEvent.js";
import { ChestRoomEvent } from "./chestRoomEvent.js";
import { CursedAltarEvent } from "./cursedAltarEvent.js";
import { EliteMobEvent } from "./eliteMobEvent.js";
import { HuntingEvent } from "./huntingEvent.js";
import { MerchantEvent } from "./merchantEvent.js";
import { MishapEvent } from "./mishapEvent.js";
import { PortalEvent } from "./portalEvent.js";
import { RestSiteEvent } from "./restSiteEvent.js";

HuntingEvent.POOL = Object.freeze([
    new PortalEvent(HUNTING_EVENT_TYPES.PORTAL),
    new MerchantEvent(HUNTING_EVENT_TYPES.WANDERING_MERCHANT),
    new BoonEvent(HUNTING_EVENT_TYPES.BOON),
    new MishapEvent(HUNTING_EVENT_TYPES.MISHAP),
    new ChestRoomEvent(HUNTING_EVENT_TYPES.CHEST_ROOM),
    new RestSiteEvent(HUNTING_EVENT_TYPES.REST_SITE),
    new CursedAltarEvent(HUNTING_EVENT_TYPES.CURSED_ALTAR),
    new ChampionIntrusionEvent(HUNTING_EVENT_TYPES.CHAMPION_INTRUSION),
    new EliteMobEvent(HUNTING_EVENT_TYPES.ELITE_MOB)
]);
HuntingEvent.REGISTRY = new Map(HuntingEvent.POOL.map((event) => [event.type, event]));

export { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";

export function createHuntingEvent(type, floor, rng = Math.random) {
    return HuntingEvent.createPayload(type, floor, rng);
}
