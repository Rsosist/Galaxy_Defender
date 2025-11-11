import { stage1Patterns } from "./patterns.js";
import { ctx, GAME_WIDTH, GAME_HEIGHT, COLORS, CONFIG, IMAGES } from "./constants.js";
import { player } from "./player.js";

export const enemies = [];
export const enemyBullets = [];
let patternIndex = 0;
let startTime = Date.now();
let bossStarted = false;

export function resetEnemies() {
  enemies.length = 0;
  patternIndex = 0;
  startTime = Date.now();
  bossStarted = false;
}

let patternCursor = 0;

// 매 프레임 호출: 시작 시각 기준 경과 초로 스폰 타이밍 처리
export function updateEnemyPatterns() {
  const nowSeconds = (Date.now() - startTime) / 1000;
  while (patternCursor < stage1Patterns.length &&
         nowSeconds >= stage1Patterns[patternCursor].time) {
    const p = stage1Patterns[patternCursor];
    p.enemies.forEach(e => {
      // 탱커는 크기를 조금 키움 (40x40), 일반 적은 28x28 유지
      const size = (e.pattern === "descendStop") ? 60 : 28;
      enemies.push({
        x: e.x, y: e.y, width: size, height: size,
        speed: e.speed ?? CONFIG.enemyBaseSpeed,
        pattern: e.pattern,
        hp: (e.pattern === "descendStop") ? 50 : 15,
        // ↓ 새 필드들 복사 (우리가 앞에서 쓰기로 한 것들)
        targetX: e.targetX, targetY: e.targetY,
        amp: e.amp, freq: e.freq,
        // 회전형 패턴 파라미터
        vy: e.vy, radius: e.radius, spinSecs: e.spinSecs, startAngle: e.startAngle, spread3: e.spread3,
        // 사격 타이머
        // - 일반 적: 일정 지연 후 1회 플레이어 조준 사격
        // - 탱커(descendStop): 멈춘 뒤 일정 간격으로 2발 수직 발사
        // - 흔들리며 떨어지는 적(slashV): 2초마다 반복 발사
        // - 중앙 회전(dropSpinCenterCCW): 각도 트리거만 사용(12시), 일반 지연 사격 비활성화
        fireDelaySec: (e.pattern === "descendStop")
          ? (e.fireDelaySec ?? 0.5)
          : (e.pattern === "dropSpinCenterCCW" ? null : (e.fireDelaySec ?? 1.2)),
        fireIntervalSec: (e.pattern === "descendStop") 
          ? (e.fireIntervalSec ?? 0.6) 
          : (e.pattern === "slashV" ? 2.0 : null),
        // 탱커 개별 탄 크기(얇고 길게 표현 가능)
        tankBulletW: (e.pattern === "descendStop") ? (e.tankBulletW ?? 8)  : undefined,
        tankBulletH: (e.pattern === "descendStop") ? (e.tankBulletH ?? 18) : undefined,
        _timerSec: 0, _fired: false, _fireAccum: 0, _fireStarted: false,
        _spinning: false, _angle: e.startAngle ?? 0, _spinAccum: 0, _pivotX: null, _pivotY: null
      });
    });
    patternCursor++; // 커서 전진
  }
}

function lerp(a, b, t) {
  if (t < 0) t = 0;
  if (t > 1) t = 1;
  return a + (b - a) * t;
}

