# 개발 규칙

이 문서는 Ball Fight Simulator를 Git으로 관리하면서 계속 업데이트할 기준 문서입니다. 새 규칙이 생기면 이 파일을 먼저 갱신하고, 필요한 경우 `README.md`나 관련 설계 문서에 요약을 반영합니다.

## 기본 원칙

- 프로젝트 문서, 이슈 정리, 작업 메모의 기본 언어는 한국어입니다.
- 코드 식별자는 기존 JavaScript 스타일을 따르고, 사용자에게 보이는 문구는 한국어를 우선합니다.
- 변경은 작고 되돌리기 쉽게 유지합니다.
- 기존 동작을 바꾸는 수정은 가능하면 회귀 테스트를 먼저 추가하거나 기존 테스트를 갱신합니다.
- 새 의존성은 명시적으로 필요할 때만 추가합니다.
- 번들 파일을 생성해서 커밋하지 않습니다. 현재 배포 구조는 `index.html`이 `./src/main.js`를 직접 로드합니다.

## 코드 스타일

### 들여쓰기

- **탭 대신 공백 4칸**을 사용합니다.
- `editor.insertSpaces: true`, `editor.tabSize: 4`로 설정합니다.
- VS Code 상태 표시줄에서 `Tab Size: 4`로 표시되는지 확인합니다.

### 인코딩과 줄바꿈

이 프로젝트는 **VS Code (Windows)** 환경에서 개발하며, 아래 기준을 따릅니다.

| 항목 | 기준 | 이유 |
|------|------|------|
| 파일 인코딩 | **UTF-8 (BOM 없음)** | 웹 표준, 브라우저와 호환 |
| 줄바꿈 문자 | **LF (`\n`)** | Git 저장소 기준, `.gitattributes`로 통일 |
| 파일 끝 | **빈 줄로 끝남** (`insertFinalNewline`) | POSIX 표준, diff 마지막 줄 노이즈 방지 |
| 후행 공백 | **제거** (`trimTrailingWhitespace`) | diff 노이즈 방지 |

> **Windows에서 LF 규칙이 적용되는 방식**: `.gitattributes`에 `* text=auto eol=lf`가 설정되어 있어, 커밋 시점에 모든 텍스트 파일이 LF로 저장됩니다. 로컬에서 CRLF로 작업해도 Git이 LF로 변환합니다.

### 적용 설정 파일

위 규칙은 아래 두 파일로 프로젝트 전역에 적용됩니다.

- **`.gitattributes`**: Git이 줄바꿈을 자동 관리 (LF 통일)
- **`.vscode/settings.json`**: VS Code 편집기 설정 (인코딩, 들여쓰기, 후행 공백 등)

## 로컬 실행과 검증

로컬 실행은 Node 정적 서버를 사용합니다.

```bash
npm start
```

브라우저 주소:

```text
http://127.0.0.1:4173/
```

변경 후 기본 검증:

```bash
npm test
npm run check
```

`index.html`을 `file://`로 직접 열면 ES module CORS 문제로 정상 동작하지 않을 수 있습니다.

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
   - `src/entities.js` — `this.id` 할당, `switch(ball.id)` case
   - `src/roster.js` — `id`, `face`, `ability` 필드
   - 그 외 해당 클래스를 import/참조하는 모든 파일
4. **함수/클래스 선언을 실수로 지우지 않도록 `git diff`로 확인**
   - `roster.js`는 전체 배열을 `export function createRoster()`로 감싸고 있습니다. `return [` 앞의 함수 선언과 끝의 `}`를 유지해야 합니다.
5. **기존 파일 삭제** — 새 파일이 정상 참조됨을 확인한 후 삭제합니다.
6. **`tests/regression.mjs`도 함께 업데이트** — id 참조와 변수명을 변경합니다.
7. **`npm test`로 전체 회귀 테스트 통과 확인**
