let _bridge = null;

export function registerGameActionBridge(bridge) {
    _bridge = bridge;
}

export function requireGameActionBridge(actionName) {
    if (!_bridge) {
        const msg = actionName
            ? `requireGameActionBridge: '${actionName}' \uC561\uC158\uC744 \uD638\uCD9C\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. gameActionBridge\uAC00 \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.`
            : "requireGameActionBridge: gameActionBridge\uAC00 \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. main.js\uC758 createComponentBridge\uAC00 \uC2E4\uD589\uB418\uC5C8\uB294\uC9C0 \uD655\uC778\uD558\uC138\uC694.";
        throw new Error(msg);
    }
    if (actionName && typeof _bridge[actionName] !== "function") {
        throw new Error(
            `requireGameActionBridge: '${actionName}' \uC561\uC158\uC774 gameActionBridge\uC5D0 \uB4F1\uB85D\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. ` +
                `\uB4F1\uB85D\uB41C \uC561\uC158: ${Object.keys(_bridge).join(", ")}`
        );
    }
    return _bridge;
}
