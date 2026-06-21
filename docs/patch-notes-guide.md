# 패치 노트 관리 가이드

> **실제 데이터 파일**: `src/patch-notes.js` — 여기에 나온 규칙을 따라 `PATCH_NOTES` 객체를 수정하세요.

## 파일 위치

- **데이터**: `src/patch-notes.js` — 실제 패치노트 내용을 수정하려면 이 파일을 편집하세요.
- **유틸 함수**: `src/utils.js` — `getUnseenEntries()`, `dismissPatchNotes()` 등
- **팝업 UI**: `index.html` (`.patch-overlay` 영역)
- **스타일**: `src/styles.css` (`.patch-overlay` / `.patch-card` / `.patch-badge--*`)

---

## 새 패치노트 작성 규칙

### 1. `PATCH_NOTES` 배열에 새 항목 추가

`PATCH_NOTES`는 누적 배열입니다. 새 패치노트는 **배열 맨 앞**에 `{ version, date, title, changes }`를 추가하세요. (최신 버전이 항상 위에 오도록)

```js
{
    version: "0.3.0",  // 이전 0.2.0 → minor bump
    date: "2026-06-22",
    title: "v0.3.0 업데이트",
    changes: [ ... ]
}
```

버전은 반드시 **이전보다 커야** 합니다. 쿠키에 저장된 버전보다 최신 항목만 팝업에 누적 표시됩니다.

**버전 규칙 (SemVer):**

| 단위  | 기준                                    | 예시              |
| ----- | --------------------------------------- | ----------------- |
| major | 대규모 업데이트, 유저가 명시적으로 지정 | `0.2.0` → `1.0.0` |
| minor | 기능 변경 또는 추가                     | `0.2.0` → `0.3.0` |
| patch | 단순 버그 수정, 문구 수정, 리팩토링     | `0.2.0` → `0.2.1` |

> ⚠️ 같은 버전으로 두면 기존 유저에게 팝업이 다시 뜨지 않습니다.

### 2. `changes` 배열에 항목 추가

각 항목은 `{ type, text }` 형식입니다.

**type (카테고리):**

| type       | 의미             | 뱃지 색상 |
| ---------- | ---------------- | --------- |
| `feature`  | 새로운 기능 추가 | 초록      |
| `refactor` | 코드/구조 개선   | 파랑      |
| `fix`      | 버그 수정        | 주황      |
| `style`    | UI/디자인 개선   | 보라      |

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

- [ ] `PATCH_NOTES` 배열에 새 `{ version, date, title, changes }` 항목 추가
- [ ] version은 SemVer 규칙에 따라 증가
- [ ] `date` 오늘 날짜로 설정
- [ ] 불필요하게 오래된 항목은 `docs/patch-notes-archive.md`로 이동
- [ ] `npm test` 통과
- [ ] 브라우저에서 팝업 표시/미표시 확인

---

## 시스템 동작 방식

1. 앱 초기화 시 `src/ui.js`의 `appStore.init()`가 `getUnseenEntries()` 호출
2. `getUnseenEntries()`는 쿠키 `ballfight_patch` 값 이후의 `PATCH_NOTES` 배열 항목만 반환
3. 반환된 항목이 있으면 `patchNotesVisible = true` → 팝업에 **못 본 버전 모두** 표시 (최신순)
4. 유저가 "확인" 클릭 → `dismissPatchNotes()` → 쿠키에 **가장 최신 버전** 저장 → 팝업 숨김
5. 다음 방문 시 쿠키 버전보다 새로운 항목이 없으면 팝업 없음

### 쿠키 정보

| 항목     | 값                        |
| -------- | ------------------------- |
| Name     | `ballfight_patch`         |
| Value    | 버전 문자열 (ex. `0.2.0`) |
| Expires  | 1년                       |
| Path     | `/`                       |
| SameSite | `Lax`                     |

---

## 이전 패치노트 보관 정책

- `src/patch-notes.js`에는 **현재 버전의 패치노트만** 유지합니다.
- 이전 버전의 패치노트는 `docs/patch-notes-archive.md`에 보관합니다.
- 아카이브는 사람이 수동으로 관리합니다.
