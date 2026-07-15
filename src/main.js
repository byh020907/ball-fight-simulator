import { BattleApp } from "./app.js";
import { createComponentBridge } from "./componentBridge.js";
import { registerGameActionBridge } from "./actionGateway.js";

window.ballFightApp = new BattleApp();
const gameActionBridge = createComponentBridge(window.ballFightApp);
registerGameActionBridge(gameActionBridge);
Alpine.store("uiManager").setGameActionBridge(gameActionBridge);
