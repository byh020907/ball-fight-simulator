# 결정 기록

## [L1] 2026-07-06 — 충돌 회전 impulse가 각속도에 반영되도록 수정
- 맥락: Codex 사전 확인 결과 `handleFighterCollision()`에서 `_applyCollisionPhysics()`가 먼저 velocity를 반사시킨 후, `_applyAngularCollisionResponse()`가 재계산한 `velAlongNormal >= 0`이 되어 angular response가 항상 early return. 즉 충돌 angular impulse이 단 한 번도 angularVelocity에 반영되지 않던 버그.
- 결정: (1) `_applyCollisionPhysics()` 호출 전에 충돌 전 relative velocity와 velAlongNormal을 미리 계산. (2) 이 pre-collision 값을 `_applyAngularCollisionResponse()`에 전달해 선형 impulse 적용 후에도 올바른 접근 속도 기준으로 회전 impulse 계산. (3) 기존 테스트 `testCollisionProducesAngularImpulse`를 강화 — 비중심 충돌에서 `_accumulatedAngularImpulse` 변화 검증. (4) 신규 `testCollisionAngularImpulseChangesVelocity` — polygon-polygon 비중심 충돌 후 `update()` → `integrateRotation()`까지 거쳐 `angularVelocity`가 실제로 변하는지 검증.
- 영향: `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과
- 미검증: 브라우저에서 polygon 몹 충돌 회전 육안 확인

## [L1] 2026-07-06 — 다각형 몹 회전이 화면에서 보이도록 수정
- 맥락: 다각형 몹의 angle/angularVelocity/body rotate는 구현되어 있었으나, (1) 얼굴이 회전하지 않고 항상 정면을 바라 회전 체감이 거의 없었고, (2) generateMobAppearance(rng)가 angle/angularVelocity를 반환하지 않아 회전값이 rng 재현 불가, (3) createHuntingMobEncounter가 createHuntingMobSpec에 rng를 전달하지 않아 몹 생성 rng 체인이 끊김.
- 결정: (1) drawFace에 this.angle을 전달해 polygon body의 얼굴이 다각형과 함께 회전, circle 캐릭터는 기존 동작 유지. (2) generateMobAppearance(rng)에 angle/angularVelocity 필드 추가, BattleBall 생성자에서 appearance 값 우선 사용. (3) createHuntingMobEncounter가 rng를 createHuntingMobSpec에 전달하도록 수정. 이름표·HP바는 회전시키지 않음. Set-Content 미사용, Node.js 일괄 치환.
- 영향: `src/entities/mobAppearance.js`, `src/entities/battleBall.js`, `src/hunting/huntingMonsters.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`, `docs/hunting-grounds-system.md`
- 검증: `npm test`, `npm run format:check`, `npm run check` 통과
- 미검증: 브라우저에서 polygon 몹 얼굴 회전 육안 확인

## [L1] 2026-07-06 — 물리 디버깅을 위한 ring buffer 기록 추가
- 맥락: 각속도/다각형 충돌 구현 중 NaN/Infinity 또는 이상 충돌이 발생할 때 직전 물리 이벤트를 추적할 수단이 필요. 과도한 finite guard 대신 ring buffer 기반 원인 추적을 우선.
- 결정: (1) `src/physics/PhysicsDebugRingBuffer.js` 신설 — 고정 길이(30) ring buffer, `push(event)`, `toArray()`, `clear()`, capacity 초과 시 오래된 이벤트 제거. (2) `snapshotPhysicsState(entity)` — position/velocity/angle/angularVelocity/torqueAccum 등을 값 복사로 스냅샷. (3) `validatePhysicsState(entity, elapsed)` — position/velocity/angle/angularVelocity NaN/Infinity 검사, 무효 시 ring buffer dump를 console.error로 출력. (4) BattleBall에 `physicsDebug` buffer 연결, `applyImpulse`/`applyTorque`/`applyAngularImpulse` 래퍼로 debug 이벤트 기록, `update()` 종료 시 summary snapshot + validate. (5) BattleSimulation.handleFighterCollision에 collision event 기록 (normal, overlap, contactPoint). (6) 테스트: ring buffer 단독(5종), BattleBall debug(4종), validate(3종) 등 12종.
- 영향: `src/physics/PhysicsDebugRingBuffer.js`, `src/physics/index.js`, `src/entities/battleBall.js`, `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`, `docs/development-rules.md`
- 검증: `npm test` (11개 스위트), `npm run format:check`, `npm run check` 통과
- 미검증: 실제 브라우저 게임플레이 중 물리 디버그 버퍼가 메모리에 미치는 영향

## [L1] 2026-07-06 — 회전 물리를 torque accumulator 기반으로 재설계
- 맥락: 기존 RotationalBody는 applyAngularImpulse가 angularVelocity를 직접 수정하고, torque 개념이 없어 한 프레임에 여러 충돌이 겹칠 때 불안정. 일반적인 2D 물리 엔진의 force→acceleration→velocity→position 흐름에 대응되는 회전 구조 필요.
- 결정: (1) RotationalBody에 torque accumulator(`_accumulatedTorque`), angular impulse accumulator(`_accumulatedAngularImpulse`), `_inverseMomentOfInertia`(solid disk I=0.5mr²), `angularDamping=0.98` 도입. (2) `applyTorque`는 누적만, `applyAngularImpulse`도 누적만 하고 `integrateRotation`에서 torque→angularAccel→velocity→damping→angle 흐름으로 일괄 처리 후 누적 초기화. (3) `_applyAngularCollisionResponse` 신설: 충돌 contactPoint와 normal의 2D cross로 torque 계산 → `applyAngularImpulse`로 누적. (4) `resolveFighterShapeCollision`에 `contactPoint` 추가 (circle-circle: 중첩 중점, circle-polygon: 최근접 vertex, polygon-polygon: 중심 중점). (5) 테스트: torque accumulation, multi-torque same-frame, torque+impulse 동시, polygon update integration, collision angular impulse 안전성 등 6종 추가 + 기존 RotationalBody 테스트 갱신.
- 영향: `src/physics/RotationalBody.js`, `src/physics/CollisionShape.js`, `src/simulation/battleSimulation.js`, `src/entities/battleBall.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (10개 스위트), `npm run format:check`, `npm run check` 통과
- 미검증: 브라우저에서 polygon 몹의 torque 기반 회전 + 다중 충돌 누적 육안 확인

