# Alpine 템플릿 컴포넌트 시스템

> 상태: 태그 기반 + 파일 분리 + 독립 스코프 + scoped CSS 지원
> 기준 코드: 2026-07-04 `main`
> 핵심 파일: `src/alpineTemplateComponents.js`, `src/componentLoader.js`
> 참고 문서: Alpine 공식 `Alpine.data`, `Alpine.store`, `Extending`

## 1. 목적

이 프로젝트는 Vanilla JS + Alpine.js + Canvas 2D 구조입니다. 반복되는 UI 조각을 재사용하기 위해 `<template id="template-{name}">` 기반 컴포넌트 시스템을 둡니다.

각 컴포넌트는 독립된 `x-data` 스코프를 가지며, Vue SFC 같은 단일 파일 구조(`template.html`)로 관리합니다:

- `<template>` 내 마크업 (루트 요소에 자체 `x-data`)
- `<script>` — `Alpine.data()` 컴포넌트 로직
- `<style scoped>` 또는 `<style global>` — 스타일 (맨 아래 배치)

## 2. 파일 구조

```
src/
  componentLoader.js              ← 템플릿 fetch + script/style 처리
  alpineTemplateComponents.js     ← 태그 기반 mount 시스템
  components/
    xp-reward-panel.html          ← HTML + Script + Style 일체
    xp-progress-bar.html
```

컴포넌트 추가 시:
1. `src/components/<name>.html` 생성

## 3. 컴포넌트 파일 포맷 (Vue SFC 순서)

```html
<!-- src/components/my-component/template.html -->

<!-- 1. Template: 루트 요소에 자체 x-data 스코프 -->
<div x-data="myComponent" class="my-component">
    <span x-text="label"></span>
    <button @click="doSomething">Click</button>
</div>

<!-- 2. Script: 컴포넌트 로직 (Vue 3 Composition API 스타일) -->
<script>
    Alpine.data("myComponent", () => {
        // state: 템플릿이 참조하는 반응형 데이터만 그룹화 (Alpine.reactive()로 반응성 보장)
        const state = Alpine.reactive({
            label: "",
            visible: false
        });

        // private: 템플릿과 무관한 내부 변수/함수는 클로저에 숨김
        function privateHelper() {
            // ...
        }

        // 템플릿에 노출할 것만 return (state + 필수 메서드)
        return {
            state,
            init() {
                this.$watch("$store.myData", (val) => {
                    if (!val) return;
                    state.label = val.label ?? "";
                    state.visible = val.visible ?? false;
                }, { immediate: true });
            }
        };
    });
</script>

> **`Alpine.data()` 구조 규칙**: 팩토리 함수 바디에서 `const state = Alpine.reactive({...})`로 템플릿 바인딩 데이터를 그룹화하고, 내부 전용 변수/함수는 클로저에 선언합니다. `return { state, ... }`로 꼭 필요한 것만 노출합니다. 이는 Vue 3 `<script setup>`의 Composition API 스타일을 따릅니다. 네임드 함수 `function fooFactory(){}`는 전역 스코프를 오염시키므로 사용하지 않습니다.
>
> > **`Alpine.reactive()`가 필요한 이유**: Alpine은 `Alpine.data()`의 반환값을 reactive Proxy로 감싸지만, 클로저 변수 `state`는 원본 객체(비-Proxy)를 참조합니다. 따라서 `state.visible = true` 같은 돌연변이가 Proxy setter를 우회하여 DOM 업데이트가 발생하지 않습니다. `Alpine.reactive({...})`로 생성하면 클로저 변수 자체가 reactive Proxy가 되어, 템플릿에서 접근하든 클로저 함수에서 접근하든 동일한 반응성을 보장합니다.

<!-- 3. Style: scoped (기본) 또는 global -->
<style scoped>
.my-component {
    display: flex;
    gap: 8px;
}
</style>
```

**순서 규칙: Template → Script → Style** (Vue SFC 규약).

## 4. 데이터 흐름

### 4.1 부모(Controller) → 컴포넌트

`Alpine.store()`를 데이터 브릿지로 사용합니다.

```js
// UIController (src/ui.js)
this._setXpReward({
    visible: true,
    characterName: "Dash",
    xpGained: 7
    // ...
});
```

```js
// 컴포넌트 내부
Alpine.data("xpRewardPanel", () => {
    const state = Alpine.reactive({
        visible: false,
        characterName: ""
    });

    return {
        state,
        init() {
            this.$watch("$store.xpReward", (val) => {
                if (!val) return;
                state.characterName = val.characterName ?? "";
                state.visible = val.visible ?? false;
            }, { immediate: true });
        }
    };
});
```

