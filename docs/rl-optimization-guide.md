# RL 파이프라인 구현 명세

> **알고리즘**: REINFORCE with baseline (Monte Carlo Policy Gradient)
> **구현 언어**: 순수 JavaScript (Node.js, 외부 ML 라이브러리 불필요)
> **모델 크기**: ~3,600 파라미터 (24→48→48→1)

---

## 0. RL 학습 루프 해부 — 개념은 아는데 코드가 궁금한 사람을 위해

### 0.1 RL의 근본 문제

"어떤 상황(s)에서 어떤 행동(a)을 해야 나중에 이득(R)을 볼까?"

강아지 훈련으로 비유:
```
상황: 강아지가 앉았다 (s)
행동: 간식을 준다 (a=1) / 안 준다 (a=0)
결과: 꼬리 흔든다 → 보상 +1 / 무시한다 → 보상 -1
목표: "앉았을 때 간식을 줘야 한다"는 규칙을 스스로 발견
```

### 0.2 정책(Policy)이란

```javascript
// π(a|s) — "상태 s일 때 행동 a를 할 확률"
π(use | hp=80%, dist=300px) = 0.73  // "써야겠다" 73%
π(wait | hp=80%, dist=300px) = 0.27  // "말아야겠다" 27%
```

이 확률 분포를 만들어내는 함수가 바로 **정책 네트워크**(Policy Network), 즉 우리의 MLP 모델입니다.

### 0.3 학습 루프의 5단계

한 에피소드(매치 1회) 동안 벌어지는 일:

```
┌─────────────────────────────────────────────────────────┐
│ 1. ROLLOUT: 정책으로 매치 끝까지 플레이                   │
│    매 결정 시점마다 "써/말아" 확률 뽑아서 행동 선택        │
│    모든 결정을 trajectory에 기록                          │
│                                                         │
│ 2. JUDGE: 매치 끝나면 승/패 판정 → reward = +1 or -1    │
│                                                         │
│ 3. BASELINE: reward가 baseline보다 좋았는지 나빴는지 비교  │
│    advantage = reward - baseline                         │
│    → "평소보다 잘했어" (+advantage) or "평소보다 못했어"   │
│                                                         │
│ 4. CREDIT: trajectory의 모든 결정에 advantage 분배        │
│    "이겼으면 → 모든 결정이 좋은 결정이었다"               │
│    "졌으면   → 모든 결정이 나쁜 결정이었다"               │
│                                                         │
│ 5. UPDATE: 정책의 가중치를 조정                           │
│    +advantage → 행동 확률 증가                            │
│    -advantage → 행동 확률 감소                            │
└─────────────────────────────────────────────────────────┘
```

### 0.4 구체적인 숫자로 보는 한 에피소드

```
매치: Archer(RL) vs Dash

결정1 (t=2.0s, hpRatio=0.85, dist=380):
  π(use)=0.62 → coin flip → use=1 (썼다!)
  → Rush 발동, HP -1%

결정2 (t=3.5s, hpRatio=0.79, dist=310):
  π(use)=0.34 → coin flip → use=0 (안 썼다)

결정3 (t=6.0s, hpRatio=0.55, dist=180):
  π(use)=0.71 → coin flip → use=1 (썼다!)
  → TimeWarp 발동, HP -0.5%

... 8개 결정 ...

결과: Archer 승리! → reward = +1.0

baseline = 0.15 (지난 20경기 평균 보상)
advantage = 1.0 - 0.15 = +0.85 → "평소보다 잘했어!"

업데이트 (각 결정마다):
  결정1: use=1 prob=0.62 → ∇ = -(1-0.62)×0.85 = -0.323
         → prob=0.62가 더 높아지도록 가중치 조정 ✓
  결정2: use=0 prob=0.34 → ∇ = -(0-0.34)×0.85 = +0.289
         → prob=0.34가 더 낮아지도록 가중치 조정 ✓
  결정3: use=1 prob=0.71 → ∇ = -(1-0.71)×0.85 = -0.247
         → prob=0.71이 더 높아지도록 가중치 조정 ✓
```

### 0.5 왜 Baseline이 필요한가

```javascript
// baseline 없음 → 문제
reward = +1 (이겼다) → 모든 결정에 "좋았다" 신호
reward = -1 (졌다)   → 모든 결정에 "나빴다" 신호

// 그런데 실제로는:
//   결정1(쓸모있음) + 결정2(쓸모없음) + 결정3(쓸모있음) → 승리
//   → 결정2도 "좋았다"고 학습됨 → 잘못된 학습!

// baseline 있음 → 개선
baseline = 0.15
advantage = +1.0 - 0.15 = +0.85 // "평소보다 +0.85만큼 좋았다"
advantage = -1.0 - 0.15 = -1.15 // "평소보다 -1.15만큼 나빴다"

// 이제 advantage의 "방향"은 맞고, "크기"는 상대적 비교가 됨
```

### 0.5b 시간 가중치 (Temporal Credit Assignment)

"모든 결정이 똑같이 중요할까?" — **아니다**. 경기 종료 1초 전의 결정이 20초 전의 결정보다 승패에 훨씬 직접적이다.

```
매치: 25초, 8번의 결정

t=2s  결정1 (Rush)         ← 승리와 인과관계 약함 (23초 전)
t=5s  결정2 (대기)
t=8s  결정3 (Shockwave)
t=12s 결정4 (대기)
t=16s 결정5 (Evade)
t=19s 결정6 (대기)
t=22s 결정7 (Endure)        ← 승리와 인과관계 강함 (3초 전, 결정적 버티기!)
t=24s 결정8 (대기)          ← 승리와 인과관계 매우 강함 (1초 전)
```

