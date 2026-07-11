import {
    equipEquipmentItem,
    expandInventory as expandEquipmentInventory,
    disassembleEquipment,
    sellEquipment,
    fuseEquipment,
    enhanceEquipment,
    canCharacterEquipItem,
    canFuseEquipment,
    calculateEnhanceCost,
    calculateEnhanceFailureRate,
    ENHANCE_MAX_LEVEL,
    getEquippedStatBonuses,
    getCharacterEquipmentLevel,
    getEquipmentRequiredLevel,
    getNextEquipmentRarity
} from "./hunting/equipmentConfig.js";
import { openHuntingChest } from "./hunting/chestRewards.js";
import { savePlayerProfile } from "./playerProfile.js";
import { PopupService } from "./popup.js";
import { HELP_TITLE, HELP_CONTENT } from "./helpContent.js";
import { CollectionHubService } from "./collectionHubService.js";

export function createComponentBridge(app) {
    function showLevelLockPopup(item) {
        const requiredLevel = getEquipmentRequiredLevel(item);
        const charLevel = getCharacterEquipmentLevel(app.playerProfile, app.playerFighterId);
        PopupService.show({
            title: "레벨 부족",
            bodyHtml: `<p>요구 레벨: ${requiredLevel}<br>현재 레벨: ${charLevel}</p>`,
            buttons: [{ text: "확인", value: "ok", primary: true }]
        });
    }

    function refreshCollectionAndProfile() {
        app._refreshCollectionHub();
        app.refreshPlayerSetup();
        savePlayerProfile(app.playerProfile);
    }

    return {
        // ── Tournament/Setup actions ──
        startTournament() {
            return app.startTournament();
        },
        adjustStat(key, delta) {
            return app.adjustStat(key, delta);
        },
        randomAllocation() {
            return app.randomAllocation();
        },
        resetAllocation() {
            return app.resetAllocation();
        },
        adjustChallengeLevel(delta) {
            return app.adjustChallengeLevel(delta);
        },

        // ── Hunting actions ──
        openHuntingLobby() {
            return app.hunting.showCharacterSelect();
        },
        huntingRetreat() {
            return app.hunting.retreat();
        },
        huntingAdvance() {
            return app.hunting.advance();
        },
        huntingMerchantChoose(idx) {
            return app.hunting.merchantChoose(idx);
        },
        huntingMerchantPass() {
            return app.hunting.merchantPass();
        },

        // ── Help action ──
        openHelp() {
            PopupService.show({
                title: HELP_TITLE,
                bodyHtml: HELP_CONTENT
            });
        },

        // ── Equipment actions ──
        expandInventory() {
            const profile = app.playerProfile;
            const result = expandEquipmentInventory(profile);
            if (result) {
                refreshCollectionAndProfile();
            } else {
                PopupService.show({
                    title: "확장 불가",
                    bodyHtml: `<p>파편이 부족하거나 최대 인벤토리입니다.</p>`,
                    buttons: [{ text: "확인", value: "ok", primary: true }]
                });
            }
            return result;
        },

        equipItem(instanceId) {
            const profile = app.playerProfile;
            const result = equipEquipmentItem(profile, instanceId, app.playerFighterId);
            if (!result) return;
            if (result.error === "level") {
                showLevelLockPopup(result.item);
                return;
            }
            if (result.error === "slot_full") {
                PopupService.show({
                    title: "슬롯 부족",
                    bodyHtml: `<p>해당 슬롯이 이미 찼습니다.</p>`,
                    buttons: [{ text: "확인", value: "ok", primary: true }]
                });
                return;
            }
            refreshCollectionAndProfile();
        },

        unequipItem(instanceId) {
            const profile = app.playerProfile;
            const eq = profile?.equipment;
            if (!eq || !Array.isArray(eq.inventory)) return;
            const equipped = eq.equipped ?? {};
            for (const slot of Object.keys(equipped)) {
                if (equipped[slot] === instanceId) {
                    equipped[slot] = null;
                    refreshCollectionAndProfile();
                    return;
                }
            }
        },

        enhanceItem(instanceId) {
            const profile = app.playerProfile;
            const eq = profile?.equipment;
            if (!eq || !Array.isArray(eq.inventory)) return;
            const item = eq.inventory.find((i) => i.instanceId === instanceId);
            if (!item) return;
            const currentLevel = item.enhanceLevel ?? 0;
            if (currentLevel >= ENHANCE_MAX_LEVEL) return;

            const cost = calculateEnhanceCost(currentLevel);
            if (
                (eq.enhancementStones ?? 0) < (cost?.stones ?? 0) ||
                (profile.hunting?.shards ?? 0) < (cost?.shards ?? 0)
            ) {
                PopupService.show({
                    title: "강화 불가",
                    bodyHtml: `<p>강화석 또는 파편이 부족합니다.</p>`,
                    buttons: [{ text: "확인", value: "ok", primary: true }]
                });
                return;
            }
            const result = enhanceEquipment(profile, instanceId);
            if (result) {
                refreshCollectionAndProfile();
            }
        },

        fuseItem(instanceId) {
            const profile = app.playerProfile;
            if (!canFuseEquipment(profile, instanceId)) {
                PopupService.show({
                    title: "합성 불가",
                    bodyHtml: `<p>파편, 강화석 부족 또는 같은 등급의 파트너 장비가 없습니다.</p>`,
                    buttons: [{ text: "확인", value: "ok", primary: true }]
                });
                return;
            }
            const result = fuseEquipment(profile, instanceId);
            if (result && !result.error) {
                refreshCollectionAndProfile();
            }
        },

        disassembleItem(instanceId) {
            const profile = app.playerProfile;
            const result = disassembleEquipment(profile, instanceId);
            if (result) {
                refreshCollectionAndProfile();
            }
        },

        sellItem(instanceId) {
            const profile = app.playerProfile;
            const result = sellEquipment(profile, instanceId);
            if (result) {
                refreshCollectionAndProfile();
            }
        },

        // ── Collection navigation actions ──
        openCollectionHub(tabId) {
            CollectionHubService.open(tabId || "roster");
        },
        openEquipmentHub() {
            CollectionHubService.open("equipment");
        },

        // ── Chest actions ──
        openChest(chestId) {
            const profile = app.playerProfile;
            if (!profile?.hunting) return false;

            const result = openHuntingChest(profile, chestId);
            if (!result.opened) {
                const msgs = {
                    not_enough_shards: `파편이 부족합니다 (필요: ${result.cost})`,
                    inventory_full: "장비 인벤토리가 가득 찼습니다. 장비를 분해하거나 인벤토리를 확장해주세요.",
                    not_found: "상자를 찾을 수 없습니다.",
                    missing_storage: "보관함 정보를 불러올 수 없습니다."
                };
                PopupService.show({
                    title: "개봉 실패",
                    bodyHtml: `<p>${msgs[result.reason] ?? "알 수 없는 오류"}</p>`
                });
                return false;
            }

            savePlayerProfile(profile);
            app._refreshCollectionHub?.();

            let bodyHtml = "";
            if (result.applied.shards > 0) {
                bodyHtml += `<p>파편 +${result.applied.shards} (보유: ${result.currentShards})</p>`;
            }
            if (result.applied.equipment) {
                const eq = result.applied.equipment;
                const statsText = eq.stats.map((s) => `${s.type} +${s.value}`).join(", ");
                bodyHtml += `<p><strong>${eq.name}</strong> (${eq.rarity})<br><span style="font-size:0.8rem">${eq.description} · ${statsText}</span></p>`;
            }

            PopupService.show({
                title: "상자 개봉 결과",
                bodyHtml
            });
            return true;
        }
    };
}
