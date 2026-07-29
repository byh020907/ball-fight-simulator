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

    dot(other) {
        return this.x * other.x + this.y * other.y;
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