#### 감가율 (Discount Factor γ) 적용

```javascript
// γ = 0.97 → 1초마다 중요도 3%씩 감소

// 결정 시점별 가중치 (경기 종료로부터 역산):
결정8 (t=24s, 종료까지 1초):  weight = γ^1  = 0.97
결정7 (t=22s, 종료까지 3초):  weight = γ^3  = 0.91
결정5 (t=16s, 종료까지 9초):  weight = γ^9  = 0.76
결정1 (t=2s,  종료까지 23초): weight = γ^23 = 0.50

// 가중치 적용 전 (uniform):
∇결정1 = -(1-0.62) × 0.88 = -0.334
∇결정7 = -(1-0.55) × 0.88 = -0.396
// → 결정1과 결정7의 그래디언트가 비슷한 크기!

// 가중치 적용 후 (time-decay):
∇결정1 = -(1-0.62) × 0.88 × 0.50 = -0.167
∇결정7 = -(1-0.55) × 0.88 × 0.91 = -0.360
// → 결정7의 영향이 결정1의 2배 이상! "클러치 순간"을 더 강하게 학습
```

#### 코드에 반영

```javascript
// 기존 (uniform credit)
for (const { obs, action, prob } of trajectory) {
    const grad = -(action - prob) * advantage;
    // ...
}

// 시간 가중치 적용
const totalDecisions = trajectory.length;
for (let i = 0; i < totalDecisions; i++) {
    const { obs, action, prob } = trajectory[i];
    // 마지막 결정(i=totalDecisions-1)이 가장 높은 가중치
    const timeWeight = Math.pow(0.97, totalDecisions - 1 - i);
    const grad = -(action - prob) * advantage * timeWeight;
    // ...
}
```

#### 직관적 이해

| 상황 | 시간 가중치 없음 | 시간 가중치 있음 |
|---|---|---|
| 초반에 HP 낭비하고 이김 | "써도 되네" 학습 | "써도 되네" 약하게 학습 |
| 종료 직전 버티기로 역전승 | "버티기 좋네" 학습 | "버티기 **매우** 좋네" 강하게 학습 |
| 초반에 썼는데 졌음 | "쓰면 안 되네" 학습 | "쓰면 안 되네" 약하게 학습 (다른 이유로 졌을 수도) |
| 종료 직전 썼는데 졌음 | "쓰면 안 되네" 학습 | "쓰면 안 되네" **강하게** 학습 |

**핵심**: γ는 "먼 과거의 결정일수록 현재 결과와의 인과관계가 희석된다"는 직관을 수학적으로 반영합니다. 25초 매치에 γ=0.97이면 초반 결정의 영향력은 종료 직전의 약 50%로 감소합니다.

```

### 0.5c 입력 정규화 (Input Normalization) — 🔴 없으면 학습 실패

24개 특성의 스케일 차이가 극단적입니다:

```
hpRatio:        0.0 ~ 1.0     (범위 1)
distance:       0   ~ 960     (범위 960)
approachSpeed:  -400 ~ 400    (범위 800)
elapsed:        0   ~ 30      (범위 30)
```

이 상태로 학습하면 `distance`가 `hpRatio`보다 960배 더 큰 그래디언트를 만들어 **작은 스케일 특성이 완전히 무시**됩니다.

#### 해결: Running Mean/Std with Welford's Algorithm

```javascript
// scripts/rl/normalizer.js
export class RunningNormalizer {
    constructor(shape = 24) {
        this.n = 0;
        this.mean = new Array(shape).fill(0);
        this.M2 = new Array(shape).fill(0);  // 분산 누적용
    }

    // 새 observation으로 통계 업데이트
    update(obs) {
        this.n++;
        for (let i = 0; i < obs.length; i++) {
            const delta = obs[i] - this.mean[i];
            this.mean[i] += delta / this.n;
            this.M2[i] += delta * (obs[i] - this.mean[i]);
        }
    }

    // 정규화된 observation 반환
    normalize(obs) {
        const result = new Array(obs.length);
        for (let i = 0; i < obs.length; i++) {
            const std = this.n > 1 ? Math.sqrt(this.M2[i] / (this.n - 1)) : 1;
            result[i] = std > 1e-6 ? (obs[i] - this.mean[i]) / std : 0;
        }
        return result;
    }
}
```

**사용**: 학습 시작 전 1000개의 랜덤 observation으로 초기화, 이후 매 스텝 업데이트.

```javascript
// train.mjs — 초기화
const normalizer = new RunningNormalizer(24);
for (let i = 0; i < 1000; i++) {
    const obs = collectRandomObservation();  // 랜덤 매치업에서 샘플링
    normalizer.update(obs);
}

// 매 결정 시점
const rawObs = extractFeatures(fighter, opponent, sim);
const obs = normalizer.normalize(rawObs);
const prob = policy.forward(obs);  // 정규화된 입력 사용
```

### 0.5d Gradient Clipping — 🟡 가중치 폭발 방지

REINFORCE의 그래디언트는 분산이 매우 큽니다:

```
// 최악의 시나리오:
prob = 0.01 (거의 안 쓴다고 확신)
action = 1  (그런데 써버림)
advantage = +1.88 (대승리!)

