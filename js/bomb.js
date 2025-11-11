import { ctx, GAME_WIDTH, GAME_HEIGHT, COLORS } from "./constants.js";
import { player } from "./player.js";
import { enemies, enemyBullets } from "./enemies.js";

// 폭탄 미사일
const bombMissiles = [];

// 폭탄 발사
export function activateBomb() {
  if (player.bombs <= 0 || player.bombing || player.dead) return;
  
  player.bombs--;
  player.bombing = true;
  player.invincible = true; // 폭탄 발동 시 무적
  
  const px = player.x + player.width / 2;
  const py = player.y;
  const speed = 8; // 속도 느리게
  
  // 왼쪽 대각선, 중앙 직선, 오른쪽 대각선
  const angles = [-Math.PI / 4, 0, Math.PI / 4]; // 왼쪽 대각선, 중앙, 오른쪽 대각선
  
  // 첫 번째 미사일만 즉시 발사, 나머지는 대기
  bombMissiles.push({
    x: px,
    y: py,
    vx: Math.sin(angles[0]) * speed,
    vy: -Math.cos(angles[0]) * speed,
    angle: angles[0],
    missileIndex: 0, // 0: 왼쪽, 1: 중앙, 2: 오른쪽
    reached: false,
    canFire: true, // 발사 가능 여부
    explosionTimer: 0,
    explosionIndex: 0,
    totalExplosions: 3,
    explosionInterval: 0.3,
    explosions: []
  });
  
  // 나머지 미사일은 대기 상태로 추가
  for (let i = 1; i < 3; i++) {
    bombMissiles.push({
      x: px,
      y: py,
      vx: Math.sin(angles[i]) * speed,
      vy: -Math.cos(angles[i]) * speed,
      angle: angles[i],
      missileIndex: i,
      reached: false,
      canFire: false, // 아직 발사 불가
      explosionTimer: 0,
      explosionIndex: 0,
      totalExplosions: 3,
      explosionInterval: 0.3,
      explosions: []
    });
  }
}