function moveEnemy(e, delta) {
  switch (e.pattern) {
    case "straight": e.y += e.speed * delta; break;
    case "descendStop": {
      // 지정 지점까지 직선 하강 후 그 자리에서 정지
      const vy = (e.speed || 1.2) * 1.0;
      const targetX = (e.targetX != null) ? e.targetX : e.x;
      const targetY = (e.targetY != null) ? e.targetY : e.y + 120;

      // X는 부드럽게 목표로 수렴
      e.x = lerp(e.x, targetX, 0.08 * delta);
      // Y는 일정 속도로 증가
      if (!e._stopped) {
        e.y += vy * delta;
        if (e.y >= targetY) {
          e.y = targetY;
          e._stopped = true; // 멈춘 뒤엔 그대로 대기
        }
      }
      break;
    }
    case "diagonalLeft": e.y += e.speed * delta; e.x -= e.speed * 0.6 * delta; break;
    case "diagonalRight": e.y += e.speed * delta; e.x += e.speed * 0.6 * delta; break;
    case "sineWave": e.y += e.speed * delta; e.x += Math.sin(e.y / 30) * 2; break;
    case "zigzag": e.y += e.speed * delta; e.x += Math.sin(e.y / 20) * 3; break;
    case "bossIntro": {
      e.y += e.speed * delta;
      if (e.y > 80) {
        e.y = 80;
        // 보스가 중앙에 도착하면 이동 패턴 시작
        if (e.type === "boss" && e.phase === 1) {
          e.pattern = "bossPhase1";
          e._bossMoveState = "shooting"; // 초기 상태: 발사
          e._bossShootTimer = 0;
          e._bossMoveTimer = 0;
          e._bossMoveTargetX = e.x; // 현재 위치 (중앙)
          e._bossCenterX = e.x; // 중앙 위치 저장
          e._didShoot = false; // 발사 플래그 초기화
          e._bossShootStep = 0; // 발사 단계: 0=대기, 1=첫 발사 완료, 2=딜레이 중, 3=두 번째 발사 완료
        }
      }
      break;
    }
    case "bossPhase1": {
      // 보스 1페이즈 이동 패턴 (1페이즈일 때만)
      if (e.type === "boss" && e.phase === 1 && e._bossMoveState != null) {
        const moveSpeed = 2.0; // 이동 속도
        const moveDistance = 120; // 이동 거리
        
        if (e._bossMoveState === "shooting") {
          // 발사 대기 중 (발사는 updateAndDrawEnemies에서 처리)
          // 발사 완료 후 이동 시작
          if (e._didShoot) {
            // 발사 완료, 이동 시작
            e._didShoot = false;
            if (e._bossMoveTargetX === e._bossCenterX) {
              // 중앙에서 시작 -> 왼쪽으로 이동
              e._bossMoveState = "movingLeft";
              e._bossMoveTargetX = e._bossCenterX - moveDistance;
            } else if (e._bossMoveTargetX < e._bossCenterX) {
              // 왼쪽에서 -> 오른쪽으로 이동
              e._bossMoveState = "movingRight";
              e._bossMoveTargetX = e._bossCenterX + moveDistance;
            } else {
              // 오른쪽에서 -> 중앙으로 이동
              e._bossMoveState = "movingCenter";
              e._bossMoveTargetX = e._bossCenterX;
            }
          }
        } else {
          // 이동 중
          const dx = e._bossMoveTargetX - e.x;
          const distance = Math.abs(dx);
          
          if (distance > 2) {
            // 목표 위치로 이동
            const dir = dx > 0 ? 1 : -1;
            e.x += dir * moveSpeed * delta;
          } else {
            // 목표 위치 도착
            e.x = e._bossMoveTargetX;
            e._bossMoveState = "shooting";
            e._bossShootTimer = 0;
            e._didShoot = false; // 발사 플래그 초기화
            e._bossShootStep = 0; // 발사 단계 초기화
          }
        }
      }
      break;
    }
    // enemies.js - moveEnemy 일부만 바꾸기
    case "crossLeft": {
      const vy = e.speed * 0.8;  // 세로 비중
      const vx = e.speed * 1.5; // 가로 비중 (수치로 기울기 조절)
      e.y += vy * delta;
      e.x -= vx * delta;
      break;
    }
    case "crossRight": {
       const vy = e.speed * 0.8;
       const vx = e.speed * 1.5;
       e.y += vy * delta;
       e.x += vx * delta;
      break;
      }
      case "slashZig": {
        // 초 단위 타이머 사용(프레임 독립), freq는 Hz(초당 사이클 수)
        if (e.timeSec == null) e.timeSec = 0;
        e.timeSec += (delta / 60);
        const base = e.speed || 1.8;
        const vy   = base * 1.00;          // 세로
        const vx   = base * 0.65;          // 오른쪽으로 살짝
        const amp  = e.amp  ?? 10;         // 흔들림 폭
        const hz   = e.freq ?? 1.5;        // 흔들림 빈도(Hz)
        const angle = 2 * Math.PI * hz * e.timeSec;
        e.y += vy * delta;
        e.x += vx * delta + Math.sin(angle) * amp;
        break;
      }
      case "slashFall": {
        // ‘/’ 모양으로 약간 오른쪽으로 기울어지며 곧게 낙하
        const vy = (e.vy != null) ? e.vy : 2.2;
        const vx = (e.vx != null) ? e.vx : 0.6;
        e.y += vy * delta;
        e.x += vx * delta;
        break;
      }
      case "slashV": {
        // 수직 낙하 + 좌우 흔들림(프레임 독립, freq는 Hz)
        if (e.timeSec == null) e.timeSec = 0;
        if (e.baseX == null) e.baseX = e.x;
        e.timeSec += (delta / 60);
        const vy   = (e.vy != null) ? e.vy : 1.6;
        const amp  = (e.amp != null) ? e.amp : 26;
        const hz   = (e.freq != null) ? e.freq : 1.2;
        const angle = 2 * Math.PI * hz * e.timeSec;
        e.y += vy * delta;
        e.x = e.baseX + Math.sin(angle) * amp;
        break;
      }
      case "dropSpinCCW":
      case "dropSpinCW": {
        const fallVy = e.vy ?? 2.0;
        const dir = (e.pattern === "dropSpinCW") ? 1 : -1; // CW: +, CCW: -
        if (!e._spinning) {
          e.y += fallVy * delta;
          if (e.y >= (e.targetY ?? 140)) {
            e._spinning = true;
            e._pivotX = e.x;
            e._pivotY = e.y;
            e._angle = e.startAngle ?? 0;
            e._spinAccum = 0;
          }
        } else {
          const spins = 2; // 2바퀴
          const spinSecs = e.spinSecs ?? 3.0;
          const omega = (spins * 2 * Math.PI) / spinSecs; // rad/sec
          const dSec = (delta / 60);
          e._angle += dir * omega * dSec;
          e._spinAccum += Math.abs(omega * dSec);
          const r = e.radius ?? 50;
          e.x = e._pivotX + Math.cos(e._angle) * r;
          e.y = e._pivotY + Math.sin(e._angle) * r;
          if (e._spinAccum >= spins * 2 * Math.PI) {
            e._expired = true; // 소멸
          }
        }
        break;
      }
      case "dropSpinCenterCCW": {
        const fallVy = e.vy ?? 2.0;
        if (!e._spinning) {
          e.y += fallVy * delta;
          if (e.y >= (e.targetY ?? 160)) {
            e._spinning = true;
            // 현재 위치가 6시가 되도록 피벗을 반지름만큼 위로 설정
            const r = e.radius ?? 80;
            e._pivotX = e.x;
            e._pivotY = e.y - r;
            e._angle = e.startAngle ?? (Math.PI * 1.5); // 6시
            e._spinAccum = 0;
            e._sinceShoot = 0;
          }
        } else {
          const spins = 3; // 3바퀴
          const spinSecs = e.spinSecs ?? 4.8;
          const omega = (spins * 2 * Math.PI) / spinSecs; // rad/sec
          const dSec = (delta / 60);
          const prevAngle = e._angle;
          e._angle += -omega * dSec; // 반시계
          e._spinAccum += omega * dSec;
          const r = e.radius ?? 80;
          // 캔버스 좌표계에 맞게 y는 -sin을 사용(위가 음수)
          e.x = e._pivotX + Math.cos(e._angle) * r;
          e.y = e._pivotY - Math.sin(e._angle) * r;
          // 매 12시(π/2)에 근접하면 3갈래 발사
          e._sinceShoot += dSec;
          const TWO_PI = Math.PI * 2;
          const norm = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;
          const curr = norm(e._angle);
          const eps = 0.06;
          if (Math.abs(curr - Math.PI / 2) < eps && e._sinceShoot > 0.2) {
            if (e.spread3) shootAtPlayerSpread3(e, 3.0, 0.24);
            else shootAtPlayer(e, 3.0);
            e._sinceShoot = 0;
          }
          if (e._spinAccum >= spins * 2 * Math.PI) {
            e._expired = true;
          }
        }
        break;
      }
    }
}

