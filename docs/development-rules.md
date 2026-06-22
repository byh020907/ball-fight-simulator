# 개발 규칙

이 문서는 Ball Fight Simulator를 Git으로 관리하면서 계속 업데이트할 기준 문서입니다. 새 규칙이 생기면 이 파일을 먼저 갱신하고, 필요한 경우 `README.md`나 관련 설계 문서에 요약을 반영합니다.

## 기본 원칙

- 프로젝트 문서, 이슈 정리, 작업 메모의 기본 언어는 한국어입니다.
- 코드 식별자는 기존 JavaScript 스타일을 따르고, 사용자에게 보이는 문구는 한국어를 우선합니다.
- 변경은 작고 되돌리기 쉽게 유지합니다.
- 기존 동작을 바꾸는 수정은 가능하면 회귀 테스트를 먼저 추가하거나 기존 테스트를 갱신합니다.
- 새 의존성은 명시적으로 필요할 때만 추가합니다.
- 번들 파일을 생성해서 커밋하지 않습니다. 현재 배포 구조는 `index.html`이 `./src/main.js`를 직접 로드합니다.
- **main에 푸시 또는 머지하기 전에 반드시 `src/patch-notes.js`의 `PATCH_NOTES`에 패치노트를 먼저 작성합니다.** 패치노트 작성 규칙은 `docs/patch-notes-guide.md`를 참고하세요.
- **패치노트 작성 시 관련 문서도 함께 업데이트합니다.** `docs/game-rules.md`, `src/help-content.js` 등이 최신 구현과 일치하는지 확인하고, 빠진 내용이 있으면 먼저 보강한 후 패치노트를 작성합니다.
- **`float`는 사용하지 않습니다.** 레이아웃은 `flex` 또는 `grid`로만 처리합니다.

## 전투 모드 확장 고려

현재 전투는 **1대1**로 진행되지만, 추후 **개인전(FFA)** 또는 **팀전**으로 확장될 수 있습니다.

- **코드는 현재 1대1 구조에 의존하지 않도록 작성합니다.**
    - 각 Ball(엔티티)은 자신의 상태와 로직을 기준으로 동작해야 하며, 항상 `fighters[0]`/`fighters[1]` 같은 고정 인덱스를 참조하지 않습니다.
    - 상대방이 필요한 경우 `simulation.getOpponent(this)`처럼 Ball 자신을 기준으로 조회합니다.
    - Ability 코드에서 특정 상대를 대상으로 하드코딩하지 않고, `update(delta, target)`으로 전달된 target 또는 simulation을 통해 상대를 찾습니다.
- **컬렉션 순회는 `filter`, `map`, `forEach`, `for...of`를 사용**하고 인덱스 기반 루프를 피합니다.
- 새 능력/시스템을 추가할 때도 1대1 전제 없이 다수의 Ball이 공존할 수 있는 구조로 설계합니다.

## 코드 스타일

### 들여쓰기

- **탭 대신 공백 4칸**을 사용합니다.
- `editor.insertSpaces: true`, `editor.tabSize: 4`로 설정합니다.
- VS Code 상태 표시줄에서 `Tab Size: 4`로 표시되는지 확인합니다.

### 기능 단위 코드 분리 (함수/모듈화)

**항상 기능 단위로 코드를 쪼개서 함수 및 모듈화합니다.**

- 하나의 함수가 여러 책임을 가지지 않도록 합니다.
- `draw(ctx)` 같은 메서드가 모든 그리기 로직을 한 번에 처리하지 않고, 각 하위 기능을 private 메서드(`_drawBat`, `_drawSlashEffect` 등)로 분리합니다.
- `update(delta, target)`도 능력 발동 조건 체크, 쿨타임 관리, 애니메이션 타이머 갱신을 별도 책임으로 분리합니다.
- 분리 기준은 **"하나의 함수는 하나의 일만 한다"** 입니다.

**적용 예 — BatBallAbility.js의 `draw()` 구조:**

```js
draw(ctx) {
    // ── 스윙 아크 ──
    this._drawSlashEffect(ctx);

    // ── 시야 범위 ──
    this._drawVisionArc(ctx);

    // ── 방망이 ──
    this._drawBat(ctx, time);
}

/** 방망이를 항상 들고 있는 모습 */
_drawBat(ctx, time) { ... }

/** 스윙 아크 애니메이션 */
_drawSlashEffect(ctx) { ... }

/** 120도 시야 범위 표시 */
_drawVisionArc(ctx) { ... }
```

