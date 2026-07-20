export const HUNTING_PARTY_ROLES = Object.freeze({
    LEADER: "leader",
    COMPANION: "companion",
    SWAP: "swap"
});

export const HUNTING_SUPPORT_SLOT_COUNT = 3;
export const HUNTING_SUPPORT_RECHARGE_FLOORS = 10;

const DIRECT_PARTY_ROLES = Object.freeze(Object.values(HUNTING_PARTY_ROLES));
const HERO_CARRYOVER_KEYS = Object.freeze(["hp", "damage", "speed", "defense", "skill", "critical"]);

function createEmptyHeroCarryover() {
    return Object.fromEntries(HERO_CARRYOVER_KEYS.map((key) => [key, 0]));
}

function createPartyMember(role, characterId) {
    if (!characterId) return null;
    return {
        role,
        characterId,
        hp: null,
        maxHp: null,
        defeated: false,
        hero: {
            carryover: createEmptyHeroCarryover()
        }
    };
}

function createSupportSlot(characterId = null) {
    return {
        characterId,
        ready: Boolean(characterId),
        floorsRemaining: 0
    };
}

function normalizeSupportIds(supportIds) {
    return Array.from({ length: HUNTING_SUPPORT_SLOT_COUNT }, (_, index) => supportIds[index] ?? null);
}

function updateMember(party, role, updater) {
    const member = party?.members?.[role];
    if (!member) return party;
    return {
        ...party,
        members: {
            ...party.members,
            [role]: updater(member)
        }
    };
}

function mapMembers(party, mapper) {
    return {
        ...party,
        members: Object.fromEntries(
            DIRECT_PARTY_ROLES.map((role) => {
                const member = party.members[role];
                return [role, member ? mapper(member) : null];
            })
        )
    };
}

function isAlive(member) {
    if (!member || member.defeated) return false;
    return !Number.isFinite(member.hp) || member.hp > 0;
}

export function createHuntingPartyState({ leaderId, companionId = null, swapId = null, supportIds = [] } = {}) {
    if (!leaderId) throw new Error("leaderId is required to create a hunting party");
    const normalizedSupportIds = normalizeSupportIds(Array.isArray(supportIds) ? supportIds : []);
    return {
        activeRole: HUNTING_PARTY_ROLES.LEADER,
        members: {
            [HUNTING_PARTY_ROLES.LEADER]: createPartyMember(HUNTING_PARTY_ROLES.LEADER, leaderId),
            [HUNTING_PARTY_ROLES.COMPANION]: createPartyMember(HUNTING_PARTY_ROLES.COMPANION, companionId),
            [HUNTING_PARTY_ROLES.SWAP]: createPartyMember(HUNTING_PARTY_ROLES.SWAP, swapId)
        },
        supports: normalizedSupportIds.map(createSupportSlot)
    };
}

export function getHuntingPartyMember(party, role) {
    return party?.members?.[role] ?? null;
}

export function getActiveHuntingPartyMember(party) {
    return getHuntingPartyMember(party, party?.activeRole);
}

export function setHuntingPartyMemberHealth(party, role, { hp, maxHp } = {}) {
    return updateMember(party, role, (member) => {
        const nextMaxHp = Number.isFinite(maxHp) && maxHp > 0 ? maxHp : member.maxHp;
        const sourceHp = Number.isFinite(hp) ? hp : member.hp;
        const nextHp = Number.isFinite(sourceHp)
            ? Math.min(Number.isFinite(nextMaxHp) ? nextMaxHp : sourceHp, Math.max(0, sourceHp))
            : sourceHp;
        return {
            ...member,
            hp: nextHp,
            maxHp: nextMaxHp,
            defeated: Number.isFinite(nextHp) ? nextHp <= 0 : member.defeated
        };
    });
}

export function setActiveHuntingPartyRole(party, role) {
    if (role !== HUNTING_PARTY_ROLES.LEADER && role !== HUNTING_PARTY_ROLES.SWAP) return party;
    if (!getHuntingPartyMember(party, role)) return party;
    return { ...party, activeRole: role };
}

export function markHuntingPartyMemberDefeated(party, role) {
    return updateMember(party, role, (member) => ({ ...member, hp: 0, defeated: true }));
}

export function reviveDefeatedHuntingPartyMembers(party) {
    return mapMembers(party, (member) => (member.defeated ? { ...member, hp: 1, defeated: false } : member));
}

export function applyHuntingPartyFloorRecovery(party, recoveryRatio = 0.1) {
    const ratio = Math.max(0, Number.isFinite(recoveryRatio) ? recoveryRatio : 0);
    return mapMembers(party, (member) => {
        if (member.defeated) return member;
        if (!Number.isFinite(member.hp) || !Number.isFinite(member.maxHp) || member.maxHp <= 0) return member;
        const hp = Math.min(member.maxHp, Math.max(0, member.hp));
        return { ...member, hp: Math.min(member.maxHp, hp + (member.maxHp - hp) * ratio) };
    });
}

export function isHuntingPartyBattleDefeated(party) {
    return (
        !isAlive(getActiveHuntingPartyMember(party)) &&
        !isAlive(getHuntingPartyMember(party, HUNTING_PARTY_ROLES.COMPANION))
    );
}

export function consumeHuntingSupportCharge(party, slotIndex) {
    const slot = party?.supports?.[slotIndex];
    if (!slot?.characterId || !slot.ready) return party;
    return {
        ...party,
        supports: party.supports.map((current, index) =>
            index === slotIndex
                ? { ...current, ready: false, floorsRemaining: HUNTING_SUPPORT_RECHARGE_FLOORS }
                : current
        )
    };
}

export function advanceHuntingSupportCharges(party) {
    return {
        ...party,
        supports: party.supports.map((slot) => {
            if (!slot.characterId || slot.ready) return slot;
            const floorsRemaining = Math.max(0, slot.floorsRemaining - 1);
            return { ...slot, floorsRemaining, ready: floorsRemaining === 0 };
        })
    };
}
