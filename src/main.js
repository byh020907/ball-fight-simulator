import { createComponentBridge } from "./componentBridge.js";
import { registerGameActionBridge } from "./actionGateway.js";

const version = encodeURIComponent(globalThis.BFS_ASSET_VERSION ?? "dev");
const { BattleApp } = await import(`./app.js?v=${version}`);

window.ballFightApp = new BattleApp();
const gameActionBridge = createComponentBridge(window.ballFightApp);
registerGameActionBridge(gameActionBridge);
Alpine.store("uiManager").setGameActionBridge(gameActionBridge);
