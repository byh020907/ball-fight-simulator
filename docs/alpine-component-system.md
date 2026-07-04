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

<!-- 2. Script: 컴포넌트 로직 -->
<script>
    Alpine.data("myComponent", () => ({
        label: "",
        visible: false,

        init() {
            // $store 구독 → 로컬 상태로 복사
            this.$watch("$store.myData", (val) => {
                if (!val) return;
                this.label = val.label ?? "";
                this.visible = val.visible ?? false;
            }, { immediate: true });
        },

        doSomething() {
            // ...
        }
    }));
</script>

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
Alpine.data("xpRewardPanel", () => ({
    visible: false,
    characterName: "",

    init() {
        this.$watch("$store.xpReward", (val) => {
            if (!val) return;
            this.characterName = val.characterName ?? "";
            this.visible = val.visible ?? false;
        }, { immediate: true });
    }
}));
```

컴포넌트는 `$store`를 직접 템플릿에서 읽지 않고, `init()`에서 로컬 상태로 복사합니다. 템플릿은 로컬 `x-data` 프로퍼티만 참조하여 각 인스턴스가 독립 스코프를 유지합니다.

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

`componentLoader`가 난수 `data-v-xxxxx` 속성을 생성하여 템플릿 루트 요소에 추가하고, CSS를 `@scope ([data-v-xxxxx]) { ... }`로 감싸 `<head>`에 주입합니다.

```html
<style scoped>
/* 이 셀렉터들은 자동으로 @scope ([data-v-abc123]) { ... } 내부에 배치됨 */
.heading {
    font-size: 1.2rem;
}
</style>
```

- scope root(루트 요소) 자체를 스타일링하려면 `:scope` 선택자를 사용합니다.
- **루트 요소의 base layout**(width, margin, grid 등)이 필요한 경우, `@scope`는 루트 요소 자체를 descendant selector로 선택할 수 없으므로 `:scope`를 사용하거나 global CSS(`src/styles.css`)에 배치합니다.

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
- scoped CSS는 `@scope` 브라우저 기능(Chrome 118+, Safari 17.4+, Firefox 146+)을 사용합니다.
- 기존 `src/styles.css`는 글로벌 리셋, 디자인 토큰, 레이아웃 기본값만 유지합니다.
- 컴포넌트별 스타일은 각 `template.html`의 `<style scoped>`로 이동합니다.

## 6. componentLoader 처리 흐름

```js
await loadTemplates();
```

`loadTemplates()`는 `document.body.innerHTML` 정규식 스캔으로 `<xp-reward-panel>`, `<popup-dialog>` 같은 커스텀 태그를 찾아 해당 컴포넌트 HTML만 fetch합니다.

중첩 컴포넌트는 별도 pre-load가 필요 없습니다. 마운트 시스템(`mountTemplateComponentTags`)이 다중 패스로 동작하여, 부모 컴포넌트 마운트 후 DOM에 생긴 자식 태그를 다음 패스에서 자동 발견하고 마운트합니다.
3. `<style scoped>`: 난수 `data-v-xxxxx` 생성 → 템플릿 루트 요소에 속성 추가 → `@scope ([data-v-xxxxx]) { ... }` 래핑 → `<head>`에 `<style>` 주입
4. `<style global>`: 원본 그대로 `<head>`에 주입
5. `<script>`: 각 script 태그를 DOM에 생성하여 실행 (브라우저 보안 문제로 innerHTML이 script를 실행하지 않으므로 별도 태그 생성)
6. 나머지 HTML: `<template id="template-<name>">` 요소 생성 → `<head>`에 추가
7. 이후 `registerAlpineComponentSystem(Alpine)`이 태그 기반 컴포넌트를 마운트

## 7. 컴포넌트 작성 규칙

- **파일당 하나의 컴포넌트**: `src/components/<name>.html`
- **순서**: Template > Script > Style (Vue SFC 규약)
- **`x-data` 필수**: 템플릿 루트 요소는 반드시 자체 `x-data="ComponentName"`를 가짐
- **Alpine.data() 등록**: `<script>` 내부에서 `Alpine.data("ComponentName", ...)` 등록
- **Props**: 부모 → 자식 데이터는 `$store` 또는 호스트 속성으로 전달
- **로직 소유**: 애니메이션, 표시 전환 등은 컴포넌트가 자체 소유
- **스코프 격리**: 템플릿에서 `xpReward.xxx`처럼 부모 스코프를 직접 참조하지 않음

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
