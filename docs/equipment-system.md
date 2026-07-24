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

## 범위 경계

이번 단계는 장비 카드·인벤토리 화면·전투 스탯 적용·12종 패시브 런타임을 구현하지 않는다. 완료 장비의 `passiveId`와 원시 스탯 합계만 다음 단계의 UI 및 `CombatEquipmentSet` 경계에 제공한다.