## [L1] 2026-07-06 — 다각형 몹 충돌을 회전 shape 기반으로 전환
- 맥락: 다각형 몹(사냥터)은 외형만 다각형이고 충돌은 원형이어서, 시각적으로 polygon에 닿지 않았는데 충돌하는 문제. RotationalBody mixin이 이미 존재하나 BattleBall에 미적용.
- 결정: (1) BattleBall에 RotationalBody mixin 추가, polygon 몹은 무작위 angle/angularVelocity 초기화. (2) `_drawPolygonBody`에 `ctx.rotate(this.angle)` 적용, `computeRegularPolygonLocalPoints` 공유 함수로 렌더링-충돌 정합성 확보. (3) `CollisionShape.js`에 `getFighterCollisionShape`, `resolveFighterShapeCollision`, SAT 기반 `_resolvePolygonPolygon`/`_resolveCirclePolygon` 추가. (4) `handleFighterCollision`을 shape 기반으로 교체, SAT normal은 충돌 반응 방향으로, 분리는 SAT normal 방향 + bounding circle 하한 보정. (5) 테스트: circle-circle/polygon-polygon/circle-polygon 분리, 각도별 normal 변화, draw rotate, shape helper, rotation init/integrate 등 11종.
- 영향: `src/entities/battleBall.js`, `src/physics/CollisionShape.js`, `src/physics/index.js`, `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (10개 스위트), `npm run format:check`, `npm run check`, `node scripts/huntingUserScenario.mjs` 통과
- 미검증: 실제 브라우저에서 polygon 몹 회전 + shape 충돌 육안 확인

## [L1] 2026-07-06 — 사냥터 초반 선택 이벤트에서 진행 UI가 막히지 않게 정리
- 맥락: 뱀파이어 박쥐 투사체가 타겟을 바라보며 날아가서 어색함. 박쥐는 자신의 velocity 방향을 보는 것이 자연스러움.
- 결정: `BatProjectile.update()`에서 `this.angle`을 항상 `Math.atan2(this.velocity.y, this.velocity.x)`로 설정. 타겟 유무에 따른 분기 제거.
- 영향: `src/entities/batProjectile.js`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과
- 미검증: 실제 브라우저에서 박쥐 떼 방향 육안 확인

## [L1] 2026-07-06 — 사냥터 초반 선택 이벤트에서 진행 UI가 막히지 않게 정리
- 맥락: 첫 번째나 두 번째 층에서 선택 이벤트(포탈/방랑 상인)가 발생하면 route 진행 상태가 남아 선택 UI가 가려지거나 진행이 막힘. `huntingMoveTo > 0`이 stale 상태로 남아 route UI가 계속 표시되고 choice UI와 겹치는 문제.
- 결정: (1) `_stopHuntingMoveForChoice()`에서 route 상태 완전 초기화(huntingMoveFrom/MoveTo/Step=0, MoveMax=10). (2) game-overlay.html의 route 표시 조건을 `huntingMoving || huntingMoveTo > 0` → `huntingMoving`으로 변경 (stale route 방지). (3) `Math.random` mock + `setTimeout` mock으로 첫층 포탈 시나리오 테스트 추가.
- 영향: `src/hunting/huntingManager.js`, `src/components/game-overlay.html`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-06 — 사냥터 이동 구간 표시를 10층 전진 기준으로 고정
- 맥락: 사냥터 이동 UI에서 진행 바는 10층 전진 기준인데 좌우 층 표시는 매 1층 이동의 현재/다음층(7F→8F)으로 바뀌어 의미가 어긋남.
- 결정: `advance()`에서 `routeStartFloor`/`routeEndFloor`/`routeMaxSteps`를 루프 전 한 번 계산. `_setHuntingMoveState`에 `routeStartFloor`/`routeEndFloor` 전달. 95층처럼 끝에 가까우면 routeMaxSteps가 5로 clamp. 중간 정지 시에도 route head는 시작/목표 구간 유지, message만 실제 층 표시.
- 영향: `src/hunting/huntingManager.js`, `tests/regression.mjs`, `docs/hunting-grounds-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-06 — 방어구 하나가 풀세트처럼 보이지 않게 외형을 분리
- 맥락: 천 갑옷 한 벌만 착용했는데 상단/하단 띠 + 좌측 방패가 모두 그려져 마치 풀셋 갑옷처럼 보이는 문제. 아이템 이름에 따라 다른 외형을 보여줘야 함.
- 결정: (1) `inferArmorVariant(item)` 도입 — 아이템 이름 기반 4종 variant 추론 (cloth/vest/shield/plate). `item.visualVariant`가 명시되면 우선. (2) `drawArmorVariant` dispatcher + `drawClothArmor`/`drawVestArmor`/`drawShieldArmor`/`drawPlateArmor` 4종 분리. cloth=얇은 천 띠 1개+측면 주름, vest=가슴 보호대+스트랩, shield=방패 단독, plate=기존 띠×2+방패. (3) 기존 `drawArmor` 삭제. (4) 테스트: 기준선 대비 ellipse 증감 검증, variant 추론 검증, shield/plate variant draw 검증.
- 영향: `src/entities/equipmentVisuals.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-06 — 장비 외형을 게임용 실루엣 원칙에 맞춰 다듬음
- 맥락: 장비 외형이 임시 선화처럼 보이고 완성도가 낮다는 피드백. 2D 게임 캐릭터 가독성 원칙(shape language, silhouette, soft outline)을 조사해 적용.
- 결정: (1) 무기: shaft+cross-guard+blade head 구조로 정착, 외곽선을 `#202020` 대신 `palette.dark`로 변경, blade에 하이라이트 라인 추가. (2) 방어구: 직선 band를 호(arc) 기반으로 변경, shield 내부에 십자 문양 추가, shield fill을 `glow`→`fill`로 변경해 실루엣 강화. (3) 장신구: 금속 받침 링 + 보석 본체 + 하이라이트 3단 구조 유지, 작은 연결 장식 추가. (4) RARITY_COLORS에 `dark` 키 추가(등급별 어두운 외곽선 색상). (5) 불필요한 `strokeEquipmentLine` helper 제거, 각 draw 함수에서 직접 stroke 호출로 가독성 향상.
- 영향: `src/entities/equipmentVisuals.js`, `docs/equipment-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과
- 참고: 80Level shape language, Disney Shape Language, Sprite-AI pixel art guide, Reddit pixel art outline feedback

## [L1] 2026-07-05 — 장비 외형 구체화 (창/장갑 띠/방패/원형 장신구)
- 맥락: 장비를 처음 착용했을 때 단순 선/다각형 조각처럼 보여 캐릭터 얼굴의 이상한 폴리곤으로 오해될 수 있음. 사용자가 샘플로 머리띠/몸띠/방패/창이 붙은 볼 실루엣을 제시.
- 결정: (1) Weapon은 오른쪽 외곽에 장착된 창 형태(손잡이, 창날, 손막이)로 구체화. (2) Armor는 얼굴 중앙을 덮지 않고 상단/하단 장갑 띠와 왼쪽 타원 방패로 표현. (3) Accessory는 마름모 보석 대신 장갑 띠 위의 원형 리벳/보석으로 변경해 얼굴 선과 혼동을 줄임. (4) 장비 draw 테스트를 새 실루엣 호출(weapon line, accessory circle, shield ellipse) 기준으로 갱신.
- 영향: `src/entities/equipmentVisuals.js`, `tests/regression.mjs`, `docs/equipment-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm run format:check`, `npm run check`, `npm test`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 장비 렌더링 가독성 개선 (얼굴 침범 방지 + 슬롯별 시각 언어)
- 맥락: 장비 외형이 캐릭터 얼굴 영역을 가로질러 "이상한 폴리곤"처럼 보이는 문제. terrain polygon 버그가 아니라 장비 배치/형태의 시각 언어 문제.
- 결정: (1) Weapon: 칼날을 몸 중심을 가로지르는 대신 오른쪽 하단(angle=0.75 rad)으로 배치, 손잡이 이중 레일, 칼날 중앙선 추가. (2) Armor: 중앙 대형 육각 방패 대신 어깨 보호대(좌우 상단 호) + 하단 흉갑 호로 분리. (3) Accessory: 4방향 분산 배치(1.28/0.72/0.35/1.65 rad), 연결 링크 추가. (4) drawEquipmentItems에 ctx.save/restore 추가.
- 영향: `src/entities/equipmentVisuals.js`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-05 — terrain/body drawing ctx state 누수 방지 (save/restore)
- 맥락: terrainRenderer, _drawArenaBackground, _drawPolygonBody가 ctx.fillStyle/strokeStyle/lineWidth를 save/restore 없이 변경해 후속 face/equipment drawing에 누수.
- 결정: terrainRenderer의 drawCircleTerrain/drawPolygonTerrain, ui.js의 _drawArenaBackground, battleBall.js의 _drawPolygonBody에 ctx.save()/try-finally/restore() 적용.
- 영향: `src/terrain/terrainRenderer.js`, `src/ui.js`, `src/entities/battleBall.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-05 — 컬렉션 허브 장비 버튼 bridge 참조 오류 수정 + 장착/해제 저장 누락
- 맥락: collection-hub.html의 bridge가 `window.ballFightApp?.bridge` 또는 `window.CollectionHubService`를 참조 → 실제 장비 함수(`equipItem`, `unequipItem` 등)는 `window.BallFightComponentBridge`에만 존재 → Alpine 런타임 에러 `bridge.equipItem is not a function`.
- 결정: (1) bridge 참조 우선순위를 `window.BallFightComponentBridge`로 교정. (2) `componentBridge.js`의 `equipItem`/`unequipItem`에 `savePlayerProfile()` 호출 추가 (다른 장비 함수들과 일관성 확보, 새로고침 후 장착 상태 유지). (3) bridge 장비 함수 존재 여부 및 equip/unequip 저장 검증 테스트 추가.
- 영향: `src/components/collection-hub.html`, `src/componentBridge.js`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`, `npm run format:check` 통과

## [L1] 2026-07-05 — terrain polygon + rotational body 기반 확장
- 맥락: 기존 terrain 시스템이 circle shape만 지원해 확장성이 부족. polygon 충돌/렌더링과 회전 물리 mixin을 추가해 범용 shape 기반 구조로 정리.
- 결정: (1) `TERRAIN_SHAPES.POLYGON` 추가, terrain 데이터 모델에 `points` 배열, `angle` 필드 지원. (2) `RotationalBody` mixin 신설 (`src/physics/RotationalBody.js`): angle, angularVelocity, applyAngularImpulse, integrateRotation. `PhysicsBody`와 분리해 회전 가능한 객체만 선택 적용 가능. (3) `CollisionShape` helper 신설 (`src/physics/CollisionShape.js`): getWorldPolygonPoints, polygonBoundingRadius, resolvePolygonTerrainCollision (SAT 기반 circle-polygon). (4) terrainCollision/terrainRenderer를 shape dispatcher로 변경. (5) cave terrain factory에서 홀수 층에 polygon 1개 포함 생성 (4~6 vertex convex polygon). (6) concave polygon, projectile collision, pathfinding, 동적 회전 장애물은 후속 과제로 명시.
- 영향: `src/physics/RotationalBody.js`(신규), `src/physics/CollisionShape.js`(신규), `src/physics/index.js`, `src/terrain/terrainConfig.js`, `src/terrain/terrainFactory.js`, `src/terrain/terrainCollision.js`, `src/terrain/terrainRenderer.js`, `tests/regression.mjs`, `docs/development-rules.md`, `docs/hunting-grounds-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`(116파일), `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 사냥터 실제 지형 시스템 1차 구조 (cave 암벽 장애물)
- 맥락: 사냥터 맵을 단순 배경에서 실제 지형으로 확장하기 위한 기반 필요. 1차로 cave stage에 원형 암벽 장애물을 추가하고 fighter-terrain 충돌을 구현.
- 결정: (1) `src/terrain/` 모듈 신설 — config(TERRAIN_SHAPES/TYPES), factory(`createHuntingTerrain`), collision(`resolveTerrainCollision`), renderer(`drawTerrain`). (2) cave stage에만 3~5개 원형 암벽 생성, stageId+floor 기반 결정론적 배치, spawn 영역 회피. forest/desert는 빈 배열. (3) `BattleSimulation` constructor에 `terrain` 옵션 추가, `Simulation.keepInsideArena()`에서 `resolveTerrainCollisions()` 호출. (4) `ArenaRenderer`에서 배경과 border 사이에 terrain draw. (5) coincident center fallback 처리 (nx=1, ny=0). 투사체 충돌과 pathfinding은 후속 과제로 명시.
- 영향: `src/terrain/`(신규 5파일), `src/simulation/simulation.js`(terrain collision), `src/simulation/battleSimulation.js`(terrain 옵션), `src/app.js`(terrain 전달), `src/hunting/huntingManager.js`(createHuntingTerrain 호출), `src/ui.js`(drawTerrain), `tests/regression.mjs`(hunting-terrain 테스트), `docs/hunting-grounds-system.md`(§2.3), `SESSION-HANDOFF.md`
- 검증: `npm test` (9개 스위트), `npm run check`(114파일), `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 사냥터 stage 배경 밝기 조정 (이름표 가독성 개선)
- 맥락: cave(`#4a4543`) 배경이 이름표 `#444444`와 대비 1.03:1로 거의 안 보이고, forest 줄무늬도 이름표와 대비 부족. desert는 비교적 괜찮았으나 전체적으로 패턴이 너무 진해 이펙트를 방해함.
- 결정: cave base `#4a4543→#9a928b`(대비 4.5:1), crack `#3d3836→#7f7770`, mineral `#5c5654→#b5ada4`. forest base `#7a9a5c→#9fbd7a`(대비 5.5:1), bush `#5d8040→#89aa66`, stripe `#4a6930→#78965b`. desert base `#d4b88c→#dcc9a3`, ripple `#c4a67a→#ccb78e`, grain `#bfa070→#c4a87a`. 인덱스 루프를 `Array.from`+`for...of`로 변환(프로젝트 코딩 규칙 준수). 이름표/HP바/이펙트 로직은 변경하지 않음.
- 영향: `src/ui.js`(3종 배경 색상+루프 스타일), `docs/hunting-grounds-system.md`(밝은 팔레트 언급), `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 사냥터 스테이지 선택 UI + stage theme 배경 렌더링
- 맥락: 동굴/숲/사막 스테이지 데이터가 이미 존재하나 유저가 선택할 UI가 없고, 전투 캔버스도 흰색 단일 배경이라 맵 차이를 체감할 수 없었음.
- 결정: (1) `showCharacterSelect()` 팝업에 `getUnlockedHuntingStageIds()` 기반 stage 선택 버튼 추가, 선택 시 `profile.hunting.selectedStageId` 갱신 후 `savePlayerProfile()`. 해금된 stage만 표시, 선택된 stage는 `.active` 하이라이트. (2) `BattleSimulation` constructor options에 `arenaTheme` 추가, `ArenaRenderer._drawArenaBackground()`에서 theme별 Canvas 2D 패턴 렌더링 — cave(암석 균열+광물), forest(덤불+나무 그림자), desert(모래결+모래알). unknown/null theme는 기본 밝은 회색 fallback. (3) `HuntingManager._startFloorBattle()`에서 stage theme를 `app.startMatch()`로 전달. (4) CSS: `.hunting-stage-select`, `.hunting-stage-btn.active` 등 스타일 추가.
- 영향: `src/hunting/huntingManager.js`(stage 선택 UI, theme 전달), `src/simulation/battleSimulation.js`(arenaTheme 옵션), `src/ui.js`(_drawArenaBackground, 3종 테마 메서드), `src/app.js`(arenaTheme 전달), `src/hunting/huntingConfig.js`(stage.theme 소스), `src/styles.css`(stage UI CSS), `tests/regression.mjs`(hunting-stage 테스트), `docs/hunting-grounds-system.md`(§2.2), `SESSION-HANDOFF.md`
- 검증: `npm test` (8개 스위트), `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 저HP 포탈 확률 보정 + 포탈 거부 억제 시스템
- 맥락: HP가 낮을 때 귀환 기회를 더 자주 제공하고, 포탈을 거부하면 일정 기간 포탈 반복을 억제하는 장치 필요.
- 결정: (1) `HUNTING_PORTAL_DECLINE` 상수 추가 (INITIAL_FLOORS=5, HP_MULT: [≥50%:×1.0, ≥30%:×1.8, <30%:×3.0]). (2) `getHuntingPortalWeightMultiplier(hpRatio, portalDeclineFloors)`로 포탈 가중치 계산 — HP 낮을수록 높고, decline 중이면 ×1.0 고정. (3) `rollWeightedEventType()`로 균등→가중치 기반 이벤트 선택 전환. (4) `advanceHuntingRun()`이 `portalDeclineFloors`를 1씩 감소, `hpRatio`를 context로 전달. (5) `HuntingManager.advance()` 시작 시 이전 이벤트가 PORTAL이면 `portalDeclineFloors=5` 설정. (6) run 상태에 `portalDeclineFloors` 필드 추가 (기본 0).
- 영향: `src/hunting/huntingConfig.js`(HUNTING_PORTAL_DECLINE), `src/hunting/huntingEncounters.js`(weighted event selection, getHuntingPortalWeightMultiplier, context 파라미터), `src/hunting/huntingState.js`(portalDeclineFloors, hpRatio 전달), `src/hunting/huntingManager.js`(portal decline 감지), `tests/regression.mjs`(hunting-portal 테스트 그룹), `docs/hunting-grounds-system.md`(§7.2), `SESSION-HANDOFF.md`
- 검증: `npm test` (7개 스위트), `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — combat relief 적용 순서 수정 (판정 전 감소 → 판정 후 감소)
- 맥락: 전투 직후 첫 층에 relief=2로 판정되는 버그. `advanceHuntingRun()`이 relief를 먼저 1 감소시킨 뒤 `rollHuntingFloorOutcome()`에 넘겨, 가장 강한 완충 단계(relief=3)를 건너뜀.
- 결정: 판정 시점에는 현재 `run.combatReliefFloors` 값을 그대로 사용하고, 반환 run에만 1 감소한 값을 저장. 테스트로 rng=0.17을 사용해 relief=3에서 COMBAT이 아닌 EVENT가 나오는지 검증. `huntingManager.js`의 미사용 `startFloor` 변수 제거.
- 영향: `src/hunting/huntingState.js`(advanceHuntingRun 순서), `src/hunting/huntingManager.js`(미사용 변수 제거), `tests/regression.mjs`(판정 순서 검증 추가)
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 전투 직후 확률 완충 시스템 + 이동 UI stale floor 버그 수정
- 맥락: (1) 사냥터 전투가 너무 자주 발생해 연속 전투 피로감 크다는 제보. (2) 전투 후 재전진 시 UI가 이전 전투 층을 기준으로 표시되는 버그.
- 결정: (1) `HUNTING_COMBAT_RELIEF` 상수 도입 (INITIAL_FLOORS=3). 전투 승리 후 `recordHuntingFloorResult(..., combatCleared: true)`로 relief 설정. `getHuntingFloorChances(floor, combatReliefFloors)`가 완충 단계에 따라 combat×0.35~0.75, event+(감소분×0.55~0.7)로 조정. `advanceHuntingRun()`이 층 이동마다 relief 1 감소. 100층은 완충 무시. (2) `HuntingManager.advance()`에서 `startFloor` 대신 `this._run.floor` 기준으로 UI 표시하도록 수정.
- 영향: `src/hunting/huntingConfig.js`(HUNTING_COMBAT_RELIEF 상수), `src/hunting/huntingEncounters.js`(getHuntingFloorChances/rollHuntingFloorOutcome 확장), `src/hunting/huntingState.js`(recordHuntingFloorResult/advanceHuntingRun), `src/hunting/huntingManager.js`(UI stale floor 수정, combatCleared 전달), `tests/regression.mjs`(hunting-relief 테스트 그룹), `docs/hunting-grounds-system.md`(§6.1 완충 규칙)
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 사냥터 버그 2건 수정: 첫 우승 후 버튼 미노출 / 이동 멈춤 혼동
- 맥락: 사용자 제보로 발견된 버그 2건. (1) 첫 토너먼트 우승 후 사냥터 버튼이 새로고침 전까지 나타나지 않음. (2) 사냥터 10층 전진이 2층에서 멈춘 것처럼 보이고, 다음 행동을 알려주지 않아 혼란.
- 결정: (1) `UIController.renderTournament()`에서 챔피언 결정 시 `tournamentActive = !tournament.champion`(false)로 설정하고, `showTournamentChampion()`에서 `refreshPlayerSetup()`을 호출해 `huntingAvailable`을 즉시 재계산. (2) `advance()`에 try-catch 안전장치 추가해 `_moving` 플래그 고착 방지. (3) 전투 승리 후 `huntingMoveMessage`에 "10층 전진 가능" 메시지 추가. (4) 포탈/상인 이벤트에서 `huntingLootSummary`로 현재 상태와 가능한 행동 표시. (5) `game-overlay.html`에 `.hunting-choice-hint` 요소 추가해 이동 상태 메시지를 선택 영역에서도 표시.
- 영향: `src/ui.js`(renderTournament 조건부), `src/app.js`(showTournamentChampion), `src/hunting/huntingManager.js`(try-catch, 메시지), `src/components/game-overlay.html`(hint 요소), `tests/regression.mjs`(tournamentActive/available 검증)
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-05 — 사냥터 100층 스테이지 원정 구조 구현
- 맥락: Codex가 사냥터 패턴 강화 구현을 일부 진행하다 중단. partial diff를 읽고 이어서 완성.
- 결정: (1) 사냥터 100층 구조 확정 — 시작 0층, 10층 전진 시 1층씩 이동, 전투/선택형이벤트/포탈/100층보스에서 정지, 빈층은 자동 진행. (2) `advance()`를 async 10-step 루프로 재작성, 층당 350ms 이동 애니메이션. (3) 포탈에서만 귀환 가능 (`canRetreatFromHuntingRun`), 포탈 지나치면 귀환 권한 소멸. (4) 새 이벤트 4종: portal(귀환 가능), wandering_merchant(정지), boon(파편 즉시), mishap(HP 손실). (5) 동굴/숲/사막 3스테이지, 100층 보스 처치 시 다음 스테이지 해금. (6) `rollHuntingFloorOutcome`으로 층 판정 (empty/combat/event/final_boss). (7) 테스트: 100층 구조, portal 전용 귀환, floor outcome, stage 해금, gameOverlay store 검증 완료.
- 영향: `src/hunting/huntingManager.js`(advance async 루프), `src/hunting/huntingState.js`(stage/portal), `src/hunting/huntingEncounters.js`(rollHuntingFloorOutcome), `src/hunting/huntingConfig.js`(100층/스테이지/이벤트), `src/components/game-overlay.html`(이동 UI/포탈 버튼), `src/playerProfile.js`(stage 해금), `src/ui.js`(store 초기값), `index.html`(V=0.24.5), `src/patchNotes.js`(v0.24.5), `tests/regression.mjs`(신규 100층 테스트), `scripts/huntingUserScenario.mjs`(12층 시나리오)
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과

## [L1] 2026-07-04 — 인라인 Alpine UI 5종 컴포넌트화 + ES module 이중 import 버그 수정
- 맥락: 남은 인라인 Alpine 패널(game-overlay, start-button, hunting-button, battle-log, fighter-strip)을 `src/components/<name>.html` 단일 HTML 컴포넌트로 분리. 컴포넌트화 후 액션 선택 팝업 클릭 불가 + 배틀 로그 위치 이상 버그 2건 발견.
- 결정: (1) game-overlay/start-button/hunting-button/battle-log/fighter-strip 5종 컴포넌트 생성 — 자체 `x-data` + `Alpine.reactive()` 상태 + `Alpine.store()` 브릿지 + scoped CSS. (2) 배틀 로그 `position: fixed` 누락 복구. (3) 액션 선택 팝업 클릭 버그 근본 원인: `index.html`에서 `?v=${V}` 캐시 버스팅으로 import한 module과 `app.js`에서 static import한 module이 다른 instance가 되어 module-level `_resolve` 변수가 공유되지 않음. (4) 수정: `_resolve`를 module-level 변수 → `Alpine.store("actionPicker")._resolve`에 저장. (5) 액션 선택기 `@click`을 `$dispatch('pick-action')` 이벤트 위임으로 변경 (x-for 내부 스코프 우회). (6) `docs/development-rules.md`에 "ES Module import 일관성 규칙" 섹션 추가.
- 영향: `src/components/game-overlay.html`(신규), `src/components/start-button.html`(신규), `src/components/hunting-button.html`(신규), `src/components/battle-log.html`(신규), `src/components/fighter-strip.html`(신규), `src/actionPicker.js`(Alpine store _resolve), `src/components/action-picker.html`($dispatch), `index.html`(스토어 초기화 6종), `src/ui.js`(store 브릿지 메서드), `src/app.js`(showTransientOverlay), `src/hunting/huntingManager.js`(store 브릿지), `src/styles.css`(CSS 5블록 제거), `docs/development-rules.md`(ES Module import 규칙 추가)
- 검증: `npm test`, `npm run format:check` 통과

## 현재 기준 요약 (2026-07-05)
- 컴포넌트 파일 구조: `src/components/<name>.html` (플랫, 폴더 없음), 9개 컴포넌트
- **사냥터 100층 구조**: 시작 0층, 10층 전진 루프, 전투/포탈/상인/챔피언에서 정지, 빈층/축복/함정/휴식/상자/제단은 자동 진행
- **3스테이지**: 동굴→숲→사막, 100층 보스 처치 시 해금
- **포탈 귀환**: 포탈 이벤트에서만 귀환 가능, 포탈 지나치면 권한 소멸
- 컴포넌트 목록: `<xp-reward-panel>`, `<xp-progress-bar>`, `<popup-dialog>`, `<toast-notification>`, `<action-picker>`, `<patch-notes>`, `<collection-hub>`, `<player-panel>`, `<tournament-bracket>`
- 컴포넌트 패턴: 자체 `x-data` 스코프 + `Alpine.reactive()` 클로저 상태 + `Alpine.store()` 데이터 브릿지 + scoped CSS (`[data-v-xxxxx]` 선택자 프리픽스)
- **Alpine.store()는 절대 `null`을 값으로 설정하지 않음** — `Object.getOwnPropertyDescriptors(null)` TypeError 방지를 위해 항상 `{ visible: false, ... }` 객체 사용
- PopupService: `Alpine.store('popupDialog')` 기반, `close()` 정적 메서드 추가됨
- 사냥터 MVP: 캐릭터 선택 → 층별 BattleSimulation 1v1 → HP 캐리오버 → 귀환/전진 선택 → 랜덤 이벤트(휴식지/상자방/저주받은 제단/챔피언 난입) → 패배/귀환 시 프로필 병합. 액션 선택은 `skipActionPick: true`로 스킵
- 사냥터 상자: 5등급 비용/보상 테이블 연결 완료. 해조각은 즉시 반영, HP 회복/임시 스탯은 deferred effect payload로 반환
- 사냥터 오버레이 내 버튼은 `.overlay { pointer-events: none }` 영향으로 클릭 안 됨 → `.hunting-choice-buttons { pointer-events: auto }` 필수
- 검증 완료: `npm test`, `npm run check`, `npm run format:check` 통과
- 인라인 Alpine 패널 0개, 모든 패널/오버레이/모달은 컴포넌트화 완료
- **player-panel**: $dispatch 이벤트 패턴 (`adjust-stat`, `random-allocation`, `reset-allocation`, `adjust-challenge-level`, `open-collection-hub`)으로 부모 appStore와 통신. `id="playerFaceCanvas"`는 document.getElementById로 접근 가능
- **tournament-bracket**: aside.tournament-panel을 root로 포함, `state.visible`로 setup-hidden 제어
- 다음 우선순위: 사냥터 deferred effect 적용 UI/런 시작 연결, PPO 학습 결과 저장 구조, Time Warp 재학습/Dash 밸런스 검토

## [L2] 2026-07-02 — 보상 3축 설계 + 액션별 가중치 + 게임 통합 완료
- 배경: 구버전 모델(승패만 보상)이 스팸 문제. HP weight만으로는 방어형 액션 불이익.
- 결정: (1) 보상 = 승패 ±1 + 액션HP피해×0.3 - 내HP손실×0.15 - 사용횟수×0.02 (2) 액션 타입별 가중치 맵: 공격형(shockwave 0.5/0.1), 방어형(evade 0.1/0.5), 유틸형(rush 0.15/0.15) (3) 훈련 0.5초 간격, 게임 매 틱 평가 (4) 이펙트 _executeAction으로 통합 (5) pendingActions 큐화 (6) TimeWarp 시전자별 독립 타이머
- 영향: `scripts/rl/train.mjs`, `src/simulation/aiActionController.js`, `src/simulation/battleSimulation.js`, `src/app.js`, `src/clickActions.js`, `scripts/benchmark.mjs`, `src/ai/rlPolicy.js`

## [L1] 2026-06-29 — RL PPO 학습 파이프라인 완성
- 맥락: AI 액션 canAIUse 수동 튜닝 한계 → PPO로 캐릭터×액션 조합별 최적 사용 확률 자동 학습
- 결정: (1) PPO Actor-Critic (16→16→1 Bernoulli 정책), GAE, mini-batch SGD로 `scripts/rl/train.mjs` 구현 (2) 피처 16차원 순수 벡터 (HP비율, 위치벡터, 속도벡터, 투사체벡터, 경과시간, 캐릭터 인덱스) — 파생값/불리언 플래그 없음 (3) `--help` 도움말, 학습 완료 시 `scripts/rl/report_*.json` 자동 저장 (4) `node scripts/rl/train.mjs` 한 줄로 전체 실행
- 영향: `scripts/rl/train.mjs`, `scripts/rl/features.js`, `scripts/rl/policyNetwork.js`, `scripts/rl/normalizer.js`, `docs/rl-optimization-guide.md`

## [L2] 2026-06-28 — AI 액션 시스템 간소화 + Shockwave 버프
- 배경: canAIUse가 대부분 거리 제한으로 차단되어 AI가 아무 액션도 못 쓰는 문제 → RL 학습 위해 모든 액션 허용 필요
- 결정: (1) 모든 `canAIUse`가 `true` 반환, 기존 로직은 주석 보존 (2) `_pickAction()` 제거, `selectAction()`에서 캐릭터 타입 기반 가중치 랜덤 선택 (3) Rush/TimeWarp/Counter/ProjectileGuard/Endure/LifeSteal/Evade에 `getFailureReason` 가드 추가 (효과 활성 중 재사용 방지) (4) Shockwave 반경 150→250, HP 40% 미만 + 거리 250 이하에서만 사용 (방어적)
- 영향: `src/clickActions.js`, `src/simulation/aiActionController.js`

## [L1] 2026-06-28 — RL 최적화 가이드 문서 작성
- 맥락: AI 액션 `canAIUse` 파라미터 수동 튜닝이 번거로워 RL/자동최적화 도입 검토
- 결정: `docs/rl-optimization-guide.md` 작성 — 게임 구조·관측공간(24차원)·행동공간·보상함수·DQN 학습코드·기존 게임 임베딩 전략을 포괄하는 설계 문서
- 영향: `docs/rl-optimization-guide.md`

## [L1] 2026-06-28 — HP 게이트 30% + 쿨다운 제거 + Shockwave 회피용 전환
- 맥락: `aiEnabled: true`여도 `_pickAction()`이 `canAIUse` 통과 액션이 없으면 `null` 반환 → `_chosenAction` 미설정 → `clickActionName` 미설정 → UI에 AI 캐릭터 액션명 미표시
- 결정: (1) `_pickAction()`에서 viable이 0이면 전체 풀에서 랜덤 fallback 선택 — `_chosenAction`이 null이 되는 경우 제거 (2) `docs/click-actions.md`에 AI 액션 규칙(할당·고정·canAIUse) 문서화, 액션 선택 주기를 토너먼트 단위로 정정 (3) `aiEnabled` 중복 키 제거, `false` 기본값 + 주석 힌트 패턴 통일
- 영향: `src/simulation/aiActionController.js`, `src/app.js`, `docs/click-actions.md`

## [L1] 2026-06-28 — 스탯 표시 버그 수정 (stats 네임스페이스 누락 참조)
- 맥락: `6538ebb`에서 `statAllocation`을 `BattleBall.stats.allocation`으로 이동했으나 `src/ui.js`, ability 3종, `heroOrb.js`, `tests/regression.mjs`의 참조가 미업데이트되어 스탯 표시가 깨짐
- 결정: `fighter.statAllocation` → `fighter.stats.allocation` (11곳), `fighter.stats?.hp` → `fighter.hp/maxHp` (2곳), `owner.statAllocation` → `owner.stats?.allocation` (4곳) 으로 수정. optional chaining 보강
- 영향: `src/ui.js`, `src/abilities/ability.js`, `src/abilities/orbitAbility.js`, `src/abilities/rageAbility.js`, `src/entities/heroOrb.js`, `tests/regression.mjs`

## [L1] 2026-06-27 — 시간 왜곡 타이머, 배속 영향 제거
- 맥락: `timeSlowRemaining`이 `speedDelta`(배속 적용된 값)로 카운트다운되어 4배속에서 0.5초가 0.125초만에 만료됨
- 결정: `BattleSimulation.update(delta, realDelta=delta)`로 실제 시간 파라미터 추가, `timeSlowRemaining`은 `realDelta`로 감소, 엔티티 업데이트는 `delta`(speedDelta) 기준 유지
- 영향: `src/app.js`, `src/simulation/battleSimulation.js`

## [L1] 2026-06-27 — 시간 왜곡 면제 시스템
- 맥락: `entity === this.playerBall` 하드코딩 → 관전 모드나 AI 사용 시 아무도 면제 안 됨
- 결정: `timeSlowExempt` Set 도입, `TimeWarpAction.apply()`에서 시전자 추가
- 영향: `src/simulation/battleSimulation.js`, `src/clickActions.js`

## [L1] 2026-06-27 — 인게임 버그 2건 수정
- 맥락: `assignActions: true` 하드코딩 → 챌린지 레벨 무관하게 AI 액션 항상 활성. `applyKnockback` speedBoost에 `multiplier` 누락 → NaN 가능성
- 결정: `assignActions` 줄 제거, `multiplier: 1` 추가
- 영향: `src/app.js`, `src/entities/battleBall.js`

## [L1] 2026-06-27 — AI 액션 컨트롤러 개선
- 맥락: 액션 사용 시 승률이 오히려 하락하는 캐릭터 6종 발견 (Phantom -7.8%, Trickster -7.5% 등)
- 결정: (1) HP 50% 미만이면 액션 사용 금지 (2) 쿨다운 6→15초 (3) 저HP 시 `_pickAction`에서 흡혈/회피 우선 가중치 (4) 액션 고정(locking)은 유지 — 사람도 첫 카드 선택 후 고정
- 영향: `src/simulation/aiActionController.js`

## [L2] 2026-06-27 — balanceSim으로 승률 검증
- 배경: AI가 새 스크립트(`scripts/aiVerify.mjs`)를 만들었으나 기존 `tests/balanceSim.mjs`가 더 완성도 높음
- 결정: 중복 스크립트 삭제, 원본 balanceSim으로 30 토너먼트 검증
- 영향: `scripts/aiVerify.mjs` 삭제

## [L1] 2026-06-27 — 세션 핸드오프 시스템
- 맥락: 매 새 대화마다 이전 컨텍스트를 이어받을 방법 필요
- 결정: (1) `AGENTS.md`에 시작 루틴(handoff 파일 읽기) 규칙 추가 (2) 결정 발생 시점마다 실시간 기록 (3) L1/L2/L3 우선순위 레벨링 (4) 단일 파일로 결정 히스토리 관리
- 영향: `AGENTS.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-27 — AGENTS.md 리팩터링
- 맥락: 200줄 중 다수가 효과 없음 (출력 형식 강제, DeepSeek 보완 장치 장황, development-rules.md 중복)
- 결정: 200줄→55줄로 축소, 핵심 규칙·코드스타일·아키텍처 원칙만 유지
- 영향: `AGENTS.md`

