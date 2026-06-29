# RL 파이프라인 구현 명세

> **알고리즘**: PPO Actor-Critic (clipped policy gradient + value baseline)
> **프레임워크**: TensorFlow.js (`@tensorflow/tfjs`) — autograd, CPU/WebGL
> **모델 크기**: Actor/Critic 각각 MLP (입력 차원→은닉층→출력 1)

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
const normalizer = new RunningNormalizer(16);
for (let i = 0; i < 1000; i++) {
    const obs = collectRandomObservation();  // 랜덤 매치업에서 샘플링
    normalizer.update(obs);
}

// 매 결정 시점
const rawObs = extractFeatures(fighter, opponent, sim);
const obs = normalizer.normalize(rawObs);
const { probability } = sampleAction(actor, obs);  // 정규화된 입력 사용
```

### 0.5d PPO Clip — 가중치 폭발 방지

정책 그래디언트는 분산이 크고, 한 번의 좋은 승리만으로 확률이 과하게 움직일 수 있습니다:

```
// 최악의 시나리오:
prob = 0.01 (거의 안 쓴다고 확신)
action = 1  (그런데 써버림)
advantage = +1.88 (대승리!)

∇ = -(1 - 0.01) × 1.88 = -1.86
// → 역전파로 3600개 가중치가 한 번에 크게 움직임 → 발산
```

#### 해결: PPO Ratio Clipping

```javascript
// policyNetwork.js
const ratios = tf.exp(tf.sub(newLogProbs, oldLogProbs));
const unclipped = tf.mul(ratios, advantages);
const clippedRatios = tf.clipByValue(ratios, 1 - clipRatio, 1 + clipRatio);
const clipped = tf.mul(clippedRatios, advantages);
const actorLoss = tf.neg(tf.mean(tf.minimum(unclipped, clipped)));
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
        const ppoBatch = buildPpoBatch(critic, batchTrajectories);
        trainPpoEpochs(actor, critic, optimizer, ppoBatch, {
            epochs: CONFIG.ppoEpochs,
            clipRatio: CONFIG.clipRatio,
        });
        batchTrajectories.length = 0;
        batchRewards.length = 0;
    }
}
```

**효과**:

| 기법 | 없는 경우 | 있는 경우 |
|---|---|---|
| 입력 정규화 | distance가 학습 장악 | 모든 특성 균등 기여 |
| PPO Clip | 한 에피소드에 정책 급변 | 안정적 step 크기 |
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
                  │ Actor Net    │  π(a|s) = sigmoid(MLP(s))
                  │ 16→H→H→1    │
                  └──────┬───────┘
                         │ sampleAction(obs) → action + oldLogProb
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
                  │ PPO Update   │  clipped ratio + Critic value loss
                  │  (backprop)  │  Actor/Critic 동시 업데이트
                  └──────────────┘
                         │
                         ▼ (다음 에피소드로)
```

### 0.8 왜 이 게임에 PPO Actor-Critic이 적합한가

| 게임 특성 | PPO Actor-Critic 특징 | 적합 이유 |
|---|---|---|
| 결정 5~15회/매치 | 에피소드 단위 rollout | trajectory 작아서 배치 업데이트 부담이 낮음 |
| Terminal reward 중심 | Critic이 상태 가치 보정 | 승패 보상을 상태별 기댓값으로 분산 |
| Binary action | Bernoulli policy | sigmoid 출력과 자연스러움 |
| Simulator fast | 여러 PPO epoch 가능 | 같은 배치를 여러 번 복습해 샘플 효율 개선 |

---

### 0.9 현미경 튜토리얼 — 한 에피소드의 모든 순간

**설정**: 16차원 입력 → 2차원 은닉층 → 1출력 으로 단순화해서 설명.
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
const { actor, critic } = createActorCriticNetworks(16, 48);
const optimizer = tf.train.adam(CONFIG.lr);