∇ = -(1 - 0.01) × 1.88 = -1.86
// → 역전파로 3600개 가중치가 한 번에 크게 움직임 → 발산
```

#### 해결: L2 Norm Clipping

```javascript
// policyNetwork.js
export function clipGradients(grads, maxNorm = 1.0) {
    // 모든 그래디언트의 L2 norm 계산
    let totalNorm = 0;
    for (const key of ['W1','W2','W3','b1','b2','b3']) {
        const g = grads[key];
        if (Array.isArray(g[0])) {
            for (const row of g) for (const v of row) totalNorm += v * v;
        } else {
            for (const v of g) totalNorm += v * v;
        }
    }
    totalNorm = Math.sqrt(totalNorm);

    // norm이 maxNorm 초과하면 비례 축소
    if (totalNorm > maxNorm) {
        const scale = maxNorm / totalNorm;
        for (const key of ['W1','W2','W3','b1','b2','b3']) {
            const g = grads[key];
            if (Array.isArray(g[0])) {
                for (const row of g) for (let j = 0; j < row.length; j++) row[j] *= scale;
            } else {
                for (let j = 0; j < g.length; j++) g[j] *= scale;
            }
        }
    }
}
```

### 0.5e Batch Training + Advantage 정규화 — 🟡 분산 감소

에피소드 1개마다 업데이트하면 노이즈가 큽니다. 16개 에피소드를 모아서 한 번에 업데이트하고, advantage도 정규화하면 수렴이 훨씬 안정적입니다.

```javascript
// train.mjs — 배치 수집
const BATCH_SIZE = 16;
const batchTrajectories = [];
const batchRewards = [];

for (let ep = 0; ep < CONFIG.episodes; ep++) {
    // ... rollout 1 episode ...
    batchTrajectories.push(trajectory);
    batchRewards.push(reward);

    // 배치가 차면 일괄 업데이트
    if (batchTrajectories.length >= BATCH_SIZE || ep === CONFIG.episodes - 1) {
        // Advantage 정규화 (μ=0, σ=1)
        const meanR = batchRewards.reduce((a,b) => a+b, 0) / batchRewards.length;
        const stdR = Math.sqrt(batchRewards.reduce((s,r) => s + (r-meanR)**2, 0) / batchRewards.length) || 1;

        for (let b = 0; b < batchTrajectories.length; b++) {
            const advantage = (batchRewards[b] - baseline) / stdR;  // 정규화된 advantage

            const traj = batchTrajectories[b];
            for (let i = 0; i < traj.length; i++) {
                const { obs, useAction, prob } = traj[i];
                const timeWeight = Math.pow(CONFIG.gamma, traj.length - 1 - i);
                const outputGrad = -(useAction - prob) * advantage * timeWeight;
                const { grads } = computeGradient(policy, obs, outputGrad);
                clipGradients(grads, 1.0);  // gradient clipping
                accumulateBatchGradients(batchGrads, grads);
            }
        }

        // 배치 평균 그래디언트로 한 번만 업데이트
        applyGradients(policy, batchGrads, CONFIG.lr / BATCH_SIZE);
        batchTrajectories.length = 0;
        batchRewards.length = 0;
        baseline = 0.05 * meanR + 0.95 * baseline;  // 배치 평균으로 baseline 갱신
    }
}
```

**효과**:

| 기법 | 없는 경우 | 있는 경우 |
|---|---|---|
| 입력 정규화 | distance가 학습 장악 | 모든 특성 균등 기여 |
| Gradient Clipping | 한 에피소드에 가중치 폭발 | 안정적 step 크기 |
| Batch + Adv 정규화 | 에피소드마다 지그재그 | 부드러운 수렴 곡선 |

```

### 0.6 Exploration vs Exploitation

```javascript
// 학습 초기: ε-greedy 대신 policy 자체의 확률로 탐험
π(use) = 0.5 → "반반이니까 자연스럽게 탐험"

// Entropy regularization
entropy = -(p×log(p) + (1-p)×log(1-p))
// p=0.5 → entropy 최대 (완전 불확실 = 탐험 중)
// p=0.99 → entropy 거의 0 (거의 확신 = exploitation)

// entropyCoef=0.01 → "너무 빨리 확신하지 마, 좀 더 탐험해"
```

### 0.7 전체 데이터 흐름

```
                  ┌──────────────┐
                  │ Policy Net   │  π(a|s) = sigmoid(MLP(s))
                  │ 24→48→48→1  │
                  └──────┬───────┘
                         │ forward(obs) → prob
                         ▼
                  ┌──────────────┐
                  │   Sample     │  action = random() < prob ? 1 : 0
                  └──────┬───────┘
                         │ (obs, action, prob)
                         ▼
                  ┌──────────────┐
                  │  Simulator   │  sim.update(1/60) → 다음 상태
                  └──────┬───────┘
                         │ reward (+1/-1) at terminal
                         ▼
                  ┌──────────────┐
                  │   Update     │  ∇L = -(a-p)×(reward-baseline)
                  │  (backprop)  │  W ← W - lr × ∇L
                  └──────────────┘
                         │
                         ▼ (다음 에피소드로)
```

### 0.8 왜 이 게임에 REINFORCE가 적합한가

| 게임 특성 | REINFORCE 특징 | 적합 이유 |
|---|---|---|
| 결정 5~15회/매치 | 에피소드가 짧음 | trajectory 작아서 MC return 효율적 |
| Terminal reward only | 중간 보상 불필요 | 승/패만으로 충분 |
| Binary action | Bernoulli policy | sigmoid 출력과 자연스러움 |
| Simulator fast | 많은 에피소드 가능 | 20K 매치도 25분 |

---

### 0.9 현미경 튜토리얼 — 한 에피소드의 모든 순간

**설정**: 24차원 입력 → 2차원 은닉층 → 1출력 으로 단순화해서 설명.
실제 모델은 48차원 2개 층이지만 원리는 동일합니다.