function shootAtPlayer(shooter, speed=3.0) {
  const sx = shooter.x + shooter.width / 2;
  const sy = shooter.y + shooter.height / 2;
  const tx = player.x + player.width / 2;
  const ty = player.y + player.height / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const vx = (dx / len) * speed;
  const vy = (dy / len) * speed;
  enemyBullets.push({
    x: sx - 6, y: sy - 6, width: 16, height: 16,
    vx, vy,
    bulletType: "normal" // 흰색 중심 + 파란색 후광
  });
}

function rotate(vx, vy, angleRad) {
  const c = Math.cos(angleRad), s = Math.sin(angleRad);
  return { vx: vx * c - vy * s, vy: vx * s + vy * c };
}

function shootAtPlayerSpread3(shooter, speed=3.0, spreadRad=0.22) {
  const sx = shooter.x + shooter.width / 2;
  const sy = shooter.y + shooter.height / 2;
  const tx = player.x + player.width / 2;
  const ty = player.y + player.height / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const vx0 = (dx / len) * speed;
  const vy0 = (dy / len) * speed;
  const left  = rotate(vx0, vy0, -spreadRad);
  const right = rotate(vx0, vy0,  spreadRad);
  const size = 10;
  enemyBullets.push({ x: sx - size/2, y: sy - size/2, width: size, height: size, vx: vx0,   vy: vy0, bulletType: "normal" });
  enemyBullets.push({ x: sx - size/2, y: sy - size/2, width: size, height: size, vx: left.vx,  vy: left.vy, bulletType: "normal" });
  enemyBullets.push({ x: sx - size/2, y: sy - size/2, width: size, height: size, vx: right.vx, vy: right.vy, bulletType: "normal" });
}

