/**
 * Alpine store 기반 Promise 팝업 서비스.
 *
 * Alpine.store("popupDialog")를 통해 컴포넌트와 데이터를 교환합니다.
 *
 * 사용법:
 *   const result = await PopupService.show({ title, bodyHtml, buttons });
 *   // result === button.value (기본 버튼은 "ok")
 */

/**
 * @typedef {{ text:string, value?:string, primary?:boolean }} PopupButton
 * @typedef {{ title:string, bodyHtml:string, buttons?:PopupButton[], closeOnOutside?:boolean }} PopupOptions
 */

let _resolve = null;

export class PopupService {
    /**
     * 팝업을 열고 사용자가 닫을 때 resolve되는 Promise를 반환합니다.
     * @param {PopupOptions} options
     * @returns {Promise<string>}
     */
    static show(options) {
        if (_resolve) return Promise.resolve("cancel");

        return new Promise((resolve) => {
            _resolve = resolve;
            Alpine.store("popupDialog", {
                title: options.title ?? "",
                bodyHtml: options.bodyHtml ?? "",
                buttons: options.buttons ?? [{ text: "닫기", value: "ok", primary: true }],
                closeOnOutside: options.closeOnOutside !== false,
                visible: true
            });
        });
    }

    /** @internal popup-dialog 컴포넌트가 닫힌 후 호출 */
    static resolve(value) {
        if (_resolve) {
            const r = _resolve;
            _resolve = null;
            r(value);
        }
    }

    /** 외부에서 팝업을 강제로 닫습니다 */
    static close() {
        Alpine.store("popupDialog", { visible: false });
        if (_resolve) {
            const r = _resolve;
            _resolve = null;
            r("close");
        }
    }
}