for (let ep = 0; ep < 20000; ep++) {
    // ── 1. ROLLOUT ──
    const sim = newBattleSimulation();  // 무작위 매치업
    const trajectory = [];

    while (!sim.finished) {
        sim.update(1/60);  // 1프레임 진행

        if (shouldMakeDecision(sim)) {
            const obs = extractFeatures(sim);          // 16차원 벡터
            const { action, logProb } = sampleAction(actor, obs);

            trajectory.push({ obs, action, oldLogProb: logProb });

            if (action === 1) executeAction(sim);
        }
    }

    // ── 2. JUDGE ──
    const reward = (sim.winner.id === myFighter.id) ? 1.0 : -1.0;

    // ── 3. CREDIT + UPDATE ──
    const ppoBatch = buildPpoBatch(critic, [{ trajectory, reward }]);
    trainPpoEpochs(actor, critic, optimizer, ppoBatch);

    // 500 에피소드마다 평가
    if (ep % 500 === 0) {
        const winRate = evaluate(actor, 200);  // 200매치 평가
        console.log(`Ep ${ep}: winRate=${(winRate*100).toFixed(1)}%`);
        // 기대: Ep 0 → ~48%, Ep 5000 → ~53%, Ep 20000 → ~55%
    }
}
```

---

## 1. 모델 아키텍처

### 1.1 구조도

```
Actor:  Input (16) → FC₁(H) + ReLU → FC₂(H) + ReLU → FC₃(1) + Sigmoid → P(use_action)
Critic: Input (16) → FC₁(H) + ReLU → FC₂(H) + ReLU → FC₃(1) → V(s)
```

### 1.2 레이어 상세

| 네트워크 | 입력 | 출력 | 활성화 |
|---|---|---|---|
| Actor | 16차원 상태 | 액션 사용 확률 | 마지막 Sigmoid |
| Critic | 16차원 상태 | 상태 가치 점수 | 마지막 활성화 없음 |

### 1.3 가중치 초기화

```javascript
// Xavier/Glorot 초기화
W ~ Uniform(-√(6/(fanIn+fanOut)), √(6/(fanIn+fanOut)))
b = 0
```

---

## 2. 입력 특성 (16차원)

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
10     | oppSpeedNorm      | [0, 1]      | 상대 속도 / 500
11     | speedRatioNorm    | [0, 1]      | 내 속도 / 상대 속도 / 3
12     | closingSpeedNorm  | [-1, 1]     | 거리 변화율 / 400
13     | collisionTimeNorm | [0, 1]      | 충돌 예상시간 / 5초
14     | projectileDist    | [0, 1]      | 최근접 투사체 거리 / 960
15     | elapsedNorm       | [0, 1]      | 경과 시간 / 30초
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

    const mySpeed = fighter.velocity.length();
    const oppSpeed = opponent.velocity.length();
    const speedRatio = oppSpeed > 0 ? mySpeed / oppSpeed : 999;
    const estCollisionTime = approachSpeed > 10 ? dist / approachSpeed : 999;
    let nearestProjectileDist = 999;
    for (const e of sim.entities) {
        if (e === fighter || e === opponent || e.isExpired || !e.velocity) continue;
        if (e.owner === fighter) continue;
        const d = Vector2.subtract(fighter.position, e.position).length();
        if (d < nearestProjectileDist) nearestProjectileDist = d;
    }
    const elapsed = sim.elapsed ?? 0;

    return [
        hpRatio,                                    // 0
        oppHpRatio,                                 // 1
        hpAdvantage,                                // 2
        dist,                                       // 3
        dist / 960,                                 // 4
        approachSpeed,                              // 5
        clamp(approachSpeed / 400, -1, 1),          // 6
        mySpeed,                                    // 7
        clamp(mySpeed / 500, 0, 1),                 // 8
        oppSpeed,                                   // 9
        clamp(oppSpeed / 500, 0, 1),                // 10
        clamp(speedRatio / 3, 0, 1),                // 11
        clamp(approachSpeed / 400, -1, 1),          // 12
        clamp(estCollisionTime / 5, 0, 1),          // 13
        clamp(nearestProjectileDist / 960, 0, 1),   // 14
        clamp(elapsed / 30, 0, 1),                  // 15
    ];
}

export const FEATURE_DIM = 16;
```

---

## 3. 정책 네트워크 (`scripts/rl/policyNetwork.js`)

### 3.1 TensorFlow.js Actor-Critic 모델 정의

