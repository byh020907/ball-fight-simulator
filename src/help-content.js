// ── 게임 시스템 도움말 콘텐츠 ──────────────────────────────────────────────
//
// PopupService.show({ bodyHtml: HELP_CONTENT }) 로 사용합니다.
// ─────────────────────────────────────────────────────────────────────────────

export const HELP_TITLE = "게임 도움말";

export const HELP_CONTENT = `
<div class="help-section">
  <h4 class="help-h">🎯 기본 규칙</h4>
  <p>두 공이 충돌하며 데미지를 주고받습니다. 상대를 먼저 쓰러뜨리는 쪽이 승리합니다.</p>
</div>

<div class="help-section">
  <h4 class="help-h">📊 스탯 배분</h4>
  <p>시작 전 <b>체력</b>, <b>공격</b>, <b>속도</b>에 총 100포인트를 자유롭게 배분할 수 있습니다.</p>
  <ul>
    <li><b>체력 (HP)</b> — 최대 체력이 1%씩 증가합니다.</li>
    <li><b>공격 (ATK)</b> — 충돌 데미지 배율이 1%씩 증가합니다.</li>
    <li><b>속도 (SPD)</b> — 이동 속도가 1%씩 증가합니다.</li>
  </ul>
</div>

<div class="help-section">
  <h4 class="help-h">⚖️ 밸런스 배율</h4>
  <p>스탯을 <b>골고루 분배</b>할수록 더 높은 전투 배율을 받습니다.<br>
  한쪽에 몰아주면 배율이 낮아집니다. (최대 ×2.0, 최소 ×1.3)</p>
</div>

<div class="help-section">
  <h4 class="help-h">💥 전투 시스템</h4>
  <ul>
    <li><b>충돌</b> — 상대와 부딪힐 때 상대 속도와 각도에 비례한 데미지를 줍니다.</li>
    <li><b>벽꿍</b> — 벽에 튕길 때 일정 데미지를 추가로 받습니다.</li>
    <li><b>오버타임</b> — 26초 이후 데미지와 속도가 점점 증가합니다.</li>
  </ul>
</div>

<div class="help-section">
  <h4 class="help-h">⭐ 고유 능력</h4>
  <p>각 캐릭터는 하나의 고유 능력을 가집니다. 쿨타임이 차면 자동으로 발동합니다.</p>
  <ul>
    <li><b>Archer</b> — 관통 화살을 발사합니다.</li>
    <li><b>Orbit</b> — 회전하는 궤도 파편으로 적을 공격합니다.</li>
    <li><b>Trickster</b> — 적을 추적하는 씨앗 3개를 발사합니다.</li>
    <li><b>Grenade</b> — 지연 폭탄을 투척합니다. 빗나갈수록 fuse가 짧아집니다.</li>
    <li><b>Dash</b> — 적을 추적하는 돌진. 충돌 시 데미지를 주고 쿨타임이 감소합니다.</li>
    <li><b>Rage</b> — 충돌 없이 오래 있을수록 속도와 공격 배율이 상승합니다.</li>
    <li><b>Eater</b> — 충돌 시 상대를 삼켜 피해를 입히고 내뱉습니다.</li>
  </ul>
</div>

<div class="help-section">
  <h4 class="help-h">🏆 목표</h4>
  <p>토너먼트를 진행하여 최종 우승자가 되세요.</p>
</div>
`;
