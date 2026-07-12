const CONFIRM_BUTTONS = [{ text: "확인", value: "ok", primary: true }];

const STAT_LABELS = Object.freeze({
    hp: "체력",
    damage: "공격력",
    defense: "방어력",
    speed: "속도",
    skill: "스킬"
});

const RARITY_LABELS = Object.freeze({
    common: "일반",
    uncommon: "고급",
    rare: "희귀",
    epic: "영웅",
    legendary: "전설"
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
    const rarity = RARITY_LABELS[item?.rarity] ?? escapeHtml(item?.rarity ?? "일반");
    const description = item?.description ? `<p>${escapeHtml(item.description)}</p>` : "";
    return `<p><strong>${name}</strong> <span>(${rarity})</span></p>${description}${formatEquipmentStats(item)}`;
}

function createPopup(title, bodyHtml) {
    return { title, bodyHtml, buttons: CONFIRM_BUTTONS };
}

function createEnhancePopup(result) {
    if (result?.error === "stones") {
        return createPopup("강화 불가", "<p>강화석이 부족합니다.</p>");
    }
    if (result?.error === "shards") {
        return createPopup("강화 불가", "<p>파편이 부족합니다.</p>");
    }

    const name = formatEquipmentName(result?.item);
    const levelChange = `+${result?.oldLevel ?? 0} → +${result?.newLevel ?? 0}`;
    const cost = result?.cost ?? {};
    const costText = `<p>소모: 강화석 ${cost.stones ?? 0} · 파편 ${cost.shards ?? 0}</p>`;
    if (result?.success) {
        return createPopup(
            "강화 성공",
            `<p><strong>${name}</strong> 강화에 성공했습니다.</p><p>${levelChange}</p>${costText}`
        );
    }
    return createPopup(
        "강화 실패",
        `<p><strong>${name}</strong> 강화에 실패했습니다.</p><p>${levelChange}</p>${costText}`
    );
}

function createChestPopup(result) {
    if (!result?.opened) {
        const failureMessages = {
            not_enough_shards: `파편이 부족합니다. (필요: ${result?.cost ?? 0})`,
            inventory_full: "장비 인벤토리가 가득 찼습니다. 장비를 분해하거나 인벤토리를 확장해 주세요.",
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
    if (rewardLines.length === 0) {
        rewardLines.push("<p>상자를 열었습니다.</p>");
    }
    return createPopup("상자 개봉 결과", rewardLines.join(""));
}

export function createCollectionActionPopupOptions(action, result) {
    if (action === "enhance") {
        return createEnhancePopup(result);
    }
    if (action === "disassemble") {
        return createPopup(
            "장비 분해 완료",
            `<p><strong>${formatEquipmentName(result?.item)}</strong>을 분해했습니다.</p><p>강화석 +${result?.stones ?? 0}</p>`
        );
    }
    if (action === "sell") {
        return createPopup(
            "장비 판매 완료",
            `<p><strong>${formatEquipmentName(result?.item)}</strong>을 판매했습니다.</p><p>파편 +${result?.shards ?? 0}</p>`
        );
    }
    if (action === "chest") {
        return createChestPopup(result);
    }
    throw new Error(`Unknown collection action popup: ${action}`);
}
