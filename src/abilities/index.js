export { Ability } from "./ability.js";
export { AbilitySet } from "./abilitySet.js";
export { ArcherAbility } from "./archerAbility.js";
export { OrbitAbility } from "./orbitAbility.js";
export { TricksterAbility } from "./tricksterAbility.js";
export { GrenadeAbility } from "./grenadeAbility.js";
export { DashAbility } from "./dashAbility.js";
export { RageAbility } from "./rageAbility.js";
export { SpinAbility } from "./spinAbility.js";
export { EaterAbility } from "./eaterAbility.js";
export { BatBallAbility } from "./batBallAbility.js";
export { HeroAbility } from "./heroAbility.js";
export { VampireAbility } from "./vampireAbility.js";
export { GunnerAbility } from "./gunnerAbility.js";
export { PhantomAbility } from "./phantomAbility.js";
export { ElementalistAbility } from "./elementalistAbility.js";
export { HuntingMeleeAbility } from "./huntingMeleeAbility.js";
export { HuntingMobAbility } from "./huntingMobAbility.js";
export { DeepCoreBossAbility } from "./deepCoreBossAbility.js";

import { Ability } from "./ability.js";
import { CHARACTER_DEFINITIONS } from "../characters/characterRegistry.js";

Ability.MAP = Object.freeze(
    Object.fromEntries(CHARACTER_DEFINITIONS.map((definition) => [definition.abilityId, definition.abilityClass]))
);
