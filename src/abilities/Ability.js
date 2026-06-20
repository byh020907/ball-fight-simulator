

export class Ability {
      constructor(owner, simulation) {
        this.owner = owner;
        this.simulation = simulation;
      }

      update() {}
      onCollision() {}
      onDamageTaken() {}
      getRadiusScale() {
        return 1;
      }
      getStatModifiers() {
        return { speed: 1, damage: 1, defense: 1, impact: 1 };
      }
      getUiState() {
        return { label: "Passive", progress: 1 };
      }
    }