function shootDownPair(shooter, speed=3.6) {
  const cx = shooter.x + shooter.width / 2;
  const cy = shooter.y + shooter.height;
  const offset = 8;
  const w = shooter.tankBulletW ?? 16;
  const h = shooter.tankBulletH ?? 16;
  // 좌/우에서 수직 하강 (얇고 길게 설정 가능)
  enemyBullets.push({ x: cx - offset - w / 2, y: cy, width: w, height: h, vx: 0, vy: speed, bulletType: "normal" });
  enemyBullets.push({ x: cx + offset - w / 2, y: cy, width: w, height: h, vx: 0, vy: speed, bulletType: "normal" });
}

function getDirToPlayer(sx, sy) {
  const tx = player.x + player.width / 2;
  const ty = player.y + player.height / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  return { ux: dx / len, uy: dy / len };
}

// 보스 전용 탄 크기 설정
const BOSS_BULLET_SIZES = {
  pyramid: { width: 8, height: 8 },      // 피라미드 탄
  spread: { width: 30, height: 30 },      // 퍼지는 탄 (대형)
  arrow: { width: 12, height: 12 }       // 화살표 탄 (일반 탄보다 작음)
};

// 피라미드 스프레이: 수직으로 떨어지며 아래로 갈수록 넓게 퍼짐
function bossSprayTriangle(boss, rows=6, spacing=12, speed=3.4) {
  const sx = boss.x + boss.width / 2;
  const sy = boss.y + boss.height / 2;
  const size = BOSS_BULLET_SIZES.pyramid;
  // 피라미드: 아래쪽 행일수록 더 넓게 좌우로 배치 (위쪽이 좁고 아래가 넓음)
  for (let i = 0; i < rows; i++) {
    const count = rows - i; // i=0일 때 6개, i=1일 때 5개, ... i=5일 때 1개
    const rowWidth = (count - 1) * spacing; // 이 행의 전체 너비
    const rowY = sy + i * 8; // 각 행의 Y 위치 (아래로 갈수록)
    for (let j = 0; j < count; j++) {
      // 이 탄의 시작 위치 (좌우로 퍼짐)
      const offsetX = (count > 1) ? (j / (count - 1) - 0.5) * rowWidth : 0;
      const bx = sx + offsetX;
      const by = rowY;
      // 수직으로만 아래로 발사
      enemyBullets.push({
        x: bx - size.width / 2, y: by - size.height / 2,
        width: size.width, height: size.height,
        vx: 0, vy: speed,
        bulletType: "bossPyramid" // 작은 총알 형태
      });
    }
  }
}

