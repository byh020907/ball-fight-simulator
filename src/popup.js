/**
 * uiManager 기반 Promise 팝업 서비스.
 *
 * 사용법:
 *   const result = await PopupService.show({ title, bodyHtml, buttons });
 *   // result === button.value (기본 버튼은 "ok")
 *
 * 설계 계약:
 * - PopupService는 uiManager.getComponent를 통해 popupDialog를 조회합니다.
 * - show()는 popupDialog가 등록되지 않은 상태에서 호출되면
 *   명확한 Error와 함께 Promise를 reject합니다 (조용한 cancel 반환 없음).
 * - resolve()/close()는 활성 다이얼로그가 없으면 무시됩니다.
 *   이는 닫힌 후 호출될 수 있는 resolve를 안전하게 처리하기 위함입니다.
 * - _testDialog는 테스트 전용 주입 경로입니다. 프로덕션 코드는
 *   Alpine.store("uiManager").getComponent("popupDialog")를 통해 조회합니다.
 */

/**
 * @typedef {{ text:string, value?:string, primary?:boolean }} PopupButton
 * @typedef {{ title:string, bodyHtml:string, buttons?:PopupButton[], closeOnOutside?:boolean }} PopupOptions
 */

export class PopupService {
    /** @type {object|null} 내부 테스트 전용 popupDialog override */
    static _testDialog = null;

    /**
     * 테스트 전용: popupDialog 구현체를 주입합니다.
     * @param {object|null} dialog
     */
    static setTestDialog(dialog) {
        PopupService._testDialog = dialog;
    }

    /** @internal popupDialog 컴포넌트를 resolve합니다. */
    static _getPopupDialog() {
        if (PopupService._testDialog) return PopupService._testDialog;
        if (typeof Alpine !== "undefined") {
            return Alpine.store("uiManager").getComponent("popupDialog") ?? null;
        }
        return null;
    }

    /**
     * 팝업을 열고 사용자가 닫을 때 resolve되는 Promise를 반환합니다.
     * @param {PopupOptions} options
     * @returns {Promise<string>}
     */
    static show(options) {
        const popup = PopupService._getPopupDialog();
        if (!popup) {
            return Promise.reject(
                new Error(
                    "PopupService.show: popupDialog가 uiManager에 등록되지 않았습니다. " +
                        "Alpine 컴포넌트 popup-dialog가 로드되었는지 확인하세요."
                )
            );
        }
        return popup.show(options);
    }

    /** @internal popup-dialog 컴포넌트가 닫힌 후 호출 */
    static resolve(value) {
        const popup = PopupService._getPopupDialog();
        if (popup) popup.resolve(value);
    }

    /** 외부에서 팝업을 강제로 닫습니다 */
    static close() {
        const popup = PopupService._getPopupDialog();
        if (popup) popup.close();
    }
}