- 메서드 분리뿐 아니라 Ability 클래스 자체도 하나의 파일(BatBallAbility.js)로 모듈화되어 있습니다.
- 새 기능을 추가할 때도 같은 원칙을 적용합니다. 예를 들어 `update()` 내에서 시야 스윕, 적 탐지, 쿨타임 관리를 각각의 책임으로 분리하여 가독성과 유지보수성을 높입니다.

### 로직 소유권 원칙

**각 로직은 그 로직을 실행하는 액션 클래스가 직접 소유합니다.**
도메인 객체(Simulation, Entity)는 로직 수행에 필요한 **데이터 접근 인터페이스**만 제공합니다.

```
잘못된 예 #1: ClickAction이 sim.timeSlowRemaining을 직접 수정 (캡슐화 위반)
잘못된 예 #2: ClickAction이 sim.applyTimeWarp()를 호출 (로직을 domain에 위임)
올바른 예:    ClickAction이 sim.getTimeSlow() / sim.setTimeSlow()로 데이터를 읽고,
              Action 내에서 알고리즘(Math.max 등)을 직접 수행
```

#### 적용 예 — 클릭 액션 시스템

```js
// ✅ Action이 로직의 주체
class TimeWarpAction extends ClickAction {
    apply(sim, playerBall) {
        // sim.getTimeSlowRemaining() — domain이 제공하는 인터페이스
        // Action이 Math.max 로직을 직접 수행
        const current = sim.getTimeSlowRemaining();
        sim.setTimeSlowRemaining(Math.max(current, 0.25));
    }
}

class RushAction extends ClickAction {
    apply(sim, playerBall) {
        const current = playerBall.getRushRemaining();
        // Action이 지속시간 연장 로직을 직접 수행
        playerBall.setRush(current > 0 ? current + 0.2 : 0.2, 1.25);
    }
}

// Domain 객체는 Action이 필요로 하는 데이터 접근 함수를 제공
class BattleSimulation {
    getTimeSlowRemaining() {
        return this._timeSlowRemaining;
    }
    setTimeSlowRemaining(v) {
        this._timeSlowRemaining = v;
    }
}

class BattleBall {
    getRushRemaining() {
        return this._rushRemaining;
    }
    setRush(duration, multiplier) {
        this._rushEffect = { duration, multiplier };
    }
}
```

| 액션      | Action이 소유한 로직                                   | Domain이 제공하는 인터페이스                                   |
| --------- | ------------------------------------------------------ | -------------------------------------------------------------- |
| 시간 왜곡 | `max(현재값, duration)` 후 저장                        | `sim.get/ setTimeSlowRemaining()`                              |
| 돌진      | 지속시간 연장 또는 신규 설정 + 속도 배율 적용          | `ball.getRushRemaining()`, `ball.setRush(dur, mult)`           |
| 카운터    | 충돌 임박 판정 + 플래그 설정 (`counterCharged = true`) | `sim.isCollisionImminent(ball)`, `sim.setCounterCharged(b)`    |
| 받아치기  | 접근 중인 투사체 탐색 + 경감 플래그 설정               | `sim.getIncomingProjectile(ball)`, `proj.setParryReduction(v)` |
| 버티기    | 경감 지속시간 설정                                     | `ball.setEndureRemaining(dur, reduction)`                      |

#### 행동 규칙

1. **Action 클래스가 비즈니스 로직(알고리즘, 조건 판정, 값 계산)을 직접 소유**합니다.
2. Domain 객체는 `getXxx()` / `setXxx()` 형태의 **의도가 드러나는 데이터 접근 인터페이스**를 제공합니다.
3. Action은 domain의 내부 변수를 직접 읽거나 쓰지 않고, 반드시 domain이 제공하는 함수를 통해서만 접근합니다.
4. 판단 기준: **"이 로직의 실행 결과를 누가 결정하는가?"** → Action이 결정한다면 Action이 로직을 소유합니다.
   | 카운터 | `BattleSimulation` | `applyCounter()` | handleCollision에서 데미지 보너스 |
   | 받아치기 | 투사체 엔티티 | `_parryReduction` 플래그 | takeDamage 전 50% 경감 |
   | 버티기 | `BattleBall` | `applyEndure(duration)` | takeDamage에서 데미지 경감 |