// 큰 탄을 여러 방향에 3발씩(속도 차) 발사
function bossRadialTriplesTowardPlayer(boss, dirs=9, spread=0.25) {
  const sx = boss.x + boss.width / 2;
  const sy = boss.y + boss.height / 2;
  const { ux, uy } = getDirToPlayer(sx, sy);
  const baseAngle = Math.atan2(uy, ux);
  const speeds = [2.6, 3.1, 3.6];
  const size = BOSS_BULLET_SIZES.spread;
  for (let i = -Math.floor(dirs/2); i <= Math.floor(dirs/2); i++) {
    const a = baseAngle + i * spread;
    const dirx = Math.cos(a), diry = Math.sin(a);
    for (let k = 0; k < speeds.length; k++) {
      const sp = speeds[k];
      enemyBullets.push({
        x: sx - size.width / 2, y: sy - size.height / 2,
        width: size.width, height: size.height,
        vx: dirx * sp, vy: diry * sp,
        bulletType: "bossSpread" // 초록색 큰 원
      });
    }
  }
}

// 2단계: 화살표 모양 탄을 원 위의 발사점에서 접선 방향(반지름에 수직)으로 양쪽 발사 (교차 패턴, 간격 발사)
function bossArrowSpread(boss, dirs=12, bulletsPerDir=5, speed=3.0, delta=1.0) {
  const sx = boss.x + boss.width / 2;
  const sy = boss.y + boss.height / 2;
  const size = BOSS_BULLET_SIZES.arrow;
  const fireInterval = 0.4; // 각 탄 발사 간격 (초)
  
  // 발사 원의 반지름: 체력 원과 같은 크기
  // 체력 원은 Math.max(e.width, e.height) * 0.9로 그려지므로 동일하게 설정
  const fireRadius = Math.max(boss.width, boss.height) * 0.9; // 발사 원 반지름 (체력 원과 동일)
  
  // 발사점 기본 각도 계산: 12, 3, 6, 9시 제외, 각 90도 구간 사이에 3개씩
  // 각 구간은 90도 = π/2, 3개를 균등 배치하면 각 구간 내 간격은 π/8
  const baseFireAngles = [];
  const quadrantCount = 4; // 4개 구간
  const pointsPerQuadrant = 3; // 각 구간당 3개
  for (let quad = 0; quad < quadrantCount; quad++) {
    const baseAngle = (quad * Math.PI / 2); // 0, π/2, π, 3π/2
    const step = Math.PI / 8; // 각 구간 내 간격
    for (let p = 0; p < pointsPerQuadrant; p++) {
      // 각 구간의 시작점(0)과 끝점(π/2)을 제외하고 사이에 배치
      const angle = baseAngle + (p + 1) * step;
      baseFireAngles.push(angle);
    }
  }
  
  // 발사 상태 초기화
  if (boss._arrowFireTimer == null) {
    boss._arrowBulletIndex = 0;
    boss._arrowFireTimer = 0;
    boss._arrowRotationAngle = 0; // 회전 각도 초기화
  }
  
  // 매 발사마다 회전 각도 증가
  const rotationSpeed = Math.PI / 24; // 회전 속도 (매 발사마다 약 7.5도 회전)
  
  boss._arrowFireTimer += (delta / 60);
  
  // 간격을 두고 순차적으로 발사
  if (boss._arrowFireTimer >= fireInterval) {
    boss._arrowFireTimer = 0;
    
    const j = boss._arrowBulletIndex;
    
    // 모든 발사점에서 동시에 발사
    for (let i = 0; i < baseFireAngles.length; i++) {
      // 발사점 위치 (원 위의 점) - 기본 각도에 회전 각도 추가
      const fireAngle = baseFireAngles[i] + boss._arrowRotationAngle;
      const baseFireX = sx + Math.cos(fireAngle) * fireRadius;
      const baseFireY = sy + Math.sin(fireAngle) * fireRadius;
      
      // 양쪽 접선 방향 계산
      const tangentAngleCW = fireAngle + Math.PI / 2;  // 시계방향 접선
      const tangentAngleCCW = fireAngle - Math.PI / 2; // 반시계방향 접선
      
      // 접선 방향의 단위 벡터
      const tangentDirXCW = Math.cos(tangentAngleCW);
      const tangentDirYCW = Math.sin(tangentAngleCW);
      const tangentDirXCCW = Math.cos(tangentAngleCCW);
      const tangentDirYCCW = Math.sin(tangentAngleCCW);
      
      // 각 탄의 발사 위치 (접선 방향으로 약간씩 이동)
      const spreadDistance = 3; // 각 탄 사이의 거리 간격
      const positionOffset = (j - (bulletsPerDir - 1) / 2) * spreadDistance;
      
      // 양쪽 방향으로 동시에 1발씩 발사
      // 시계방향 접선
      const fireXCW = baseFireX + tangentDirXCW * positionOffset;
      const fireYCW = baseFireY + tangentDirYCW * positionOffset;
      enemyBullets.push({
        x: fireXCW - size.width / 2,
        y: fireYCW - size.height / 2,
        width: size.width,
        height: size.height,
        vx: tangentDirXCW * speed,
        vy: tangentDirYCW * speed,
        angle: tangentAngleCW,
        bulletType: "bossArrow"
      });
      
      // 반시계방향 접선
      const fireXCCW = baseFireX + tangentDirXCCW * positionOffset;
      const fireYCCW = baseFireY + tangentDirYCCW * positionOffset;
      enemyBullets.push({
        x: fireXCCW - size.width / 2,
        y: fireYCCW - size.height / 2,
        width: size.width,
        height: size.height,
        vx: tangentDirXCCW * speed,
        vy: tangentDirYCCW * speed,
        angle: tangentAngleCCW,
        bulletType: "bossArrow"
      });
    }
    
    // 다음 탄으로 이동 (5번 반복)
    // 1발마다 조금씩 회전
    boss._arrowRotationAngle += rotationSpeed;
    boss._arrowBulletIndex++;
    if (boss._arrowBulletIndex >= bulletsPerDir) {
      // 5발 발사 완료, 다시 처음부터 반복 (무한 반복)
      boss._arrowBulletIndex = 0;
      // 각도는 초기화하지 않고 계속 누적
    }
  }
  
  return false; // 계속 발사 중
}