단순 표시/컨트롤 컴포넌트처럼 인스턴스별 로컬 상태가 필요 없는 경우에는 템플릿에서 `$store.<name>.*`를 직접 읽습니다. 이때도 루트 `x-data`와 `<script>`의 `Alpine.data("<name>", () => ({}))` 등록은 유지하여 태그 컴포넌트 경계를 명확히 둡니다. `$watch`로 `$store`를 로컬 state에 복사하는 방식은 컴포넌트가 자체 상태, 애니메이션 상태, 인스턴스별 파생 상태를 실제로 소유해야 할 때만 사용합니다.

클릭 같은 UI 이벤트 핸들러는 컴포넌트의 `Alpine.data()` 메서드에 둡니다. 컴포넌트는 `window.BallFightComponentBridge`를 통해 `appStore()` 또는 `BattleApp`의 공개 메서드를 호출하고, 게임 규칙/사냥터 진행/토너먼트 시작 같은 도메인 로직을 store 객체나 템플릿 표현식 안에 직접 넣지 않습니다.

### 4.2 컴포넌트 → 컴포넌트 (중첩)

부모 컴포넌트가 자식에게 props를 `x-bind`로 전달합니다.

```html
<!-- 부모 템플릿 -->
<div x-data="parentComponent">
    <child-component x-bind:some-prop="localValue"></child-component>
</div>
```

자식 컴포넌트는 호스트 요소의 속성을 `init()` 또는 MutationObserver로 읽습니다.

### 4.3 공유 데이터만 $store 사용

모든 컴포넌트 인스턴스가 동일한 값을 봐야 하는 경우(예: 현재 XP 보상 데이터)만 `$store`를 사용합니다. 인스턴스별 독립 데이터가 필요한 경우 호스트 요소 속성(props)을 통해 전달합니다.

## 5. 스타일 시스템

### 5.1 `<style scoped>` (기본)

`componentLoader`가 난수 `data-v-xxxxx` 속성을 생성하여 템플릿 루트 요소에 추가하고, 각 CSS 선택자 앞에 `[data-v-xxxxx]` 프리픽스를 붙여 `<head>`에 주입합니다. `<style scoped>` 내에 선언된 선택자만 스코핑되며, 템플릿 HTML의 클래스명은 변경되지 않습니다.

```html
<style scoped>
/* .heading → [data-v-abc123] .heading 로 자동 변환됨 */
.heading {
    font-size: 1.2rem;
}
</style>
```

- 루트 요소 자체를 스타일링하려면 `:scope`를 사용합니다. `:scope`는 `[data-v-xxxxx]`로 자동 변환되어 루트 요소를 직접 선택합니다.

```html
<style scoped>
:scope {
    width: min(420px, 78vw);
    margin: 18px auto 0;
}

.child-element {
    color: #333;
}
</style>
```

### 5.2 `<style global>`

그대로 `<head>`에 주입됩니다. 전역 키프레임, 폰트, CSS 변수 등에 사용합니다.

```html
<style global>
@keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
}
</style>
```

### 5.3 스타일 규칙

- `<style>`에 `scoped`/`global` 속성이 없으면 **scoped**가 기본값입니다.
- scoped CSS는 각 선택자 앞에 `[data-v-xxxxx]` 프리픽스를 붙이는 전통적인 방식으로, 모든 브라우저에서 동작합니다.
- 기존 `src/styles.css`는 글로벌 리셋, 디자인 토큰, 레이아웃 기본값만 유지합니다.
- 컴포넌트별 스타일은 각 `template.html`의 `<style scoped>`로 이동합니다.

## 6. componentLoader 처리 흐름

```js
await loadTemplates();
```

`loadTemplates()`는 `document.body.innerHTML` 정규식 스캔으로 `<xp-reward-panel>`, `<popup-dialog>` 같은 커스텀 태그를 찾아 해당 컴포넌트 HTML만 fetch합니다.

중첩 컴포넌트는 별도 pre-load가 필요 없습니다. 마운트 시스템(`mountTemplateComponentTags`)이 다중 패스로 동작하여, 부모 컴포넌트 마운트 후 DOM에 생긴 자식 태그를 다음 패스에서 자동 발견하고 마운트합니다.
3. `<style scoped>`: 난수 `data-v-xxxxx` 생성 → 템플릿 루트 요소에 속성 추가 → 각 선택자 앞에 `[data-v-xxxxx]` 프리픽스 → `<head>`에 `<style>` 주입
4. `<style global>`: 원본 그대로 `<head>`에 주입
5. `<script>`: 각 script 태그를 DOM에 생성하여 실행 (브라우저 보안 문제로 innerHTML이 script를 실행하지 않으므로 별도 태그 생성)
6. 나머지 HTML: `<template id="template-<name>">` 요소 생성 → `<head>`에 추가
7. 이후 `registerAlpineComponentSystem(Alpine)`이 태그 기반 컴포넌트를 마운트