#### 행동 규칙

1. **새 기능을 추가할 때 "이 로직은 어느 객체가 소유해야 하는가"를 먼저 결정**합니다.
2. Action/Command 객체는 `apply()`에서 **수신자(receiver)의 메서드를 호출만** 하고, 직접 상태를 변경하지 않습니다.
3. 수신자 객체(Entity, Simulation 등)가 내부 상태 전이와 검증을 모두 담당합니다.
4. 여러 Action에서 공유하는 로직은 공유 수신자(예: `BattleSimulation`)에 한 번만 구현합니다.

### 인코딩과 줄바꿈

이 프로젝트는 **VS Code (Windows)** 환경에서 개발하며, 아래 기준을 따릅니다.

| 항목        | 기준                                    | 이유                                     |
| ----------- | --------------------------------------- | ---------------------------------------- |
| 파일 인코딩 | **UTF-8 (BOM 없음)**                    | 웹 표준, 브라우저와 호환                 |
| 줄바꿈 문자 | **LF (`\n`)**                           | Git 저장소 기준, `.gitattributes`로 통일 |
| 파일 끝     | **빈 줄로 끝남** (`insertFinalNewline`) | POSIX 표준, diff 마지막 줄 노이즈 방지   |
| 후행 공백   | **제거** (`trimTrailingWhitespace`)     | diff 노이즈 방지                         |

> **Windows에서 LF 규칙이 적용되는 방식**: `.gitattributes`에 `* text=auto eol=lf`가 설정되어 있어, 커밋 시점에 모든 텍스트 파일이 LF로 저장됩니다. 로컬에서 CRLF로 작업해도 Git이 LF로 변환합니다.

### 적용 설정 파일

위 규칙은 아래 두 파일로 프로젝트 전역에 적용됩니다.

- **`.gitattributes`**: Git이 줄바꿈을 자동 관리 (LF 통일)
- **`.vscode/settings.json`**: VS Code 편집기 설정 (인코딩, 들여쓰기, 후행 공백 등)

### Prettier 자동 포맷

들여쓰기는 **Prettier**로 자동 관리합니다. 수동으로 맞추지 말고 아래 명령어를 실행하세요.

```bash
# 코드 포맷 적용
npm run format

# 포맷 상태만 확인 (파일 변경 없음)
npm run format:check
```

포맷 규칙은 `.prettierrc`에 정의되어 있습니다. 주요 값:

```json
{
    "tabWidth": 4,
    "useTabs": false,
    "printWidth": 120,
    "semi": true,
    "singleQuote": false,
    "trailingComma": "none"
}
```

### 파일 길이 관리

한 파일이 **1000줄**을 넘어가면 분리를 고려합니다. 단, 파일 성격에 따라 기준을 다르게 적용합니다.

| 파일 성격          | 분리 기준                                           | 분리 방향                                      | 예시                                                  |
| ------------------ | --------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| **데이터/설정**    | 1000줄 넘어도 분리 불필요                           | 값 추가만으로 유지보수에 지장 없으면 그대로 둠 | `roster.js`, `stat-allocation.js`                     |
| **게임 로직/상태** | 700~1000줄에서 분리 검토                            | 책임별로 클래스/모듈 분리                      | `simulation.js`, `entities.js`                        |
| **UI/렌더링**      | 700~1000줄에서 분리 검토                            | 컴포넌트나 역할 단위로 분리                    | `ui.js` (Alpine store / UIController / ArenaRenderer) |
| **능력(Ability)**  | 각 Ability 파일은 개별 클래스이므로 1000줄까지 허용 | 능력 하나가 1000줄 넘으면 내부 책임 분리       | `OrbitAbility.js`, `RageAbility.js`                   |
| **유틸리티**       | 500줄 이상이면 분리 검토                            | 함수 성격별 파일 분리                          | `core.js`, `effects.js`                               |

분리할 때는 아래 원칙을 따릅니다.

- **행동 변경 없이**: 분리만 하고 로직이나 인터페이스를 바꾸지 않습니다.
- **파일 간 import는 명시적으로**: `index.js` 배럴 파일을 사용해 외부 import 경로가 바뀌지 않게 합니다.
- **분리 후 `npm test` 통과 확인**: 회귀 테스트로 동작이 유지됨을 검증합니다.

## UI 아키텍처

UI는 **Alpine.js**를 통해 컴포넌트 기반으로 관리됩니다.