export function updateAndDrawEnemies(delta) {
  updateEnemyPatterns();
  enemies.forEach(e => {
    // 공용 초 단위 타이머 업데이트
    if (e._timerSec != null) e._timerSec += (delta / 60);

    // 일반 적: 지연 후 1회 조준 사격 (slashV는 제외)
    if (e.pattern !== "descendStop" && e.pattern !== "slashV") {
      if (e.fireDelaySec != null && !e._fired && e._timerSec >= e.fireDelaySec) {
        if (e.spread3) {
          shootAtPlayerSpread3(e, 3.0, 0.22);
        } else {
          shootAtPlayer(e, 3.2);
        }
        e._fired = true;
      }
    }

    // 흔들리며 떨어지는 적(slashV): 2초마다 반복 발사
    if (e.pattern === "slashV") {
      if (e._fireAccum == null) e._fireAccum = 0;
      e._fireAccum += (delta / 60);
      const threshold = e._fireStarted ? (e.fireIntervalSec ?? 2.0) : (e.fireDelaySec ?? 1.2);
      if (e._fireAccum >= threshold) {
        if (e.spread3) {
          shootAtPlayerSpread3(e, 3.0, 0.22);
        } else {
          shootAtPlayer(e, 3.2);
        }
        e._fireAccum = 0;
        e._fireStarted = true;
      }
    }

    // 탱커: 멈춘 뒤 빠른 간격으로 2발 수직 발사
    if (e.pattern === "descendStop" && e._stopped) {
      e._fireAccum += (delta / 60);
      const threshold = e._fireStarted ? (e.fireIntervalSec ?? 0.6) : (e.fireDelaySec ?? 0.3);
      if (e._fireAccum >= threshold) {
        shootDownPair(e, 3.8);
        e._fireAccum = 0;
        e._fireStarted = true;
      }
    }
    moveEnemy(e, delta);
    
    // 적 이미지 그리기 (타입별)
    let img = null;
    if (e.type === "boss") {
      img = IMAGES.boss;
    } else if (e.pattern === "descendStop") {
      img = IMAGES.tank; // 탱커
    } else {
      img = IMAGES.enemy; // 일반 적
    }
    
    if (img && img.complete) {
      ctx.drawImage(img, e.x, e.y, e.width, e.height);
    } else {
      // 이미지 로딩 중일 때는 기본 사각형
      ctx.fillStyle = e.type === "boss" ? COLORS.boss : COLORS.enemy;
      ctx.fillRect(e.x, e.y, e.width, e.height);
    }

    // 보스 체력 게이지(원형 아크)
    if (e.type === "boss" && e.maxHp) {
      const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
      const cx = e.x + e.width / 2;
      const cy = e.y + e.height / 2;
      const r  = Math.max(e.width, e.height) * 0.9;
      const start = -Math.PI / 2; // 12시
      const end = start + ratio * Math.PI * 2;
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 0, 0, 0.85)";
      ctx.lineWidth = 3;
      ctx.arc(cx, cy, r, start, end, false);
      ctx.stroke();
      ctx.closePath();

      // 보스 공격 패턴 (폭발 중이 아니면)
      if (!e._exploding) {
      if (e.phase === 1) {
        // 1단계: 이동 패턴에 따른 탄 발사
        if (e.pattern === "bossPhase1" && e._bossMoveState === "shooting") {
          // 발사 상태일 때만 탄 발사
          if (e._bossShootTimer == null) e._bossShootTimer = 0;
          if (e._bossShootStep == null) e._bossShootStep = 0;
          e._bossShootTimer += (delta / 60);
          
          if (e._bossShootStep === 0) {
            // 첫 번째 발사 대기 (퍼지는 탄)
            if (e._bossShootTimer >= 0.3) {
              bossRadialTriplesTowardPlayer(e, 9, 0.24);
              e._bossShootStep = 1;
              e._bossShootTimer = 0; // 타이머 리셋
            }
          } else if (e._bossShootStep === 1) {
            // 딜레이 중
            if (e._bossShootTimer >= 0.4) {
              e._bossShootStep = 2;
              e._bossShootTimer = 0; // 타이머 리셋
            }
          } else if (e._bossShootStep === 2) {
            // 두 번째 발사 (역삼각형)
            bossSprayTriangle(e, 6, 6, 3.6);
            e._bossShootStep = 3;
            e._didShoot = true; // 발사 완료 플래그
          }
        } else if (e.pattern === "bossIntro") {
          // 보스 등장 중일 때는 공격하지 않음
        }
      } else if (e.phase === 2) {
        // 2단계: 화살표 탄 발사 패턴
        if (e._attackSec == null) e._attackSec = 0;
        e._attackSec += (delta / 60);
        
        // 발사 중이 아니면 새 발사 시작
        if (e._arrowFireTimer == null && e._attackSec >= 1.5) {
          bossArrowSpread(e, 16, 5, 2.2, delta);
          e._attackSec = 0;
        } else if (e._arrowFireTimer != null) {
          // 발사 중이면 계속 발사 (체력이 0이 될 때까지 무한 반복)
          bossArrowSpread(e, 16, 5, 2.2, delta);
        }
        
        // 원형 탄 2초마다 1발 발사
        if (e._circleBulletTimer == null) e._circleBulletTimer = 0;
        e._circleBulletTimer += (delta / 60);
        if (e._circleBulletTimer >= 2.5) {
          shootAtPlayer(e, 3.0);
          e._circleBulletTimer = 0;
        }
      }
      }
    }
  });

  // 적 탄 업데이트/그리기
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += (b.vx ?? 0) * delta;
    b.y += (b.vy ?? 0) * delta;
    
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const type = b.bulletType || "normal";
    
    if (type === "normal") {
      // 일반 적 탄: 파란색 테두리 + 하얀색 내부
      const r = Math.max(b.width, b.height) / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      // 내부 하얀색
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fill();
      // 파란색 굵은 테두리
      ctx.strokeStyle = "rgba(100, 200, 255, 0.9)";
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (type === "bossSpread") {
      // 보스 퍼지는 탄: 초록색 테두리 + 하얀색 내부
      const r = Math.max(b.width, b.height) / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      // 내부 하얀색
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fill();
      // 초록색 굵은 테두리
      ctx.strokeStyle = "rgba(0, 255, 100, 0.9)";
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (type === "bossPyramid") {
      // 보스 피라미드 탄: 작은 총알 형태 (직사각형)
      ctx.fillStyle = "rgba(255, 200, 100, 0.9)";
      ctx.fillRect(b.x, b.y, b.width, b.height);
    } else if (type === "bossArrow") {
      // 보스 화살표 탄: 화살표 모양으로 그리기
      const angle = b.angle ?? 0;
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      const arrowLength = Math.max(b.width, b.height);
      const arrowHeadSize = arrowLength * 0.4;
      
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      
      // 화살표 몸통
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.fillRect(-arrowLength / 2, -2, arrowLength * 0.6, 4);
      
      // 화살표 머리 (삼각형)
      ctx.beginPath();
      ctx.moveTo(arrowLength / 2, 0);
      ctx.lineTo(arrowLength / 2 - arrowHeadSize, -arrowHeadSize / 2);
      ctx.lineTo(arrowLength / 2 - arrowHeadSize, arrowHeadSize / 2);
      ctx.closePath();
      ctx.fill();
      
      // 테두리 (색상별로 다르게)
      ctx.strokeStyle = "rgba(100, 200, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
      
      ctx.restore();
    } else {
      // 기본 (fallback)
      ctx.fillStyle = COLORS.bullet;
      ctx.fillRect(b.x, b.y, b.width, b.height);
    }
    
    if (b.y > GAME_HEIGHT || b.y < -20 || b.x < -20 || b.x > GAME_WIDTH + 20) {
      enemyBullets.splice(i, 1);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].y > GAME_HEIGHT || enemies[i].x < -50 || enemies[i].x > GAME_WIDTH + 50 || enemies[i]._expired)
      enemies.splice(i, 1);
  }

  // 보스전 트리거: 40초 이후 + 화면에 적이 없을 때
  const elapsedSec = (Date.now() - startTime) / 1000;
  if (!bossStarted && elapsedSec >= 40 && enemies.length === 0) {
    spawnBoss();
  }
}

function spawnBoss() {
  bossStarted = true;
  const bossSize = 64;
  enemies.push({
    x: (GAME_WIDTH - bossSize) / 2,
    y: -bossSize,
    width: bossSize,
    height: bossSize,
    speed: CONFIG.bossSpeed,
    pattern: "bossIntro",
    type: "boss",
    hp: 500,
    maxHp: 500,
    phase: 1, // 1단계, 2단계
    _stopped: false
  });
}