## [L1] 2026-06-27 — ABILITY_MAP 3군데 누락 수정
- 맥락: Vampire/Gunner/Phantom 얼굴이 UI에서 안 보임. `ui.js`, `app.js`의 ABILITY_MAP과 import에 3종 누락
- 결정: import 추가, ABILITY_MAP에 3종 추가
- 영향: `src/ui.js`, `src/app.js`

## [L1] 2026-06-27 — SESSION-HANDOFF.md 워크스페이스 루트로 이동
- 맥락: `/memories/repo/` 경로는 사용자에게 안 보임
- 결정: 워크스페이스 루트 `SESSION-HANDOFF.md`를 primary로, AGENTS.md의 읽기/쓰기 모두 이 파일 대상으로 변경
- 영향: `AGENTS.md`, `SESSION-HANDOFF.md`

## [L3] FIGHTER_IDS/ABILITY_TYPES 누락 추가 (Vampire/Gunner/Phantom)
## [L3] regression.mjs 테스트 복구 (구현과 불일치하던 테스트 값, 미구현 기능 테스트)
## [L3] balanceSim 30T 검증 통과, npm test 통과, format:check 통과

## [L1] 2026-06-27 — 시간왜곡 canAIUse 재설계 (원거리/근접 구분)
- 맥락: 기존 `상대속도 > 내속도 × 1.5`는 조건이 너무 엄격해 AI가 거의 사용 안 함
- 결정: 원거리(archer/grenade/gunner)는 상대 접근속도>80 & 거리<350, 근접은 상대 도망속도>40 & 거리<300
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — 7개 액션 canAIUse 전면 개선
- 맥락: 30T balanceSim에서 Orbit(-16%), Hero(-16%), Phantom(-11%) 등 액션 사용 시 승률 하락
- 결정: Rush(근접전용, 거리>300), Counter/Endure/Evade(충돌 임박 시), Guard(투사체 접근 시), LifeSteal(HP≤50%), Shockwave(그대로)
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — 캐릭터-액션 조합별 베이스라인 대비 분석
- 결정: balanceSim 25T로 캐릭터×액션 매트릭스 출력, 베이스라인 대비 델타로 AI 조건 진단
- 발견: 충격파(Trickster/Dash/Rage에 독), 돌진(Phantom/Gunner에 독), 회피(Eater/Grenade/Hero에 독)

## [L1] 2026-06-27 — 회피(Evade) 리워크: 좌우 90도 꺾기
- 맥락: 타이밍형은 버티기와 유사, 대시형은 Dash와 유사 → 차별화 필요
- 결정: 현재 진행방향에서 좌/우 랜덤 90도로 꺾어 회피. 800px/s, +30%속도 0.4초, HP 0.8%, 거리<220 & 접근>40 & 50%확률
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — 버티기(Endure) 원복
- 맥락: 0.5초/50%DR로 버프했으나 리턴이 너무 적어짐
- 결정: 원래값 0.2초/80%DR/1.0%HP로 복구, canAIUse 인간분산 50% 유지
- 영향: `src/clickActions.js`, `tests/regression.mjs`

## [L1] 2026-06-27 — 밸런싱 방침 확정
- 맥락: 특정 조합 사기(OP) 방지가 목적. 안 어울리는 조합은 유저가 안 고르므로 제한 불필요
- 결정: 캐릭터 타입별 액션 제한 없음. OP 조합 식별 시 해당 액션 파라미터 조정으로 대응
- 영향: 추후 밸런싱 방향

