import { BattleApp } from "./app.js";
import { createComponentBridge } from "./componentBridge.js";
import { registerGameActionBridge } from "./actionGateway.js";

window.ballFightApp = new BattleApp();
window.gameActionBridge = createComponentBridge(window.ballFightApp);
registerGameActionBridge(window.gameActionBridge);
