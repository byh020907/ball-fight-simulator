# Ball Fight Simulator

Ball Fight Simulator는 여러 공 캐릭터가 자동으로 싸우는 브라우저 게임입니다. 각 공은 고유한 능력, 움직임, 사운드, 시각 효과를 가지며, 시작 버튼 한 번으로 토너먼트 전투가 진행됩니다.

이 프로젝트의 기본 문서와 개발 대화 언어는 한국어입니다.

## 플레이

GitHub Pages가 활성화되면 아래 주소에서 실행합니다.

```text
https://byh020907.github.io/ball-fight-simulator/
```

로컬 개발에서는 `index.html`을 더블클릭하지 말고 로컬 서버로 실행합니다. 현재 구조는 번들 없이 `src/`의 네이티브 ES module을 직접 로드하므로, `file://`에서는 브라우저 CORS 정책 때문에 모듈 import가 막힐 수 있습니다.

```bash
npm start
```

실행 후 아래 주소를 엽니다.

```text
http://127.0.0.1:4173/
```

## 개발

주요 소스는 책임별로 나뉘어 있습니다.

- `index.html`: 화면 구조, CSS, 캔버스
- `src/main.js`: 앱 진입점
- `src/app.js`: `BattleApp`
- `src/abilities/`: 캐릭터별 능력
- `src/entities.js`: 공, 투사체, 수류탄 등 엔티티
- `src/simulation.js`: 전투 루프, 충돌, 이펙트, 사운드 훅
- `src/ui.js`: 캔버스 렌더링과 UI
- `src/tournament.js`: 자동 토너먼트 진행
- `src/roster.js`: 캐릭터 스탯과 정보
- `docs/game-rules.md`: 게임 흐름, 스탯 배분, 등수 규칙
- `docs/design.md`: 시각 방향과 캐릭터 표현 규칙
- `docs/development-rules.md`: 개발, 문서, Git 운영 규칙

회귀 테스트를 실행합니다.

```bash
npm test
```

## 스크립트

```bash
npm start
npm test
npm run check
```

## 라이선스

MIT