// 폭탄 업데이트
export function updateBomb(delta) {
  // 미사일 업데이트
  for (let i = bombMissiles.length - 1; i >= 0; i--) {
    const m = bombMissiles[i];
    
    // 발사 가능한 미사일만 이동
    if (m.canFire && !m.reached) {
      m.x += m.vx * delta;
      m.y += m.vy * delta;
      
      // 화면 중간보다 살짝 위쪽에 도달하면 폭발 시작 (y의 중간 지점보다 살짝 위)
      const targetY = GAME_HEIGHT * 0.4; // 화면 중간보다 살짝 위
      if (!m.reached && m.y <= targetY) {
        m.reached = true;
        m.explosionTimer = 0;
        // 도달한 위치 저장 (x는 미사일의 x 위치, y는 목표 위치)
        m.explosionX = m.x;
        m.explosionY = targetY;
      }
    }
    
    // 폭발 처리
    if (m.reached) {
      m.explosionTimer += (delta / 60);
      
      // 0.3초마다 폭발 생성
      if (m.explosionIndex < m.totalExplosions && 
          m.explosionTimer >= (m.explosionIndex + 1) * m.explosionInterval) {
        // 저장된 폭발 위치에서 폭발 생성
        const explosionX = m.explosionX;
        const explosionY = m.explosionY;
        const explosionRadius = 250; // 큰 폭발 범위
        
        m.explosions.push({
          x: explosionX,
          y: explosionY,
          radius: explosionRadius,
          life: 0.3, // 0.3초 동안 지속
          damageDealt: false
        });
        
        m.explosionIndex++;
        
        // 2번 폭발 후 다음 미사일 발사
        if (m.explosionIndex === 2 && m.missileIndex < 2) {
          // 다음 미사일 발사 가능하게
          for (const nextM of bombMissiles) {
            if (nextM.missileIndex === m.missileIndex + 1 && !nextM.canFire) {
              nextM.canFire = true;
              // 플레이어 위치에서 시작
              const px = player.x + player.width / 2;
              const py = player.y;
              nextM.x = px;
              nextM.y = py;
              break;
            }
          }
        }
      }
      
      // 폭발 처리
      for (let j = m.explosions.length - 1; j >= 0; j--) {
        const exp = m.explosions[j];
        exp.life -= (delta / 60);
        
        if (exp.life <= 0) {
          m.explosions.splice(j, 1);
          continue;
        }
        
        // 폭발 범위 내 적 탄 제거
        for (let k = enemyBullets.length - 1; k >= 0; k--) {
          const b = enemyBullets[k];
          const bx = b.x + b.width / 2;
          const by = b.y + b.height / 2;
          const dist = Math.hypot(bx - exp.x, by - exp.y);
          if (dist <= exp.radius) {
            enemyBullets.splice(k, 1);
          }
        }
        
        // 각 폭발마다 화면 안의 모든 적에게 5 피해 (폭발 범위와 무관)
        if (!exp.damageDealt) {
          exp.damageDealt = true;
          const damage = 5;
          
          for (let e = enemies.length - 1; e >= 0; e--) {
            const enemy = enemies[e];
            // 화면 안에 있는 모든 적에게 피해
            if (enemy.x >= 0 && enemy.x <= GAME_WIDTH && 
                enemy.y >= 0 && enemy.y <= GAME_HEIGHT) {
              enemy.hp = (enemy.hp != null ? enemy.hp : 1) - damage;
              if (enemy.hp <= 0) {
                enemies.splice(e, 1);
              }
            }
          }
        }
      }
      
      // 모든 폭발이 끝나면 미사일 제거
      if (m.explosionIndex >= m.totalExplosions && m.explosions.length === 0) {
        bombMissiles.splice(i, 1);
      }
    } else if (!m.canFire) {
      // 발사 대기 중인 미사일은 제거하지 않음
      continue;
    }
    // reached 상태가 아니고 canFire가 true인 경우는 더 이상 없음 (reached가 되면 이동 중지)
  }
  
  // 모든 미사일이 끝나면 폭탄 종료
  if (bombMissiles.length === 0) {
    player.bombing = false;
    // 폭탄 종료 후 무적 해제 (기존 무적 시간이 있으면 유지)
    if (player.invincibleTime <= 0) {
      player.invincible = false;
    }
  }
}

// 폭탄 그리기
export function drawBomb() {
  // 미사일 그리기
  for (const m of bombMissiles) {
    // 발사 가능한 미사일만 그리기
    if (!m.canFire) continue;
    
    // 도달한 위치가 있으면 그 위치에 고정, 없으면 현재 위치
    const drawX = m.reached && m.explosionX != null ? m.explosionX : m.x;
    const drawY = m.reached && m.explosionY != null ? m.explosionY : m.y;
    
    // 플레이어 총탄과 비슷한 크기 (반지름 약 5)
    const r = 5;
    
    // 외곽 후광 (붉은색 계열)
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 100, 100, 0.4)";
    ctx.arc(drawX, drawY, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    
    // 중간 레이어 (붉은 주황색)
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 150, 50, 0.7)";
    ctx.arc(drawX, drawY, r * 1.2, 0, Math.PI * 2);
    ctx.fill();
    
    // 중심 (밝은 붉은색/주황색)
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 200, 150, 0.95)";
    ctx.arc(drawX, drawY, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // 폭발 그리기
  for (const m of bombMissiles) {
    for (const exp of m.explosions) {
      const alpha = exp.life / 0.3;
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      gradient.addColorStop(0, `rgba(255, 200, 0, ${alpha * 0.8})`);
      gradient.addColorStop(0.5, `rgba(255, 100, 0, ${alpha * 0.6})`);
      gradient.addColorStop(1, `rgba(255, 0, 0, ${alpha * 0.3})`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // 테두리
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

// 폭탄 리셋
export function resetBomb() {
  bombMissiles.length = 0;
}