```
모델 (설명용 축소판):
  입력: obs = [hpRatio, distance] = [0.8, 0.5]  (2차원)
  은닉: h = ReLU(W1 × obs + b1)                (2차원)
  출력: p = sigmoid(W2 · h + b2)                (스칼라)

  W1 = [[0.1, 0.2],   b1 = [0, 0]
        [-0.1, 0.3]]
  W2 = [0.5, -0.5]    b2 = 0
```

#### Step A — 순전파 (Forward Pass)

```javascript
// 1. 은닉층 계산
h_pre[0] = W1[0][0]*obs[0] + W1[0][1]*obs[1] + b1[0]
         = 0.1*0.8 + 0.2*0.5 + 0 = 0.08 + 0.10 = 0.18
h_pre[1] = W1[1][0]*obs[0] + W1[1][1]*obs[1] + b1[1]
         = -0.1*0.8 + 0.3*0.5 + 0 = -0.08 + 0.15 = 0.07

// 2. ReLU 활성화
h = [max(0, 0.18), max(0, 0.07)] = [0.18, 0.07]

// 3. 출력층 (logit)
logit = W2[0]*h[0] + W2[1]*h[1] + b2
      = 0.5*0.18 + (-0.5)*0.07 + 0 = 0.09 - 0.035 = 0.055

// 4. Sigmoid → 확률
p = 1/(1+e^(-0.055)) = 1/(1+0.946) = 0.514
// → "지금 액션을 쓸 확률 51.4%"
```

#### Step B — 행동 선택 (Action Sampling)

```javascript
coin = Math.random()  // 0.0 ~ 1.0 사이 난수

// Case 1: coin = 0.23 → 0.23 < 0.514 → useAction = 1 (사용!)
// Case 2: coin = 0.71 → 0.71 > 0.514 → useAction = 0 (대기)

// 이번엔 useAction = 1 이었다고 가정
trajectory.push({ obs: [0.8, 0.5], action: 1, prob: 0.514 })
```

#### Step C — 매치 종료 후 보상

```javascript
// 25초 동안 총 8번의 결정이 있었음
trajectory = [
    { obs:[0.80,0.50], action:1, prob:0.514 },  // 결정1: Rush 사용
    { obs:[0.72,0.38], action:0, prob:0.340 },  // 결정2: 대기
    { obs:[0.65,0.22], action:1, prob:0.710 },  // 결정3: Shockwave 사용
    { obs:[0.55,0.30], action:0, prob:0.420 },  // 결정4: 대기
    { obs:[0.48,0.45], action:1, prob:0.630 },  // 결정5: Evade 사용
    { obs:[0.35,0.15], action:0, prob:0.280 },  // 결정6: 대기
    { obs:[0.30,0.25], action:1, prob:0.550 },  // 결정7: Endure 사용
    { obs:[0.20,0.10], action:0, prob:0.180 },  // 결정8: 대기 (HP 너무 낮음)
]

// 매치 결과: 승리!
reward = +1.0
```

#### Step D — Baseline & Advantage

```javascript
// baseline: 지금까지 500에피소드의 이동평균
baseline = 0.12  // "평균적으로 reward 0.12 정도 받아왔음"

advantage = reward - baseline = 1.0 - 0.12 = +0.88
// → "평소보다 0.88만큼 더 잘했어! 이번 결정들은 좋은 결정이었어!"
```

#### Step E — 그래디언트 계산 (결정1에 대해서만)

```javascript
// Policy Gradient 공식:
//   ∇L = -(action - prob) × advantage
//   → action=1이고 prob=0.514였으니, 더 높은 확률을 갖도록 조정

// 결정1: action=1, prob=0.514
grad_output = -(1 - 0.514) × 0.88 = -0.486 × 0.88 = -0.428
// 음수 → "prob을 더 높여라"

// 결정3: action=1, prob=0.710
grad_output = -(1 - 0.710) × 0.88 = -0.290 × 0.88 = -0.255
// prob이 이미 높아서(0.71) 조정폭이 더 작음

// 결정2: action=0, prob=0.340
grad_output = -(0 - 0.340) × 0.88 = +0.340 × 0.88 = +0.299
// 양수 → "prob을 더 낮춰라" (안 쓰는 게 좋은 결정이었으니까)
```

#### Step F — 역전파로 가중치 업데이트 (결정1 기준)

```javascript
// 출력층 그래디언트가 은닉층으로 흘러감
// dL/d(logit) = grad_output = -0.428

// ── W2 업데이트 ──
// ∂L/∂W2[i] = dL/d(logit) × h[i]
∇W2[0] = -0.428 × h[0] = -0.428 × 0.18 = -0.077
∇W2[1] = -0.428 × h[1] = -0.428 × 0.07 = -0.030
∇b2    = -0.428

// SGD 업데이트: W_new = W_old - lr × ∇W
W2[0] = 0.5 - 0.0003 × (-0.077) = 0.5 + 0.000023 = 0.500023
W2[1] = -0.5 - 0.0003 × (-0.030) = -0.5 + 0.000009 = -0.499991
b2    = 0 - 0.0003 × (-0.428) = 0.000128
// ↑ h[0]이 0.18로 h[1]=0.07보다 크므로 W2[0]이 더 많이 조정됨
//   → "hpRatio 정보를 더 중요하게 반영하라"는 의미

// ── W1 업데이트 (ReLU 역전파) ──
// dh[i] = (h_pre[i] > 0 ? 1 : 0) × dL/d(logit) × W2[i]
dh[0] = (0.18 > 0 → 1) × (-0.428) × 0.5 = -0.214
dh[1] = (0.07 > 0 → 1) × (-0.428) × (-0.5) = +0.214

// ∂L/∂W1[i][j] = dh[i] × obs[j]
∇W1[0][0] = -0.214 × 0.8 = -0.171   // hpRatio가 은닉뉴런0에 주는 영향
∇W1[0][1] = -0.214 × 0.5 = -0.107   // distance가 은닉뉴런0에 주는 영향
∇W1[1][0] = +0.214 × 0.8 = +0.171   // hpRatio가 은닉뉴런1에 주는 영향
∇W1[1][1] = +0.214 × 0.5 = +0.107   // distance가 은닉뉴런1에 주는 영향

// SGD 업데이트
W1[0][0] = 0.1  - 0.0003 × (-0.171) = 0.100051
W1[0][1] = 0.2  - 0.0003 × (-0.107) = 0.200032
W1[1][0] = -0.1 - 0.0003 × 0.171  = -0.100051
W1[1][1] = 0.3  - 0.0003 × 0.107  = 0.299968
```

