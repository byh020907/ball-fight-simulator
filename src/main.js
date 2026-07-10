import { BattleApp } from "./app.js";
import { createComponentBridge } from "./componentBridge.js";

window.ballFightApp = new BattleApp();
window.gameActionBridge = createComponentBridge(window.ballFightApp);