## [L1] 2026-06-27 — 카운터/버티기 인간 수준 분산 추가
- 맥락: AI가 충돌 타이밍을 완벽하게 계산, Counter/Endure를 100% 성공률로 사용 → 사기. 시뮬: AI 100% vs 인간(반응150ms+예측오차) 54%
- 결정: Counter 55%, Endure 50% 확률로만 활성화 → 인간 수준으로
- 영향: `src/clickActions.js`

## [L1] 2026-06-27 — debug 네임스페이스 + 계층 구조 규칙
- 맥락: 디버그 변수들이 평면적으로 흩어짐 (startCharacter, debugAIEnabled 등)
- 결정: `this.debug = { startCharacter, aiEnabled }` 네임스페이스로 그룹화, `docs/development-rules.md`에 계층 구조 규칙 추가
- 영향: `src/app.js`, `docs/development-rules.md`

## [L1] 2026-06-28 — BattleApp._speed/_action + BattleBall.hero/mastery 네임스페이스
- 맥락: 계층 구조 규칙을 전체 코드베이스에 적용
- 결정: `_battleSpeed/_speedIndicator*` → `this._speed`, `selectedActionId/currentMatchAction` → `this._action`, `heroOrbBonuses/Carryover` → `this.hero`, `masteryPhysicsModifiers/ActionModifiers/CombatPassives` → `this.mastery`
- 영향: `src/app.js`, `src/entities/battleBall.js`, `src/entities/heroOrb.js`, `src/simulation/battleSimulation.js`, `src/ui.js`, `tests/regression.mjs`

## [L1] 2026-06-28 — BattleBall.meta: ability가 자신의 메타정보 소유
- 맥락: `isRanged` 판단을 위해 `RANGED_IDS` Set을 여러 곳에서 하드코딩 중 → ability가 자신의 메타정보를 갖고 BattleBall은 getter로 위임
- 결정: `Ability.meta` getter 추가 (기본 `{ isRanged: false }`), ArcherAbility/GrenadeAbility/GunnerAbility에서 `{ isRanged: true }` 오버라이드, `BattleBall.meta` getter는 `this.ability?.meta`로 위임, aiActionController/clickActions에서 `RANGED_IDS` 제거하고 `fighter.meta.isRanged` 사용
- 영향: `src/abilities/ability.js`, `archerAbility.js`, `grenadeAbility.js`, `gunnerAbility.js`, `src/entities/battleBall.js`, `src/simulation/aiActionController.js`, `src/clickActions.js`

## [L1] 2026-06-28 — BattleBall state/flags/display + Ability state 계층화
- 맥락: BattleBall과 Ability 하위클래스에 30~50개 평면 프로퍼티가 흩어져 변수 스코프 구분 불가
- 결정: BattleBall에 `state`(slow/speedBoost/forcedHeading/movement/swallowed/wallSlam/bounced), `flags`(defeated/destroyed), `display`(spinRotation/scale) 네임스페이스 추가. 10개 Ability 하위클래스에 `state` 네임스페이스 추가 (가변 상태변수 이동). config 상수는 직접 프로퍼티 유지.
- 영향: `src/entities/battleBall.js`, `src/simulation/simulation.js` (optional chaining 추가), `src/abilities/*.js` (10개 파일), `src/simulation/battleSimulation.js`, `src/core.js`, `src/clickActions.js`, `src/combatEffects.js`, `src/app.js`, `src/ui.js`, `src/entities/*.js`, `tests/regression.mjs`, `tests/balanceSim.mjs`

## [L1] 2026-06-28 — UI 로그 순서 수정 + appendCapped 공통 헬퍼
- 맥락: `unshift`로 로그가 위에 쌓임 → 아래로 쌓이게 `push`로 변경, `utils.js`에 `appendCapped` 추가로 통일
- 영향: `src/ui.js`, `src/utils.js`

## [L1] 2026-06-28 — 도전단계 Alpine ↔ 프로필 동기화 버그 수정
- 맥락: UI에서 도전단계 조정해도 프로필에 저장 안 됨 → 토너먼트 시작 시 이전 값 사용
- 결정: `startTournament()`에서 Alpine `challengeLevel` 우선, 프로필도 동기화
- 영향: `src/app.js`

## [L1] 2026-06-28 — BattleBall.stats 네임스페이스 (base stat)
- 맥락: `baseDamage`, `baseDefense`, `baseSpeed`, `baseRadius` 등 base stat들이 평면에 흩어짐
- 결정: `this.stats` 네임스페이스 추가 — `baseDamage`, `baseDefense`, `baseSpeed`, `baseRadius`, `mass`, `allocation` 이동. `hp`, `radius`, `mass`는 외부 호환성을 위해 평면 프로퍼티로도 유지
- 영향: `src/entities/battleBall.js`, `src/abilities/*.js` (12개), `src/app.js`, `src/clickActions.js`, `src/combatEffects.js`, `src/core.js`, `src/entities/*.js` (6개), `src/simulation/battleSimulation.js`, `src/ui.js`, `tests/regression.mjs`

## [L1] 2026-06-28 — 푸시 전 패치노트/문서 경로 정합성
- 맥락: main 푸시 전 `PATCH_NOTES` 작성 규칙이 있는데 미푸시 리팩토링/핫픽스 범위에 패치노트가 없었고, 문서가 실제 파일명 `src/patchNotes.js`가 아닌 옛 경로를 가리킴
- 결정: `v0.22.0` 패치노트 추가, 문서/주석의 패치노트 경로를 `src/patchNotes.js`로 통일
- 영향: `src/patchNotes.js`, `AGENTS.md`, `docs/*`, `src/utils.js`, `SESSION-HANDOFF.md`

## [L1] 2026-06-28 — 경험치 및 캐릭터 레벨 시스템 설계 문서화
- 맥락: 업적 위주 성장만으로는 전투 직후 즉각적인 보상이 부족하게 느껴짐
- 결정: 캐릭터별 XP/레벨을 단기 보상 시스템으로 분리하고, 패배해도 지급되는 XP, 대표 행동 XP, 레벨 보상, 결과 화면 UX, 저장 구조, 회귀 조건을 `docs/experience-system.md`에 기록
- 영향: `docs/experience-system.md`, 성장/도감/숙련도/컬렉션 허브/저장 문서 링크

## [L1] 2026-06-28 — XP 성장에 따른 상대 성장 보정 고려
- 맥락: 플레이어 캐릭터 레벨만 오르면 장기적으로 게임이 너무 쉬워질 수 있음
- 결정: 상대도 저장 XP를 갖는 방식 대신, 토너먼트 시작 시 플레이어 캐릭터 레벨에서 `rivalExperienceScaling`을 파생해 hp/damage/defense에만 제한 적용. 보정은 상한을 두고 도전 단계와 분리해 문서화.
- 영향: `docs/experience-system.md`

## [L1] 2026-06-28 — AI 우승자는 영구 성장 대신 디펜딩 챔피언화
- 맥락: AI 우승 캐릭터가 계속 스탯 성장하면 원래 강한 캐릭터가 더 자주 이기는 양의 피드백으로 밸런스가 깨질 수 있음
- 결정: AI 우승자는 `defendingChampion`으로 저장해 표시/현상금 대상이 되며, 전투력 보정은 없거나 다음 토너먼트 1회성 `championAura`로 제한. 필요 시 최근 우승률이 높은 캐릭터의 보정을 감쇠.
- 영향: `docs/experience-system.md`

## [L1] 2026-06-28 — 디펜딩 챔피언 시각 표식 및 반응형 UI 설계
- 맥락: 챔피언은 텍스트 로그만으로는 전투 중 구분이 약하고, 모바일/PC 화면에서 표시 밀도 요구가 다름
- 결정: 전장 내 챔피언 모자 표식, PC 대진표 배너/현상금 chip/HUD, 모바일 compact strip/짧은 bracket row/결과 팝업 우선순위를 `docs/experience-system.md`에 구체화
- 영향: `docs/experience-system.md`

## [L1] 2026-06-28 — 사냥터 및 상자 해금 시스템 설계 문서화
- 맥락: 토너먼트와 별개로 로그라이크식 사냥터에서 여러 적을 상대하고, 승리 후 귀환/전진을 선택하며, 처치 재화로 등급별 상자를 여는 루프를 구상
- 결정: 사냥터는 토너먼트와 분리된 연전 파밍 모드로 정의. 층, 조우, 귀환/전진, 랜덤 이벤트, 열쇠 조각, 상자 등급/개봉 비용, pending/secured loot, 보관함 UI 요구사항을 `docs/hunting-grounds-system.md`에 기록
- 영향: `docs/hunting-grounds-system.md`, `docs/collection-hub-ui.md`, `docs/player-data-storage-security.md`

## [L1] 2026-06-28 — 다수 전투를 위한 팀 기반 리팩터링
- 맥락: 사냥터와 1대n/n대n 전투를 위해 기존 전투가 사실상 1대1 전제에 머물러 있고, 같은 팀끼리 피해를 주지 않는 구조가 필요
- 결정: `BattleBall.teamId`와 `simulation.isHostile()`, `getEnemiesOf()`, `getNearestEnemy()`를 도입. 명시적 팀이 없으면 fighter별 고유 팀을 부여해 기존 개인전 동작을 유지하고, 같은 팀끼리는 충돌 물리만 적용하며 피해/적대 효과를 차단. 승패는 남은 적대 팀 수로 판단
- 영향: `src/entities/battleBall.js`, `src/simulation/simulation.js`, `src/simulation/battleSimulation.js`, `tests/regression.mjs`, `docs/development-rules.md`, `docs/game-rules.md`, `docs/hunting-grounds-system.md`

## [L1] 2026-06-28 — 스탯 배분 UI 초기화 버그 수정
- 맥락: Alpine 스탯 배분 버튼은 UI 내부 `allocation`만 갱신하고 `BattleApp.playerStatAllocation`에는 알리지 않아, `refreshPlayerSetup()` 같은 화면 갱신이 들어오면 앱이 가진 이전 0 배분으로 UI가 다시 덮일 수 있었음
- 결정: `adjustStat()`, `randomAllocation()`, `resetAllocation()` 후 `allocation-changed` 이벤트를 발행해 앱 상태를 즉시 동기화. `renderPlayerSetup()`은 전달받은 배분 객체를 복사해 UI가 호출자 객체를 직접 변형하지 않게 함
- 영향: `src/ui.js`, `tests/regression.mjs`, `src/patchNotes.js`

## [L1] 2026-06-28 — 스탯 배분 핫픽스 캐시 버전 갱신
- 맥락: 스탯 배분 초기화 수정 후에도 `index.html`의 모듈 캐시 버전 `V`가 오래된 `0.18.1`이라 브라우저가 이전 `src/ui.js?v=0.18.1`을 재사용하면 동일 버그가 계속 보일 수 있었음
- 결정: `index.html`의 캐시 버전을 최신 패치노트 버전 `0.23.2`로 갱신하고, 회귀 테스트에서 `index.html`의 `V`가 `PATCH_NOTES[0].version`과 일치하는지 검증
- 영향: `index.html`, `src/patchNotes.js`, `tests/regression.mjs`

## [L1] 2026-06-28 — 스탯 배분 초기화 race E2E 검증 및 차단
- 맥락: 실제 Playwright E2E에서 수동/자동 배분 후 시작은 유지됐지만, Alpine UI가 BattleApp import보다 먼저 활성화되어 앱 이벤트 리스너 부착 전 입력이 발생할 수 있는 구조를 확인
- 결정: BattleApp 생성 시 이미 존재하는 Alpine `allocation`을 즉시 흡수하고, 로딩 오버레이 제거를 Alpine `x-init`이 아니라 앱 모듈 import 완료 후로 이동. 최신 캐시 버전은 `0.23.3`으로 갱신
- 영향: `src/app.js`, `index.html`, `src/patchNotes.js`, `tests/regression.mjs`