### 핵심 원칙

- **문자열 결합 금지**: `innerHTML`로 HTML을 조립하지 않습니다.
- **Alpine.js 템플릿**: `index.html`에 `x-text`, `x-for`, `x-bind`, `@click` 등의 Alpine.js 디렉티브를 사용합니다.
- **반응형 상태**: `src/ui.js`의 `appStore()` 함수가 Alpine 컴포넌트의 상태를 정의합니다.
- **CSS 분리**: 모든 스타일은 `src/styles.css`에 있으며, `index.html`은 `<link>`로 참조합니다.

### 데이터 흐름

```
app.js → UIController 메서드 호출
         → Alpine 컴포넌트 데이터 업데이트
         → Alpine.js가 자동으로 DOM 렌더링
```

- `BattleApp`은 `UIController`의 메서드(`renderPlayerSetup`, `updateStatus`, `showOverlay` 등)를 호출합니다.
- `UIController`는 Alpine 컴포넌트의 `$data`를 찾아 상태 속성을 갱신합니다.
- Alpine.js가 변경을 감지하여 HTML 템플릿을 다시 렌더링합니다.
- Canvas 렌더링(`ArenaRenderer`)은 이 흐름과 별도로 동작합니다.

### 컴포넌트 구조 (index.html)

| Alpine 바인딩                                 | 역할                     | 상태 출처                                                |
| --------------------------------------------- | ------------------------ | -------------------------------------------------------- |
| `x-data="appStore"`                           | 메인 컴포넌트 (`<main>`) | `appStore()`                                             |
| `x-text="statusBadge"`                        | 상태 뱃지 텍스트         | `UIController.updateStatus()`                            |
| `x-text="statusText"`                         | 매치업 레이블            | `UIController.updateStatus()`                            |
| `x-bind:class="{ visible: overlayVisible }"`  | 오버레이 표시            | `UIController.showOverlay()` / `hideOverlay()`           |
| `@click="$dispatch('start-tournament')"`      | 시작 버튼 클릭           | `document` 이벤트 리스너 → `BattleApp.startTournament()` |
| `x-for="fighter in fighters"`                 | 파이터 카드 목록         | `UIController.renderRoster()` / `updateLiveCards()`      |
| `x-for="stat in statDefs"`                    | 스탯 배분 버튼 그리드    | `appStore().adjustStat()`                                |
| `x-for="(round, rIndex) in tournamentRounds"` | 토너먼트 대진표          | `UIController.renderTournament()`                        |
| `x-text="item"` in `x-for`                    | 배틀 로그                | `UIController.addLog()`                                  |

### 새 UI 컴포넌트 추가 규칙

1. **`index.html`**에 Alpine.js 템플릿을 작성합니다 (`x-data`, `x-for`, `x-text` 등).
2. **`ui.js`**의 `appStore()`에 필요한 상태와 액션을 추가합니다.
3. **`UIController`**에 상태를 갱신하는 메서드를 추가합니다.
4. **`src/styles.css`**에 스타일을 추가합니다.

`innerHTML`을 직접 조작하거나 jQuery 등을 도입하지 않습니다.

````

## 로컬 실행과 검증

로컬 실행은 Node 정적 서버를 사용합니다.

```bash
npm start
````

브라우저 주소:

```text
http://127.0.0.1:4173/
```

변경 후 기본 검증:

```bash
npm run format:check
npm test
npm run check
```

`index.html`을 `file://`로 직접 열면 ES module CORS 문제로 정상 동작하지 않을 수 있습니다.
또한 Alpine.js는 CDN에서 로드되므로 인터넷 연결이 필요합니다.

## Git 운영

- 작업 전 `git status --short`로 현재 변경 상태를 확인합니다.
- 서로 다른 목적의 수정은 가능한 한 별도 커밋으로 나눕니다.
- 커밋 메시지는 "무엇을 바꿨는지"보다 "왜 바꿨는지"를 첫 줄에 씁니다.
- 커밋 본문에는 필요한 경우 제약, 거절한 대안, 검증 결과를 trailer 형식으로 남깁니다.
- 사용자가 만든 변경은 되돌리지 않습니다. 충돌이 있으면 그 변경을 존중하면서 이어갑니다.

커밋 메시지 예시:

