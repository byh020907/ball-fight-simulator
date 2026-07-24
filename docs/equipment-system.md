# 장비 시스템

> 상태: 조합 장비 도메인 체크포인트 완료. UI와 전투 패시브 연결은 후속 단계가 소유합니다.

## 영구 조합 모델

장비는 이름과 성능이 고정된 템플릿이다. 무작위 등급 인스턴스, 강화, 판매, 등급 합성은 새 프로필에 저장하지 않는다.

- 기초 15종, 중간 12종, 완성 12종으로 총 39종이다.
- `basic`, `intermediate`, `completed`가 내부 tier 키다.
- 템플릿은 안정 ID, 정식명, 검수된 `iconTag`, 원시 스탯, 누적 파편 가치, 직접 레시피, 완성 장비의 `passiveId`를 가진다.
- 중간·완성 레시피는 직접 재료를 최대 3개만 사용한다. 완성 장비를 다른 장비의 재료로 쓰지 않아 DAG를 유지한다.

정적 레지스트리는 `src/hunting/equipmentTemplates.js`가 단독 소유한다. `getEquipmentTemplate(id)`로 조회하고, `validateEquipmentTemplateRegistry()`로 39종·recipe·passive 계약을 검증한다.

## 가치와 조합 비용

가치 1포인트는 HP 10, 공격 1, 방어 6, 속도 15, 스킬 가속 6, 치명타 7%p, 질량·벽 반사·회전 충격 원시값 각각 7%다.

- 조합비는 직접 재료의 누적 비용 합계의 25%를 25파편 단위로 올림한다.
- 재료 가치와 조합비는 누적 비용에 보존한다.
- 조합으로 얻는 대표 스탯에는 조합비 100파편당 가치 1포인트를 더한다.
- 실제 스탯은 0.5 단위로 반올림한다.

`calculateEquipmentValuePoints`, `calculateCombinationCost`, `calculateCombinedStats`, `roundEquipmentStat`은 순수 함수다.

## 프로필과 인벤토리

프로필 버전은 12다. v11 이하의 저장은 장비를 포함한 베타 프로필 전체를 기본값으로 초기화한다. v12 저장은 sanitize 후 round-trip한다.

```js
equipment: {
    inventory: { [templateId]: count }, // 종류별 1~100
    equipped: [templateId | null, templateId | null, templateId | null,
               templateId | null, templateId | null, templateId | null]
}
```

장착은 공용 6칸이다. 기초·중간 장비는 보유 수량 이내에서 중복 장착할 수 있다. 같은 완성 ID는 한 번만 장착할 수 있다. 파편은 기존대로 `profile.hunting.shards`가 소유한다.

`src/hunting/equipmentInventory.js`는 수량 변경, 장착/해제, 조합 미리보기·실행, 정렬과 장착 원시 스탯 합계를 제공한다. UI는 이 모듈의 결과만 사용하며 재료·수량·파편을 직접 변경하지 않는다.

## 후속 UI 체크포인트 API

- `addEquipmentQuantity(profile, templateId, amount)` / `removeEquipmentQuantity(...)`
- `canEquipEquipmentTemplate(profile, templateId, slotIndex)` / `equipEquipmentTemplate(...)` / `unequipEquipmentTemplate(...)`
- `getEquipmentRecipePreview(profile, templateId)` / `craftEquipmentTemplate(profile, templateId)`
- `sortEquipmentInventory(profile)`, `getEquippedEquipmentTemplates(profile)`, `getEquippedEquipmentStats(profile)`

기존 상자·업적 보상이 새 UI로 옮겨가기 전에는 `src/hunting/equipmentLegacyAdapter.js`가 레거시 보상 객체를 기초 템플릿 수량으로 한 번 변환한다. 이 adapter는 레거시 인스턴스나 무작위 장비를 새 인벤토리에 만들지 않는다.

## 컬렉션 장비 화면

컬렉션 허브의 `장비` 탭은 수량형 인벤토리를 직접 조작하지 않는 presentation 화면이다.

- 공용 장착 슬롯 6개와 39종 카탈로그를 기초·중간·완성 순서로 표시한다.
- 카드에는 Canvas `x-equipment-icon-tag`, 정식명, 보유 수량, 원시 스탯을 보이고, 선택한 카드의 상세 영역에서 재료 `보유/필요`, 조합 비용과 결과 스탯을 확인한다.
- 기초 장비는 보유 수량과 빈 슬롯이 있을 때 장착한다. 중간·완성 장비는 재료와 파편이 모두 있을 때 같은 상세 영역의 `조합`으로 만든 뒤 즉시 수량을 갱신한다.
- 조합 실패는 `missing ingredients`, `missing shards`, `capacity`, `recipe` 도메인 이유를 화면 문구로만 변환한다. UI는 재료·수량·파편을 직접 변경하지 않는다.
- `BallFightComponentBridge`의 공개 경계는 `equipEquipmentTemplate(templateId, slotIndex?)`, `unequipEquipmentSlot(slotIndex)`, `craftEquipmentTemplate(templateId)` 세 명령이다.

강화, 판매, 랜덤 합성, 상점, 인벤토리 확장과 등급/장비 유형 전용 슬롯은 이 화면에 제공하지 않는다. 전투 스탯 적용과 12종 완성 패시브 런타임도 후속 체크포인트 범위다.
