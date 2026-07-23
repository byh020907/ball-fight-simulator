import { getRarityLabel } from "../hunting/rarityPresentation.js";

const CONFIRM_BUTTONS = [{ text: "확인", value: "ok", primary: true }];

const STAT_LABELS = Object.freeze({
    hp: "체력",
    damage: "공격력",
    defense: "방어력",
    speed: "속도",
    skill: "스킬"
});

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => {
        const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" };
        return entities[character];
    });
}

function formatEquipmentName(item) {
    return escapeHtml(item?.name ?? "장비");
}

function formatEquipmentStats(item) {
    const stats = item?.stats ?? [];
    if (stats.length === 0) return "";
    const text = stats.map((stat) => `${STAT_LABELS[stat.type] ?? escapeHtml(stat.type)} +${stat.value}`).join(" · ");
    return `<p>${text}</p>`;
}

function formatEquipmentReward(item) {
    const name = formatEquipmentName(item);
    const rarity = escapeHtml(getRarityLabel(item?.rarity));
    const description = item?.description ? `<p>${escapeHtml(item.description)}</p>` : "";
    return `<p><strong>${name}</strong> <span>(${rarity})</span></p>${description}${formatEquipmentStats(item)}`;
}

function createPopup(title, bodyHtml, buttons = CONFIRM_BUTTONS) {
    return { title, bodyHtml, buttons };
}

function createEnhancePopup(result) {
    if (result?.error === "shards") {
        return createPopup("강화 불가", "<p>파편이 부족합니다.</p>");
    }

    const name = formatEquipmentName(result?.item);
    const levelChange = `+${result?.oldLevel ?? 0} → +${result?.newLevel ?? 0}`;
    const cost = result?.cost ?? {};
    const costText = `<p>소모: 파편 ${cost.shards ?? 0}</p>`;
    if (result?.success) {
        return createPopup(
            "강화 성공",
            `<p><strong>${name}</strong> 강화에 성공했습니다.</p><p>${levelChange}</p>${costText}`
        );
    }
    const canRecover = result?.recoverable && result?.canRecover;
    const recoveryText = result?.recoverable
        ? canRecover
            ? "<p>강화석 1개로 방금 하락한 단계를 복구할 수 있습니다.</p>"
            : "<p>강화석이 없어 하락한 단계를 복구할 수 없습니다.</p>"
        : "";
    const buttons = canRecover
        ? [
              { text: "하락 유지", value: "keep" },
              { text: "강화석 1개로 복구", value: "recover", primary: true }
          ]
        : CONFIRM_BUTTONS;
    return createPopup(
        "강화 실패",
        `<p><strong>${name}</strong> 강화에 실패했습니다.</p><p>${levelChange}</p>${costText}${recoveryText}`,
        buttons
    );
}

function createChestPopup(result) {
    if (!result?.opened) {
        const failureMessages = {
            not_enough_shards: `파편이 부족합니다. (필요: ${result?.cost ?? 0})`,
            inventory_full: "장비 인벤토리가 가득 찼습니다. 장비를 판매하거나 인벤토리를 확장해 주세요.",
            not_found: "상자를 찾을 수 없습니다.",
            missing_storage: "보관함 정보를 불러올 수 없습니다."
        };
        return createPopup(
            "개봉 실패",
            `<p>${failureMessages[result?.reason] ?? "알 수 없는 오류가 발생했습니다."}</p>`
        );
    }

    const rewardLines = [];
    if ((result.applied?.shards ?? 0) > 0) {
        rewardLines.push(`<p>파편 +${result.applied.shards} (보유: ${result.currentShards ?? 0})</p>`);
    }
    if (result.applied?.equipment) {
        rewardLines.push(formatEquipmentReward(result.applied.equipment));
    }
    if (result.applied?.autoEquip?.equipped) {
        rewardLines.push("<p><strong>현재 캐릭터에게 자동 장착했습니다.</strong></p>");
    }
    if (rewardLines.length === 0) {
        rewardLines.push("<p>상자를 열었습니다.</p>");
    }
    return createPopup("상자 개봉 결과", rewardLines.join(""));
}

function createFusionPopup(result) {
    if (result?.error) {
        const failureMessages = {
            profile: "합성 정보를 불러올 수 없습니다.",
            sources: "같은 등급 장비 3개를 선택해 주세요.",
            rarity: "선택한 장비의 등급이 서로 다릅니다.",
            max_rarity: "legendary 장비는 더 이상 합성할 수 없습니다.",
            equipped: "장착 중인 장비는 합성 재료로 사용할 수 없습니다.",
            shards: "파편이 부족합니다.",
            cost: "이 등급의 합성 비용을 찾을 수 없습니다."
        };
        return createPopup("합성 불가", `<p>${failureMessages[result.error] ?? "합성할 수 없습니다."}</p>`);
    }

    const consumedNames = (result?.consumed ?? []).map(formatEquipmentName).join(" · ");
    const cost = result?.cost ?? {};
    return createPopup(
        "장비 합성 완료",
        `<p>소모 장비: ${consumedNames}</p><p>소모: 파편 ${cost.shards ?? 0}</p>${formatEquipmentReward(result?.item)}`
    );
}

export function createCollectionActionPopupOptions(action, result) {
    if (action === "enhance") {
        return createEnhancePopup(result);
    }
    if (action === "sell") {
        const stoneText = (result?.stones ?? 0) > 0 ? `<p>강화석 +${result.stones}</p>` : "";
        return createPopup(
            "장비 판매 완료",
            `<p><strong>${formatEquipmentName(result?.item)}</strong>을 판매했습니다.</p><p>파편 +${result?.shards ?? 0}</p>${stoneText}`
        );
    }
    if (action === "enhanceRecovery") {
        return createPopup(
            "강화 단계 복구",
            `<p><strong>${formatEquipmentName(result?.item)}</strong>을 +${result?.newLevel ?? 0} 단계로 복구했습니다.</p><p>강화석 -${result?.stones ?? 0}</p>`
        );
    }
    if (action === "chest") {
        return createChestPopup(result);
    }
    if (action === "fusion") {
        return createFusionPopup(result);
    }
    throw new Error(`Unknown collection action popup: ${action}`);
}