```text
로컬 서버 기준을 명확히 해 실행 혼선을 줄임

브라우저가 file:// ES module import를 막기 때문에 로컬 실행 기준을
npm start와 127.0.0.1:4173으로 고정했다.

Constraint: GitHub Pages는 main/root 배포를 사용
Rejected: FastAPI 서버 유지 | 정적 파일 서빙만 하기에는 과함
Confidence: high
Scope-risk: narrow
Tested: npm test, npm run check
```

## 문서 관리

- `README.md`는 처음 보는 사람이 실행, 구조, 검증 방법을 바로 알 수 있게 유지합니다.
- `docs/game-rules.md`는 게임 흐름, 스탯, 토너먼트 규칙을 기록합니다.
- `docs/design.md`는 시각 스타일과 캐릭터 표현 규칙을 기록합니다.
- `docs/click-actions.md`는 클릭 액션 시스템의 전체 설계를 기록합니다. (구현 전 설계 단계)
- `docs/implementation-plan.md`는 기능 단위 구현 계획과 단계별 작업 내용을 기록합니다.
- `docs/development-rules.md`는 개발, 검증, Git 운영 규칙의 기준 문서입니다.
- 구현과 문서가 어긋나면 구현을 확인한 뒤 문서를 즉시 갱신합니다.

## 배포 메모

- GitHub Pages는 `main` 브랜치의 root 배포를 기준으로 합니다.
- `.nojekyll`은 유지합니다.
- 배포 URL은 `https://byh020907.github.io/ball-fight-simulator/`입니다.

## 개발 환경 시행착오와 방지 규칙

### Windows PowerShell 차이

이 프로젝트는 Windows PowerShell을 기본 셸로 사용합니다. Linux/macOS와 명령어 차이가 있습니다.

- `&&` 연산자는 PowerShell에서 지원하지 않습니다. 명령어 연결은 `;`(세미콜론)을 사용합니다.
    ```powershell
    # bad
    cd path && git status
    # good
    cd path; git status
    ```
- `>` 리디렉션 출력이 예상과 다른 인코딩(UTF-16LE)으로 저장될 수 있으므로, 파일 복원 후 내용을 확인합니다.
- `Get-Content` / `Set-Content`는 `-Encoding UTF8`을 명시해야 한글이 깨지지 않습니다.
- `Select-String -SimpleMatch`로 단순 문자열 존재 여부를 확인할 수 있습니다.

### `tests/regression.mjs` 보호

`tests/regression.mjs`는 `src/simulation.js`와 import 경로가 유사해 실수로 덮어쓰기 쉽습니다. 특히 `single_find_and_replace`가 파일 경로를 잘못 지정하면 파일 전체가 다른 내용으로 대체될 수 있습니다.

- `tests/regression.mjs` 수정 시 대상 경로를 다시 확인합니다.
- 덮어써졌다면 `git checkout -- tests/regression.mjs`로 즉시 복원합니다.
- 복원 후 id 참조(`"clone"` → `"trickster"`, `"berserker"` → `"rage"`, `"frosty"` → `"dash"`)와 변수명을 다시 적용합니다.

### `single_find_and_replace` 도구 사용 시

이 도구는 **들여쓰기와 공백까지 정확히 일치해야** 동작합니다. 실패하면 `read_file`로 실제 파일 내용을 다시 읽고 정확한 문자열을 확인합니다.

### 파일명과 클래스명 변경 절차

1. **새 파일 먼저 생성** — 기존 파일을 지우기 전에 새 파일을 만듭니다.
2. **`src/abilities/index.js` 갱신** — 바로 새 파일을 export합니다.
3. **참조하는 모든 파일 업데이트** — 아래를 빠짐없이 확인합니다.
    - `src/simulation.js` — import 구문, `createAbility` 테이블
    - `src/entities.js` — `this.id` 할당
    - `src/roster.js` — `id`, `face`, `ability` 필드
    - 그 외 해당 클래스를 import/참조하는 모든 파일
4. **함수/클래스 선언을 실수로 지우지 않도록 `git diff`로 확인**
    - `roster.js`는 전체 배열을 `export function createRoster()`로 감싸고 있습니다. `return [` 앞의 함수 선언과 끝의 `}`를 유지해야 합니다.
5. **기존 파일 삭제** — 새 파일이 정상 참조됨을 확인한 후 삭제합니다.
6. **`tests/regression.mjs`도 함께 업데이트** — id 참조와 변수명을 변경합니다.
7. **`npm test`로 전체 회귀 테스트 통과 확인**