```javascript
import * as tf from "@tensorflow/tfjs";

export function createActorCriticNetworks(inputDim = 16, hiddenDim = 48) {
    return {
        actor: createActorNetwork(inputDim, hiddenDim),   // 액션 확률 π(a|s)
        critic: createCriticNetwork(inputDim, hiddenDim), // 상태 가치 V(s)
    };
}
```

**역전파? 자동.** `tf.GradientTape` 또는 `optimizer.minimize()`가 처리합니다.

### 3.2 추론

```javascript
// obs: number[] → tf.tensor2d([obs]) → forward → prob
const prob = model.predict(tf.tensor2d([obs])).dataSync()[0];
// prob ∈ [0, 1] → Bernoulli 샘플링
const action = Math.random() < prob ? 1 : 0;
```

### 3.3 학습 (PPO clipped update + Adam)

```javascript
const optimizer = tf.train.adam(1e-3);

const result = trainPpoEpochs(actor, critic, optimizer, {
    obs,
    actions,
    oldLogProbs,
    returns,
    advantages,
    weights,
});
```

`oldLogProbs`는 rollout 당시 Actor가 선택한 행동의 로그 확률입니다. 업데이트 시 현재 로그 확률과의 비율(`ratio`)을 계산하고, `clipRatio` 범위 안에서만 정책이 움직이도록 제한합니다.

### 3.4 저장/로드

```javascript
// @tensorflow/tfjs 단독 환경에서는 file:// 저장이 없다.
// 영구 저장이 필요하면 별도 직렬화 또는 tfjs-node 도입을 별도 작업으로 진행한다.
```

### 3.5 핵심: tf.tidy() 메모리 관리

TensorFlow.js는 GPU 텐서를 수동 해제해야 합니다. `tf.tidy()`가 블록 내 생성된 모든 중간 텐서를 자동 정리합니다. `.dataSync()`는 GPU→CPU 전송.

---

## 4. 학습 루프 (`scripts/rl/train.mjs`)

```javascript
import * as tf from "@tensorflow/tfjs";
import { createActorCriticNetworks, sampleAction, trainPpoEpochs } from "./policyNetwork.js";
import { extractFeatures } from "./features.js";
import { RunningNormalizer } from "./normalizer.js";
// ... 게임 import ...

const CONFIG = {
    episodes: 20000, lr: 3e-4, entropyCoef: 0.01,
    gamma: 0.97, batchSize: 64, miniBatchSize: 128, clipRatio: 0.2,
    ppoEpochs: 3, minDecisionFrames: 10, hpGate: 0.3, maxDist: 400,
    logInterval: 100,
};

async function main() {
    const { actor, critic } = createActorCriticNetworks(16, 48);
    const optimizer = tf.train.adam(CONFIG.lr);
    const normalizer = new RunningNormalizer(16);

    // ── 입력 정규화 초기화 (1000 샘플) ──
    initNormalizer(normalizer, roster);

    for (let ep = 0; ep < CONFIG.episodes; ep++) {
        // ... rollout 1 episode → obs/action/oldLogProb trajectory, terminal win/loss reward ...

        // ── 배치 업데이트 ──
        if (batchFull) {
            const ppoBatch = buildPpoBatch(critic, batchTraj);
            trainPpoEpochs(actor, critic, optimizer, ppoBatch, {
                epochs: CONFIG.ppoEpochs,
                miniBatchSize: CONFIG.miniBatchSize,
            });
        }
    }

    console.log("학습 완료");
}
```

---

## 5. 게임 임베딩

### 5.1 `AIActionController.evaluate()` 수정 경로

```javascript
// src/simulation/aiActionController.js
import * as tf from "@tensorflow/tfjs";

// 생성자에서 모델 로드
async loadModel() {
    try {
        this.rlModel = await tf.loadLayersModel("file://./src/aiModelWeights/model.json");
        this.rlThreshold = 0.5;
        console.log("RL 모델 로드 완료");
    } catch {
        this.rlModel = null; // fallback: rule-based
    }
}

// evaluate() 내부 — 기존 게이트 통과 후 RL 추론
evaluate(sim, fighter, delta) {
    // ... 기존 게이트 (HP, distance, getFailureReason) ...
    if (!this.rlModel) return this._ruleBasedEvaluate(sim, fighter, delta);

    const obs = extractFeatures(fighter, opponent, sim);
    const prob = this.rlModel.predict(tf.tensor2d([obs])).dataSync()[0];
    if (prob < this.rlThreshold) return null;

    // 실행
    const paidCost = fighter.actionContext.spendHpForAction(fighter, cost);
    // ...
}
```

