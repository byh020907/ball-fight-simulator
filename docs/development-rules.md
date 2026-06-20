# 개발 규칙

이 문서는 Ball Fight Simulator를 Git으로 관리하면서 계속 업데이트할 기준 문서입니다. 새 규칙이 생기면 이 파일을 먼저 갱신하고, 필요한 경우 `README.md`나 관련 설계 문서에 요약을 반영합니다.

## 기본 원칙

- 프로젝트 문서, 이슈 정리, 작업 메모의 기본 언어는 한국어입니다.
- 코드 식별자는 기존 JavaScript 스타일을 따르고, 사용자에게 보이는 문구는 한국어를 우선합니다.
- 변경은 작고 되돌리기 쉽게 유지합니다.
- 기존 동작을 바꾸는 수정은 가능하면 회귀 테스트를 먼저 추가하거나 기존 테스트를 갱신합니다.
- 새 의존성은 명시적으로 필요할 때만 추가합니다.
- 번들 파일을 생성해서 커밋하지 않습니다. 현재 배포 구조는 `index.html`이 `./src/main.js`를 직접 로드합니다.

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