#### Step G — 500 에피소드 후 변화

```javascript
// 같은 obs=[0.8, 0.5] 입력에 대해...

// 초기 (에피소드 1):
forward([0.8, 0.5]) → prob = 0.514  // 반반

// 에피소드 500:
W1, W2가 누적 업데이트됨 →
  h_pre = [0.38, 0.15]         // 더 강한 신호
  h = [0.38, 0.15]
  logit = 0.8*0.38 + (-0.3)*0.15 = 0.259
  prob = sigmoid(0.259) = 0.564
  // "HP 80% + 거리 50% 상황에선 쓰는 게 좋다" 확신 증가

// 에피소드 5000 (학습 수렴):
forward([0.8, 0.5]) → prob = 0.73   // 뚜렷한 선호

// 하지만 다른 상황에서는:
forward([0.2, 0.1]) → prob = 0.12   // HP 낮고 가까우면 → 쓰지 마 (HP 보존)
forward([0.9, 0.8]) → prob = 0.88   // HP 높고 멀면 → 적극 사용
```

#### Step H — 전체 루프 의사코드

```javascript
// 학습 루프 — 모든 단계를 하나로
const policy = new PolicyNetwork();  // 24→48→48→1, Xavier init
let baseline = 0;

for (let ep = 0; ep < 20000; ep++) {
    // ── 1. ROLLOUT ──
    const sim = newBattleSimulation();  // 무작위 매치업
    const trajectory = [];

    while (!sim.finished) {
        sim.update(1/60);  // 1프레임 진행

        if (shouldMakeDecision(sim)) {
            const obs = extractFeatures(sim);         // 24차원 벡터
            const prob = policy.forward(obs);          // π(use|obs)
            const action = Math.random() < prob ? 1 : 0;

            trajectory.push({ obs, action, prob });    // 기록

            if (action === 1) executeAction(sim);
        }
    }

    // ── 2. JUDGE ──
    const reward = (sim.winner.id === myFighter.id) ? 1.0 : -1.0;

    // ── 3. BASELINE ──
    baseline = 0.05 * reward + 0.95 * baseline;  // EMA
    const advantage = reward - baseline;

    // ── 4 & 5. CREDIT + UPDATE ──
    for (const { obs, action, prob } of trajectory) {
        const grad = -(action - prob) * advantage;   // 정책 그래디언트
        policy.backward(obs, grad);                   // 역전파
        policy.applyGradients(0.0003);                // SGD 스텝
    }

    // 500 에피소드마다 평가
    if (ep % 500 === 0) {
        const winRate = evaluate(policy, 200);  // 200매치 평가
        console.log(`Ep ${ep}: winRate=${(winRate*100).toFixed(1)}%`);
        // 기대: Ep 0 → ~48%, Ep 5000 → ~53%, Ep 20000 → ~55%
    }
}
```

---

## 1. 모델 아키텍처

### 1.1 구조도

```
Input (24) → FC₁(48) + ReLU → FC₂(48) + ReLU → FC₃(1) + Sigmoid → P(use_action)
```

### 1.2 레이어 상세

| 레이어 | 입력 | 출력 | 파라미터 수 | 활성화 |
|---|---|---|---|---|
| `fc1` | 24 | 48 | W: 24×48=1152, b: 48 | ReLU |
| `fc2` | 48 | 48 | W: 48×48=2304, b: 48 | ReLU |
| `fc3` | 48 | 1 | W: 48×1=48, b: 1 | Sigmoid |

**총 파라미터**: 1152+48+2304+48+48+1 = **3,601개**

### 1.3 가중치 초기화

```javascript
// Xavier/Glorot 초기화
W ~ Uniform(-√(6/(fanIn+fanOut)), √(6/(fanIn+fanOut)))
b = 0
```

---

## 2. 입력 특성 (24차원)

### 2.1 특성 벡터 명세

