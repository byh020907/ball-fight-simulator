# 개발 환경 구성

이 문서는 Ball Fight Simulator 개발에 사용하는 AI 도구 환경을 다른 PC에서 초기 구성할 때 참고하기 위한 문서입니다.

## 사용 AI 도구

이 프로젝트는 두 가지 AI 도구를 함께 사용하여 개발합니다.

### 1. Codex + OMX (Oh My Codex)

Codex CLI 위에 **OMX (Oh My Codex)** 라는 멀티 에이전트 오케스트레이션 레이어를 얹어 사용합니다.

- **Codex CLI**: OpenAI의 터미널 기반 코딩 에이전트 ([공식 문서](https://github.com/openai/codex))
- **OMX (Oh My Codex)**: Codex에 워크플로우, 역할, 스킬, 후크 등을 추가하는 오케스트레이션 레이어
  - 저장소: [Yeachan-Heo/oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex)
  - 설치: `npm install -g oh-my-codex`
  - 실행: `omx` 명령어로 사용 (예: `omx --madmax --xhigh`)

**설치 순서**:

```bash
# 1. Codex CLI 설치
npm install -g @openai/codex

# 2. OMX 설치
npm install -g oh-my-codex

# 3. OMX 초기 설정
omx setup

# 4. 정상 동작 확인
omx doctor
```

### 2. DeepSeek (VS Code Chat)

- **용도**: VS Code 채팅 기반 대화형 개발
- **확장**: **Vizards**의 **DeepSeek V4 for Copilot Chat**
- **사용법**: VS Code에서 해당 확장을 설치한 후, GitHub Copilot Chat 인터페이스에서 DeepSeek 모델을 사용

### 3. Gajae-Code (GJC) — (향후 전환 고려 중)

**Gajae-Code**는 OMX와 같은 개발자(Yeachan-Heo)가 만든 외부 코딩 에이전트 하네스입니다.
현재는 Codex + OMX 조합을 사용 중이나, 추후 Gajae-Code 기반으로 변경하는 것을 고려 중입니다.

- **저장소**: [Yeachan-Heo/gajae-code](https://github.com/Yeachan-Heo/gajae-code)
- **웹사이트**: [gajae-code.com](https://gajae-code.com/)
- **설치**: `bun install -g gajae-code`
- **실행**: `gjc` 명령어 사용
- **워크플로우**: `deep-interview` → `ralplan` → `ultragoal`
- **특징**: OMX와 달리 Codex CLI에 플러그인 형태가 아닌 독립 실행형 하네스로 동작

### OMX vs Gajae-Code 비교

두 도구는 같은 개발자가 비슷한 철학으로 만들었기 때문에, 실제 개발 성능과 워크플로우 측면에서 의미 있는 차이는 거의 없습니다. 같은 LLM을 백엔드로 사용하므로 코드 생성 품질도 동일합니다.

| 항목 | OMX (Oh My Codex) | Gajae-Code (GJC) |
|------|-------------------|------------------|
| **정체** | Codex CLI 위에 얹는 워크플로우 레이어 | Codex와 독립적으로 동작하는 하네스 |
| **설치** | `npm install -g oh-my-codex` | `bun install -g gajae-code` |
| **명령어** | `omx` | `gjc` |
| **Codex 의존성** | 필요 — Codex CLI가 실제 실행 엔진 | 불필요 — 자체 런타임 보유 |
| **실행 방식** | Codex CLI를 내부적으로 호출 | Codex, Claude Code 등과 병행 실행 가능 |
| **워크플로우** | 동일 (deep-interview → ralplan → ultragoal) | 동일 |
| **코드 생성 성능** | 차이 없음 (동일한 LLM 백엔드) | 차이 없음 |
| **주요 차이** | Codex 생태계에 플러그인 | 독립 실행, 자체 TUI 보유 |
| **Windows 지원** | 제한적 (macOS/Linux 위주) | 정식 지원 |
| **부가 기능** | 팀 런타임, 스파크쉘, 위키 | 자체 TUI, rlm 연구 모드, image input, computer-use |

**결론**: 굳이 전환해야 할 긴급한 이유는 없습니다. 현재 OMX 조합이 잘 동작 중이라면 유지해도 무방하며, Windows에서의 안정성이 필요하거나 Codex 없이 독립 실행이 필요해질 때 Gajae-Code 전환을 고려하면 됩니다.

## VS Code 확장 설치

아래 확장을 VS Code marketplace에서 검색하여 설치합니다.

| 확장 ID | 설명 |
|---------|------|
| `Vizards.deepseek-v4-copilot-chat` | DeepSeek V4 for Copilot Chat |

> **참고**: 확장 ID는 마켓플레이스 상황에 따라 변경될 수 있으므로, "DeepSeek V4 for Copilot Chat" 또는 "Vizards"로 검색하여 찾습니다.

## 기본 개발 워크플로

```bash
# 1. 로컬 서버 실행
npm start

# 2. 브라우저에서 확인
# http://127.0.0.1:4173/

# 3. 변경 후 검증
npm test
npm run check
```

## 참고

- 프로젝트 문서와 커밋 메시지는 한국어를 기본 언어로 사용합니다.
- 자세한 개발 규칙은 `docs/development-rules.md` 참고.
- Codex 사용 시 Windows PowerShell에서는 `&&` 대신 `;`로 명령어를 연결합니다.
