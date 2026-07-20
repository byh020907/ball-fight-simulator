import { createHuntingChest } from "../huntingRewards.js";
import { HUNTING_EVENT_TRANSITIONS, HuntingEvent } from "./huntingEvent.js";
import { safeFloor } from "./eventHelpers.js";
import { getRarityLabel } from "../rarityPresentation.js";
import {
    HUNTING_RUN_PHASES,
    getHuntingRunHealth,
    recordHuntingFloorResult,
    setHuntingRunPhase
} from "../huntingState.js";
import { REWARD_BALANCE } from "../../rewardBalanceConfig.js";

function rollChestRarity(floor, rng) {
    const chances = REWARD_BALANCE.hunting.events.chestRoom;
    const roll = rng();
    if (floor >= chances.legendary.minimumFloor && roll < chances.legendary.chance) return "legendary";
    if (floor >= chances.epic.minimumFloor && roll < chances.epic.chance) return "epic";
    if (floor >= chances.rare.minimumFloor && roll < chances.rare.chance) return "rare";
    return roll < chances.uncommonChance ? "uncommon" : "common";
}

export class ChestRoomEvent extends HuntingEvent {
    createPayload(floor, rng) {
        const safe = safeFloor(floor);
        return { type: this.type, floor: safe, chestRarity: rollChestRarity(safe, rng) };
    }

    resolve(event, { run }) {
        const chest = createHuntingChest({ rarity: event.chestRarity ?? "common" });
        const health = getHuntingRunHealth(run);
        const nextRun = recordHuntingFloorResult(run, {
            hpRemain: health.hp,
            maxHp: health.maxHp,
            loot: { shards: 0, chests: [chest] },
            consumeStatModifiers: false
        });
        return {
            run: setHuntingRunPhase(nextRun, HUNTING_RUN_PHASES.AWAITING_CHEST),
            transition: HUNTING_EVENT_TRANSITIONS.CHEST,
            chest,
            logMessage: `[사냥터] 상자방: ${getRarityLabel(chest.rarity)} 상자 획득`,
            presentation: {
                title: "상자방 발견",
                subtext: "상자를 미확보 전리품에 보관했습니다.",
                detail: "상자 1개 획득"
            }
        };
    }
}