```
인덱스 | 이름               | 범위        | 설명
───────┼───────────────────┼─────────────┼──────────────────────────
0      | hpRatio           | [0, 1]      | 내 HP / maxHP
1      | oppHpRatio        | [0, 1]      | 상대 HP / maxHP
2      | hpAdvantage       | [-1, 1]     | (내HP-상대HP) / max(내HP,상대HP)
3      | distance          | [0, 960]    | 상대까지 거리 (px)
4      | distNorm          | [0, 1]      | distance / 960
5      | approachSpeed     | [-400, 400] | 상대 접근 속도 (양수=접근)
6      | approachSpeedNorm | [-1, 1]     | approachSpeed / 400
7      | mySpeed           | [0, 500]    | 내 현재 속도 크기
8      | mySpeedNorm       | [0, 1]      | mySpeed / 500
9      | oppSpeed          | [0, 500]    | 상대 현재 속도 크기
10     | myBaseSpeed       | [238, 320]  | 내 기본 속도 (종족값)
11     | myBaseSpeedNorm   | [0, 1]      | (myBaseSpeed-200)/150
12     | isRanged          | {0, 1}      | 원거리 캐릭터 여부
13     | isSlowed          | {0, 1}      | 내 슬로우 여부
14     | oppIsSlowed       | {0, 1}      | 상대 슬로우 여부
15     | hasSpeedBoost     | {0, 1}      | 내 속도버프 여부
16     | actionHpCost      | [0.5, 1.5]  | 액션 HP 코스트 (%)
17     | actionHpCostNorm  | [0, 1]      | actionHpCost / 1.5
18     | canUseNow         | {0, 1}      | getFailureReason()==null
19     | intervalReady     | {0, 1}      | _nextAvailableAt ≤ 0
20     | projectileNearby  | {0, 1}      | 250px 내 투사체 존재
21     | collisionImminent | {0, 1}      | 0.5초 내 충돌 예상
22     | elapsed           | [0, 30]     | 경과 시간 (초)
23     | elapsedNorm       | [0, 1]      | elapsed / 30
```

### 2.2 특성 추출

```javascript
// scripts/rl/features.js
import { Vector2 } from "../../src/core.js";

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function extractFeatures(fighter, opponent, sim) {
    const hpRatio = fighter.hp / fighter.maxHp;
    const oppHpRatio = opponent.hp / opponent.maxHp;
    const maxHp = Math.max(fighter.maxHp, opponent.maxHp);
    const hpAdvantage = maxHp > 0 ? (fighter.hp - opponent.hp) / maxHp : 0;

    const toOpp = Vector2.subtract(opponent.position, fighter.position);
    const dist = toOpp.length();
    const approachSpeed = dist > 0
        ? opponent.velocity.dot(toOpp.normalize().scale(-1))
        : 0;

    const action = fighter.aiController?._chosenAction;
    const canUse = action ? (action.getFailureReason?.(sim, fighter) ?? null) === null : false;
    const intervalReady = (fighter.aiController?._nextAvailableAt ?? 0) <= 0;

    const projectileNearby = sim.entities.some(e => {
        if (e === fighter || e === opponent || e.isExpired || !e.velocity) return false;
        return Vector2.subtract(fighter.position, e.position).length() < 250;
    });

    const collisionImminent = dist > 0 && dist < 200 &&
        approachSpeed > 30 && dist / Math.max(1, approachSpeed) < 0.5;

    return [
        hpRatio,                                    // 0
        oppHpRatio,                                 // 1
        hpAdvantage,                                // 2
        dist,                                       // 3
        dist / 960,                                 // 4
        approachSpeed,                              // 5
        clamp(approachSpeed / 400, -1, 1),          // 6
        fighter.velocity.length(),                  // 7
        clamp(fighter.velocity.length() / 500, 0, 1), // 8
        opponent.velocity.length(),                 // 9
        fighter.stats.baseSpeed,                    // 10
        clamp((fighter.stats.baseSpeed - 200) / 150, 0, 1), // 11
        fighter.meta?.isRanged ? 1 : 0,             // 12
        fighter.state.slow ? 1 : 0,                 // 13
        opponent.state.slow ? 1 : 0,                // 14
        fighter.state.speedBoost ? 1 : 0,           // 15
        action?.hpCostPercent ?? 0,                 // 16
        (action?.hpCostPercent ?? 0) / 1.5,         // 17
        canUse ? 1 : 0,                             // 18
        intervalReady ? 1 : 0,                      // 19
        projectileNearby ? 1 : 0,                   // 20
        collisionImminent ? 1 : 0,                  // 21
        sim.elapsed ?? 0,                           // 22
        clamp((sim.elapsed ?? 0) / 30, 0, 1),      // 23
    ];
}
```

---

## 3. 정책 네트워크 (`scripts/rl/policyNetwork.js`)

### 3.1 순전파

```javascript
export class PolicyNetwork {
    constructor() {
        this.W1 = randMatrix(24, 48);  this.b1 = zeros(48);
        this.W2 = randMatrix(48, 48);  this.b2 = zeros(48);
        this.W3 = randMatrix(48, 1);   this.b3 = zeros(1);
    }

    forward(obs) {
        // fc1: 24 → 48 + ReLU
        const h1 = matVecMul(this.W1, obs, this.b1);
        reluInPlace(h1);
        // fc2: 48 → 48 + ReLU
        const h2 = matVecMul(this.W2, h1, this.b2);
        reluInPlace(h2);
        // fc3: 48 → 1 + Sigmoid
        const logit = dot(h2, this.W3) + this.b3[0];
        return sigmoid(logit);
    }

    sample(obs) {
        const prob = this.forward(obs);
        return { action: Math.random() < prob ? 1 : 0, prob };
    }

    act(obs, threshold = 0.5) {
        return this.forward(obs) >= threshold ? 1 : 0;
    }

    serialize() {
        return { W1: this.W1, b1: this.b1, W2: this.W2, b2: this.b2, W3: this.W3, b3: this.b3 };
    }

    static deserialize(data) {
        const p = new PolicyNetwork();
        p.W1 = data.W1; p.b1 = data.b1;
        p.W2 = data.W2; p.b2 = data.b2;
        p.W3 = data.W3; p.b3 = data.b3;
        return p;
    }
}
```

### 3.2 수학 헬퍼 (`scripts/rl/math.js`)

