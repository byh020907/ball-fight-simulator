# 현대 강화학습(PPO)의 데이터 흐름 및 확률 기반 아키텍처

## 1. 핵심 패러다임 전환 (Transformer vs RL)

| 비교 항목 | 데이터-레이블 기반 학습 (Transformer 등) | 현대 강화학습 (PPO - Actor-Critic) |
| --- | --- | --- |
| 모델 출력 | 다음에 올 단어의 **확률 분포**를 계산 | **Actor:** 액션 확률 분포 / **Critic:** 상태의 평균 점수 |
| 정답지 (Y) | 데이터셋 내에 **고정된 고유값**으로 존재 | Critic의 평균 예측치를 바탕으로 **실시간 조립(제조)** |
| 데이터셋 | 정제된 정적 데이터셋 활용 (I.I.D. 만족) | 현재 실력으로 직접 수집한 최신 에피소드 버퍼 활용 |

---

## 2. 스텝(Step)의 선후 인과관계

강화학습 구현 시 가장 많이 헤매는 핵심은 **"조작 후 물리 스텝이 실행되어야만 정답 재료가 태어난다"**는 시계열적 선후 관계입니다.

- 현재 상태 S -> 조작 확률 분포에서 액션 A 추출 -> 게임엔진 구동 [env.step()]
- 이후 1프레임 물리 연산이 완료되면 -> [바뀐 미래 상태 S'] + [진짜 보상 R] 탄생

컴퓨터는 조작을 가하고 물리 엔진이 연산을 끝내기 전까지는, 그 조작이 유리했는지 불리했는지 채점할 수 없습니다. 따라서 **실행 후 도출된 결과물(S', R)**을 바탕으로 사후 채점이 이루어집니다.

---

## 3. Actor-Critic: 확률 모델과 평균 가치 모델

기본 DQN이 오직 최고 점수 하나(\(\max\))만 보고 폭주하는 도박꾼 버그가 있다면, PPO는 이를 치료하기 위해 신경망의 역할을 **확률**하고 **평균 가치 점수**로 완전히 이원화합니다.

### 3.1 Actor Network (배우 = 확률 모델)

- **역할:** 질문자님의 직관대로 현재 상태 S를 보고 각 액션을 취할 **"실행 확률 분포(0~100%)"**를 출력합니다.
- **행동 방식:** "이 상황에선 90% 확률로 점프, 10% 확률로 들이받기"처럼 주사위를 굴려 부드럽고 역동적인 연속 조작을 수행합니다.

### 3.2 Critic Network (비평가 = 평균 가치 모델)

- **역할:** 현재 내가 서 있는 자리가 미래에 평균적으로 몇 점이나 벌 수 있는 땅인지 **"수학적 기댓값(V-value, 평균 점수)"**을 계산합니다.
- **핵심 지표 (Advantage):** 진짜 보상을 확인한 후, **"방금 한 행동이 이 자리 평균 점수(Critic 예측)보다 얼마나 더 유리했나?"**를 계산해냅니다. (\(Advantage = \text{실제 정답} - \text{평균 예측}\))

- 비평가가 "그 상태의 평균 기댓값이 낮다"라고 평가하면, 배우는 그 방향으로 가는 행동의 **확률 자체를 낮춥니다.** 이 원리로 평균의 함정을 완화합니다.

---

## 4. 매 스텝(Step) 및 에피소드 데이터 파이프라인 (3단계)

### [1단계] 실시간 확률 주사위 및 실행

1. Actor가 현재 상태 S에 대한 **액션 확률 분포**를 계산합니다.
2. 이 분포를 바탕으로 랜덤하게 액션 A를 샘플링하여 `env.step(action)` 물리 엔진을 가동합니다.
3. 1프레임 뒤 현실 세계에서 **진짜 보상 R**과 **바뀐 미래 상태 S'**이 도출됩니다.
4. 당시 실행했던 액션의 `상태, 행동, 진짜보상, 다음상태, 행동확률`을 에피소드 버퍼에 임시 보관합니다.

### [2단계] 에피소드 종료 후 정답 제조 - 감마(Gamma) 결합 구간

1. 게임이 끝나면(or 일정 스텝이 모이면) 모아둔 데이터를 바탕으로 Critic(비평가)이 정답지를 조립합니다.

- `Target Value = R + (감마 * 다음 상태 S'의 평균 가치 예측치)`
- **감마(γ)의 누적 원리:** 에피소드를 거듭하며 Critic 신경망이 학습될 때, 레이어의 출력값 내부에 이미 과거에 누적된 감마 지식(\(0.99, 0.99^2, 0.99^3...\))이 실시간 업데이트되어 저장되어 나옵니다. 따라서 코드가 스스로 감마를 줄이는 게 아니라, **Critic 레이어의 학습 결과물에 감마가 저절로 누적되는 구조**입니다.

### [3단계] 묵직한 미니배치 확률 업데이트

1. 제조된 정답 데이터를 무작위로 섞어 미니배치 단위로 처리합니다.
2. `Advantage`를 계산하여, 평균보다 잘한 행동은 **Actor의 출력 확률을 더 높이도록** 가중치를 수정하고, Critic은 **평균 점수를 더 잘 맞추도록** 가중치를 묵직하게 역전파 업데이트합니다.
3. PPO 고유의 안전장치(`Clip`)를 가동하여, 확률이 한 번에 너무 급격하게 바뀌어 정책이 붕괴되는 현상을 방지합니다.

## 파이토치(PyTorch) 표준 아키텍처 소스 코드

```
import random
import torch
import torch.nn as nn
import torch.optim as optim
from torch.distributions import Categorical

# ======================================================================
# [1] 가상의 신경망 구조 (Actor-Critic 네트워크 모델 정의)
# ======================================================================
class ActorNetwork(nn.Module):
    def __init__(self, state_size, action_size):
        super().__init__()
        # 입력: 상태 피처 -> 출력: 각 액션의 "확률" 분포 (Softmax 적용)
        self.net = nn.Sequential(
            nn.Linear(state_size, 64),
            nn.ReLU(),
            nn.Linear(64, action_size),
            nn.Softmax(dim=-1) # 합이 1.0이 되는 진짜 확률 분포를 출력
        )
    def forward(self, x): return self.net(x)

class CriticNetwork(nn.Module):
    def __init__(self, state_size):
        super().__init__()
        # 입력: 상태 피처 -> 출력: 이 자리의 "평균 가치 점수(V-value)" 1개
        self.net = nn.Sequential(
            nn.Linear(state_size, 64),
            nn.ReLU(),
            nn.Linear(64, 1) # 활성화 함수 없음 (Raw 평균 점수 출력)
        )
    def forward(self, x): return self.net(x)

# ======================================================================
# [2] PPO 핵심 데이터 학습 파이프라인 클래스
# ======================================================================
class PPODataPipeline:
    def __init__(self, actor_net, critic_net, optimizer, action_size, gamma=0.99, eps_clip=0.2):
        self.actor = actor_net          # Actor: 상태를 입력받아 각 액션의 "확률 분포" 출력
        self.critic = critic_net        # Critic: 상태를 입력받아 "평균 가치 점수(V)" 출력
        self.optimizer = optimizer
        self.action_size = action_size
        self.gamma = gamma              # 미래 가치 할인율 (0.99)
        self.eps_clip = eps_clip        # 확률이 한 번에 급격히 바뀌지 않도록 잠그는 클립 범위 (20%)

    # ----------------------------------------------------
    # [1단계] 확률 기반 행동 선택 (질문자님의 직관과 일치하는 구간)
    # ----------------------------------------------------
    def get_action(self, state):
        state_t = torch.FloatTensor(state).unsqueeze(0) # 배치 차원 추가

        # 1. Actor 레이어가 각 액션별 "실행 확률"을 뱉습니다. -> 예: [0.10, 0.90] (합은 1.0)
        action_probs = self.actor(state_t)

        # 2. 이 확률판을 바탕으로 주사위를 굴려 실제 액션을 샘플링합니다.
        dist = Categorical(action_probs)
        action = dist.sample() # 90% 확률로 돌진, 10% 확률로 도망이 알아서 추출됨

        # 실제 조작할 액션 번호와, 당시 그 액션의 확률값(Log Prob)을 리턴
        return action.item(), dist.log_prob(action).item()

    # ----------------------------------------------------
    # [2단계 & 3단계] 에피소드 버퍼 데이터를 이용한 묵직한 융합 학습
    # ----------------------------------------------------
    def train_epoch(self, states, actions, old_log_probs, rewards, next_states, dones, K_epochs=3):
        # 파이토치 연산을 위해 세로 행렬(Tensor)로 일괄 변환
        states_t      = torch.FloatTensor(states)
        actions_t     = torch.LongTensor(actions).unsqueeze(1)
        old_log_probs_t = torch.FloatTensor(old_log_probs).unsqueeze(1)
        rewards_t     = torch.FloatTensor(rewards).unsqueeze(1)
        next_states_t = torch.FloatTensor(next_states)
        dones_t       = torch.FloatTensor(dones).unsqueeze(1)

        # K_epochs 번 반복하며 모인 데이터를 묵직하게 다회독 복습합니다.
        for _ in range(K_epochs):
            # 1. Critic 레이어에게 현재 상태와 다음 상태의 "평균 가치 점수"를 출력하게 합니다.
            current_values = self.critic(states_t)
            next_values = self.critic(next_states_t)

            # 2. [정답 채점표 즉석 제조] 진짜 보상 + (감마 * 다음 상태의 평균 가치 점수)
            # [핵심 원리 주석]:
            # 코드 상에서는 매번 self.gamma를 단 한번만 곱하는 것처럼 보입니다.
            # 하지만 학습이 반복될수록 'next_values' 레이어 출력값 자체에 과거에 누적된 감마 지식(0.99^2, 0.99^3...)이
            # 저절로 축적되어 출력됩니다. 따라서 신경망 학습 결과물에 감마가 알아서 누적되는 구조입니다.
            target_values = rewards_t + (self.gamma * next_values * (1 - dones_t))

            # 3. [평균의 함정 파괴: 어드밴티지 계산]
            # "방금 내가 선택한 조작의 정답 점수가, 원래 이 자리에 서 있을 때의 평균 기댓값보다 얼마나 더 유리했나?"
            advantage = target_values - current_values

            # 4. Actor(배우 망)의 진짜 확률 분포 업데이트
            new_probs = self.actor(states_t)
            dist = Categorical(new_probs)
            new_log_probs = dist.log_prob(actions_t.squeeze(-1)).unsqueeze(1)

            # 과거의 행동 확률과 현재 수정 중인 행동 확률의 비율(Ratio) 계산
            ratio = torch.exp(new_log_probs - old_log_probs_t)

            # PPO의 핵심 안전장치: 확률 변동 폭이 20%(eps_clip)를 넘지 못하게 제한합니다.
            surr1 = ratio * advantage
            surr2 = torch.clamp(ratio, 1 - self.eps_clip, 1 + self.eps_clip) * advantage
            actor_loss = -torch.min(surr1, surr2).mean() # Advantage가 플러스면 이 행동의 확률을 극대화함

            # 5. Critic(비평가 망)의 평균 점수 예측력 정교화 오차 계산
            critic_loss = nn.MSELoss()(current_values, target_values)

            # 6. 배우와 비평가의 손실을 합산하여 묵직하게 가중치 업데이트 역전파 실행
            total_loss = actor_loss + 0.5 * critic_loss

            self.optimizer.zero_grad()
            total_loss.backward()
            self.optimizer.step() # Actor와 Critic을 동시에 업데이트

# ======================================================================
# [3] 가상의 게임 환경 시뮬레이션 클래스 (Ball-Fight)
# ======================================================================
class SimpleBallFightEnv:
    def __init__(self):
        self.state_size = 2 # 예: [내 위치, 상대 위치]
        self.reset()
    def reset(self):
        self.steps = 0
        return [0.0, 5.0] # 초기 상태 리턴
    def step(self, action):
        self.steps += 1
        # 가상의 물리 반응 결과물 리턴 (다음상태, 즉시보상, 종료여부)
        next_state = [float(self.steps), 5.0]
        reward = 1.0 if action == 1 else 0.0 # 1번 액션(돌진)했을 때만 즉각 보상 +1
        done = True if self.steps >= 10 else False # 10걸음 뛰면 게임 오버
        return next_state, reward, done

# ======================================================================
# [4] 메인 게임 실행 및 PPO 실시간 학습 구동 루프
# ======================================================================
if __name__ == "__main__":
    # 환경 및 기본 변수 세팅
    env = SimpleBallFightEnv()
    state_size = 2
    action_size = 2 # 0: 도망, 1: 돌진

    # 두 개의 뇌 합산 모델 초기화
    actor = ActorNetwork(state_size, action_size)
    critic = CriticNetwork(state_size)

    # 두 신경망의 파라미터를 하나의 옵티마이저로 한꺼번에 관리
    all_parameters = list(actor.parameters()) + list(critic.parameters())
    optimizer = optim.Adam(all_parameters, lr=0.001)

    # PPO 데이터 학습 파이프라인 생성
    ppo_pipeline = PPODataPipeline(actor, critic, optimizer, action_size)

    total_episodes = 5  # 시뮬레이션용으로 5판만 구동 테스트

    for epi in range(total_episodes):
        state = env.reset()
        done = False

        # 이번 판의 기억을 한 번에 모아두기 위한 최신 임시 버퍼 리스트들
        ep_states, ep_actions, ep_log_probs, ep_rewards, ep_next_states, ep_dones = [], [], [], [], [], []

        # [실시간 라이브 플레이 루프]
        while not done:
            # (1) Actor 확률 모델에게 현재 화면(S)을 주고 확률 기반 액션(A)과 당시의 확률(log_prob)을 받아옴
            action, log_prob = ppo_pipeline.get_action(state)

            # (2) [선후관계 지점]
            # 조작(A)을 게임 엔진에 주입하고 1프레임 타임머신을 돌려야만 미래 화면(S')과 진짜 보상(R)이 태어남
            next_state, reward, done = env.step(action)

            # (3) 방금 일어난 따끈따끈한 사실들을 이번 판 버퍼 리스트에 차곡차곡 수집
            ep_states.append(state)
            ep_actions.append(action)
            ep_log_probs.append(log_prob)
            ep_rewards.append(reward)
            ep_next_states.append(next_state)
            ep_dones.append(done)

            # 다음 프레임 전이를 위해 상태 변경
            state = next_state

        # ----------------------------------------------------------------------
        # [학습 단계] 판이 끝나면 본격적인 복습 시작
        # ----------------------------------------------------------------------
        print(f"Episode {epi + 1} 종료. 한 판의 데이터를 묶어서 학습을 가동합니다.")

        # 모아둔 한 판 치 분량의 연속된 시계열 데이터 뭉치를 PPO 파이프라인의 학습 모듈로 일괄 토스!
        # 내부적으로 섞기(Shuffle), 임시정답 제조, Advantage 연산, 배우/비평가 레이어 역전파가 동시에 일어납니다.
        ppo_pipeline.train_epoch(
            states=ep_states,
            actions=ep_actions,
            old_log_probs=ep_log_probs,
            rewards=ep_rewards,
            next_states=ep_next_states,
            dones=ep_dones,
            K_epochs=3 # 이 한 판의 추억을 3번 다회독하며 묵직하게 복습해라!
        )

        # [PPO의 핵심 정리]:
        # 학습이 단 1회 완료되면 이 데이터들은 일회용이므로 메모리를 완전히 비워버립니다.
        # 다음 판에는 조금 더 똑똑해진 최신 버전의 확률 분포 상태로 새로운 고품질 데이터를 수집하기 위함입니다.
```

## 감마(Gamma, γ)와 2가지 보상 체계 (점프 예시 기반)

감마(gamma)를 결합하여 정답을 조립하는 진짜 이유는 게임의 보상 체계를 다음 2가지로 결합하기 위함입니다.

1. **즉각 보상 (Immediate Reward):** 액션을 취했을 때 발생한 `next_state`에서 환경(물리 엔진)이 즉시 던져준 눈앞의 진짜 점수(R).
2. **예측 보상 (Future Expected Value):** 당장 `next_state`로 이동한 순간에는 즉각 보상이 0점일지라도, 이 자리가 미래에 큰 건을 건질 수 있는 명당자리인지 비평가 뇌(`Critic`)가 추정한 **예상 점수**.

---

### 실무 예시: 점프 조작을 통해 본 확률과 평균 가치의 전파 메커니즘

질문자님이 이해하신 "얼떨결에 피해서 보상을 받은 기억이 미래 예측 점수로 계승되는 과정"은 PPO 아키텍처에서 다음과 같은 완벽한 인과관계로 작동합니다.

#### 1단계: 얼떨결에 피해서 진짜 보상 획득 (판 1)

- 장애물이 다가오는 위험한 상황에서 인공지능이 무작위 주사위를 굴려 우연히 '점프' 액션을 실행했습니다.
- 장애물을 완벽히 피하면서 **즉각 보상**으로 진짜 점수 `+100점`을 얻었습니다. 이 경험이 버퍼에 담겨 복습 학습(`train_epoch`)으로 들어갑니다.

#### 2단계: 비평가(Critic)의 명당 인지 및 배우(Actor)의 확률 수정

- **Critic의 공부:** 비평가 뇌는 "장애물 바로 앞 상황"의 **평균 가치 점수를 100점에 가깝게 대폭 상향** 조정합니다.
- **Actor의 공부:** 배우 뇌는 "방금 그 상황에서 점프를 뛴 건 평균보다 훨씬 유리한 행동(\(Advantage\) 양수)이었다!"라고 판단하여, 다음번엔 이 자리에서 점프를 선택할 **출력 확률 분포 자체를 10%에서 90%로 대폭 끌어올립니다.**
- 판이 끝나고 이 학습된 파라미터가 그대로 다음 판으로 계승됩니다.

#### 3단계: 아직 장애물이 멀리 있을 때의 빌드업 (판 2 - 예측 보상의 효과)

- 다음 판이 시작되어 **"장애물이 저 멀리서 다가오는 아주 이른 상태"**가 되었습니다. 당장 점프를 뛰어봤자 즉각 보상은 `0점`입니다.
- 하지만 1스텝 전진해서 "장애물 바로 앞 칸"으로 이동하는 액션을 평가해 보려고 하니, 2단계에서 똑똑해진 `Critic` 레이어가 **"어? 거기 장애물 바로 앞 칸으로 가면 미래에 90% 확률로 점프 뛰어 대박 낼 수 있는 명당자리잖아! 내 예측 점수는 100점이야!"** 하고 미래 예측 점수(next_value)를 뿜어냅니다.
- 여기에 감마(0.99)가 한 번 곱해지면서 현재 정답지는 `0 + 0.99 * 100 = 99점`으로 계산됩니다.
- **결과:** 인공지능은 당장 눈앞에 아무런 보상이 없더라도, **"지금 앞으로 전진해 두어야 나중에 점프를 뛰어 100점을 먹는 연계 콤보(예측 보상)가 완성되는구나!"**를 완벽하게 인지하고 미리 전진하는 지혜(큰 그림)를 배우게 됩니다.

---

### 소스 코드 내 핵심 수식과의 1:1 매칭 확인

이 메커니즘이 코드의 어느 부위에서 구동되는지 정확한 수식 라인입니다.

```
# [2단계] 복습할 때: 점프 뛰어 대박 쳤던 과거의 100점(rewards_t)이 반영되는 순간
# [3단계] 전진할 때: 다음 칸의 점프 대박 명당 예측치(next_values = 100점)에 감마가 곱해져 전달되는 순간
target_values = rewards_t + (self.gamma * next_values * (1 - dones_t))

# "이 자리 평균(current_values)보다 전진하거나 점프 뛴 게 얼마나 더 좋은 행동인가?" 채점
advantage = target_values - current_values
```
