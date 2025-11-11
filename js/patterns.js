// patterns.js
import { GAME_WIDTH } from "./constants.js";


export const ARRIVE_Y = 260;     // 더 아래로 내리고 싶으면 숫자 ↑ (예: 300)
export const STAGE1_INTERVAL = 0.5;
export const STAGE1_SPEED = 1.7; // 전체 속도 베이스
// ───────────────────────────────────────────

// 한 웨이브 = 2마리(두 줄 한 컬럼) × 8스텝 = 16마리
export const stage1Patterns = [
  // 1) 오른쪽→왼쪽
  ...createColumnSequence("rightToLeft", 0, 8, STAGE1_INTERVAL, ARRIVE_Y),

  // 2) 왼쪽→오른쪽
  ...createColumnSequence("leftToRight", 7, 8, STAGE1_INTERVAL, ARRIVE_Y),

  // 3) 양쪽 동시 교차 (좌2+우2 = 4마리 × 4스텝 = 16)
  ...createColumnSequence("bothSides", 12, 4, STAGE1_INTERVAL, ARRIVE_Y),

  { time: 16.0, enemies: [
    { x:  80, y: -50, pattern: "descendStop", speed: 1.2, targetX:  80,               targetY: 110 }
  ]},

  { time: 16.6, enemies: [
    { x: GAME_WIDTH - 80, y: -50, pattern: "descendStop", speed: 1.2, targetX: GAME_WIDTH - 80, targetY: 110 }
  ]},

  { time: 17.2, enemies: [
    { x: GAME_WIDTH / 2,  y: -60, pattern: "descendStop", speed: 1.2, targetX: GAME_WIDTH / 2,  targetY:  86 }
  ]},

  // ── 즉시 이어지는 약한 적 “/” 모양의 수직 낙하 ──
  // 컬럼/탱커 이후에 시작하도록 시간을 충분히 뒤로 배치
  ...createSlashWave(18.0, 12, 0.5, 1.6, 26, 1.2), // vy, amp, freq(Hz)

  ...createSpinCenterWave(30.0, 12, 0.3, 160, 80, 6.0)
];

// ‘/’ 모양 수직 낙하 (수직 + 좌우 흔들림, 순 이동 드리프트 없음)
// freq는 Hz(초당 왕복 횟수), amp는 픽셀 폭
function createSlashWave(startTime, count, interval, vy=1.6, amp=26, freq=1.2) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const spawnX = 40 + i * 28; // "/" 형태를 만들기 위해 오른쪽으로 점점 옮겨 스폰
    out.push({
      time: startTime + i * interval,
      enemies: [{
        x: spawnX, y: -30 - i * 12,
        pattern: "slashV",
        vy, amp, freq
      }]
    });
  }
  return out;
}

// 양쪽 상단에서 떨어진 뒤 원운동(2바퀴) 후 소멸
export function createSpinDropWave(startTime, pairs=5, interval=0.25, dropY=140, radius=50, spinSecs=3.0, fireDelaySec=0.9) {
  const out = [];
  for (let i = 0; i < pairs; i++) {
    const t = startTime + i * interval;
    out.push({
      time: t,
      enemies: [
        { x: 24, y: -40, pattern: "dropSpinCCW", vy: 2.0, targetY: dropY, radius, spinSecs, startAngle: Math.PI, spread3: true, fireDelaySec },
        { x: GAME_WIDTH - 24, y: -40, pattern: "dropSpinCW",  vy: 2.0, targetY: dropY, radius, spinSecs, startAngle: 0,         spread3: true, fireDelaySec }
      ]
    });
  }
  return out;
}

// 중앙에서 낙하 → 6시 방향에서 시작해 반시계로 크게 3바퀴, 매 12시에서 발사
export function createSpinCenterWave(startTime, count=1, interval=0.4, dropY=160, radius=80, spinSecs=6.0) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      time: startTime + i * interval,
      enemies: [{
        x: GAME_WIDTH / 2, y: -40, pattern: "dropSpinCenterCCW",
        vy: 2.0, targetY: dropY, radius, spinSecs,
        startAngle: Math.PI * 1.5, // 6시
        spread3: true // 12시마다 3갈래 발사
      }]
    });
  }
  return out;
}

function createColumnSequence(type, startTime, columns, interval, arriveY) {
  const seq = [];
  for (let i = 0; i < columns; i++) {
    seq.push({
      time: startTime + i * interval,
      enemies: createColumn(type, i, arriveY),
    });
  }
  return seq;
}

// patterns.js (createColumn 내부 숫자만 조정)
function createColumn(type, colIndex, arriveY) {
  const enemies = [];
  const spacingY   = 46;
  const startY     = 32;     // -8 → 32 : 화면 안쪽에서 바로 보이게
  const tiltPerCol = 2;      // 3 → 2 : 열 진행할수록 내려가는 기울기 완화
  const speed      = 1.4;    // 1.6 → 1.4 : 전체 속도 한 단계 더 낮춤

  const X_RIGHT_EDGE = GAME_WIDTH + 49;
  const X_LEFT_EDGE  = -49;

  const yTop    = startY - 0 * spacingY - colIndex * tiltPerCol;
  const yBottom = startY - 1 * spacingY - colIndex * tiltPerCol;

  const ay = arriveY ?? 360; // 320 → 360 : 도착 지점을 더 아래로

  if (type === "rightToLeft") {
    enemies.push({ x: X_RIGHT_EDGE,      y: yTop,    pattern: "crossLeft",  speed });
    enemies.push({ x: X_RIGHT_EDGE - 12, y: yBottom, pattern: "crossLeft",  speed });
  } else if (type === "leftToRight") {
    enemies.push({ x: X_LEFT_EDGE,       y: yTop,    pattern: "crossRight", speed });
    enemies.push({ x: X_LEFT_EDGE + 12,  y: yBottom, pattern: "crossRight", speed });
  } else if (type === "bothSides") {
    enemies.push({ x: X_RIGHT_EDGE,      y: yTop,    pattern: "crossLeft",  speed });
    enemies.push({ x: X_RIGHT_EDGE - 12, y: yBottom, pattern: "crossLeft",  speed });
    enemies.push({ x: X_LEFT_EDGE,       y: yTop,    pattern: "crossRight", speed });
    enemies.push({ x: X_LEFT_EDGE + 12,  y: yBottom, pattern: "crossRight", speed });
  }
  return enemies;
}