### 5.2 학습 vs 추론 환경

- **학습**: 현재 저장소는 설치 부담을 낮추기 위해 `@tensorflow/tfjs` CPU 백엔드를 사용.
- **저장**: `@tensorflow/tfjs` 단독 사용 시 `file://` 저장은 지원되지 않으므로, 파일 저장은 별도 직렬화 또는 `tfjs-node` 도입 시 처리.
- **브라우저 추론**: `@tensorflow/tfjs` — `tf.loadLayersModel("model.json")`으로 로드.

---

## 6. 파일 구조

```
scripts/rl/
├── train.mjs              ← node scripts/rl/train.mjs
├── policyNetwork.js       ← createActorCriticNetworks(), trainPpoEpochs()
├── features.js            ← extractFeatures() — 16차원
└── normalizer.js          ← RunningNormalizer — Welford

package.json               ← "dependencies": { "@tensorflow/tfjs": "^4" }
```

---

## 7. 하이퍼파라미터

| 파라미터 | 값 | 설명 |
|---|---|---|
| `hiddenDim` | 48×2 | 은닉층 2개 |
| `lr` | 3e-4 | Adam learning rate |
| `entropyCoef` | 0.01 | 탐험 장려 |
| `gamma` | 0.97 | 시간 가중치 감가율 |
| `batchSize` | 64 | PPO rollout buffer에 모을 에피소드 수 |
| `miniBatchSize` | 128 | PPO 업데이트 시 shuffle 후 나눌 decision 샘플 수 |
| `clipRatio` | 0.2 | PPO ratio clipping |
| `ppoEpochs` | 3 | 같은 배치 반복 학습 횟수 |
| `logInterval` | 100 | 최근 승률/보상/사용률 로그 윈도우 |
| `minDecisionFrames` | 10 | 결정 최소 간격 |
| `hpGate` | 0.3 | HP 30%↑ |
| `maxDist` | 400 | 거리 400px↓ |
| `episodes` | 20,000 | 총 학습 매치 |
| `threshold` | 0.5 | 추론 임계값 |

---

## 8. 단계별 학습 계획

### 8.1 1단계: 기본 액션 (고정 상대: Rage Ball)

Rage Ball은 공격 패턴이 직관적(충돌 기반, 속도·공격력 증가)이라 버티기·회피·카운터 같은 **방어형 액션** 테스트에 최적.

| 캐릭터 | 액션 | 유형 |
|---|---|---|
| Dash | Rush | 돌진 |
| Archer | TimeWarp | CC |
| Eater | LifeSteal | 흡혈 |
| Vampire | Counter | 반사 |
| Bat Ball | Endure | 버티기 |
| Phantom | Evade | 회피 |
| Rage | Shockwave | 광역 |
| Trickster | Rush | 돌진 |

**상대 고정**: Rage Ball — 순수 충돌 딜러, 액션 효과 판별 용이

### 8.2 2단계: 투사체 액션 (고정 상대: Gunner, Archer, Grenade)

ProjectileGuard는 투사체 특성이 필요 → **상대를 원거리 캐릭터로 고정**.

| 캐릭터 | 액션 | 상대 |
|---|---|---|
| Bat Ball | ProjectileGuard | Gunner |
| Dash | ProjectileGuard | Archer |
| Eater | ProjectileGuard | Grenade |

### 8.3 3단계: 전체 조합 × 랜덤 상대

1·2단계에서 검증된 모델들을 종합해 **모든 캐릭터×모든 액션** 조합을 랜덤 상대로 학습.

---

## 9. 실행

```bash
# 의존성 설치
npm install @tensorflow/tfjs

# 학습 (조합별 1500eps, 약 5분)
node scripts/rl/train.mjs

# 검증
node tests/balanceSim.mjs 30
```
