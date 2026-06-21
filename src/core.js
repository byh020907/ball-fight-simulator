export class Vector2 {
      constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
      }

      clone() {
        return new Vector2(this.x, this.y);
      }

      add(other) {
        this.x += other.x;
        this.y += other.y;
        return this;
      }

      subtract(other) {
        this.x -= other.x;
        this.y -= other.y;
        return this;
      }

      scale(value) {
        this.x *= value;
        this.y *= value;
        return this;
      }

      length() {
        return Math.hypot(this.x, this.y);
      }

      normalize() {
        const size = this.length() || 1;
        this.x /= size;
        this.y /= size;
        return this;
      }

      static add(a, b) {
        return new Vector2(a.x + b.x, a.y + b.y);
      }

      static subtract(a, b) {
        return new Vector2(a.x - b.x, a.y - b.y);
      }

      static fromAngle(angle, radius) {
        return new Vector2(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
    }

export class CombatEntity {
      constructor(position, velocity, radius) {
        this.position = position;
        this.velocity = velocity;
        this.radius = radius;
        this.isExpired = false;
      }

      update() {}
      draw() {}
    }

export class TimedEffect {
      constructor(duration) {
        this.duration = duration;
        this.elapsed = 0;
      }

      get finished() {
        return this.elapsed >= this.duration;
      }

      tick(delta) {
        this.elapsed += delta;
      }
    }

export const FIGHTER_IDS = Object.freeze({
  ARCHER: "archer",
  ORBIT: "orbit",
  TRICKSTER: "trickster",
  GRENADE: "grenade",
  DASH: "dash",
  RAGE: "rage",
  EATER: "eater"
});