## [L1] 2026-06-29 — PPO 학습 아키텍처 문서명 및 표현 정리
- 맥락: AI 코드 개발 관련 문서가 숫자 임시 파일명으로 생성되어 있고, 제목/섹션/코드 주석에 장식 이모티콘이 많아 장기 문서로 쓰기 어려움
- 결정: 문서 파일명을 `docs/ppo-learning-architecture.md`로 변경하고, PPO/Actor-Critic 데이터 흐름 설명에서 장식 이모티콘과 과한 표현을 문서형 톤으로 정리. 다음 개발 단계는 학습 코드 개선으로 이어감
- 영향: `docs/ppo-learning-architecture.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-29 — PPO Actor-Critic 학습 코드 반영
- 맥락: 기존 학습 초안은 REINFORCE 단일 정책망 구조라 PPO 문서의 Actor/Critic, old log probability, clipped ratio 업데이트와 맞지 않았음
- 결정: `scripts/rl/policyNetwork.js`에 TensorFlow.js 기반 Actor/Critic 생성, Bernoulli sampling, Critic value prediction, PPO clipped update를 구현하고 `scripts/rl/train.mjs`를 에피소드 rollout → discounted return/advantage batch → PPO epoch 학습 흐름으로 변경. Node 실행 시 CPU 백엔드를 명시하고 짧은 학습 실행용 환경변수를 지원. 액션별 `getFailureReason()`은 PPO rollout의 불가능/중복 액션 필터로 사용
- 영향: `scripts/rl/*`, `src/clickActions.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`, `package.json`, `package-lock.json`

## [L1] 2026-06-29 — PPO 학습률 확인 및 rollout buffer 보강
- 맥락: 300 에피소드 비교에서 `lr=3e-4`, `lr=1e-3`, `lr=0` 간 승률 개선이 뚜렷하지 않았고, Eater × LifeSteal은 Rage 상대 승률이 계속 0%라 승패 보상만으로 학습 신호가 부족했음
- 결정: 현재는 중간 보상이 없으므로 보상은 게임 종료 후 승/패 terminal reward만 사용. 대신 PPO rollout buffer를 64 에피소드로 늘리고, decision 샘플을 shuffle한 뒤 `miniBatchSize` 단위로 나눠 여러 epoch 학습하도록 변경. 최근 윈도우 기준 승률/평균 보상/액션 사용률/Actor 평균 확률 로그로 학습 추세를 확인
- 영향: `scripts/rl/train.mjs`, `scripts/rl/policyNetwork.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-29 — 전체 캐릭터 × 전체 액션 PPO 학습 지원
- 맥락: 기존 학습 스크립트는 Dash/Rush, Archer/TimeWarp, Eater/LifeSteal 3개 조합만 하드코딩되어 있어 N 캐릭터 × N 액션 학습을 할 수 없었음
- 결정: 기본 학습 대상을 로스터 전체 캐릭터 × 액션 풀 전체 액션으로 확장. `RL_CHARACTERS`, `RL_ACTIONS`, `RL_MAX_COMBOS`, `RL_OPPONENT_MODE`, `RL_FIXED_OPPONENT`, `RL_NORMALIZER_SAMPLES` 환경변수로 부분 학습/랜덤 상대/스모크 테스트를 지원. 공통 normalizer를 한 번 초기화한 뒤 조합별 clone으로 복사해 초기화 비용을 줄임
- 영향: `scripts/rl/train.mjs`, `scripts/rl/normalizer.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`, `SESSION-HANDOFF.md`

## [L1] 2026-06-29 — PPO 학습 전/후 deterministic 평가 추가
- 맥락: 훈련 중 승률은 Actor 샘플링과 탐험이 섞여 있어 학습 전후 정책 자체가 개선됐는지 판단하기 어려웠음
- 결정: 각 캐릭터 × 액션 조합마다 학습 전 `eval before`, 학습 후 `eval after`를 deterministic 정책으로 별도 실행. 평가는 `RL_EVAL_THRESHOLD` 이상일 때만 액션을 사용하고 normalizer 통계를 업데이트하지 않으며, `RL_EVAL_EPISODES`로 평가 횟수를 조절. 최종 결과에 `eval before -> after`와 delta를 출력
- 영향: `scripts/rl/train.mjs`, `scripts/rl/policyNetwork.js`, `tests/regression.mjs`, `docs/rl-optimization-guide.md`

## [L1] 2026-07-02 — Orbit 투사체 벽 반사 버그 수정
- 맥락: Orbit 투사체가 벽에 튕기지 않고 달라붙는 버그 발견
- 결정: `bx, by` 위치 저장을 `_integrateAndClamp()` 전으로 이동, 중복 `keepEntityInsideArena` 제거
  - 원인: `_integrateAndClamp()`가 내부에서 이미 클램프한 후에 `bx,by`를 저장해 충돌 감지 실패
  - `dir`이 갱신되지 않아 매 프레임 `applyImpulse`가 속도를 다시 벽 방향으로 되돌림
- 영향: `src/entities/orbitProjectile.js`

## [L1] 2026-07-02 — AI 액션 spend 실패 시 _consecutiveYes 미초기화 버그 수정
- 맥락: AI가 HP=1일 때 spendHpForAction이 0 반환 → _consecutiveYes가 3+ 유지 →
  매 프레임 decided=true로 재시도 → 회복 시 쿨다운 없이 즉시 발동 (burst)
- 결정: spend 실패 시 `_consecutiveYes = 0` 리셋 추가, _nextAvailableAt은 유지
- 영향: `src/simulation/aiActionController.js`

## [L2] 2026-07-03 — Time Warp RL 패널티 0.02→0.15 인상 (코드만, 미학습)
- 배경: Time Warp가 훈련 중 0.5s마다 무조건 사용하도록 학습 (95.87% 승률). 사용 패널티 0.02가 너무 낮아 스팸이 최적 전략.
- 결정: `time_warp` penalty 0.02→0.15 (7.5배). 10회 사용 시 -1.5 보상 차감. 재학습 필요.
- 영향: `scripts/rl/train.mjs`

## [L2] 2026-07-03 — Shockwave 밀치기 재설계 (applyKnockback + 벽꽝)
- 배경: 1) `applyImpulse`만 사용 → 같은 프레임 `_applyVelocityCorrection`이 즉시 상쇄 → 넉백 미체감. 2) 데미지 0 + 벽 충돌 피드백 없음.
- 결정: (1) `fighter.applyImpulse()` → `fighter.applyKnockback(vel, 0.12)`로 변경 — `forceHeading`으로 0.12s 동안 넉백 방향 유지, 속도보정이 방해하지 않음. (2) `DEFAULT_PUSH_FORCE` 400→600 (50%↑). (3) `WallSlamEffect` 추가 — 벽 충돌 시 데미지(`force×0.05`, 최대 30) + 시각/사운드 피드백.
- 영향: `src/clickActions.js` (WallSlamEffect import, applyKnockback 사용, pushForce 증가)

## [L1] 2026-07-03 — PPO rollout의 기존 AI 액션 호출 기본 비활성화
- 맥락: `BattleSimulation`의 `assignActions`는 false여도 `scripts/rl/train.mjs`가 직접 `fighter.aiController`를 붙이면 `BattleBall.update()`에서 기존 `AIActionController.evaluate()`가 Actor 선택과 별개로 액션을 발동할 수 있었음
- 결정: `RL_BUILTIN_AI_ACTIONS` 플래그를 추가하고 기본값을 false로 설정. normalizer 샘플링과 학습/평가 episode 모두 기본적으로 기존 AI 컨트롤러를 붙이지 않으며, PPO Actor가 직접 `scheduleAction()`한 액션만 반영
- 영향: `scripts/rl/train.mjs`, `docs/rl-optimization-guide.md`

## [L1] 2026-07-03 — 앱 기본 디버그 AI 액션 플래그 비활성화
- 맥락: `BattleApp.debug.aiEnabled`가 true라 일반 앱 실행에서도 `assignActions`가 켜져 기존 AI 액션 컨트롤러가 자동 부착될 수 있었음
- 결정: `this.debug.aiEnabled` 기본값을 false로 변경. 단, 챌린지 레벨이 1 이상이면 기존 조건 `this._currentChallengeLevel > 0`에 의해 AI 액션 배정은 계속 활성화됨
- 영향: `src/app.js`

## [L1] 2026-07-03 — XP 결과 오버레이 브라우저 E2E 진단
- 맥락: XP 지급 로그/토스트는 나오지만 결과 오버레이의 XP subtext가 실제 브라우저에서 안 보인다는 의심이 있어 DevTools 수준 상태 확인이 필요했음
- 결정: 로컬 서버(`http://127.0.0.1:4173/`)에서 Playwright 브라우저 E2E로 토너먼트 1회 진행. `window.ballFightApp._lastXpResult`는 `{ xpGained: 7, totalXp: 7, level: 1, levelUp: false }`, `app.ui.state.overlaySubtext`는 `+7XP (Lv.1) | 도전 단계 0 도전 실패 | 해금 단계는 유지됩니다`, overlay `<p>` 텍스트와 `display:block` 확인. 현재 코드 기준 XP UI는 표시 정상으로 판정
- 영향: 코드 변경 없음, `SESSION-HANDOFF.md`

## [L1] 2026-07-03 — XP를 유저 매치 종료마다 즉시 지급
- 맥락: XP는 원래 토너먼트 종료 시점이 아니라 유저가 참가한 매 전투 종료 직후 보여야 하는 보상인데, 기존 구현은 `showTournamentChampion()`에서 토너먼트 단위로 지급해 최종 화면에서만 표시됐음
- 결정: `grantExperienceFromMatchReport()`를 추가하고 `BattleApp.finishMatch()`가 유저 참가 매치 리포트를 완성한 직후 XP 지급, 로그, 토스트, 결과 오버레이 subtext, 프로필 저장을 처리하도록 변경. 토너먼트 종료 단계의 일괄 XP 지급은 제거하고 업적/숙련도/도전 단계 처리만 남김
- 영향: `src/app.js`, `src/experience/experienceService.js`, `src/experience/index.js`, `tests/regression.mjs`, `docs/experience-system.md`
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과. Playwright E2E에서 첫 유저 매치 종료 직후 `overlaySubtext="+7XP (Lv.1)"`, overlay `<p>` `display:block`, 스크린샷 `tmp-xp-match-proof.png` 확인

## [L1] 2026-07-04 — 캐릭터별 XP 저장과 XP 전용 UI 정합화
- 맥락: 경험치는 원래 캐릭터별 성장인데 구현이 전역 `experience.currentXp`로 되어 있어 캐릭터별 XP를 초기 화면/도감에서 볼 수 없었고, 매치 종료 보상도 텍스트 한 줄이라 보상감이 약했음
- 결정: `experience.byCharacter[characterId].currentXp`를 정식 저장 구조로 도입하고 전역 `currentXp`는 합계/레거시 호환 필드로 유지. 레거시 전역 XP만 있는 세이브는 최근 플레이 기록 캐릭터로 귀속. 매치 종료 결과 오버레이에 자동 진행을 막지 않는 XP 전용 바 패널을 추가하고, 초기 내 캐릭터 패널과 컬렉션 허브 도감 카드/상세에 캐릭터별 XP 레벨/진행도/다음 보상을 표시
- 영향: `src/playerProfile.js`, `src/experience/experienceService.js`, `src/experience/index.js`, `src/app.js`, `src/ui.js`, `src/collection/collectionViewModel.js`, `index.html`, `src/styles.css`, `tests/regression.mjs`, `docs/experience-system.md`, `docs/collection-hub-ui.md`
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과. Playwright E2E에서 PC 결과 XP 패널 `width:60%`, `byCharacter.dash.currentXp=60`, 도감 상세 `60/100 XP`, 모바일 결과 XP 패널 `bodyScrollWidth=viewportWidth=390` 확인

## [L1] 2026-07-04 — 사냥터 MVP 기반 상태/보상/보관함 저장 구조 구현
- 맥락: 다음 단계가 사냥터 MVP 구현이며, 실제 전투 UI를 붙이기 전에 우승 캐릭터 입장 조건, 층간 HP 누적 상태, 귀환/패배 보상 처리, 상자 파손 연쇄 확률을 순수 함수로 먼저 고정해야 했음
- 결정: `src/hunting/` 모듈을 추가해 사냥터 설정, 보상, 적 스케일링, 이벤트, 런 상태, 상자 개봉 가능 여부를 분리 구현. `playerProfile.hunting`에 해조각/상자/설계도/통계를 저장하고 sanitize에서 중복 상자 ID를 제거. 컬렉션 허브에는 보관함 탭을 최소 표시해 해조각과 상자 목록/개봉 가능 여부를 확인할 수 있게 함
- 영향: `src/hunting/*`, `src/playerProfile.js`, `src/collection/collectionViewModel.js`, `src/ui.js`, `index.html`, `src/styles.css`, `tests/regression.mjs`, `docs/hunting-grounds-system.md`, `docs/collection-hub-ui.md`
- 검증: `npm test` 통과. 입장 조건, 층별 스케일링, 해조각 보상, pending→secured 귀환, 패배 시 상자 파손 순서/50% 해조각/70% XP 보존, 상자 개봉 비용, 프로필 sanitize, 보관함 ViewModel을 회귀 테스트로 확인

## [L1] 2026-07-04 — Alpine 템플릿 컴포넌트 시스템 기반 구성
- 맥락: 사용자가 기존 Alpine 개발에서 쓰던 `x-component`/`template-*` 기반 커스텀 컴포넌트 패턴을 이 프로젝트에도 구성하기 원했고, 사냥터 UI 전에 시스템부터 잡아야 했음
- 결정: Alpine 공식 확장 문서 기준에 맞춰 `Alpine.start()` 전 `registerAlpineComponentSystem(Alpine)`을 등록. `src/alpineTemplateComponents.js`에 `x-component` directive, kebab-case 이름 검증, `template-` 접두사 해석, `template.content.cloneNode(true)` 복제, 복제된 자식 루트 `Alpine.initTree(child)` 초기화를 구현. 호스트 자체 재초기화는 피함
- 영향: `src/alpineTemplateComponents.js`, `index.html`, `tests/regression.mjs`, `docs/alpine-component-system.md`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm test`의 `[alpine-components] ok`에서 이름 검증/템플릿 해석/마운트/등록 동작 확인

## [L1] 2026-07-04 — x-component 실사용/중첩/예외 예시 추가
- 맥락: 시스템만 있고 실제 사용 예시가 없어 사용자가 일반 예시, 중첩 컴포넌트 예시, 예외사항 예시를 요청
- 결정: 결과 오버레이 XP 보상 패널을 `template-xp-reward-panel` + `x-component="xp-reward-panel"` 실사용 예시로 전환하고, 내부 XP 진행 바를 `template-xp-progress-bar` + 중첩 `x-component="xp-progress-bar"`로 분리. 문서에 일반/중첩/잘못된 이름/없는 템플릿/대량 반복/외부 입력 금지 예시를 추가하고 회귀 테스트에 실제 HTML 예시 존재, 중첩 mount, invalid/missing template, `initTree` 부재 fallback 검증을 추가
- 영향: `index.html`, `docs/alpine-component-system.md`, `tests/regression.mjs`, `SESSION-HANDOFF.md`
- 검증: `npm run format`, `npm test`, `npm run check`, `npm run format:check` 통과. 브라우저 DOM 확인에서 `xp-reward-panel`/`xp-progress-bar` 템플릿 존재, 보상 패널/중첩 진행 바 `data-component` 스탬프, `.xp-bar` 마운트, 콘솔 에러 없음 확인
- 현재 상태: 바로 아래 태그 기반 전환 결정으로 실제 사용 예시는 `<xp-reward-panel>`/`<xp-progress-bar>`가 기준이며, `x-component`는 보조/호환 문법으로만 유지

## [L1] 2026-07-04 — 템플릿 컴포넌트 기본 문법을 태그 기반으로 전환
- 맥락: 사용자가 예전 Alpine 컴포넌트 시스템처럼 `div x-component`가 아니라 태그 자체로 컴포넌트를 쓰는 방식을 선호한다고 확인
- 결정: `src/alpineTemplateComponents.js`에 `<component-name>` 태그 호스트 탐색/마운트 기능을 추가하고, `registerAlpineComponentSystem(Alpine)`이 `Alpine.start()` 전에 태그 컴포넌트를 템플릿으로 확장하게 변경. `x-component` directive는 호환/보조 문법으로 유지. XP 보상 패널 실사용 예시는 `<xp-reward-panel>`, 중첩 진행 바는 `<xp-progress-bar>`로 전환
- 영향: `src/alpineTemplateComponents.js`, `index.html`, `tests/regression.mjs`, `docs/alpine-component-system.md`, `docs/development-rules.md`, `SESSION-HANDOFF.md`
- 검증: `npm run format`, `npm test`, `npm run check`, `npm run format:check` 통과. 브라우저 DOM 확인에서 `xComponentHosts=0`, `<xp-reward-panel>`/`<xp-progress-bar>` `data-component` 스탬프, `.xp-bar` 마운트, 콘솔 에러 없음 확인

## [L1] 2026-07-04 — 템플릿 컴포넌트 파일 분리 (template.html + script 일체형)
- 맥락: index.html에 인라인 `<template>`이 있어 컴포넌트가 늘어날수록 유지보수 어려움. HTML을 JS 문자열로 넣으면 IDE 도움(구문 강조, 자동완성)을 못 받음
- 결정: (1) `src/componentLoader.js` 추가 — fetch → `<template>` 주입, `<script>`는 분리해서 실행 (2) 기존 `<template>`을 `src/components/<name>/template.html`로 분리, `<script>` 포함 가능 (3) 컴포넌트별 Alpine.data 등록은 template.html 내 `<script>`로 처리
- 영향: `src/componentLoader.js` 생성, `src/components/xp-reward-panel/template.html`, `src/components/xp-progress-bar/template.html`, `index.html`(`<template>` 2개 제거, `loadTemplates()` 호출 추가), `tests/regression.mjs`(inline template 검증 대신 COMPONENTS 배열 검증)
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과

## [L2] 2026-07-04 — 컴포넌트 자체 x-data 스코프 + Alpine.store() 브릿지
- 배경: 분리된 컴포넌트가 여전히 부모 appStore의 xpReward를 직접 참조해 독립적이지 않음. Vue 컴포넌트처럼 각 컴포넌트가 자체 스코프를 가져야 함
- 결정: (1) 각 템플릿 root에 `x-data="ComponentName"` 추가 (2) 데이터 교환은 `Alpine.store('xpReward', data)`로 통일 (3) `UIController._showXpReward`에서 `s.xpReward = {...}` → `Alpine.store('xpReward')`로 변경 (4) `index.html`의 `<xp-reward-panel>`에서 `x-show`/`x-bind:class`를 템플릿 내부로 이동
- 영향: `src/ui.js`(UIController store 변경), `index.html`, `src/components/xp-reward-panel/template.html`(x-data + $store), `src/components/xp-progress-bar/template.html`(x-data + $store), `tests/regression.mjs`(Alpine store mock 추가)
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과

## [L2] 2026-07-04 — 컴포넌트 폴더 구조를 단일 HTML 파일로 플랫화
- 배경: `src/components/<name>/template.html`은 폴더 하나에 파일 하나만 담겨 불필요하게 깊음
- 결정: `src/components/<name>.html`로 평탄화. 폴더 제거, 파일만 존재
- 영향: `src/components/xp-reward-panel.html`, `src/components/xp-progress-bar.html`, `src/componentLoader.js`(fetch 경로), `tests/regression.mjs`(URL 경로), `docs/alpine-component-system.md`

## [L1] 2026-07-04 — PopupDialog 컴포넌트화 (x-html → Alpine.store() + scoped CSS)
- 맥락: PopupService가 `Alpine.$data(root)`로 직접 Alpine 데이터를 조작하고, x-html body를 인라인 Alpine 템플릿이 렌더링하는 구조 → 컴포넌트 시스템 첫 확장 대상
- 결정: (1) `src/components/popup-dialog.html` 생성 — 자체 `x-data="popupDialog"` + `$store.popupDialog` 구독 + 모든 `bf-popup-*` 스타일 scoped CSS로 이동 + x-html body 유지 (2) `PopupService.show()` → `Alpine.store('popupDialog', data)`로 변경, `window.PopupService = PopupService`로 전역 노출 (3) `src/ui.js`에서 `popupVisible`/`popupContent`/`closePopup()` 제거 (4) `index.html` 인라인 팝업 템플릿 → `<popup-dialog>` 태그로 대체 (5) `src/styles.css`에서 `bf-popup-*` 13개 규칙 제거 (help-section 등은 x-html 컨텐츠 스타일로 유지)
- 영향: `src/components/popup-dialog.html`(신규), `src/popup.js`, `src/ui.js`, `index.html`, `src/styles.css`, `src/componentLoader.js`(COMPONENTS 추가)
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-04 — componentLoader 자동 발견으로 전환 (COMPONENTS 배열 제거)
- 맥락: 컴포넌트 추가 시마다 `COMPONENTS` 배열에 이름을 수동 등록해야 하는 번거로움
- 결정: `loadTemplates()`가 DOM을 스캔하여 `<xp-reward-panel>` 같은 커스텀 태그를 자동 발견. 이미 로드된 템플릿 내부의 중첩 컴포넌트도 재귀적으로 발견. `COMPONENTS` 배열과 `components` 파라미터 제거. `getLoadedComponents()` 헬퍼 export
- 영향: `src/componentLoader.js`, `tests/regression.mjs`(COMPONENTS import 제거, 파일 존재 검증으로 대체)
- 검증: `npm test`, `npm run format:check` 통과

## [L2] 2026-07-04 — `Alpine.reactive()`로 컴포넌트 상태 반응성 수정
- 배경: `Alpine.data()` 컴포넌트의 `$watch` 콜백과 클로저 함수에서 `const state = {}`의 속성을 직접 변경할 때 Alpine의 reactive Proxy를 우회하여 DOM 업데이트가 발생하지 않는 문제 발견. 도움말 `?` 버튼 클릭 시 popup이 표시되지 않던 원인.
- 결정: 모든 컴포넌트에서 `const state = { ... }`를 `const state = Alpine.reactive({ ... })`로 변경. `Alpine.reactive()`는 Alpine 3.x의 public API로, Proxy 기반 깊은 반응성 객체를 생성하여 클로저 내 돌연변이도 Alpine 의존성 추적을 트리거함.
- 영향: `src/components/popup-dialog.html`, `src/components/xp-reward-panel.html`, `src/components/toast-notification.html`
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-04 — 액션 선택기, 패치노트, 컬렉션 허브 컴포넌트화 완료
- 맥락: 남은 인라인 Alpine 패널(액션 선택기, 패치노트, 컬렉션 허브)을 단일 HTML 파일 컴포넌트로 분리. 컬렉션 허브는 4탭/계산 getter/400줄 scoped CSS 포함
- 결정: (1) `src/components/action-picker.html` — `Alpine.reactive()` 상태 + scoped CSS. `src/actionPicker.js` — `ActionPickerService.show()/resolve()`. (2) `src/components/patch-notes.html` — `Alpine.reactive()` + scoped CSS. `src/patchNotesService.js` — `PatchNotesService.show()/dismiss()`. (3) `src/components/collection-hub.html` — 4탭 모달, `Alpine.reactive()`에 computed getter(`filteredRoster/Mastery/Achievement/StorageItems`) 포함, scoped CSS ~400줄. `src/collectionHubService.js` — `CollectionHubService.render()/open()/close()`. (4) `index.html` — 3개 `<template>` 제거. (5) `src/ui.js` — `actionPicker*`/`patch*`/`collectionHub*` 상태/메서드 제거. (6) `src/app.js` — `waitForActionPick` → `ActionPickerService.show()`, `renderCollectionHub` → `CollectionHubService.render()`. (7) `src/styles.css` — `.action-*` `.patch-*` `.ch-*` CSS 제거 (총 ~650줄). (8) `componentLoader.js` — 자동 발견으로 전환 완료.
- 영향: `src/components/action-picker.html`, `src/actionPicker.js`, `src/components/patch-notes.html`, `src/patchNotesService.js`, `src/components/collection-hub.html`, `src/collectionHubService.js`, `index.html`, `src/ui.js`, `src/app.js`, `src/styles.css`, `docs/alpine-component-system.md`
- 검증: `npm test`, `npm run format:check` 통과. 인라인 Alpine 패널 0개

## [L1] 2026-07-04 — 사냥터 MVP 전투 연결 완료
- 맥락: 사냥터 기반 코드(huntingState/huntingConfig/huntingEncounters/huntingRewards)는 구현되어 있었으나 메인 화면 입장 버튼, 캐릭터 선택, 실제 BattleSimulation 연동, 승리 후 귀환/전진 선택 UI가 없었음
- 결정: (1) `src/hunting/huntingManager.js` — HuntingManager 클래스. `BattleApp._onSimulationResult` 훅을 통해 사냥 전투 완료 처리, 층별 HP 캐리오버, 귀환/전진/랜덤 이벤트 처리, 프로필 병합 담당. (2) `src/app.js` — `_onSimulationResult` 훅 추가, `loop()`에서 사냥 전투 완료 시 `finishMatch()` 대신 훅 호출, `_huntingDone` 플래그로 "확인" 버튼이 `startTournament()`를 트리거하지 않도록 방지. (3) `index.html` — `⚔ 사냥터` 버튼 (조건 `!locked && !tournamentActive && !huntingActive`), overlay 카드 내 귀환/전진 선택 버튼. (4) `src/ui.js` — `huntingActive`, `huntingChoiceVisible`, `huntingFloor`, `huntingCharacterName`, `huntingLootSummary` 상태 + `openHuntingLobby()/huntingRetreat()/huntingAdvance()` 메서드. (5) `src/styles.css` — 사냥터 버튼/선택/오버레이 CSS 추가
- 영향: `src/hunting/huntingManager.js`(신규), `src/app.js`, `index.html`, `src/ui.js`, `src/styles.css`
- 검증: `npm test`, `npm run format:check` 통과

## [L2] 2026-07-04 — scoped CSS `@scope` → 선택자 프리픽스 방식으로 전환
- 배경: `@scope ([data-v-xxxxx])` 방식은 브라우저 지원 범위가 제한적이고(Chrome 118+/Firefox 146+), `<style scoped>` 내 선언된 선택자만 스코핑하는 원래 의도와 달리 `@scope` 블록 전체가 모든 자손 선택자의 스코프를 변경
- 결정: `componentLoader.js`에 `rewriteScopedCss()` 추가 — CSS 토크나이저로 각 선택자를 파싱하여 `[data-v-xxxxx]` 프리픽스를 붙임. `:scope`는 `[data-v-xxxxx]`로 변환. `@media`/`@supports`는 재귀 처리. 주석/`@keyframes`는 건너뜀. 템플릿 HTML의 클래스명은 변경되지 않음
- 영향: `src/componentLoader.js`(신규 함수 `rewriteScopedCss`, `loadSingle`에서 `@scope` 대신 사용), `docs/alpine-component-system.md`(설명 업데이트)
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-04 — 사냥터 운영 버그 5종 수정 + 액션 선택 스킵 플래그
- 맥락: 사냥터 MVP 전투 연결 후 발견된 버그들 — 컬렉션 허브 흰 글자, 팝업 크기 변동, 사냥터 버튼 위치, Alpine store null 크래시, PopupService.close 미구현, 전진/귀환 버튼 미클릭
- 결정: (1) 컬렉션 허브 `.ch-detail-body`/`.ch-mast-info`/`.ch-ach-info`에 `color` 추가 (body `#f4f7fb` 상속 방지). (2) `.ch-content` `min-height: 0` → `400px` (탭 전환 시 팝업 수축 방지). (3) `.hunting-btn.control-button` `bottom: 64px` → `90px` (시작 버튼과 간격 확보). (4) `Alpine.store("name", null)` 3건 → `{ visible: false, ... }` 객체로 변경 (Alpine 내부 `Object.getOwnPropertyDescriptors(null)` TypeError 방지). (5) `PopupService.close()` 정적 메서드 추가. (6) `startMatch({ skipActionPick: true })` — 사냥터에서 액션 선택 UI 스킵. (7) `.hunting-choice-buttons { pointer-events: auto }` — overlay의 `pointer-events: none` 우회.
- 영향: `src/components/collection-hub.html`, `src/actionPicker.js`, `src/patchNotesService.js`, `src/components/popup-dialog.html`, `src/popup.js`, `src/app.js`, `src/hunting/huntingManager.js`, `src/styles.css`

## [L1] 2026-07-04 — 사냥터 상자 보상 테이블과 이벤트 확장 연결
- 맥락: 사냥터 전투 연결 이후 `createHuntingChest()`가 등급/id 중심 더미에 가까웠고, 이벤트 풀도 휴식지/상자방 중심이라 실제 로그라이크식 보상/위험 선택감이 부족했음
- 결정: (1) 상자 5등급과 `key_shards`/`instant_heal`/`temporary_stat` 보상 타입, 등급별 reward table, `rewardTableVersion`, `rewardPreview`, `openCost`를 추가. (2) `openHuntingChest()`가 실제 reward를 굴리고 해조각 보상은 즉시 프로필에 반영, HP/임시 스탯은 후속 런 적용용 deferred effect로 반환. (3) `rest_site`, `chest_room`, `cursed_altar`, `champion_intrusion` 이벤트 payload를 생성. (4) 저주받은 제단은 `run.statModifiers`에 gain/loss modifier를 추가하고 전투 클리어 시 지속 층수를 소모. (5) 챔피언 난입은 다음 적을 champion 타입으로 스케일하고 승리 해조각 보상에 1.5배 배율 적용
- 영향: `src/hunting/huntingConfig.js`, `src/hunting/huntingRewards.js`, `src/hunting/chestRewards.js`, `src/hunting/huntingEncounters.js`, `src/hunting/huntingState.js`, `src/hunting/huntingManager.js`, `tests/regression.mjs`, `docs/hunting-grounds-system.md`, `SESSION-HANDOFF.md`
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과

## 진행 중 이슈
- 밸런스 안정화됨 (±20% 이상 극단치 없음). Dash +27% 강세, 일부 캐릭터 약하락
- Time Warp 패널티 인상은 재학습 후 반영
- 사냥터 HP 층간 완전 누적 적용, 휴식지 이벤트 회복량 25%는 임시값
- 사냥터 HP/임시 스탯 상자 보상은 deferred effect payload까지만 반환됨 — 실제 런 시작/진행 UI 적용은 후속 작업
- **Alpine.store() 절대 null 설정 금지** — 모든 서비스/컴포넌트에서 강제해야 함. 대신 `{ visible: false, ... }` 빈 상태 객체 사용
- **ES Module 이중 import 방지**: module-level 변수가 필요한 서비스는 Alpine store에 저장. `index.html`에서 `?v=${V}` import와 JS static import가 다른 instance를 생성할 수 있음.

## 다음 할 일
1. 전체 N×N PPO 학습 결과 저장 구조 설계: `{charId, actionId}`별 Actor/Critic/normalizer 저장 단위 결정
2. 사냥터 deferred effect 적용 UI/런 시작 연결: `instant_heal`, `temporary_stat` 보상을 다음 사냥터 런에 실제 적용
3. Time Warp 패널티 인상분 재학습 및 Dash +27% 강세 밸런스 검토

## [L1] 2026-07-04 — player-panel / tournament-bracket 컴포넌트화 ($dispatch 이벤트 패턴 적용)
- 맥락: 마지막 남은 인라인 Alpine 패널 2개(player-panel, bracket)를 컴포넌트화. player-panel은 x-for 내부 버튼이 많아 기존 `@click="adjustStat()"` 호출이 컴포넌트 x-data 스코프 밖으로 나가면 동작하지 않는 문제가 있음
- 결정: (1) `<player-panel>` — 자체 `x-data="playerPanel"` + `Alpine.reactive()` 상태 + `Alpine.store("playerPanel")` 브릿지. 모든 액션 버튼을 `$dispatch('adjust-stat', {key, delta})`, `$dispatch('random-allocation')`, `$dispatch('reset-allocation')`, `$dispatch('adjust-challenge-level', {delta})`, `$dispatch('open-collection-hub')`로 변경. 이벤트 리스너는 appStore.init()의 `_listenComponentEvents()`에서 document.addEventListener로 등록. (2) `<tournament-bracket>` — `aside.tournament-panel`을 root로 포함, `state.visible`/`phase`/`rounds`를 Alpine.store 브릿지로 제어. (3) `renderPlayerSetup()` — appStore + Alpine.store("playerPanel") 이중 동기화. (4) `renderTournament()` — `Alpine.store("tournamentBracket")`에 visible/phase/rounds 기록. (5) `_syncSummary()` — 추가로 `Alpine.store("playerPanel")`에 allocation/allocationSummary/remainingPoints 동기화. (6) `adjustChallengeLevel()` — 추가로 `_syncPlayerPanelChallenge()` 호출. (7) CSS — player-panel/bracket/tournament-panel 전용 CSS ~52개 규칙을 styles.css에서 제거하고 각 컴포넌트 scoped CSS로 이동
- 영향: `src/components/player-panel.html`(신규), `src/components/tournament-bracket.html`(신규), `src/ui.js`(renderPlayerSetup/renderTournament/_syncSummary store 브릿지 + _listenComponentEvents + _syncPlayerPanelChallenge), `index.html`(store 초기화 2종 + 인라인 패널→컴포넌트 태그 교체), `src/styles.css`(~52개 규칙 제거), `tests/regression.mjs`(store 초기화 2종 추가)
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-04 — 사냥터 전투 컨셉을 1대다 몹 전투로 재정렬
- 맥락: 사용자가 현재 사냥터가 의도와 다르게 로스터 캐릭터 1대1 반복처럼 구성되어 있다고 지적. 사냥터는 기본적으로 플레이어 1명 대 다수 몹 전투여야 하고, 기존 기본 캐릭터들은 일반 적이 아니라 중간 보스 정도로 사용해야 함.
- 결정: 사냥터 전용 몹 스펙을 `melee`/`ranged` 2종으로 추가하고, 일반 층은 다수 몹 팩으로 구성. 3층 단위 또는 `champion_intrusion` 이벤트에서는 로스터 캐릭터를 중간 보스로 변환해 몹과 함께 등장. 플레이어/적은 `hunting-player`/`hunting-enemy` 팀으로 구분해 같은 팀 피해를 방지.
- 결정: 물리 경기장 크기는 유지하고 `ArenaCamera` 렌더 줌으로 사냥터 다수전 시야만 `0.78`로 축소. 일반 1대1은 기본 `1.0` 시야 유지.
- 영향: `src/hunting/huntingMonsters.js`, `src/hunting/huntingManager.js`, `src/simulation/battleSimulation.js`, `src/camera.js`, `src/ui.js`, `src/app.js`, `tests/regression.mjs`, `docs/hunting-grounds-combat-update.md`

## [L1] 2026-07-04 — 사냥터 버튼은 우승 캐릭터가 있을 때만 노출
- 맥락: 사용자가 사냥터는 기본적으로 한 번이라도 우승해서 사용 가능한 캐릭터가 존재할 때 버튼이 생성되어야 한다고 요청.
- 결정: `refreshPlayerSetup()`에서 `getEligibleHuntingCharacters(playerProfile, roster)` 결과를 기준으로 `huntingAvailable` 상태를 계산하고, 메인 화면 사냥터 버튼은 `huntingAvailable && !tournamentActive && !huntingActive`일 때만 표시.
- 영향: `src/app.js`, `src/ui.js`, `index.html`, `tests/regression.mjs`

## [L1] 2026-07-04 — 근접몹은 전용 추적 능력으로 이동
- 맥락: 사용자가 사냥터 근접몹이 움직이지 않는다고 보고. 기존 근접몹은 `dash` 능력을 재사용해 쿨다운 돌진 외에는 플레이어 추적형 몹처럼 보이지 않았음.
- 결정: `HuntingMeleeAbility`를 추가해 근접몹이 매 프레임 가장 가까운 적을 향해 조향하도록 변경. 근접몹 스펙은 `ability: "hunting_melee"`를 사용하고, 시뮬레이션/UI ability map에 등록.
- 검증: 수치 시뮬레이션에서 근접몹과 플레이어 거리 `460 -> 187.55` 감소 확인. `npm test`, `npm run check`, `npm run format:check` 통과.
- 영향: `src/abilities/huntingMeleeAbility.js`, `src/abilities/index.js`, `src/hunting/huntingMonsters.js`, `src/simulation/battleSimulation.js`, `src/ui.js`, `tests/regression.mjs`

## [L1] 2026-07-04 — 사냥터는 실제 물리 맵을 키우고 카메라는 전체 맵에 맞춤
- 맥락: 사용자가 기존 구현은 카메라 줌만 바뀌고 실질 맵 크기가 커지지 않았다고 지적. 카메라는 기본적으로 전체 맵을 보이게 하고, 사냥터는 실제 맵 크기를 더 크게 조절해야 함.
- 결정: `BattleSimulation`이 `arenaWidth`/`arenaHeight` 옵션을 받아 실제 `Simulation.width/height`를 바꾸도록 변경. 사냥터는 `HUNTING_ARENA` 1280×1280을 사용. `ArenaCamera`는 전투원 수 기반 자동 줌아웃을 제거하고 현재 시뮬레이션 맵 전체를 캔버스에 fit-to-map으로 맞춤.
- 검증: 수치 시뮬레이션에서 사냥터 arena `[1280,1280]`, 960 캔버스 cameraScale `0.75` 확인. `npm test`, `npm run check`, `npm run format:check` 통과.
- 영향: `src/hunting/huntingConfig.js`, `src/hunting/huntingManager.js`, `src/simulation/battleSimulation.js`, `src/camera.js`, `src/ui.js`, `src/app.js`, `tests/regression.mjs`, `docs/hunting-grounds-combat-update.md`

## [L1] 2026-07-05 — player-panel $dispatch → $store._actions 전환 (버튼 무반응 디버깅 중)
- 맥락: `@click="$dispatch(...)"` 이벤트가 `template.cloneNode(true)`로 복제된 컴포넌트 내부에서 `document` 리스너까지 전파되지 않는 문제. `_listenComponentEvents()`를 appStore.init()에서 등록해 document가 이벤트를 수신하게 했으나, 실제 브라우저에서 버튼이 여전히 무반응.
- 결정: $dispatch 이벤트 패턴을 폐기하고 `Alpine.store("playerPanel")._actions` 콜백 객체로 전환. UIController._exposeActionsToPlayerPanel()이 `renderPlayerSetup()` 실행 직후 store._actions에 바인딩된 콜백({adjustStat, randomAllocation, resetAllocation, adjustChallengeLevel, openCollectionHub})을 저장. 템플릿은 `@click="$store.playerPanel._actions.adjustStat(key, delta)"`로 직접 호출. _listenComponentEvents() 제거.
- 영향: `src/components/player-panel.html`(@click 모두 $store._actions로 변경, state getter 제거), `src/ui.js`(_exposeActionsToPlayerPanel 추가, _listenComponentEvents 제거), `index.html`(store 초기화에 _actions: null 추가)
- 검증: `npm test`, `npm run format:check` 통과. BUT 브라우저에서 버튼 여전히 무반응 (원인 불명)
- 미해결 원인 추정: `$watch("$store.playerPanel", callback)`가 전체 store 참조를 감시하므로 store 내부 속성 변경(alocation 등)이 발생해도 watcher가 재실행되지 않을 가능성. 현지 `state → `$store.playerPanel` 직접 참조로 전환 시도 예정. player-panel 템플릿이 `state.xxx` 대신 `$store.playerPanel.xxx`를 직접 사용하면 watcher 회피 가능.

## [L1] 2026-07-05 — 사냥터 몹 사망 즉시 폭발 이펙트 + 화면 제거
- 맥락: 몹 캐릭터가 HP=0이 되면 `flags.defeated=true`만 설정되어 `update()`가 중단되지만 `draw()`는 계속 그려서 죽은 몹이 멈춰있는 버그처럼 보임
- 결정: (1) `BattleBall.takeDamage()`에서 HP<=0 시 `flags.destroyed=true`를 함께 설정하고 `sim.spawnDeathExplosion()` + 로그를 즉시 호출. (2) `BattleSimulation.resolveResult()`에서 이미 `flags.destroyed`가 true인 패자는 중복 이펙트를 건너뛰도록 `continue` 추가.
- 영향: `src/entities/battleBall.js:304-311`, `src/simulation/battleSimulation.js:435`
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-05 — 몹 전투원 fighter strip 제외 + 인게임 HP바
- 맥락: 몹이 많으면 fighter strip이 늘어나 캔버스가 위로 밀리는 레이아웃 문제. UX 개선 요청으로 미니보스만 strip 표시, 일반 몹은 캔버스 내 HP 바로만 확인.
- 결정: (1) `ui.js renderRoster()`에서 `fighter.hunting?.isMob` 필터 추가. (2) `BattleBall`에 `this.hunting = spec.hunting` 저장. (3) `BattleBall._drawMobHpBar()` 신규 — 몹 볼 위에 컬러 구간 HP바 렌더링 (초록>노랑>빨강).
- 영향: `src/ui.js:469`(필터), `src/entities/battleBall.js:48,317-322,347-361`(hunting prop, HP바)
- 검증: `npm test`, `npm run format:check` 통과

## [L1] 2026-07-05 — 장비 시스템 MVP (상자 보상 교체 + 인벤토리 + 스탯 적용)
- 맥락: 상자가 INSTANT_HEAL/TEMP_STAT 일시적 효과를 주고 있었으나, docs/equipment-system.md 설계대로 장비를 주도록 변경. deferredEffects 체계 정리.
- 결정: (1) INSTANT_HEAL/TEMP_STAT 제거 — `HUNTING_CHEST_REWARD_TYPES`에서 삭제, 보상 테이블에서 항목 제거, `_consumeDeferredEffects()`, `_pendingHeal`, `deferredEffects` 필드 전면 제거. (2) `src/hunting/equipmentConfig.js` 생성 — 슬롯/등급별 스탯 범위, 특수 옵션 풀, 장비 이름 풀, `createEquipmentInstance()`, `applyEquipmentStats()`, `getEquippedStatBonuses()`. (3) 프로필 `equipment.inventory/equipped/enhancementStones/maxInventorySlots` 추가 + sanitize. (4) 상자 보상 테이블에 EQUIPMENT 타입 추가 — SHARDS와 장비 2지선다. (5) `openHuntingChest()` → 장비 인스턴스 생성 → 인벤토리 추가 → 팝업에 장비 정보 표시. (6) `applyEquipmentStats()`를 `huntingManager._startFloorBattle()`에 적용. (7) 컬렉션 허브 장비 탭 추가 — 슬롯 현황 + 인벤토리 목록 + 장착/해제 버튼. (8) equip/unequip 브릿지 메서드 추가.
- 영향: `src/hunting/equipmentConfig.js`(신규), `src/hunting/huntingConfig.js`, `src/hunting/huntingRewards.js`, `src/hunting/chestRewards.js`, `src/hunting/huntingManager.js`, `src/playerProfile.js`, `src/collectionHubService.js`, `src/componentBridge.js`, `src/components/collection-hub.html`, `src/collection/collectionViewModel.js`, `tests/regression.mjs`
- 검증: `npm test`, `npm run format` 통과

## [L1] 2026-07-05 — 파편 리네임 + 상자 개봉 UI + deferredEffects 적용
- 맥락: "해조각" 명칭을 "파편"으로 변경. 상자 개봉/보상 시스템 미완성 상태를 완료.
- 결정: (1) `keyShards`→`shards`, `KEY_SHARDS`→`SHARDS`, `rollKeyShardReward`→`rollShardReward`, 상수명 전체 리네임, UI 텍스트 "해조각"→"파편". (2) `profile.hunting.deferredEffects` 배열 추가 — INSTANT_HEAL/TEMP_STAT 보상을 프로필에 저장. (3) `huntingManager._consumeDeferredEffects()` 사냥터 런 시작 시 deferredEffects 소비 (HP 회복, 임시 스탯 버프). (4) `collectionHubService.openChest()` 보관함 개봉 로직 연결. (5) collection-hub storage 탭 상자 카드에 `@click` + `openChest(item)` 핸들러. (6) 개봉 결과 PopupService 팝업 표시. (7) epic/legendary CSS + 필터 옵션 추가.
- 영향: `src/components/collection-hub.html`, `src/collectionHubService.js`, `src/componentBridge.js`, `src/hunting/chestRewards.js`, `src/hunting/huntingConfig.js`, `src/hunting/huntingManager.js`, `src/hunting/huntingRewards.js`, `src/hunting/huntingState.js`, `src/playerProfile.js`, `src/collection/collectionViewModel.js`, `tests/regression.mjs`
- 검증: `npm test`, `npm run format` 통과

## [L1] 2026-07-05 — 몹 랜덤 외형 시스템 (다각형 몸 + 다양한 표정)
- 맥락: 사냥터 몹이 모두 동그란 원형 + 기본 표정이라 단조로움. 랜덤 외형으로 다양화 요청.
- 결정: (1) `src/entities/mobAppearance.js` 신규 — BODY_SHAPES(0/3/4/5/6/8각형), FACE_TEMPLATES 8종(default/angry/xeye/ooo/dash/skele/cyclops/happy), `generateMobAppearance(rng)` 내보냄. (2) `BattleBall.appearance`에 `{sides, face}` 저장. (3) `draw()`에서 `sides>0`이면 `_drawPolygonBody()`로 n각형 렌더링(짝수는 상단 평면 정렬). (4) `drawFace()`에서 ability fallback 후 `_drawAppearanceFace()` 호출. (5) `createHuntingMobSpec()`에서 `appearance: generateMobAppearance(rng)` 추가.
- 영향: `src/entities/mobAppearance.js`(신규), `src/entities/battleBall.js`, `src/entities/index.js`, `src/hunting/huntingMonsters.js`
- 검증: `npm test`, `npm run format:check` 통과

## 진행 중 이슈 (2026-07-05 갱신)
- **player-panel 버튼 무반응**: `$store._actions` 콜백은 논리적으로 정상 (`UIController._exposeActionsToPlayerPanel`가 `this.state?.adjustStat()`를 바인딩). 원인이 `$watch` 의존성 추적 문제일 가능성이 높아, `state` + watcher 패턴을 폐기하고 템플릿이 직접 `$store.playerPanel.xxx`를 읽도록 전환할 계획. `$store`는 Alpine magic으로 의존성 추적이 정확함.
- **사냥터 deferred effect UI 연결**: instant_heal/temporary_stat 보상은 payload까지만 반환, 실제 런 연결은 미구현

## 다음 할 일 (2026-07-05 갱신)
1. **player-panel 버튼 수정**: `state` + `$watch` → `$store.playerPanel.*` 직접 템플릿 참조로 전환 (watcher 의존성 추적 우회)
2. 전체 N×N PPO 학습 결과 저장 구조 설계
3. 사냥터 deferred effect 적용 UI/런 시작 연결
4. Time Warp 패널티 인상분 재학습 및 Dash +27% 강세 밸런스 검토

## [L1] 2026-07-05 — player-panel 스탯 버튼 브라우저 검증 및 회귀 테스트 고정
- 맥락: 이전 핸드오프에서 player-panel 스탯 버튼이 실제 브라우저에서 무반응이라고 기록되어 있었고, `$store.playerPanel._actions` 연결 경로가 의심 대상이었다.
- 결정: 로컬 브라우저에서 `http://127.0.0.1:4173/`를 열어 첫 체력 `+` 버튼 클릭을 검증했다. 클릭 후 체력 배분이 `0% → 1%`, 남은 포인트가 `100 → 99`로 갱신되어 현재 구현은 정상 동작함을 확인했다. 재발 방지를 위해 `renderPlayerSetup()` 회귀 테스트에 `playerPanel` store `_actions.adjustStat()`가 appStore allocation과 store allocation/remainingPoints를 함께 동기화하는 검증을 추가했다.
- 영향: `tests/regression.mjs`

## [L2] 2026-07-05 — UI 컴포넌트 store 복사층 제거 + 액션 패턴 통일
- 배경: UI 컴포넌트화 과정에서 단순 표시 컴포넌트도 `$watch("$store...")`로 store를 로컬 `Alpine.reactive()` state에 복사하고 있어 불필요한 중간 상태가 늘어났다. 또한 버튼 액션이 `$dispatch`, `window.ballFightApp`, `$store._actions`로 섞여 있어 다음 컴포넌트 작업의 기준이 흐려졌다.
- 결정: 중첩 컴포넌트 로더는 사용자가 의도적으로 제외한 단순 로딩 구조를 유지한다. 대신 start-button/hunting-button/battle-log/fighter-strip/game-overlay/tournament-bracket/player-panel은 가능한 범위에서 `$store` 직접 참조로 전환하고, 사용자 액션은 store `_actions` 콜백으로 통일한다. `UIController`에는 `getAlpineStore`/`patchAlpineStore`/`setAlpineStore` 헬퍼를 추가해 반복 store 접근을 줄인다.
- 영향: `src/components/*.html` 일부, `src/ui.js`, `src/app.js`, `index.html`, `tests/regression.mjs`
- 검증: `npm test`, `npm run check`, `npm run format:check`, 브라우저에서 스탯 버튼/자동 배분/시작 버튼 흐름 확인

## [L1] 2026-07-05 — 태그 컴포넌트 정의는 빈 스코프라도 유지
- 맥락: store 직접 참조로 단순화하는 과정에서 일부 태그 컴포넌트의 루트 `x-data`와 `<script> Alpine.data(...)` 등록까지 제거되어, 파일 구조상 컴포넌트 정의가 사라진 것처럼 보이는 문제가 있었다.
- 결정: start-button/hunting-button/battle-log/fighter-strip/game-overlay/player-panel/tournament-bracket는 `$store` 직접 참조를 유지하되, 루트 `x-data="<componentName>"`와 `<script> Alpine.data("<componentName>", () => ({})) </script>`를 반드시 둔다. 로컬 state 복사와 watcher는 필요한 컴포넌트에만 사용한다.
- 영향: `src/components/start-button.html`, `src/components/hunting-button.html`, `src/components/battle-log.html`, `src/components/fighter-strip.html`, `src/components/game-overlay.html`, `src/components/player-panel.html`, `src/components/tournament-bracket.html`, `docs/alpine-component-system.md`

## [L1] 2026-07-05 — UI 핸들러는 컴포넌트에, 게임 로직은 app/game에 둔다
- 맥락: `_actions`를 Alpine store에 주입하는 방식은 store가 데이터 브릿지가 아니라 콜백 레지스트리가 되어 책임 경계가 흐려졌다. 사용자는 UI 관련 로직은 컴포넌트가 갖고, 게임 관련 로직은 게임/app 쪽 공개 핸들러에 남는 구조를 요청했다.
- 결정: start-button/hunting-button/game-overlay/player-panel의 `@click`은 컴포넌트 `Alpine.data()` 메서드를 호출한다. 컴포넌트 메서드는 `window.BallFightComponentBridge`를 통해 `appStore()` 또는 `BattleApp`/`HuntingManager` 공개 메서드를 호출한다. `Alpine.store()`의 `_actions` 초기값과 `BattleApp._exposeComponentActions()`, `UIController._exposeActionsToPlayerPanel()`는 제거한다.
- 영향: `src/componentBridge.js`, `src/components/start-button.html`, `src/components/hunting-button.html`, `src/components/game-overlay.html`, `src/components/player-panel.html`, `index.html`, `src/app.js`, `src/ui.js`, `tests/regression.mjs`, `docs/alpine-component-system.md`, `docs/development-rules.md`

## [L1] 2026-07-05 — 장비 시스템: 상자 보상을 장비로 교체 (INSTANT_HEAL/TEMP_STAT 제거)
- 맥락: 상자가 INSTANT_HEAL/TEMP_STAT 같은 일시적 효과 대신 docs/equipment-system.md 설계대로 장비를 주도록 변경.
- 결정: (1) `HUNTING_CHEST_REWARD_TYPES`에서 INSTANT_HEAL/TEMP_STAT 삭제, deferredEffects 체계 전면 제거(`_consumeDeferredEffects()`, `_pendingHeal`, `deferredEffects` 필드). (2) `src/hunting/equipmentData.js` — 순수 계층형 설정 데이터(EQUIPMENT.SLOTS.WEAPON 형태). (3) `src/hunting/equipmentConfig.js` — create/apply/disassemble/expandInventory. (4) 프로필 `equipment.inventory/equipped/enhancementStones/maxInventorySlots`. (5) 상자 보상 SHARDS+EQUIPMENT 2지선다, 용량 초과 시 `inventory_full` 차단. (6) 컬렉션 허브 장비 탭(슬롯/인벤토리/장착/해제/분해/확장). (7) `componentBridge.js`에 expandInventory/disassembleItem 추가.
- 영향: `src/hunting/equipmentData.js`(신규), `src/hunting/equipmentConfig.js`(신규), `src/hunting/chestRewards.js`, `src/hunting/huntingRewards.js`, `src/hunting/huntingManager.js`, `src/playerProfile.js`, `src/collectionHubService.js`, `src/componentBridge.js`, `src/components/collection-hub.html`, `src/collection/collectionViewModel.js`, `tests/regression.mjs`
- 검증: `npm test`, `npm run format` 통과. `node scripts/huntingUserScenario.mjs` 100런 인벤토리 초과 없이 정상 동작.

## [L1] 2026-07-05 — 사냥 시뮬레이션 스크립트 (huntingSim + huntingUserScenario)
- 맥락: 장비 드롭 분포와 인벤토리 관리 시나리오를 시뮬레이션으로 검증 필요. 추측만으로 코드 수정 금지 규칙에 따라 먼저 시뮬레이션.
- 결정: (1) `scripts/huntingSim.mjs` — 장비 드롭/스탯 분포 시뮬레이터. OVERRIDES 블록으로 rarity 비율/스탯 범위 조절 가능. (2) `scripts/huntingUserScenario.mjs` — 실제 유저 시나리오: 100런 반복, 파편 순환, 인벤토리 관리(확장/분해), 장비 스탯 성장 추적. 10런 단위 리포트.
- 영향: `scripts/huntingSim.mjs`(신규), `scripts/huntingUserScenario.mjs`(신규)
- 검증: 시뮬레이션에서 인벤토리 초과 자동 탐지 → expandInventory/disassembleEquipment 추가 → 정상 순환 확인 (인벤토리 40/41, 확장 12회, 파편 1787 잔여)

## [L2] 2026-07-05 — 컬렉션 허브 글자색 버그 수정
- 배경: `body` 기본 글자색 `--text: #f4f7fb`(거의 흰색)이 `.ch-frame`(배경 `#ffffff`)에 상속되어 흰 바탕에 흰 글자가 되어 안 보임.
- 결정: `.ch-frame`에 `color: #202020` 추가. 중복으로 지정된 `color: #202020` 10개 요소에서 제거 (이제 상속받음).
- 영향: `src/components/collection-hub.html`

## 진행 중 이슈 (2026-07-05 갱신)
- 장비 시스템 MVP 완료. 강화(Enhancement) 시스템 미구현.
- 인벤토리 자동 관리: 확장(파편 100→+3칸, 최대 100), 분해(등급별 강화석).
- 사냥 deferred effects 완전 제거됨 (장비 시스템으로 대체).

## [L1] 2026-07-05 — 장비 강화 시스템 구현
- 맥락: docs/equipment-system.md 설계에 따른 강화 시스템 MVP 구현. 장비 스탯 % 증가, 실패 확률, 분해 시 강화 단계 비례 보상.
- 결정: (1) `equipmentData.js` — ENHANCE 상수 추가(MAX_LEVEL=5, MAX_FAILURE_RATE=0.8, STAT_BONUS_PER_LEVEL=0.2, COST 테이블). (2) `equipmentConfig.js` — `calculateEnhanceCost()`, `calculateEnhanceFailureRate()`, `enhanceEquipment()` (성공 시 +1레벨, 실패 시 -1레벨(0下限)). 분해 시 `enhanceLevel` 비례 추가 보상(+50%/레벨). `getEquippedStatBonuses()`에 강화 배율 반영. (3) `instanceId` 중복 버그 수정 — `_eqCounter` 추가. (4) `componentBridge.js` — `enhanceItem()` 동적 import. (5) `collectionViewModel.js` — 각 장비에 `canEnhance`, `enhanceCost`, `enhanceFailureRate` 추가. (6) `collection-hub.html` — 카드 헤더에 `+N` 강화 레벨 배지, 액션에 강화 버튼(실패율 표시). (7) `src/hunting/index.js` — `equipmentConfig.js` re-export 추가.
- 영향: `src/hunting/equipmentData.js`, `src/hunting/equipmentConfig.js`, `src/hunting/index.js`, `src/componentBridge.js`, `src/collection/collectionViewModel.js`, `src/components/collection-hub.html`, `tests/regression.mjs`
- 검증: `npm test` 4/4 ok, `npm run format` 통과. 회귀 테스트에서 강화 성공/실패/0下限/최대레벨차단/재료부족/스탯반영/없는장비 케이스 모두 검증.

## 진행 중 이슈 (2026-07-05 갱신)
- 장비 시스템 MVP + 강화 완료. 합성 승급/판매/레벨 제한/외형 draw는 미구현.
- `createEquipmentInstance` instanceId 중복 방지용 `_eqCounter` 도입 (모듈 수준 카운터).

## 다음 할 일 (2026-07-05 갱신)
1. **장비 합성 승급 시스템**: 같은 등급 장비 2개 + 추가 재료 → 한 단계 높은 등급 장비 1개. 캐릭터 레벨 제한 적용.
2. 장비 판매 (파편 환급)
3. 전체 N×N PPO 학습 결과 저장 구조 설계
4. Time Warp 패널티 인상분 재학습 및 Dash +27% 강세 밸런스 검토

## [L1] 2026-07-05 — 장비 합성/판매 및 토너먼트 적용 검증
- 맥락: 사용자가 장비 시스템 구현과 테스트 구성을 이어서 완료/검증하라고 요청. 기존 구현은 강화/분해/확장까지 있었고, 문서상 중복 장비 처리(합성/판매)와 토너먼트 장비 스탯 적용이 비어 있었음.
- 결정: 같은 등급 장비 2개 + 강화석/파편 비용으로 다음 등급 랜덤 장비 1개를 만드는 합성 승급, 등급별 파편 환급 판매를 추가. 장비 스탯은 사냥터뿐 아니라 토너먼트 시작 시 플레이어 스펙에도 적용. 컬렉션 허브 장비 카드에 합성/판매 버튼과 비용/보상 정보를 노출.
- 영향: `src/hunting/equipmentData.js`, `src/hunting/equipmentConfig.js`, `src/collection/collectionViewModel.js`, `src/components/collection-hub.html`, `src/componentBridge.js`, `src/app.js`, `tests/regression.mjs`, `scripts/huntingUserScenario.mjs`, `docs/equipment-system.md`
- 검증: `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과. 회귀 테스트에서 강화/합성/판매/토너먼트 장비 스탯 적용을 검증.

## 진행 중 이슈 (2026-07-05 갱신)
- 장비 시스템 MVP + 강화 + 합성/판매 완료. 캐릭터 레벨 제한과 장비 외형 draw는 미구현.
- 합성 MVP 수치: common→uncommon 강화석2/파편20, uncommon→rare 강화석5/파편40, rare→epic 강화석12/파편80, epic→legendary 강화석25/파편150.

## [L1] 2026-07-05 — 장비 외형 draw 구현
- 맥락: 사용자가 장비 draw 구현을 요청. 기존 장비 시스템은 스탯/인벤토리/강화/합성/판매까지 있었지만 전투 캔버스에서 장착 장비가 보이지 않았음.
- 결정: 프로필에는 함수 대신 순수 데이터 `draw` 키(`weapon`/`armor`/`accessory`)만 저장하고, 런타임에서 `src/entities/equipmentVisuals.js`가 슬롯/등급별 draw 함수를 해석한다. `applyEquipmentStats()`는 장착 장비 목록을 `equipment.equippedItems`로 전투 스펙에 전달하고, `BattleBall.draw()`는 몸체 렌더링 후 무기/방어구/장신구 오버레이를 그린다.
- 영향: `src/hunting/equipmentData.js`, `src/hunting/equipmentConfig.js`, `src/entities/equipmentVisuals.js`, `src/entities/battleBall.js`, `src/components/collection-hub.html`, `src/componentLoader.js`, `index.html`, `src/patchNotes.js`, `tests/regression.mjs`, `docs/equipment-system.md`
- 검증: `npm test`, `npm run check`, `npm run format:check` 통과. 로컬 브라우저 새 로드에서 `v0.24.2` 패치노트 노출, 로딩 제거, 컬렉션 허브 마운트, 새 로드 이후 콘솔 에러 없음 확인.

## [L1] 2026-07-05 — 장비 캐릭터 레벨 제한 적용
- 맥락: 장비 시스템의 다음 미구현 항목이 캐릭터 레벨 제한이었고, 문서상 Rare/Epic/Legendary 장비는 캐릭터별 XP 레벨 요구 조건을 만족해야 장착 가능해야 했다. 구현 전 시뮬레이션에서 Lv.1 캐릭터도 Rare 장비 스탯을 받는 결함을 확인했다.
- 결정: 등급별 요구 레벨(Common 1, Uncommon 3, Rare 5, Epic 8, Legendary 10)을 `equipmentData`에 추가하고, `equipmentConfig`에 요구 레벨/캐릭터 레벨/장착 가능 판정 함수를 모았다. `applyEquipmentStats()`와 `getEquippedItems()`는 `spec.id`의 캐릭터 레벨을 기준으로 잠긴 장비를 스탯/외형에서 제외한다. 컬렉션 허브 장비 카드는 요구 레벨과 잠김 상태를 보여주며, 실제 장착 액션도 같은 판정으로 차단한다. 토너먼트 시작 시 장비 외형 목록도 전투 스펙에 복사하도록 보강했다.
- 영향: `src/hunting/equipmentData.js`, `src/hunting/equipmentConfig.js`, `src/componentBridge.js`, `src/collection/collectionViewModel.js`, `src/components/collection-hub.html`, `src/app.js`, `src/patchNotes.js`, `index.html`, `tests/regression.mjs`, `docs/equipment-system.md`
- 검증: 구현 전 `scripts/equipmentLevelLimitProbe.mjs`로 Lv.1 Rare 장비 스탯이 적용되는 결함 확인 → 구현 후 Lv.1 damage 10 / Lv.5 damage 18로 수정 확인 후 임시 스크립트 제거. `npm test`, `npm run check`, `npm run format:check`, `node scripts/huntingUserScenario.mjs` 통과.

## 진행 중 이슈 (2026-07-05 갱신)
- 장비 시스템 MVP + 강화 + 합성/판매 + 슬롯별 외형 draw + 캐릭터 레벨 제한 + 시작 전 장비 UI 연결 완료. 아이템별 고유 외형 세분화는 추후 결정.

## [L1] 2026-07-05 — 시작 전 장비 화면 UI 연결
- 맥락: 사용자가 장비 화면 UI 진행을 요청. 컬렉션 허브 장비 탭은 이미 실제 관리 UI를 제공하므로, 토너먼트/사냥터 입장 직전 중복 UI를 새로 만들기보다 시작 패널에서 현재 장비 상태를 확인하고 장비 탭으로 바로 진입하는 흐름이 적합했음.
- 결정: player-panel에 장비 요약 블록을 추가해 현재 캐릭터 레벨, 인벤토리 사용량, 슬롯별 장착/잠김 상태, 적용 중인 장비 스탯을 표시한다. “장비 화면” 버튼은 `BallFightComponentBridge.openCollectionHub("equipment")`를 통해 컬렉션 허브 장비 탭을 연다. `UIController.renderPlayerSetup()`과 Alpine store 초기값, 테스트 하네스를 모두 같은 `equipmentSummary` 구조로 맞춘다.
- 영향: `src/app.js`, `src/ui.js`, `src/components/player-panel.html`, `index.html`, `src/patchNotes.js`, `tests/regression.mjs`, `docs/equipment-system.md`
