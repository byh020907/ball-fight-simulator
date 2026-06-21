# 패치 노트 관리 가이드

> **실제 데이터 파일**: `src/patch-notes.js` — 여기에 나온 규칙을 따라 `PATCH_NOTES` 객체를 수정하세요.

## 파일 위치

- **데이터**: `src/patch-notes.js` — 실제 패치노트 내용을 수정하려면 이 파일을 편집하세요.
- **팝업 UI**: `index.html` (`.patch-overlay` 영역)
- **스타일**: `src/styles.css` (`.patch-overlay` / `.patch-card` / `.patch-badge--*`)

---

## 새 패치노트 작성 규칙

### 1. `PATCH_NOTES.version` 변경

버전은 반드시 **이전보다 커야** 합니다. 쿠키에 저장된 버전과 비교하여 다를 때만 팝업이 표시됩니다.

```js
version: "0.3.0"  // 이전 0.2.0 → 변경
```

> ⚠️ 같은 버전으로 두면 기존 유저에게 팝업이 다시 뜨지 않습니다.

### 2. `changes` 배열에 항목 추가

각 항목은 `{ type, text }` 형식입니다.

**type (카테고리):**

| type       | 의미               | 뱃지 색상  |
|------------|-------------------|------------|
| `feature`  | 새로운 기능 추가    | 초록       |
| `refactor` | 코드/구조 개선      | 파랑       |
| `fix`      | 버그 수정          | 주황       |
| `style`    | UI/디자인 개선      | 보라       |

> 새로운 `type`이 필요하면 `styles.css`에 `.patch-badge--{type}` 클래스를 추가해야 합니다.

**text 작성 원칙:**

- 한국어로 작성
- **유저 시점**에서 서술 (개발자 내부 용어 지양)
- 명사형 종결 (ex. "했습니다" → "했습니다" or "합니다")
- 간결하게: 한 줄에 40자 이내 권장
- 중요한 변경만 포함 (버그 수정은 모은 후 한 줄로)

**예:**

```js
{ type: "fix", text: "특정 상황에서 전투가 멈추던 문제를 수정했습니다." }
```

### 3. 배포 전 체크리스트

- [ ] `PATCH_NOTES.version` 증가
- [ ] `PATCH_NOTES.date` 오늘 날짜로 갱신
- [ ] `PATCH_NOTES.title`에 버전 반영
- [ ] 불필요한 이전 항목 제거 또는 유지 (변경점만 남김)
- [ ] `npm test` 통과
- [ ] 브라우저에서 팝업 표시/미표시 확인

---

## 시스템 동작 방식

1. 앱 초기화 시 `src/ui.js`의 `appStore.init()`가 `shouldShowPatchNotes()` 호출
2. `shouldShowPatchNotes()`는 쿠키 `ballfight_patch`의 값과 `PATCH_NOTES.version`을 비교
3. 다르면 `patchNotesVisible = true` → 팝업 표시
4. 유저가 "확인" 클릭 → `dismissPatchNotes()` → 쿠키에 현재 버전 저장 → 팝업 숨김
5. 다음 방문 시 쿠키 버전이 같으면 팝업 없음

### 쿠키 정보

| 항목     | 값                          |
|----------|-----------------------------|
| Name     | `ballfight_patch`           |
| Value    | 버전 문자열 (ex. `0.2.0`)   |
| Expires  | 1년                         |
| Path     | `/`                         |
| SameSite | `Lax`                       |

---

## 이전 패치노트 보관 정책

- `src/patch-notes.js`에는 **현재 버전의 패치노트만** 유지합니다.
- 이전 버전의 패치노트는 `docs/patch-notes-archive.md`에 보관합니다.
- 아카이브는 사람이 수동으로 관리합니다.