## 7. 컴포넌트 작성 규칙

- **파일당 하나의 컴포넌트**: `src/components/<name>.html`
- **순서**: Template > Script > Style (Vue SFC 규약)
- **`x-data` 필수**: 템플릿 루트 요소는 반드시 자체 `x-data="ComponentName"`를 가짐
- **Alpine.data() 등록**: `<script>` 내부에서 `Alpine.data("ComponentName", () => ({}))` 형태라도 반드시 등록. 로컬 상태가 필요할 때만 `const state = Alpine.reactive({...}); return { state, init(){} };` 패턴을 사용하며, private은 클로저에 숨기고 공유 객체/네임드 함수 전역 등록은 금지
- **UI 핸들러 소유**: `@click="doThing()"`처럼 컴포넌트 메서드를 호출하고, 그 메서드에서 `BallFightComponentBridge`를 통해 app/game 공개 핸들러를 호출. `Alpine.store()`에는 `_actions` 같은 콜백 레지스트리를 두지 않음
- **Props**: 부모 → 자식 데이터는 `$store` 또는 호스트 속성으로 전달
- **로직 소유**: 애니메이션, 표시 전환 등은 컴포넌트가 자체 소유
- **스코프 격리**: 템플릿에서 `xpReward.xxx`처럼 부모 스코프를 직접 참조하지 않음

### 7.1 모달 닫기 소유권

전체 화면을 덮는 모달은 다른 컴포넌트의 바깥 클릭 상태를 검사하지 않고, 자기 backdrop과 포커스 안의 입력만 처리합니다.

- 모달 루트는 `role="dialog"`, `aria-modal="true"`, `tabindex="-1"`을 선언합니다.
- 닫을 수 있는 모달은 루트에 `@click.self="close()"`와 `@keydown.escape="close()"`를 둡니다. 카드 내부의 `@click.outside`는 사용하지 않습니다.
- `init()`에서 `this.$root`를 컴포넌트 전용 참조로 확보하고, 모달을 열 때 `requestAnimationFrame`으로 그 루트에 포커스를 둡니다. uiManager를 거친 메서드 호출에서는 Alpine magic이 아닌 이 참조를 사용해야 합니다. 그러면 sibling으로 렌더링된 하위 모달의 `Escape`가 상위 모달로 전달되지 않습니다.
- 닫을 수 없는 필수 선택 모달은 `@keydown.escape.stop`으로 Escape를 자신이 소비하고, 명시된 선택 동작으로만 닫습니다.
- 이 규칙으로 상위 모달은 하위 모달의 식별자·가시 상태·z-index를 알 필요가 없습니다.

## 8. 초기화 순서 (index.html)

```js
const { loadTemplates } = await import(`./src/componentLoader.js?v=${V}`);
const { registerAlpineComponentSystem } = await import(`./src/alpineTemplateComponents.js?v=${V}`);
const { appStore } = await import(`./src/ui.js?v=${V}`);

await loadTemplates();

// Alpine store 초기화 (컴포넌트가 구독할 데이터)
Alpine.store("xpReward", {
    visible: false,
    characterName: "",
    xpGained: 0,
    // ...
});

registerAlpineComponentSystem(Alpine);
Alpine.data("appStore", appStore);
window.Alpine = Alpine;

Alpine.start();
```

## 9. 구현 규칙

- 태그 컴포넌트 이름은 반드시 하이픈이 포함된 소문자 kebab-case
- 템플릿 복제는 `template.content.cloneNode(true)` 사용
- 호스트 엘리먼트 자체에는 `initTree`를 다시 호출하지 않음
- `x-component` directive는 동적 mount가 필요한 경우만 보조 문법으로 사용

## 10. 사용 금지/주의

- 도메인 로직(전투, 보상 계산, 프로필 저장)은 컴포넌트에 넣지 않음
- 수백 개 이상 반복되는 목록에는 템플릿 복제 비용 확인 필요
- 컴포넌트 이름을 사용자 입력에서 직접 만들지 않음
- `x-for` 내부에 무거운 컴포넌트를 배치할 때는 성능 테스트 필요
