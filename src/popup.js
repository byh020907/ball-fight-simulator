/**
 * Alpine 기반 Promise 팝업 서비스.
 *
 * Alpine의 반응형 데이터를 통해 팝업을 표시하므로,
 * HTML 템플릿은 index.html 에서 Alpine x-show / x-html 등으로 관리합니다.
 *
 * 사용법:
 *   const result = await PopupService.show({ title, bodyHtml, buttons });
 *   // result === button.value (기본 버튼은 "ok")
 *
 * 전제: appStore에 popupContent, closePopup() 가 정의되어 있어야 합니다.
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
            const root = document.querySelector(".app");
            const data = root ? window.Alpine.$data(root) : null;
            if (!data) {
                _resolve = null;
                resolve("error");
                return;
            }
            data.popupVisible = true;
            data.popupContent = {
                title: options.title ?? "",
                bodyHtml: options.bodyHtml ?? "",
                buttons: options.buttons ?? [{ text: "닫기", value: "ok", primary: true }],
                closeOnOutside: options.closeOnOutside !== false
            };
        });
    }

    /** @internal PopupService.closePopup에서 setTimeout 이후 호출 */
    static resolve(value) {
        if (_resolve) {
            const r = _resolve;
            _resolve = null;
            r(value);
        }
    }
}
