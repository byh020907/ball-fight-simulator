import { Simulation } from "./Simulation.js";

/**
 * Test simulation — extends Simulation with no-op hooks.
 * Use in test pages where entities need a real arena with wall bouncing.
 *
 * Example:
 *   const sim = new TestSimulation();
 *   sim.fighters.push(ball);
 *   sim.entities.push(ball);
 *   ball.simulation = sim;
 */
export class TestSimulation extends Simulation {
    constructor() {
        super();
        this._log = [];
        this._sounds = [];
    }

    addLog(message) {
        this._log.push(message);
    }

    playSound(type, intensity = 1) {
        this._sounds.push({ type, intensity });
    }
}
