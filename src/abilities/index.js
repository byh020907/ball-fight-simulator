export { Ability } from "./ability.js";
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
export { HuntingMeleeAbility } from "./huntingMeleeAbility.js";

import { Ability } from "./ability.js";
import { ArcherAbility } from "./archerAbility.js";
import { OrbitAbility } from "./orbitAbility.js";
import { TricksterAbility } from "./tricksterAbility.js";
import { GrenadeAbility } from "./grenadeAbility.js";
import { DashAbility } from "./dashAbility.js";
import { RageAbility } from "./rageAbility.js";
import { SpinAbility } from "./spinAbility.js";
import { EaterAbility } from "./eaterAbility.js";
import { BatBallAbility } from "./batBallAbility.js";
import { HeroAbility } from "./heroAbility.js";
import { VampireAbility } from "./vampireAbility.js";
import { GunnerAbility } from "./gunnerAbility.js";
import { PhantomAbility } from "./phantomAbility.js";

Ability.MAP = Object.freeze({
    archer: ArcherAbility,
    orbit: OrbitAbility,
    trickster: TricksterAbility,
    grenade: GrenadeAbility,
    dash: DashAbility,
    rage: RageAbility,
    spin: SpinAbility,
    eater: EaterAbility,
    bat_ball: BatBallAbility,
    hero: HeroAbility,
    vampire: VampireAbility,
    gunner: GunnerAbility,
    phantom: PhantomAbility
});
