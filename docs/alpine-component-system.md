# Alpine 템플릿 컴포넌트 시스템

> 상태: 기반 구현 완료
> 기준 코드: 2026-07-04 `main`
> 구현 파일: `src/alpineTemplateComponents.js`
> 참고 문서: Alpine 공식 `Extending`, `Alpine.data`, `x-data`, `x-init`

## 1. 목적

이 프로젝트는 Vanilla JS + Alpine.js + Canvas 2D 구조를 유지합니다. React/Vue 같은 별도 컴포넌트 런타임을 추가하지 않고, 반복되는 HTML 조각만 안전하게 재사용하기 위해 `x-component` 기반 템플릿 컴포넌트 시스템을 둡니다.

핵심 사용처:

- 동일한 카드/패널/미터 UI가 `index.html` 안에서 반복될 때
- Alpine 상태는 기존 `appStore()`가 계속 소유하고, 마크업만 재사용하고 싶을 때
- 문자열 HTML 조립이나 `x-html` 없이 정적인 HTML 템플릿을 복제하고 싶을 때

## 2. 기본 사용법

템플릿은 반드시 `<template id="template-{name}">` 형식으로 선언합니다.

```html
<template id="template-xp-meter">
    <div class="xp-meter">
        <strong x-text="experience.levelLabel"></strong>
        <span x-text="experience.progressText"></span>
    </div>
</template>

<div x-component="xp-meter" x-data="{ experience: playerExperience }"></div>
```

`x-component="xp-meter"`는 `template-xp-meter`를 찾아 복제합니다. 복제된 템플릿 내부의 Alpine 지시문은 호스트의 `x-data` 스코프를 사용할 수 있습니다.

### 2.1 실제 일반 예시

현재 결과 오버레이의 XP 보상 패널은 실제 `x-component` 사용 예시입니다.

```html
<template id="template-xp-reward-panel">
    <div class="xp-reward-head">
        <span x-text="xpReward.characterName"></span>
        <b x-text="'+' + xpReward.xpGained + ' XP'"></b>
    </div>
    <div class="xp-reward-level">
        <strong x-text="xpReward.levelLabel"></strong>
        <em x-show="xpReward.levelUp">LEVEL UP</em>
    </div>
</template>

<div
    class="xp-reward"
    x-show="xpReward.visible"
    x-bind:class="{ levelup: xpReward.levelUp }"
    x-component="xp-reward-panel"
></div>
```

호스트는 `x-show`, `x-bind:class`처럼 표시 상태를 계속 소유하고, 템플릿은 내부 마크업만 제공합니다.

### 2.2 실제 중첩 컴포넌트 예시

`template-xp-reward-panel` 내부에는 진행 바 전용 컴포넌트가 중첩되어 있습니다.

```html
<template id="template-xp-reward-panel">
    <div class="xp-reward-level">
        <strong x-text="xpReward.levelLabel"></strong>
        <em x-show="xpReward.levelUp">LEVEL UP</em>
    </div>
    <div x-component="xp-progress-bar"></div>
    <div class="xp-reward-foot">
        <span x-text="xpReward.progressText"></span>
        <span x-text="xpReward.nextText"></span>
    </div>
</template>

<template id="template-xp-progress-bar">
    <div class="xp-bar" aria-hidden="true">
        <div class="xp-bar-fill" x-bind:style="'width:' + xpReward.animatedProgressPct + '%'"></div>
    </div>
</template>
```

중첩 컴포넌트도 같은 상위 Alpine 스코프를 사용합니다. 따라서 `xpReward.animatedProgressPct`를 별도 props 전달 없이 읽을 수 있습니다.

### 2.3 예외 예시

잘못된 이름은 mount하지 않고 경고만 남깁니다.

```html
<!-- 금지: kebab-case 이름이 아니고 경로처럼 보이는 값 -->
<div x-component="../xp-progress-bar"></div>
```

없는 템플릿도 mount하지 않습니다.

```html
<!-- template-missing-panel 이 없으면 경고 후 그대로 둠 -->
<div x-component="missing-panel"></div>
```

너무 많은 반복 렌더링에는 쓰지 않습니다.

```html
<!-- 주의: 수백 개 이상 반복되는 목록에서는 템플릿 복제 비용을 먼저 확인 -->
<template x-for="item in hugeList">
    <div x-component="heavy-card"></div>
</template>
```

컴포넌트 이름을 사용자 입력에서 직접 만들지 않습니다.

```html
<!-- 금지: 외부 입력이 템플릿 ID 선택에 직접 개입 -->
<div x-component="userSelectedTemplate"></div>
```

## 3. 등록 위치

Alpine 공식 확장 문서 기준으로 커스텀 directive는 Alpine import 후, `Alpine.start()` 전 등록해야 합니다.

현재 `index.html` 초기화 순서:

```js
import Alpine from "https://cdn.jsdelivr.net/npm/alpinejs@3.14.9/dist/module.esm.js";

const { registerAlpineComponentSystem } = await import(`./src/alpineTemplateComponents.js?v=${V}`);
const { appStore } = await import(`./src/ui.js?v=${V}`);

registerAlpineComponentSystem(Alpine);
Alpine.data("appStore", appStore);
window.Alpine = Alpine;
Alpine.start();
```

## 4. 구현 규칙

- directive 이름은 `x-component`입니다.
- 컴포넌트 이름은 소문자 kebab-case만 허용합니다.
- 실제 템플릿 ID는 `template-` 접두사를 붙입니다.
- 템플릿 복제는 `template.content.cloneNode(true)`를 사용합니다.
- 삽입 후 Alpine 초기화는 복제된 자식 루트에만 `Alpine.initTree(child)`를 호출합니다.
- 호스트 엘리먼트 자체에는 `initTree`를 다시 호출하지 않습니다. 호스트의 `x-data` 중복 초기화를 피하기 위해서입니다.
- 템플릿 이름은 사용자 입력이나 서버 응답에서 직접 만들지 않습니다.

## 5. 사용 금지/주의

이 시스템은 “HTML 조각 재사용”용입니다. 아래에는 쓰지 않습니다.

- 전투 로직, 보상 계산, 프로필 저장 같은 도메인 로직
- 동적으로 외부 HTML을 받아 렌더링하는 용도
- `x-for` 안에서 수백 개 이상 찍히는 고빈도 리스트
- 상태와 메서드를 독립 컴포넌트처럼 캡슐화해야 하는 경우

상태와 메서드 재사용이 목적이면 Alpine 공식 `Alpine.data()`를 먼저 사용합니다. `x-component`는 마크업 복제 문제를 해결할 때만 사용합니다.

## 6. 적용 후보

바로 전체 UI를 바꾸지 않습니다. 다음처럼 중복이 커진 곳부터 단계적으로 적용합니다.

- XP 미터
- 컬렉션 허브 카드
- 보관함 상자 카드
- 사냥터 귀환/전진 선택 패널

첫 실제 적용은 사냥터 UI를 붙일 때 보관함/런 결과 카드 중 하나로 제한합니다.
