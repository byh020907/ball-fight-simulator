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
        version: "0.24.47",
        date: "2026-07-12",
        title: "v0.24.47 숙련도 물리 효과와 무상한 합산으로 개편",
        changes: [
            {
                type: "refactor",
                text: "Orbit 숙련도가 반사 궤도(벽 반사 속도 +5/10/15%, 장비 반향과 합산)로, Dash가 추진력(이동 속도 +2/4/6%)으로, Gunner가 반동 증폭(충돌 각충격 +5/10/15%, 장비 소용돌이와 합산)으로 각각 교체되었습니다."
            },
            {
                type: "refactor",
                text: "숙련도 누적 상한(masteryCaps)을 제거했습니다. 이제 같은 종류의 숙련도 효과를 여러 캐릭터가 제공하면 상한 없이 단순 가산됩니다."
            },
            {
                type: "refactor",
                text: "사냥터 원정에서도 플레이어 캐릭터가 다른 캐릭터의 숙련도 효과를 받도록 적용 경로를 추가했습니다."
            },
            {
                type: "fix",
                text: "Dash와 Trickster가 같은 속도 복귀율 효과를 제공하던 중복을 해소했습니다."
            }
        ]
    },
    {
        version: "0.24.46",
        date: "2026-07-12",
        title: "v0.24.46 레벨업이 기본 수치와 행동을 함께 강화합니다",
        changes: [
            {
                type: "feature",
                text: "Lv.2~Lv.10의 모든 레벨업에 캐릭터 성향별 기본 스탯 보상을 추가했습니다. Lv.3·Lv.6·Lv.9에는 같은 레벨 보상에 대표 행동 강화도 함께 적용됩니다."
            },
            {
                type: "refactor",
                text: "캐릭터별 레벨 진행표와 진행 스냅샷을 토너먼트, 사냥터, XP 결과, 도감이 함께 사용하도록 정리했습니다."
            }
        ]
    },
    {
        version: "0.24.45",
        date: "2026-07-12",
        title: "v0.24.45 대표 행동 강화 기반을 추가합니다",
        changes: [
            {
                type: "feature",
                text: "Lv.3, Lv.6, Lv.9에 각 캐릭터의 대표 행동을 강화하는 보상을 추가했습니다."
            },
            {
                type: "feature",
                text: "Hero의 축적·방출과 Phantom의 표식 연계를 포함한 12개 캐릭터 강화가 토너먼트와 사냥터에 적용됩니다."
            }
        ]
    },
    {
        version: "0.24.44",
        date: "2026-07-12",
        title: "v0.24.44 아처가 이동을 예측해 쏩니다",
        changes: [
            {
                type: "feature",
                text: "아처가 상대의 이동을 예측해 화살을 조준합니다. 화살은 발사 뒤에도 직선으로 날아가 회피와 벽 반사가 유지됩니다."
            },
            {
                type: "feature",
                text: "2회 연속 빗나가면 산탄 대신 매 발을 다시 예측 조준하는 3연발을 발사합니다."
            }
        ]
    },
    {
        version: "0.24.43",
        date: "2026-07-12",
        title: "v0.24.43 갈증이 위기 대응 숙련도로 바뀝니다",
        changes: [
            {
                type: "refactor",
                text: "갈증은 4초마다 준비되며, 다음 충돌에서 준 실제 피해의 3/6/9%를 회복합니다. 잃은 HP가 많을수록 회복 효율은 최대 2배까지 증가합니다."
            }
        ]
    },
    {
        version: "0.24.42",
        date: "2026-07-12",
        title: "v0.24.42 숙련도 보정이 최종 수치에 적용됩니다",
        changes: [
            {
                type: "refactor",
                text: "숙련도 스탯 보정은 레벨, 스탯 배분, 장비 고정 수치가 모두 확정된 뒤 마지막에 퍼센트로 적용됩니다. 도감과 도감 완성 업적도 실제 숙련도 단계와 같은 상태를 사용합니다."
            },
            {
                type: "fix",
                text: "역효과였던 충격량 보정은 최종 충돌 피해 보정으로 바꾸고, 갈증 숙련도는 실제 충돌 피해 기준 회복이 발동하도록 수정했습니다."
            }
        ]
    },
    {
        version: "0.24.41",
        date: "2026-07-12",
        title: "v0.24.41 장비 옵션이 공통 가치 비율을 사용합니다",
        changes: [
            {
                type: "refactor",
                text: "장비 기본 옵션의 HP, 공격, 방어, 속도 수치를 공통 가치 포인트와 스탯 가치 비율로 관리하도록 정리했습니다. 이후 장비 옵션 수치는 한 비율 테이블에서 조정됩니다."
            }
        ]
    },
    {
        version: "0.24.40",
        date: "2026-07-12",
        title: "v0.24.40 레벨 보상이 스탯 배율을 받습니다",
        changes: [
            {
                type: "fix",
                text: "레벨업 스탯은 캐릭터 기본 수치에 먼저 더해진 뒤 배분 스탯의 퍼센트 보정을 받도록 수정했습니다. 장비 수치는 그 뒤에 고정값으로 더해집니다."
            }
        ]
    },
    {
        version: "0.24.39",
        date: "2026-07-12",
        title: "v0.24.39 레벨 보상이 전투 공에 적용됩니다",
        changes: [
            {
                type: "refactor",
                text: "레벨 보상을 실제 전투 공에 적용하는 효과 핸들러 구조로 정리했습니다. 토너먼트와 사냥터에서 같은 캐릭터 성장 보정이 적용되며, 결과 패널에서 이번에 얻은 보상을 확인할 수 있습니다."
            }
        ]
    },
    {
        version: "0.24.38",
        date: "2026-07-12",
        title: "v0.24.38 상자방에 전투 승리 문구가 남지 않습니다",
        changes: [
            {
                type: "fix",
                text: "상자방 이벤트가 열릴 때 직전 전투의 승리 문구 대신 현재 층의 상자방 문맥을 표시하도록 수정했습니다."
            }
        ]
    },
    {
        version: "0.24.37",
        date: "2026-07-12",
        title: "v0.24.37 사냥터 이벤트를 상태 전이로 분리합니다",
        changes: [
            {
                type: "refactor",
                text: "사냥터 이벤트는 클래스별 payload와 런 전이를 소유하고, 원정 상태는 명시적인 phase로 현재 상호작용 단계를 기록하도록 정리했습니다."
            }
        ]
    },
    {
        version: "0.24.36",
        date: "2026-07-12",
        title: "v0.24.36 사냥터 이동 처리를 분리합니다",
        changes: [
            {
                type: "refactor",
                text: "사냥터 이동 루프에서 조우와 이벤트별 처리를 분리해, 새 이벤트를 추가할 때 전용 처리기를 등록하도록 정리했습니다."
            }
        ]
    },
    {
        version: "0.24.35",
        date: "2026-07-12",
        title: "v0.24.35 상자방 보상을 직접 확인합니다",
        changes: [
            {
                type: "feature",
                text: "상자방에서 등급 색상의 상자를 확인한 뒤 계속 전진을 눌러 다음 층 이동을 이어갈 수 있습니다. 미확보 전리품도 함께 표시됩니다."
            }
        ]
    },
    {
        version: "0.24.34",
        date: "2026-07-12",
        title: "v0.24.34 사냥터 첫 이동 UI를 확정한 뒤 진행합니다",
        changes: [
            {
                type: "fix",
                text: "사냥터는 1층에서 시작하며, 첫 이동 UI가 화면에 표시된 뒤에만 다음 층 판정을 시작하도록 수정했습니다."
            }
        ]
    },
    {
        version: "0.24.33",
        date: "2026-07-12",
        title: "v0.24.33 토너먼트 종료 확인 버튼을 통일합니다",
        changes: [
            {
                type: "fix",
                text: "토너먼트 종료 뒤에도 사냥터와 동일하게 확인 버튼을 표시하며, 누르면 캐릭터를 다시 고를 수 있는 초기 화면으로 돌아갑니다."
            }
        ]
    },
    {
        version: "0.24.32",
        date: "2026-07-12",
        title: "v0.24.32 상인 선택지를 더 편하게 읽을 수 있습니다",
        changes: [
            {
                type: "fix",
                text: "모바일 상인 선택지가 눌리거나 잘리지 않도록 카드 폭과 여백을 조정하고, 각 선택지는 충분한 높이를 유지한 채 목록만 스크롤되게 했습니다."
            }
        ]
    },
    {
        version: "0.24.31",
        date: "2026-07-12",
        title: "v0.24.31 수류탄 초탄 퓨즈도 쿨다운 기준으로 맞춥니다",
        changes: [
            {
                type: "feature",
                text: "수류탄 초탄은 현재 쿨다운의 20% 뒤 폭발합니다. 기본 쿨다운 3.5초에서는 0.7초입니다."
            }
        ]
    },
    {
        version: "0.24.30",
        date: "2026-07-12",
        title: "v0.24.30 수류탄 마지막 퓨즈가 쿨다운과 맞춰집니다",
        changes: [
            {
                type: "feature",
                text: "수류탄 묶음의 마지막 탄은 그레네이드 볼의 현재 쿨다운과 같은 시간 뒤 폭발합니다. 쿨다운 감소도 함께 반영됩니다."
            }
        ]
    },
    {
        version: "0.24.29",
        date: "2026-07-12",
        title: "v0.24.29 수류탄 탄속과 근접 신관을 속도에 연동합니다",
        changes: [
            {
                type: "feature",
                text: "수류탄 탄속이 그레네이드 볼의 현재 기본 속도에 연동됩니다. 폭발권 진입 뒤 퓨즈는 기본 3배, 고속일수록 최대 6배 빠르게 줄어듭니다."
            },
            {
                type: "fix",
                text: "그레네이드 볼의 캐릭터 설명을 실제 360도 무작위 3~5발 발사 규칙에 맞췄습니다."
            }
        ]
    },
    {
        version: "0.24.28",
        date: "2026-07-12",
        title: "v0.24.28 수류탄 폭발 판정이 이펙트와 맞춰집니다",
        changes: [
            {
                type: "fix",
                text: "수류탄 폭발의 실제 피해 범위를 이펙트 외곽에 맞춰 넓혀, 보이는 범위 안의 적이 빗나가지 않게 했습니다."
            }
        ]
    },
    {
        version: "0.24.27",
        date: "2026-07-12",
        title: "v0.24.27 결과 확인 뒤 초기 화면으로 돌아갑니다",
        changes: [
            {
                type: "fix",
                text: "토너먼트와 사냥터 결과에서 확인을 누르면 결과 화면과 진행 상태를 정리하고 캐릭터를 다시 고를 수 있게 했습니다."
            }
        ]
    },
    {
        version: "0.24.26",
        date: "2026-07-12",
        title: "v0.24.26 고속 수류탄의 근접 폭발을 보정합니다",
        changes: [
            {
                type: "fix",
                text: "수류탄이 상대 폭발권을 빠르게 통과해도 퓨즈가 탄속에 맞춰 단축되도록 수정했습니다."
            }
        ]
    },
    {
        version: "0.24.25",
        date: "2026-07-12",
        title: "v0.24.25 사냥터 종료 뒤 UI 상태를 초기화합니다",
        changes: [
            {
                type: "fix",
                text: "사냥터를 마치고 초기 화면으로 돌아올 때 이전 층·상인·전리품 UI가 남지 않도록 수정했습니다."
            }
        ]
    },
    {
        version: "0.24.24",
        date: "2026-07-12",
        title: "v0.24.24 상인 전진 버튼을 고정합니다",
        changes: [
            {
                type: "fix",
                text: "모바일 상인 화면에서 선택지만 스크롤되고 계속 전진 버튼은 항상 하단에 보이도록 수정했습니다."
            }
        ]
    },
    {
        version: "0.24.23",
        date: "2026-07-12",
        title: "v0.24.23 모바일 상인 선택지를 끝까지 볼 수 있습니다",
        changes: [
            {
                type: "fix",
                text: "모바일 전투 화면에서 방랑 상인 선택지가 잘리지 않도록 상인 패널을 내부 스크롤로 바꿨습니다."
            }
        ]
    },
    {
        version: "0.24.22",
        date: "2026-07-12",
        title: "v0.24.22 시작 버튼의 비활성 사유를 표시합니다",
        changes: [
            {
                type: "fix",
                text: "스탯을 아직 배분하지 않았을 때 게임 시작 버튼에 남은 스탯 수가 표시되도록 수정했습니다."
            }
        ]
    },
    {
        version: "0.24.21",
        date: "2026-07-12",
        title: "v0.24.21 사냥터 맵 선택을 즉시 원정으로 연결합니다",
        changes: [
            {
                type: "fix",
                text: "사냥터에서 맵 카드를 누르면 별도 원정 시작 버튼 없이 바로 전투를 시작하도록 수정했습니다."
            }
        ]
    },
    {
        version: "0.24.20",
        date: "2026-07-12",
        title: "v0.24.20 사냥터 원정 준비를 간결하게 만듭니다",
        changes: [
            {
                type: "fix",
                text: "사냥터 모드에서 이미 선택한 프리뷰 캐릭터를 다시 고르지 않고, 맵 선택 후 바로 원정을 시작하도록 수정했습니다."
            }
        ]
    },
    {
        version: "0.24.19",
        date: "2026-07-12",
        title: "v0.24.19 사냥터 진행 상태를 즉시 반영합니다",
        changes: [
            {
                type: "fix",
                text: "사냥터 전투 중 모바일 화면에 모드 선택과 게임 시작 UI가 남는 문제를 수정했습니다."
            },
            {
                type: "fix",
                text: "방랑 상인에게서 상자를 구매하면 버튼이 즉시 구매 완료 상태로 바뀌도록 수정했습니다."
            }
        ]
    },
    {
        version: "0.24.18",
        date: "2026-07-12",
        title: "v0.24.18 물리 장비 빌드를 추가합니다",
        changes: [
            {
                type: "feature",
                text: "중량은 실제 질량을, 반향은 벽 반사 속도를, 소용돌이는 충돌 각충격을 강화합니다. 세 효과는 별도 피해나 넉백 수치 없이 물리 solver에서 작동합니다."
            }
        ]
    },
    {
        version: "0.24.17",
        date: "2026-07-12",
        title: "v0.24.17 장비 특수 옵션이 전투에 적용된다",
        changes: [
            {
                type: "feature",
                text: "파쇄는 충돌 피해를 강화하고, 순환은 스킬 쿨다운을 줄이며, 갈망은 충돌과 접촉형 스킬 피해를 합산해 2.5초마다 회복합니다."
            },
            {
                type: "feature",
                text: "특수 옵션은 장비 이름의 접미사와 인벤토리 표기에 갈망·파쇄·순환으로 표시됩니다. 같은 특수 옵션을 여러 개 장착하면 가장 높은 수치 하나만 적용됩니다."
            }
        ]
    },
    {
        version: "0.24.16",
        date: "2026-07-12",
        title: "v0.24.16 장비 이름이 핵심 옵션을 알려준다",
        changes: [
            {
                type: "feature",
                text: "새 장비는 가장 가치가 높은 기본 스탯을 이름 앞에 표시합니다. 예: 질풍의 철검, 수호자의 룬 방패."
            },
            {
                type: "feature",
                text: "장비 옵션을 HP·공격·방어·속도의 전투 가치 비율에 맞춰 생성해, 같은 등급의 옵션이 더 공정한 보상이 되도록 조정했습니다."
            }
        ]
    },
    {
        version: "0.24.15",
        date: "2026-07-08",
        title: "v0.24.15 전투원 물리 계층을 배틀 규칙 아래로 분리한다",
        changes: [
            {
                type: "refactor",
                text: "Simulation과 BattleSimulation 사이에 FighterPhysicsSimulation 계층을 추가했습니다. 전투원 충돌 탐지, 분리, rigid-body 충돌, 공통 충돌 피드백은 이 계층이 담당하고 BattleSimulation은 데미지, 능력, 결과 판정 같은 게임 규칙을 조립합니다."
            },
            {
                type: "refactor",
                text: "프리뷰 캐릭터 재선택도 FighterPhysicsSimulation을 상속하도록 바꿔 전투와 같은 충돌 흐름을 재사용합니다. 별도 미니 물리 구현이 생기지 않도록 구조를 고정했습니다."
            }
        ]
    },
    {
        version: "0.24.14",
        date: "2026-07-08",
        title: "v0.24.14 프리뷰 재선택 충돌을 전투 물리 피드백으로 맞춘다",
        changes: [
            {
                type: "feature",
                text: "프리뷰 캐릭터 교체 충돌이 전투 물리를 재사용하도록 개선했습니다. 들어오는 볼이 10배 impact로 충돌해 기존 볼이 강하게 튕겨 나가고, 충돌 시 spark/pulse/particle burst/화면 흔들림이 발생합니다."
            },
            {
                type: "refactor",
                text: "프리뷰 재선택 물리 로직을 BattleApp에서 분리해 src/preview/previewReselectSimulation.js 전용 모듈로 이전했습니다. applyDynamicCollisionResponse 등 기존 물리 helper를 재사용합니다."
            },
            {
                type: "fix",
                text: "프리뷰 스왑 중 텍스트 레이블(내 캐릭터, 이름)이 볼을 따라다니지 않도록 완전히 숨기고, 스왑 완료 후 정상 표시됩니다."
            }
        ]
    },
    {
        version: "0.24.13",
        date: "2026-07-08",
        title: "v0.24.13 프리뷰 재선택 확정을 물리 전환 완료 시점으로 늦춘다",
        changes: [
            {
                type: "fix",
                text: "프리뷰 캐릭터 재선택 시 캐릭터/스탯/UI 변경을 물리 전환 애니메이션 완료 시점으로 미뤄, 교체 중 두 번째 탭이 dead tap으로 느껴지지 않도록 개선했습니다."
            },
            {
                type: "feature",
                text: "전환 중 탭 하면 큐에 저장되었다가 현재 전환이 끝난 후 자동으로 다음 캐릭터를 선택합니다."
            }
        ]
    },
    {
        version: "0.24.12",
        date: "2026-07-08",
        title: "v0.24.12 프리뷰 캐릭터 재선택을 물리 상호작용으로 만든다",
        changes: [
            {
                type: "feature",
                text: "시작 화면에서 프리뷰 캐릭터를 클릭/탭하면 새 캐릭터가 무작위 방향에서 날아와 기존 캐릭터를 물리적으로 밀쳐내고 대표 캐릭터를 교체합니다. 전환 중에는 충돌과 속도 교환이 실제 물리처럼 동작합니다."
            },
            {
                type: "feature",
                text: "캐릭터 교체 시 스탯 배분이 자동으로 초기화됩니다. 토너먼트나 사냥터 진행 중에는 교체가 차단됩니다."
            }
        ]
    },
    {
        version: "0.24.11",
        date: "2026-07-08",
        title: "v0.24.11 WallSlam 회전을 물리 기반 angular impulse로 전환",
        changes: [
            {
                type: "refactor",
                text: "벽 충돌 슬램(WallSlam) 효과의 회전이 시각 보간(spinRotation) 대신 물리 angular impulse로 동작하도록 재작성했습니다. 회전하는 볼이 벽에 부딪힐 때 속도와 질량에 비례한 실제 각운동량이 전달되어 물리 일관성이 향상되었습니다. 회전이 비활성화된 볼은 영향을 받지 않습니다."
            }
        ]
    },
    {
        version: "0.24.10",
        date: "2026-07-08",
        title: "v0.24.10 모바일 세팅 화면 스크롤을 패널 내부로 수정",
        changes: [
            {
                type: "fix",
                text: "모바일 세로 모드에서 시작 전 화면이 문서 전체로 스크롤되던 문제를 수정했습니다. 이제 아레나와 시작 버튼 영역은 뷰포트에 고정되고, 장비/스탯 패널만 아래에서 스크롤됩니다."
            }
        ]
    },
    {
        version: "0.24.9",
        date: "2026-07-08",
        title: "v0.24.9 모바일 세팅 화면 스크롤 보정",
        changes: [
            {
                type: "fix",
                text: "모바일 세로 모드의 시작 전 화면에서 아레나와 플레이어 패널 전체가 문서 스크롤로 자연스럽게 내려가도록 수정했습니다."
            }
        ]
    },
    {
        version: "0.24.8",
        date: "2026-07-08",
        title: "v0.24.8 플레이어 패널 모바일 스크롤 + 사냥터 스탯 반영",
        changes: [
            {
                type: "fix",
                text: "모바일 세로 모드에서 플레이어 패널 하단 스탯 배분 컨트롤에 접근할 수 없던 문제 수정 — 패널 자체 스크롤 영역 명시, 장비 요약 축소, 하단 여백 추가."
            },
            {
                type: "fix",
                text: "사냥터 전투에 플레이어 스탯 배분이 항상 적용되도록 보강하고 회귀 테스트로 검증을 추가했습니다."
            }
        ]
    },
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
                text: "전투 배속 시스템 — 관전 전투 화면을 터치해 x2/x4 배속 전환, 업적 해금 시 사용 가능."
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
