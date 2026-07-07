# GitHub Pages 검증 및 배포 흐름

이 문서는 Ball Fight Simulator의 GitHub Pages 배포 기준과 리모트 Codex 개발 검증 흐름을 정리한다.

## 브랜치 역할

이 프로젝트는 별도 서버 없이 GitHub Pages를 사용한다.

- 공개 URL: `https://byh020907.github.io/ball-fight-simulator/`
- 기본 Pages source: `release /`
- `main`: 최신 개발 및 검토 브랜치
- `release`: 실제 공개 안정판 브랜치

핵심 원칙은 **main은 개발 상태를 공유하기 위해 자주 push하고, release만 공개 안정판으로 관리한다**는 것이다.

## 왜 release 브랜치를 둔다

리모트 Codex 환경에서는 로컬 서버 화면을 직접 확인하기 어렵다. 동시에 GitHub/GitSync에서 diff를 보려면 작업 커밋이 원격에 push되어야 한다.

따라서 다음 모델을 사용한다.

- `main`은 작업과 검토를 위해 원격에 push해도 된다.
- GitHub Pages는 평소 `release`를 보고 있으므로, `main` push가 곧바로 공개 배포가 되지 않는다.
- 사용자가 직접 화면 검증이 필요할 때만 Pages source를 `main`으로 잠시 바꾼다.
- 검증이 끝나면 `release`를 승인된 `main` commit으로 갱신한다.

이 구조에서는 diff 확인과 공개 배포 안정성을 동시에 확보할 수 있다.

## 일반 개발 흐름

1. `main`에서 개발한다.
2. 커밋한다.
3. `main`을 원격에 push한다.
4. GitHub/GitSync에서 diff와 커밋을 검토한다.
5. Pages는 여전히 `release /`를 보고 있으므로 공개 페이지는 바뀌지 않는다.

## 리모트 검증 흐름

사용자가 공개 URL에서 최신 `main` 상태를 직접 확인해야 할 때 사용한다.

1. `main`의 작업 커밋을 원격에 push한다.
2. GitHub Pages source를 `main /`으로 전환한다.
3. Pages build가 끝날 때까지 확인한다.
4. 사용자에게 공개 URL, 주요 변경요약, 확인 포인트를 전달한다.
5. 사용자가 브라우저 또는 모바일에서 확인한다.

검증 URL은 항상 동일하다.

```text
https://byh020907.github.io/ball-fight-simulator/
```

단, 검증 중에는 이 URL이 `release`가 아니라 `main`을 서빙한다.

## 리모트 Codex 작업 완료 기준

리모트 Codex 환경에서는 사용자가 GitHub/GitSync에서 diff를 확인할 수 있어야 하므로, 사용자 작업 요청을 처리한 뒤에는 **커밋 후 `main` push까지 완료하는 것**을 기본 완료 기준으로 삼는다.

기본 순서:

1. 요청된 작업을 구현한다.
2. 필요한 검증을 실행한다.
3. 작업 단위 커밋을 만든다.
4. `main`에 push한다.
5. 사용자에게 커밋, push 여부, 검증 결과를 보고한다.

예외:

- 사용자가 명시적으로 push하지 말라고 한 경우
- 테스트 실패나 불완전 구현처럼 push하면 안 되는 상태인 경우
- secret, 깨진 산출물, 의도하지 않은 대용량 파일이 포함된 경우

`main` push는 공개 배포가 아니다. 공개 페이지는 `release`가 통제한다.

## 검증 취소 또는 보류

검증을 취소하거나 보류할 때는 배포하지 않고 Pages source만 되돌린다.

1. GitHub Pages source를 `release /`로 전환한다.
2. Pages build가 끝났는지 확인한다.
3. `release` 브랜치는 갱신하지 않는다.

이 경우 공개 페이지는 기존 안정판으로 돌아간다.

## 배포 승인 흐름

사용자가 검증 완료를 명시적으로 승인한 경우에만 `release`를 갱신한다.

권장 절차:

1. 테스트를 다시 실행한다.
2. `origin/main`이 승인된 commit인지 확인한다.
3. `release` 브랜치를 `origin/main`으로 fast-forward 한다.
4. `release`를 push한다.
5. GitHub Pages source를 `release /`로 전환한다.
6. Pages build commit이 release commit인지 확인한다.

이 흐름에서 `merge`라는 표현은 PR merge가 아니라 **release 브랜치를 승인된 main으로 갱신하는 것**을 뜻한다.

## Codex 스킬 명령

리모트 검증과 배포 전환은 `github-pages-verify` 스킬을 사용한다.

```text
$github-pages-verify start
$github-pages-verify status
$github-pages-verify release
$github-pages-verify restore
```

각 명령의 의미:

- `start`: Pages source를 `main /`으로 전환해 최신 개발 상태를 검증한다.
- `status`: Pages source, latest build commit, `main`, `release` 상태를 확인한다.
- `release`: 사용자 승인 후 `release`를 승인된 `main`으로 갱신하고 Pages를 `release /`로 둔다.
- `restore`: 배포 없이 Pages source만 `release /`로 되돌린다.

## 캐시와 빌드 확인

GitHub Pages source 전환 직후에는 브라우저 캐시 때문에 이전 JS/CSS와 새 HTML이 잠깐 섞여 보일 수 있다.

문제가 보이면 먼저 다음을 확인한다.

- GitHub Pages source branch/path
- latest Pages build status
- latest Pages build commit
- 브라우저 시크릿 창 또는 cache-busting query

예:

```text
https://byh020907.github.io/ball-fight-simulator/?v=20260707
```

## 금지 사항

- `main` push가 곧 공개 배포라고 가정하지 않는다. 공개 배포 기준은 `release`다.
- 사용자 승인 없이 `release`를 갱신하지 않는다.
- `release`를 force-push하지 않는다.
- GitHub Pages source를 임의의 feature branch나 tag로 바꾸지 않는다.
- Pages source path(`/` 또는 `/docs`)를 명시 요청 없이 바꾸지 않는다.