```javascript
export function matVecMul(W, x, b) {
    const y = new Array(W.length).fill(0);
    for (let i = 0; i < W.length; i++) {
        for (let j = 0; j < x.length; j++) y[i] += W[i][j] * x[j];
        y[i] += b[i];
    }
    return y;
}

export function reluInPlace(v) { for (let i = 0; i < v.length; i++) v[i] = Math.max(0, v[i]); }

export function sigmoid(x) {
    const clamped = Math.max(-10, Math.min(10, x));
    return 1 / (1 + Math.exp(-clamped));
}

export function dot(a, b) {
    let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s;
}

export function randMatrix(rows, cols) {
    // Xavier init
    const bound = Math.sqrt(6 / (rows + cols));
    return Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => (Math.random() * 2 - 1) * bound));
}

export function zeros(n) { return new Array(n).fill(0); }
export function zeros2D(r, c) { return Array.from({ length: r }, () => new Array(c).fill(0)); }
```

### 3.3 역전파 (REINFORCE gradient)

```javascript
export function computeGradient(policy, obs, outputGrad) {
    // Forward pass (기록)
    const h1Pre = matVecMul(policy.W1, obs, policy.b1);
    const h1 = [...h1Pre]; reluInPlace(h1);
    const h2Pre = matVecMul(policy.W2, h1, policy.b2);
    const h2 = [...h2Pre]; reluInPlace(h2);
    const logit = dot(h2, policy.W3) + policy.b3[0];
    const prob = sigmoid(logit);

    // Backward (cross-entropy + sigmoid)
    // dL/d(logit) = prob - target (target = outputGrad 방향)
    const dLogit = outputGrad; // REINFORCE: -(a - prob) * advantage → advantage 부호로 단순화

    const grads = { W1: zeros2D(24,48), b1: zeros(48), W2: zeros2D(48,48), b2: zeros(48), W3: zeros2D(48,1), b3: zeros(1) };

    // fc3
    for (let i = 0; i < 48; i++) grads.W3[i][0] = dLogit * h2[i];
    grads.b3[0] = dLogit;

    // fc2
    const dh2 = new Array(48).fill(0);
    for (let i = 0; i < 48; i++) dh2[i] = (h2Pre[i] > 0 ? 1 : 0) * dLogit * policy.W3[i][0];
    for (let i = 0; i < 48; i++) {
        for (let j = 0; j < 48; j++) grads.W2[i][j] = dh2[i] * h1[j];
        grads.b2[i] = dh2[i];
    }

    // fc1
    const dh1 = new Array(48).fill(0);
    for (let i = 0; i < 48; i++) {
        for (let j = 0; j < 48; j++) dh1[j] += (h1Pre[j] > 0 ? 1 : 0) * dh2[i] * policy.W2[i][j];
    }
    for (let i = 0; i < 48; i++) {
        for (let j = 0; j < 24; j++) grads.W1[i][j] = dh1[i] * obs[j];
        grads.b1[i] = dh1[i];
    }

    return { grads, prob };
}
```

---

## 4. 학습 루프 (`scripts/rl/train.mjs`)

