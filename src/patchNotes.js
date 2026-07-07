// ── Patch notes data ────────────────────────────────────────────────────────
//
// 패치노트 작성 규칙은 docs/patch-notes-guide.md 를 참고하세요.
//   - version 증가 / date 갱신 / changes 배열 추가
//   - type: feature | refactor | fix | style (새 type 추가시 CSS도 필요)
//   - 한국어, 유저 시점, 간결하게
//
// 유틸 함수(getUnseenEntries, dismissPatchNotes 등)는 src/utils.js 에 있습니다.
// 이전 버전중 PATCH_NOTES 배열에 남길 필요가 없는 항목은
// docs/patch-notes-archive.md 에 보관합니다.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ version:string, date:string, title:string, changes:Array<{type:string,text:string}> }} PatchEntry
 *
 * 누적 패치노트 목록. **맨 앞이 최신 버전**입니다.
 * 유저가 마지막으로 확인한 버전 이후의 항목만 팝업에 표시됩니다.
 * @type {PatchEntry[]}
 */
export const PATCH_NOTES = [
    {
        version: "0.24.7",
        date: "2026-07-07",
        title: "v0.24.7 PWA 이름 정리",
        changes: [
            {
                type: "fix",
                text: "홈 화면과 설치 앱 이름을 Ball Fight Simulator / Ball Fight로 고정했습니다."
            }
        ]
    },
    {
        version: "0.24.6",
        date: "2026-07-07",
        title: "v0.24.6 브라우저 제목 정리",
        changes: [
            {
                type: "fix",
                text: "브라우저 탭 제목을 현재 게임 이름인 Ball Fight Simulator로 정리했습니다."
            }
        ]
    },
    {
        version: "0.24.5",
        date: "2026-07-05",
        title: "v0.24.5 사냥터 100층 원정",
        changes: [
            {
                type: "feature",
                text: "사냥터가 100층 스테이지 구조로 확장되었습니다. 10층 전진 버튼을 누르면 최대 10층까지 1층씩 이동하며 전투·이벤트·빈층·보스 판정을 수행합니다."
            },
            {
                type: "feature",
                text: "새 이벤트 4종 추가: 포탈(귀환 가능), 떠돌이 상인, 축복(파편 획득), 함정(HP 손실). 포탈에서만 귀환이 가능합니다."
            },
            {
                type: "feature",
                text: "동굴·숲·사막 스테이지가 추가되었습니다. 각 스테이지의 100층 보스를 처치하면 다음 스테이지가 해금됩니다."
            },
            {
                type: "feature",
                text: "이동 중 층별 애니메이션과 진행도를 오버레이에서 확인할 수 있습니다."
            }
        ]
    },
    {
        version: "0.24.4",
        date: "2026-07-05",
        title: "v0.24.4 시작 전 장비 화면",
        changes: [
            {
                type: "feature",
                text: "토너먼트와 사냥터 입장 전에 현재 장비 슬롯, 인벤토리 수량, 적용 중인 장비 스탯을 확인하고 장비 화면으로 바로 이동할 수 있습니다."
            }
        ]
    },
    {
        version: "0.24.3",
        date: "2026-07-05",
        title: "v0.24.3 장비 레벨 제한",
        changes: [
            {
                type: "feature",
                text: "장비 등급별 요구 레벨을 적용해 현재 캐릭터 레벨보다 높은 장비는 장착과 전투 스탯 반영이 막힙니다."
            },
            {
                type: "fix",
                text: "토너먼트 전투 스펙에 장착 장비 외형 정보도 함께 전달되도록 보강했습니다."
            }
        ]
    },
    {
        version: "0.24.2",
        date: "2026-07-05",
        title: "v0.24.2 장비 외형 표시",
        changes: [
            {
                type: "feature",
                text: "장착한 무기, 방어구, 장신구가 전투 캔버스에서 슬롯별 외형으로 표시됩니다."
            },
            {
                type: "fix",
                text: "컴포넌트 HTML에도 버전 캐시 버스터를 적용해 오래된 컬렉션 허브 UI가 남는 문제를 줄였습니다."
            }
        ]
    },
    {
        version: "0.24.0",
        date: "2026-07-03",
        title: "v0.24.0 충격파 리워크 + AI 안정화",
        changes: [
            {
                type: "feature",
                text: "충격파 재설계: applyKnockback(1200 force, 0.3s 방향고정) + 벽꽝 데미지 + 본인 radius 보정 effectiveDist. 넉백이 명확히 체감됩니다."
            },
            {
                type: "fix",
                text: "AI burst 패턴 수정: spendHpForAction 실패 시 _consecutiveYes 리셋, HP=1에서 회복 후 즉시 연속 발동 방지."
            },
            {
                type: "refactor",
                text: "Time Warp RL 패널티 0.02→0.15 (7.5배). 재학습 시 스팸 억제."
            }
        ]
    },
    {
        version: "0.23.3",
        date: "2026-06-28",
        title: "v0.23.3 핫픽스",
        changes: [
            {
                type: "fix",
                text: "앱 초기화 전에 스탯 UI가 먼저 변경된 경우에도 배분값이 0으로 덮이지 않도록 보강했습니다."
            }
        ]
    },
    {
        version: "0.23.2",
        date: "2026-06-28",
        title: "v0.23.2 핫픽스",
        changes: [
            {
                type: "fix",
                text: "브라우저가 이전 UI 모듈을 캐시해 스탯 배분 초기화 수정이 반영되지 않을 수 있던 문제를 수정했습니다."
            }
        ]
    },
    {
        version: "0.23.1",
        date: "2026-06-28",
        title: "v0.23.1 핫픽스",
        changes: [
            {
                type: "fix",
                text: "스탯 배분 후 화면 갱신이 발생하면 배분값이 초기화될 수 있던 문제를 수정했습니다."
            }
        ]
    },
    {
        version: "0.23.0",
        date: "2026-06-28",
        title: "v0.23.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "캐릭터 경험치, 디펜딩 챔피언, 사냥터와 상자 해금 시스템의 설계 방향을 정리했습니다."
            },
            {
                type: "refactor",
                text: "전투 참가자에 팀 정보를 추가해 1대n, n대n 전투 기반을 마련했습니다."
            },
            {
                type: "fix",
                text: "같은 팀끼리는 충돌해도 피해를 입지 않고, 투사체가 아군을 대상으로 삼지 않도록 했습니다."
            }
        ]
    },
    {
        version: "0.22.0",
        date: "2026-06-28",
        title: "v0.22.0 업데이트",
        changes: [
            {
                type: "refactor",
                text: "전투 엔티티 물리/수명/쿨다운 공통 로직을 믹스인 구조로 정리했습니다."
            },
            {
                type: "refactor",
                text: "BattleBall과 Ability의 상태값을 state, flags, stats 같은 네임스페이스로 묶었습니다."
            },
            {
                type: "fix",
                text: "투사체 렌더 레이어 누락으로 화살, 총알, 박쥐가 보이지 않던 문제를 수정했습니다."
            }
        ]
    },
    {
        version: "0.21.0",
        date: "2026-06-28",
        title: "v0.21.0 업데이트",
        changes: [
            {
                type: "refactor",
                text: "Trickster Ball 상향 — 체력 98→110."
            },
            {
                type: "refactor",
                text: "Grenade Ball 리워크 — 예측 조준 폭탄 대신 2~4발 산탄 발사(쿨타임 4.5초). 중심부 퓨즈 0.25초, 가장자리 0.8초로 지연 폭발. 데미지 절반(중심 20/가장자리 10), 넉백 대폭 증가(600px/s, 0.5초)로 연쇄 폭발 유도. 속도 278→290."
            },
            {
                type: "refactor",
                text: "Phantom Ball 상향 — 체력 100→110, 방어력 보정 1.3→1.5."
            }
        ]
    },
    {
        version: "0.20.0",
        date: "2026-06-27",
        title: "v0.20.0 업데이트",
        changes: [
            {
                type: "refactor",
                text: "대규모 밸런스 조정 — 200회 토너먼트 시뮬레이션 3회차 분석 기반."
            },
            {
                type: "refactor",
                text: "Vampire Ball 박쥐 이동 Boids(Flocking) 알고리즘으로 개선 — 응집/정렬/분리 3규칙 + 표적 추적. 5→7마리 소환, 느리게 떼지어 접근 후 동시타격."
            },
            {
                type: "refactor",
                text: "Grenade Ball 예측 정확도 하향(0.48→0.18), 센서 범위 축소(180→140). 대신 더 자주 투척(쿨타임 4.7→3.8s, 랜덤폭 증가)."
            },
            {
                type: "refactor",
                text: "Trickster Ball 시드 대시 충돌 데미지 1.3→0.9배 하향."
            },
            {
                type: "refactor",
                text: "Dash Ball 대시 충돌 데미지 0.4배 추가 (기존 0 → 보너스뎀)."
            },
            {
                type: "fix",
                text: "Phantom Ball 대시 벽 충돌 시 종료(untilWall) 추가 — 과도한 연타 방지."
            },
            {
                type: "fix",
                text: "박쥐 날개 방향 수정 — 몸통 기준 수직(위/아래)으로 펼쳐지도록 교정."
            },
            {
                type: "style",
                text: "박쥐 시각 개선 — 눈 앞쪽 이동, 몸통/날개 분리 뚜렷하게."
            }
        ]
    },
    {
        version: "0.19.0",
        date: "2026-06-27",
        title: "v0.19.0 업데이트",
        changes: [
            {
                type: "refactor",
                text: "대규모 밸런스 조정 — 200회 토너먼트 시뮬레이션 기반 데이터 분석."
            },
            {
                type: "refactor",
                text: "Vampire Ball 상향 — HP 92→100, 박쥐 쿨타임 4초→3초, 흡혈률/발사체/데미지 전반 개선."
            },
            {
                type: "refactor",
                text: "Eater Ball 상향 — 피스트 쿨타임 7.2초→6초, 유도력/지속시간/벽꿍 데미지 증가."
            },
            {
                type: "refactor",
                text: "Phantom Ball 개선 — 쿨타임 4초→2초, 방어력 증가, 충돌 시 섀도우 스트라이크 보너스 데미지 5→12. 기존 충돌 발동 방식 유지."
            },
            {
                type: "refactor",
                text: "Grenade Ball 센서 신관 추가 — 수류탄이 적 근처(180px)에 접근하면 0.2초 후 자동 폭발. 기존 타이머 퓨즈와 병행."
            },
            {
                type: "refactor",
                text: "Archer Ball 상향 — 활시위 당기기 0.6초→0.4초, 화살 데미지 1.4배→1.6배."
            },
            {
                type: "refactor",
                text: "Archer Ball / Grenade Ball 쿨타임 랜덤화 — 다음 발사까지 대기시간이 매번 달라져 예측 불가능한 전투 리듬 제공."
            },
            {
                type: "refactor",
                text: "Dash Ball 상향 — 기본 공격력 9→10."
            },
            {
                type: "refactor",
                text: "Bat Ball 하향 — 방망이 쿨타임 2.2초→3초, 데미지 계수 1.6배→1.3배, 탐지 범위 감소."
            },
            {
                type: "refactor",
                text: "Rage Ball 하향 — 충전 속도/데미지/충격 계수 대폭 감소, 최대 충전 시간 7초→12초."
            }
        ]
    },
    {
        version: "0.18.0",
        date: "2026-06-25",
        title: "v0.18.0 업데이트",
        changes: [
            {
                type: "fix",
                text: "숙련도 물리 보정(넉백 감소/충격 증가/속도 복귀)이 전투에 적용되지 않던 버그 수정."
            },
            {
                type: "fix",
                text: "숙련도 액션 HP 비용 감소(bat_ball)가 실제 비용 계산에 반영되지 않던 버그 수정."
            },
            {
                type: "fix",
                text: "숙련도 전투 패시브(rage 주기적 충돌 보너스)가 발동하지 않던 버그 수정."
            },
            {
                type: "fix",
                text: "archer 숙련도의 공격력 보너스가 단독으로 적용되지 않던 버그 수정."
            },
            {
                type: "fix",
                text: "성장 보너스(extraStatPoints)가 UI에 표시되지 않고 실제 배분도 불가능했던 버그 수정."
            },
            {
                type: "fix",
                text: "balanceTolerance 0일 때 SENSITIVITY가 초기화되지 않던 버그 수정."
            },
            {
                type: "fix",
                text: "여러 업적 동시 해금 시 토스트가 하나만 표시되던 버그 수정 (큐 기반 순차 표시)."
            },
            {
                type: "refactor",
                text: "성장 보너스 포인트를 UI에 표시하고 사용자가 직접 배분 가능하도록 개선."
            },
            {
                type: "refactor",
                text: "core.js 깨진 한글 주석 전체 복구."
            }
        ]
    },
    {
        version: "0.16.0",
        date: "2026-06-24",
        title: "v0.16.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "업적 시스템 구현 — 9개 업적, 컬렉션 허브에서 확인 가능."
            },
            {
                type: "feature",
                text: "업적 해금 시 성장 보너스 자동 지급 (최대 100 스탯 가치)."
            },
            {
                type: "feature",
                text: "숙련도(계승) 시스템 — 캐릭터별 등급(BRONZE/SILVER/GOLD) 및 전투 보너스."
            },
            {
                type: "refactor",
                text: '"연계" → "숙련도"로 UI/코드 명칭 통일, 프로필 마이그레이션 포함.'
            },
            {
                type: "refactor",
                text: "entities.js를 entities/ 폴더로 분리 (개별 파일 + barrel)."
            },
            {
                type: "style",
                text: "파일명 camelCase, 클래스 PascalCase로 네이밍 규칙 통일."
            },
            {
                type: "refactor",
                text: "액션 사용/성공 기록 시스템 연동 — MatchReport가 실제 데이터 수집."
            },
            {
                type: "fix",
                text: "클릭 액션 HP 비용 기록, 카운터/투사체방어/버티기 성공 기록."
            }
        ]
    },
    {
        version: "0.17.0",
        date: "2026-06-25",
        title: "v0.17.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "전투 배속 시스템 — x2/x4 배속, 업적 해금 시 사용 가능."
            },
            {
                type: "feature",
                text: "업적 3종 추가: 단일 대미지 150(gold), 속도 해방 1단계/2단계."
            },
            {
                type: "refactor",
                text: "회귀 테스트 9개 추가 (업적/숙련도/토너먼트리포트/ViewModel)."
            }
        ]
    },
    {
        version: "0.15.1",
        date: "2026-06-24",
        title: "v0.15.1 업데이트",
        changes: [
            {
                type: "feature",
                text: "클릭 액션 돌진이 발동 즉시 앞으로 튀어나가도록 개선했습니다."
            },
            {
                type: "refactor",
                text: "돌진 액션도 impulse 기반 속도 변경 규칙에 맞췄습니다."
            },
            {
                type: "fix",
                text: "Archer/Grenade 패시브 회피가 즉시 옆으로 빠지도록 반응성을 복구했습니다."
            }
        ]
    },
    {
        version: "0.15.0",
        date: "2026-06-24",
        title: "v0.15.0 업데이트",
        changes: [
            {
                type: "refactor",
                text: "충격 기반 충돌 물리 적용 — 충돌 후 튕김이 더 자연스럽게 유지됩니다."
            },
            {
                type: "fix",
                text: "빠른 대시 중 같은 충돌 피해가 연속으로 반복되던 현상을 완화했습니다."
            },
            {
                type: "refactor",
                text: "대시, 넉백, 벽 반사, 파티클 속도 변경을 impulse 방식으로 통일했습니다."
            }
        ]
    },
    {
        version: "0.14.0",
        date: "2026-06-24",
        title: "v0.14.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "Hero Orb 스탯 증가량 1~5로 상향 — 체감 폭 증가."
            },
            {
                type: "feature",
                text: "Hero Ball 승리 시 스탯 계승 시스템 추가 — 이번 경기 Hero Orb 획득량의 절반을 floor 처리하여 다음 스테이지에 carryover."
            },
            {
                type: "feature",
                text: "applyHeroOrbStatAmount() helper 분리 — 랜덤 roll 없는 스탯 적용, carryover 전용."
            },
            {
                type: "feature",
                text: "UI carryover 합산 표시 — mergeOrbBonuses()로 carryover + current match 합산."
            },
            {
                type: "refactor",
                text: "STAT_ORB_KEYS export, mergeOrbBonuses() 공용 함수 분리."
            }
        ]
    },
    {
        version: "0.13.0",
        date: "2026-06-24",
        title: "v0.13.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "Hero Orb 스탯 증가량 1~3 랜덤으로 변경 — 체감 큰 폭 증가. cap clamp 시 실제 amount만 적용."
            },
            {
                type: "feature",
                text: "Trickster seed 발사 속도 버프 — owner 전투 속도 × 1.2~1.5 (기존 250 고정)."
            },
            {
                type: "feature",
                text: "Trickster seed 유지시간 버프 — 스킬 쿨타임의 2배 (기존 쿨타임 동일)."
            },
            {
                type: "refactor",
                text: "rollHeroOrbStatGain() / clampStatGain() 공용 helper 분리."
            },
            {
                type: "refactor",
                text: "TricksterAbility seed 속도/수명 계산 — computeOwnerCombatSpeed 재사용."
            }
        ]
    },
    {
        version: "0.12.0",
        date: "2026-06-23",
        title: "v0.12.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "특수 Hero Orb 3종 추가 — dash(10%, 돌진), arrow(10%, 화살), cooldown_burst(5%, 쿨타임 25% 단축)."
            },
            {
                type: "feature",
                text: "pickHeroOrbEffectType() 확률 선택 함수 — rng 제어 가능, 특수 미선택 시 기존 5종 스탯 orb."
            },
            {
                type: "feature",
                text: "dash orb — DashEffect 재사용, owner 속도 × 1.5 돌진."
            },
            {
                type: "feature",
                text: "arrow orb — spawnArrow/ArrowProjectile 재사용, owner 속도 × 2.0 화살."
            },
            {
                type: "feature",
                text: "cooldown_burst orb — 1초간 HeroAbility 쿨타임 ×0.25. HeroAbility가 multiplier 상태 소유."
            },
            {
                type: "feature",
                text: "특수 orb 시각 구분 — 내부 ≫/↑/⚡ 기호, 외곽선 3px."
            },
            {
                type: "refactor",
                text: "computeOwnerCombatSpeed() 공용 함수 분리 — HeroAbility/entities.js 재사용."
            }
        ]
    },
    {
        version: "0.11.0",
        date: "2026-06-23",
        title: "v0.11.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "Hero Ball 기본 쿨타임 1초로 변경 — 더 자주 오브를 생성합니다."
            },
            {
                type: "feature",
                text: "Hero Orb 발사 속도 owner 기준으로 변경 — 내 전투 속도 × 1.2~1.5 랜덤 배율. 정지 시에도 일정 속도 보장."
            },
            {
                type: "feature",
                text: "Hero Orb 획득 시 스탯명 +1 텍스트 피드백 추가 — effect 색상에 맞는 색으로 표시, cap 상태에서는 미표시."
            },
            {
                type: "feature",
                text: "HERO_ORB_EFFECTS에 label 및 apply() 반환값 추가 — { applied, amount } 구조로 UI/피드백 정합성 확보."
            },
            {
                type: "feature",
                text: "Hero Ball 스탯 UI 개선 — 시작 전 배분과 Hero Orb 보너스를 체력 +30%(+3) 형태로 같은 스탯 줄에 표시."
            },
            {
                type: "refactor",
                text: "HeroAbility 발사 속도 함수 _computeOrbSpeed() 분리."
            }
        ]
    },
    {
        version: "0.10.0",
        date: "2026-06-23",
        title: "v0.10.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "신규 캐릭터 Hero Ball 추가 — 쿨타임마다 랜덤 스탯 오브를 던집니다. 본인이 먹으면 해당 스탯 영구 증가, 상대가 먹으면 보너스 없이 제거됩니다."
            },
            {
                type: "feature",
                text: "Hero Orb effect registry 기반 구현 — hp/damage/speed/defense/skill 5종. 추후 heal/shield 등 확장 가능."
            },
            {
                type: "feature",
                text: "Hero Orb 스탯 성장 상한 시스템 — HERO_ORB_STAT_CAP = -1 (무한). 0 이상 설정 시 해당 스탯 보너스 상한 도달 후 증가 중단."
            },
            {
                type: "feature",
                text: "Hero Orb 필드 제한 — HERO_ORB_MAX_ACTIVE_PER_OWNER = 10. owner 1개체당 최대 10개, 전체 제한 없음."
            },
            {
                type: "feature",
                text: "토너먼트 참가자 선발 규칙 변경 — 캐릭터가 8명 이상일 때 유저 캐릭터 1명 + 유저 제외 랜덤 7명 = 총 8명 참가. 8명 미만이면 기존 부전승 로직 유지."
            }
        ]
    },
    {
        version: "0.9.0",
        date: "2026-06-23",
        title: "v0.9.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "카운터/투사체 방어 리워크 — 이제 무조건 발동 후 판정 window 방식. 카운터는 0.20초 안에 상대 충돌 피해를 반사하고, 투사체 방어는 0.3초 안에 투사체 75% 경감 및 성공 시 비용 회수."
            },
            {
                type: "feature",
                text: "액션 실패 시 피드백 텍스트 추가 — 조건 불충족 시 빨간색 문구가 표시됩니다."
            },
            {
                type: "refactor",
                text: "BattleBall 클릭 액션 시스템 리팩토링 — ActionContext 단일 ref로 통합, 모든 액션 변수/로직 분리."
            },
            {
                type: "refactor",
                text: "DashEffect/WallSlamEffect 런타임 이펙트 분리 — 대시/벽 충돌 로직이 독립 클래스로 통합되었습니다."
            },
            {
                type: "refactor",
                text: "투사체 방어 재설계 — 투사체 사전 탐색 제거, CombatEntity 경감 로직 제거, ActionContext timed effect로 대체."
            },
            {
                type: "refactor",
                text: "액션 description/cost를 모듈 상수 기반 템플릿으로 변경 — 정합성 자동 유지."
            },
            {
                type: "refactor",
                text: "코드베이스 안티패턴 11건 개선 — Template Method, 메서드 분리, 중복 제거, 캡슐화 강화."
            },
            {
                type: "refactor",
                text: "PopupService closeOnOutside 속성 복원 — false 시 바깥 클릭으로 팝업 닫힘 방지."
            },
            {
                type: "fix",
                text: "Dash Ball 충돌/벽 꽂힘 버그 수정 — 대시 종료 시 forcedHeading 미제거로 속도가 덮어써지던 문제."
            },
            {
                type: "fix",
                text: "Trickster 씨앗 본인도 먹을 수 있도록 수정 — 모든 파이터 검사, 대시 방향은 항상 상대방."
            },
            {
                type: "fix",
                text: "Orbit Ball 프리뷰 화면 shard 지글거림 수정 — 매 프레임 BattleBall 재생성 제거."
            },
            {
                type: "fix",
                text: "액션 선택 중복 요청 방지 — waitForActionPick 가드 추가."
            },
            {
                type: "fix",
                text: "UI 텍스트 커서 숨김 — .app에 user-select:none 적용."
            },
            {
                type: "style",
                text: "액션 효과값 0.05(5%) 단위, HP 코스트 0.5%p 단위로 정렬."
            },
            {
                type: "style",
                text: "시간 왜곡 슬로우 강화 — 상대 속도 45%→35%."
            }
        ]
    },
    {
        version: "0.8.0",
        date: "2026-06-22",
        title: "v0.8.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "클릭 액션 시스템 추가 — 매치 시작 시 5개 액션 중 3개를 뽑아 1개 선택. 캔버스 클릭으로 발동, HP 소모."
            },
            {
                type: "feature",
                text: "액션: 시간 왜곡 — HP 50% 이하에서 0.25초간 상대만 슬로우"
            },
            {
                type: "feature",
                text: "액션: 돌진 — 1초간 속도 +50%"
            },
            {
                type: "feature",
                text: "액션: 카운터 — 0.20초 안에 충돌 시 상대 충돌 피해 반사"
            },
            {
                type: "feature",
                text: "액션: 투사체 방어 — 0.3초 안에 맞는 투사체 데미지 75% 경감, 성공 시 비용 회수"
            },
            {
                type: "feature",
                text: "액션: 버티기 — 0.1초간 모든 데미지 80% 경감"
            },
            {
                type: "feature",
                text: "TriggerStrategy 패턴 — Tap/Release/Hold 세 가지 발동 방식 지원 (현재는 Tap만 사용)"
            }
        ]
    },
    {
        version: "0.7.0",
        date: "2026-06-22",
        title: "v0.7.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "신규 캐릭터 Bat Ball 추가 — 120도 시야 범위가 좌우로 스캔하며 적을 휘둘러 넉백을 줍니다."
            },
            {
                type: "refactor",
                text: "Sword Night → Bat Ball 리브랜딩: 방망이 VFX, 캡 모자 얼굴로 변경"
            },
            {
                type: "style",
                text: "Bat Ball 캡모자 크기 확대 + 눈과 간격 조정"
            },
            {
                type: "style",
                text: "docs/click-actions.md 설계 문서 추가 (클릭 액션 시스템, 미구현)"
            },
            {
                type: "refactor",
                text: "넉백 시스템 재설계 — forceHeading에 overrideVelocity 통합, knockbackState 제거. 벽 충돌 시 넉백 종료."
            },
            {
                type: "refactor",
                text: "applyKnockback이 속도 벡터를 직접 받도록 변경 — 투사체 속도가 넉백에 반영됩니다."
            }
        ]
    },
    {
        version: "0.6.4",
        date: "2026-06-21",
        title: "v0.6.4 업데이트",
        changes: [
            {
                type: "refactor",
                text: "넉백 시스템 개선 — forceHeading+speedBoost 기반 다프레임 지속, applyKnockback 공용 메서드."
            },
            { type: "buff", text: "Orbit 위성 3→5개, 리차지 2초→1초 (쿨타임 스탯으로 추가 단축)." }
        ]
    },
    {
        version: "0.6.3",
        date: "2026-06-21",
        title: "v0.6.3 업데이트",
        changes: [
            {
                type: "feature",
                text: "Orbit Ball 상향 — 위성 3개 충전 시 3연속 원거리 발사 (가속/벽튕김), 쿨타임 스탯이 재충전 속도에 반영."
            },
            {
                type: "refactor",
                text: "OrbitProjectile 엔티티 분리 — 기존 Ability 내부 배열 대신 Arrow/Grenade와 동일한 구조."
            }
        ]
    },
    {
        version: "0.6.2",
        date: "2026-06-21",
        title: "v0.6.2 업데이트",
        changes: [
            {
                type: "feature",
                text: "Grenade Ball 상향 — 수류탄 벽 튕김(최대 2회), 폭발 데미지 20~40, 패시브 회피 추가."
            },
            {
                type: "feature",
                text: "투사체 데미지 baseDamage 연동 — Arrow/Grenade/Shard/Seed 데미지가 공격 스탯에 비례합니다."
            },
            { type: "refactor", text: "evadeTarget 공용 함수 추출 — Archer/Grenade가 회피 로직 공유." }
        ]
    },
    {
        version: "0.6.1",
        date: "2026-06-21",
        title: "v0.6.1 업데이트",
        changes: [
            {
                type: "fix",
                text: "충돌 피해 speedEff 상한 제거 — 빠른 볼이 속도 비례 더 큰 피해를 줍니다. (Rage 5배속 보상)"
            },
            { type: "fix", text: "Eater Ball UI 버그 수정 — 삼킨 후 쿨타임 게이지가 8.5%에 고정되던 문제 수정." },
            { type: "fix", text: "벽꿍 데미지 상향 — 방어력 적용 후 너무 낮아져 8→15로 상승." }
        ]
    },
    {
        version: "0.6.0",
        date: "2026-06-21",
        title: "v0.6.0 업데이트",
        changes: [
            {
                type: "feature",
                text: "방어력(DEF) 스탯 추가 — 받는 피해에서 방어력만큼 차감됩니다. roster에 캐릭터별 기본 방어력 추가."
            },
            { type: "feature", text: "Eater Ball 방어력 재설계 — 피스트 중 방어력 1.5배, 뱉은 후 쿨타임 초기화." },
            { type: "refactor", text: "충돌 피해 계산 체계 정리 — 3단계(충돌 × 능력보정 − 방어력)로 문서화." },
            { type: "style", text: "게임 도움말 업데이트 — 방어력/5스탯, 모든 능력 설명 최신화." }
        ]
    },
    {
        version: "0.5.0",
        date: "2026-06-21",
        title: "v0.5.0 업데이트",
        changes: [
            {
                type: "refactor",
                text: "쿨타임 공식 변경 — 선형(1 - skill/100)에서 체감형(100/(100+skill))으로, 100포인트 시 50% 단축."
            },
            { type: "feature", text: "Rage Ball 상향 — 최고 속도 5배, 쿨타임 스탯이 충전 시간에 반영됩니다." },
            {
                type: "fix",
                text: "Eater Ball 버그 수정 — 피스트 종료 후 쿨타임 즉시 재시작 버그 수정, 뱉은 후 쿨타임 초기화."
            },
            {
                type: "fix",
                text: "Eater Ball 크기 조절 버그 수정 — 삼키면 1.5배로 커지고, 뱉으면 원래 크기로 돌아옵니다."
            }
        ]
    },
    {
        version: "0.4.0",
        date: "2026-06-21",
        title: "v0.4.0 업데이트",
        changes: [
            {
                type: "refactor",
                text: "충돌 피해 공식 개선 — damage가 최대 피해량을 의미하는 정수로 변경, 속도/방향 기반 효율(0~1) 곱셈."
            },
            { type: "feature", text: "스탯 초기화 버튼 추가 — 자동 배분 옆에 초기화 버튼이 생겼습니다." },
            { type: "fix", text: "Dash Ball 너프 — 쿨다운 최대 2단계(75% 감소), 벽 충돌 시 스택 완전 초기화." },
            { type: "refactor", text: "ESM 모듈 로딩 방식으로 변경 — window 전역 패턴 제거." }
        ]
    },
    {
        version: "0.3.1",
        date: "2026-06-21",
        title: "v0.3.1 업데이트",
        changes: [
            { type: "feature", text: "Eater Ball 방어력 조정 — 평균권 기본 방어와 피스트 중 1.5배 보정." },
            { type: "feature", text: "Eater Ball 피스트 중 제한 각도 유도 기능 추가." },
            { type: "feature", text: "쿨타임 스탯 추가 — 스킬 쿨타임을 포인트당 1% 단축합니다." }
        ]
    },
    {
        version: "0.3.0",
        date: "2026-06-21",
        title: "v0.3.0 업데이트",
        changes: [
            { type: "feature", text: "Archer Ball 능력 개선 — 활 당기기 애니메이션, 2연속 빗나감 시 3연속 발사." },
            { type: "feature", text: "Archer Ball 패시브 회피 — 상대가 접근하면 옆으로 자동 회피합니다." },
            { type: "refactor", text: "시뮬레이션 구조 개선 — Simulation/TestSimulation 베이스 클래스 도입." },
            { type: "refactor", text: "패치노트 시스템 개선 — 놓친 버전도 함께 표시됩니다." },
            { type: "style", text: "데미지 숫자 디자인 개선 및 팝업 버튼 하단 고정." }
        ]
    },
    {
        version: "0.2.2",
        date: "2026-06-21",
        title: "v0.2.2 업데이트",
        changes: [
            { type: "fix", text: "팝업 닫힐 때 콘텐츠가 먼저 사라지던 버그를 수정했습니다." },
            { type: "fix", text: "파이터 카드가 좁은 화면에서 레이아웃이 깨지던 문제를 수정했습니다." },
            { type: "style", text: "게임 도움말 아이콘을 스탯 창 상단으로 이동했습니다." }
        ]
    },
    {
        version: "0.2.1",
        date: "2026-06-21",
        title: "v0.2.1 업데이트",
        changes: [
            { type: "feature", text: "게임 시스템 도움말 추가 — 우측 상단 ? 버튼을 눌러 확인하세요." },
            { type: "refactor", text: "팝업 시스템을 Alpine 컴포넌트 기반으로 개선했습니다." },
            { type: "fix", text: "고유 능력 설명을 실제 구현과 일치하도록 수정했습니다." },
            { type: "style", text: "데미지 숫자 디자인을 개선했습니다." }
        ]
    },
    {
        version: "0.2.0",
        date: "2026-06-21",
        title: "v0.2.0 업데이트",
        changes: [
            { type: "feature", text: "실시간 데미지 숫자 표시 — 타격 시 피해량이 캐릭터 위에 떠오릅니다." },
            { type: "feature", text: "스탯 밸런스 배율 시스템 — 스탯을 골고루 분배할수록 더 높은 배율을 받습니다." },
            { type: "refactor", text: "UI 시스템을 Alpine.js 컴포넌트 기반으로 개선했습니다." },
            { type: "fix", text: "스탯 분배 화면에서 발생하던 스택 오버플로우 오류를 수정했습니다." },
            { type: "style", text: "데미지 숫자 폰트 및 디자인을 플랫 스타일로 개선했습니다." }
        ]
    }
];