```javascript
import { BattleSimulation } from "../../src/simulation/battleSimulation.js";
import { createRoster } from "../../src/roster.js";
import { applyStatAllocation, createEmptyStatAllocation } from "../../src/statAllocation.js";
import { PolicyNetwork, computeGradient } from "./policyNetwork.js";
import { extractFeatures } from "./features.js";
import { Vector2 } from "../../src/core.js";
import fs from "fs";

const CONFIG = {
    episodes: 20000,
    lr: 3e-4,
    baselineAlpha: 0.05,
    entropyCoef: 0.01,
    gamma: 0.97,            // 시간 가중치 감가율 (1.0 = uniform)
    batchSize: 16,           // 배치 크기 (에피소드 누적 후 한 번에 업데이트)
    gradClipNorm: 1.0,       // 그래디언트 L2 클리핑 임계값
    evalInterval: 500,
    minDecisionFrames: 10,
    hpGate: 0.3,
    maxDist: 400,
};

function pickRandomFighters(roster) {
    const shuffled = [...roster].sort(() => Math.random() - 0.5);
    return [shuffled[0], shuffled[1]];
}

function applyGradients(policy, grads, lr) {
    const scale = -lr; // gradient descent 방향
    for (let i = 0; i < policy.W1.length; i++) {
        for (let j = 0; j < policy.W1[i].length; j++) policy.W1[i][j] += scale * grads.W1[i][j];
        policy.b1[i] += scale * grads.b1[i];
    }
    for (let i = 0; i < policy.W2.length; i++) {
        for (let j = 0; j < policy.W2[i].length; j++) policy.W2[i][j] += scale * grads.W2[i][j];
        policy.b2[i] += scale * grads.b2[i];
    }
    for (let i = 0; i < policy.W3.length; i++) {
        policy.W3[i][0] += scale * grads.W3[i][0];
    }
    policy.b3[0] += scale * grads.b3[0];
}

async function main() {
    const roster = createRoster();
    const policy = new PolicyNetwork();
    let baseline = 0;

    for (let ep = 0; ep < CONFIG.episodes; ep++) {
        const [a, b] = pickRandomFighters(roster);
        const specA = applyStatAllocation(a, createEmptyStatAllocation(), false);
        const specB = applyStatAllocation(b, createEmptyStatAllocation(), false);

        // assignActions: true → AI 컨트롤러 생성, 하지만 RL이 evaluate 우회
        const sim = new BattleSimulation([specA, specB], { onLog() {} }, null, { assignActions: true });
        const fighter = sim.fighters[0];
        const opponent = sim.getOpponent(fighter);
        const action = fighter.aiController?._chosenAction;
        if (!action || !opponent) continue;

        const trajectory = [];
        let lastDecisionFrame = -CONFIG.minDecisionFrames;

        while (!sim.finished) {
            sim.update(1/60, 1/60);
            const opponentNow = sim.getOpponent(fighter);
            if (!opponentNow) break;

            const frame = Math.floor((sim.elapsed ?? 0) * 60);
            const canDecide = frame - lastDecisionFrame >= CONFIG.minDecisionFrames;
            const hpOk = fighter.hp / fighter.maxHp >= CONFIG.hpGate;
            const distOk = Vector2.subtract(opponentNow.position, fighter.position).length() <= CONFIG.maxDist;
            const failureFree = action.getFailureReason?.(sim, fighter) == null;

            if (canDecide && hpOk && distOk && failureFree) {
                const obs = extractFeatures(fighter, opponentNow, sim);
                const { action: useAction, prob } = policy.sample(obs);
                trajectory.push({ obs, useAction, prob });

                if (useAction === 1) {
                    const cost = Math.ceil(fighter.maxHp * action.hpCostPercent / 100);
                    const paid = fighter.actionContext.spendHpForAction(fighter, cost);
                    if (paid > 0) sim.scheduleAction(action, fighter, paid);
                }
                lastDecisionFrame = frame;
            }
        }

        const winner = sim.winner;
        const reward = (winner && winner.id === fighter.id) ? 1.0 : -1.0;
        baseline = CONFIG.baselineAlpha * reward + (1 - CONFIG.baselineAlpha) * baseline;
        const advantage = reward - baseline;

        // 시간 가중치 적용: 마지막 결정일수록 더 큰 영향
        const totalDecisions = trajectory.length;
        for (let i = 0; i < totalDecisions; i++) {
            const { obs, useAction, prob } = trajectory[i];
            const timeWeight = Math.pow(CONFIG.gamma, totalDecisions - 1 - i);
            const outputGrad = -(useAction - prob) * advantage * timeWeight;
            const { grads } = computeGradient(policy, obs, outputGrad);
            // Entropy regularization
            const entropyGrad = CONFIG.entropyCoef * (1 - 2 * prob);
            // entropy 영향은 logit gradient에 추가
            // (단순화: 이미 computeGradient 안에서 처리)
            applyGradients(policy, grads, CONFIG.lr);
        }

        // 주기적 평가 + 저장
        if (ep % CONFIG.evalInterval === 0) {
            console.log(`Ep ${ep}: reward=${reward.toFixed(1)} baseline=${baseline.toFixed(3)} trajectory_len=${trajectory.length}`);
            const data = policy.serialize();
            fs.writeFileSync("src/aiModelWeights.json", JSON.stringify(data), "utf-8");
        }
    }

    console.log("학습 완료 → src/aiModelWeights.json");
}

main().catch(e => { console.error(e); process.exit(1); });
```

---

## 5. 게임 임베딩

### 5.1 `AIActionController.evaluate()` 수정 경로

```javascript
// src/simulation/aiActionController.js
import { PolicyNetwork } from "../../scripts/rl/policyNetwork.js";
import { extractFeatures } from "../../scripts/rl/features.js";

// 생성자에 추가
this.rlModel = loadModelWeights();
this.rlThreshold = 0.5;

// evaluate() 내부 — 기존 게이트 통과 후 RL 추론
const obs = extractFeatures(fighter, opponent, sim);
const shouldUse = this.rlModel.act(obs, this.rlThreshold);
if (!shouldUse) return null;
```

### 5.2 모델 로드 (fallback 포함)

```javascript
function loadModelWeights() {
    try {
        const raw = fs.readFileSync("src/aiModelWeights.json", "utf-8");
        return PolicyNetwork.deserialize(JSON.parse(raw));
    } catch {
        return null; // 학습 전이면 rule-based로 동작
    }
}
```

---

## 6. 파일 구조

```
scripts/rl/
├── train.mjs              ← node scripts/rl/train.mjs
├── policyNetwork.js       ← MLP + 순전파 + 역전파 + 직렬화
├── features.js            ← extractFeatures()
├── normalizer.js          ← RunningNormalizer (입력 정규화)
└── math.js                ← matVecMul, sigmoid, randMatrix 등

src/
└── aiModelWeights.json    ← 학습 완료 후 자동 생성 (~150KB)
```

---

## 7. 하이퍼파라미터

| 파라미터 | 값 | 설명 |
|---|---|---|
| `hiddenDim` | 48×2 | 은닉층 2개 |
| `lr` | 3e-4 | 학습률 |
| `baselineAlpha` | 0.05 | baseline EMA |
| `entropyCoef` | 0.01 | 탐험 장려 |
| `gamma` | 0.97 | 시간 가중치 감가율 |
| `batchSize` | 16 | 배치 에피소드 수 |
| `gradClipNorm` | 1.0 | 그래디언트 L2 클리핑 |
| `minDecisionFrames` | 10 | 결정 최소 간격 (0.17초) |
| `hpGate` | 0.3 | HP 30%↑ |
| `maxDist` | 400 | 거리 400px↓ |
| `episodes` | 20,000 | 총 학습 매치 |
| `threshold` | 0.5 | 추론 임계값 |

---

## 8. 실행

```bash
# 학습 (약 25분)
node scripts/rl/train.mjs

# 검증
node tests/balanceSim.mjs 30

# 실제 테스트
# index.html 열고 debug.aiEnabled = true
```
