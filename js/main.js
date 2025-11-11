import { ctx, canvas, COLORS, IMAGES, GAME_WIDTH } from "./constants.js";
import { player, movePlayer, drawPlayer, isShooting, resetPlayer, takeDamage } from "./player.js";
import { bullets, shoot, updateBullets } from "./bullets.js";
import { updateAndDrawEnemies, resetEnemies, enemies, enemyBullets } from "./enemies.js";
import { activateBomb, updateBomb, drawBomb, resetBomb } from "./bomb.js";

let lastTime = performance.now();
let gameRunning = false;
let gameOver = false;
let score = 0;
let justStarted = false; // 게임이 방금 시작되었는지 추적
let gameOverTime = 0; // 게임 오버 후 경과 시간 (깜빡임용)
let cleared = false; // 클리어 상태
let clearTime = 0; // 클리어 후 경과 시간
let bombUsedInBossFight = false; // 보스전에서 폭탄 사용 여부
let bossFightStarted = false; // 보스전 시작 여부
let clearScore = 0; // 클리어 시 총 점수
let baseScore = 0; // 기본 처치 점수
let lifeBonus = 0; // 목숨 보너스 점수
let bombBonus = 0; // 폭탄 보너스 점수
let timeBonus = 0; // 시간 보너스 점수
let gameStartTime = 0; // 게임 시작 시간
let clearElapsedTime = 0; // 클리어까지 경과 시간 (초)
let clearDelay = 0; // 클리어 문구 표시 전 딜레이
let showClear = false; // CLEAR 표시 여부
let showBombBonus = false; // BOOM BONUS 표시 여부
let showLifeBonus = false; // 목숨 보너스 표시 여부
let showTimeBonus = false; // 시간 보너스 표시 여부
let showScore = false; // SCORE 표시 여부
let bossExploding = false; // 보스 폭발 중 여부
let bossExplosionCount = 0; // 보스 폭발 횟수
let bossExplosionTimer = 0; // 보스 폭발 타이머
let bossToRemove = null; // 제거할 보스 참조
let bossPhaseTransition = false; // 보스 페이즈 전환 중 여부
let bossPhaseTransitionCount = 0; // 보스 페이즈 전환 폭발 횟수
let bossPhaseTransitionTimer = 0; // 보스 페이즈 전환 타이머
let bossToTransition = null; // 페이즈 전환할 보스 참조

// 폭발 이펙트 파티클
const explosions = [];

// 폭발 이펙트 생성
function createExplosion(x, y, size = 1.0) {
  const particleCount = Math.floor(12 * size);
  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
    const speed = 2 + Math.random() * 3;
    explosions.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0, // 0~1, 1에서 시작해서 0으로 감소
      size: 3 + Math.random() * 4,
      color: size > 1.5 ? "rgba(255, 200, 0, 1)" : "rgba(255, 100, 50, 1)" // 보스는 노란색, 일반은 주황색
    });
  }
}

// 폭발 이펙트 업데이트 및 그리기
function updateExplosions(delta) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const exp = explosions[i];
    exp.x += exp.vx * delta;
    exp.y += exp.vy * delta;
    exp.life -= (delta / 60) * 2; // 0.5초 동안 지속
    
    if (exp.life <= 0) {
      explosions.splice(i, 1);
      continue;
    }
    
    // 그리기
    const alpha = exp.life;
    ctx.fillStyle = exp.color.replace("1)", `${alpha})`);
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, exp.size * exp.life, 0, Math.PI * 2);
    ctx.fill();
  }
}

window.addEventListener("keydown", e => {
  if (e.code === "Space") {
    if (!gameRunning && !gameOver && !cleared) {
      // 게임 시작
      startGame();
      justStarted = true;
    } else if (gameOver || cleared) {
      // 게임 재시작
      restartGame();
      justStarted = true;
    }
  } else if (e.code === "KeyX" || e.code === "ShiftLeft" || e.code === "ShiftRight") {
    // 폭탄 발사 (X 키 또는 Shift 키)
    if (gameRunning && !gameOver && !cleared) {
      // 보스전 중이면 폭탄 사용 플래그 설정
      if (bossFightStarted) {
        bombUsedInBossFight = true;
      }
      activateBomb();
    }
  }
});

function startGame() {
  gameRunning = true;
  gameOver = false;
  cleared = false;
  gameOverTime = 0;
  clearTime = 0;
  clearDelay = 0;
  showClear = false;
  showBombBonus = false;
  showLifeBonus = false;
  showTimeBonus = false;
  showScore = false;
  bossExploding = false;
  bossExplosionCount = 0;
  bossExplosionTimer = 0;
  bossToRemove = null;
  bossPhaseTransition = false;
  bossPhaseTransitionCount = 0;
  bossPhaseTransitionTimer = 0;
  bossToTransition = null;
  bombUsedInBossFight = false;
  bossFightStarted = false;
  resetEnemies();
  resetPlayer();
  resetBomb();
  bullets.length = 0;
  enemyBullets.length = 0;
  explosions.length = 0; // 폭발 이펙트 초기화
  score = 0;
  clearScore = 0;
  baseScore = 0;
  lifeBonus = 0;
  bombBonus = 0;
  timeBonus = 0;
  clearElapsedTime = 0;
  gameStartTime = Date.now(); // 게임 시작 시간 기록
  lastTime = performance.now();
  requestAnimationFrame(update);
}

function restartGame() {
  startGame();
}

function update(now = performance.now()) {
  if (!gameRunning && !gameOver && !cleared) {
    // 게임 시작 전
    return;
  }
  
  const delta = (now - lastTime) / (1000 / 60);
  lastTime = now;
  
  // 게임 오버 상태면 시간 누적 (깜빡임용)
  if (gameOver) {
    gameOverTime += (delta / 60);
  }
  
  // 보스 페이즈 전환 폭발 처리
  if (bossPhaseTransition && bossToTransition) {
    bossPhaseTransitionTimer += (delta / 60);
    
    // 0.4초마다 폭발 이펙트 생성 (총 2번)
    if (bossPhaseTransitionCount < 2 && bossPhaseTransitionTimer >= (bossPhaseTransitionCount + 1) * 0.4) {
      const ecx = bossToTransition.x + bossToTransition.width / 2;
      const ecy = bossToTransition.y + bossToTransition.height / 2;
      createExplosion(ecx, ecy, 3.0);
      bossPhaseTransitionCount++;
    }
    
    // 2번 폭발 후 2단계로 전환
    if (bossPhaseTransitionCount >= 2 && bossPhaseTransitionTimer >= 0.8) {
      // 2단계로 전환 및 체력 증가
      bossToTransition.phase = 2; // 2단계로 전환
      bossToTransition.maxHp = 800; // 2페이즈 최대 체력
      bossToTransition.hp = 800; // 2페이즈 체력 회복
      bossToTransition._attackSec = 0; // 공격 타이머 리셋
      bossToTransition._didSpray = false;
      // 화살표 탄 발사 상태 초기화
      bossToTransition._arrowFireTimer = null;
      bossToTransition._arrowBulletIndex = 0;
      // 폭발 플래그 해제
      bossToTransition._exploding = false;
      // 1페이즈 이동 패턴 초기화
      bossToTransition._bossMoveState = null;
      bossToTransition._bossShootTimer = 0;
      bossToTransition._didShoot = false;
      bossToTransition._bossShootStep = 0;
      
      // 페이즈 전환 완료
      bossPhaseTransition = false;
      bossToTransition = null;
    }
  }
  
  // 보스 폭발 처리 (최종 처치)
  if (bossExploding && bossToRemove) {
    bossExplosionTimer += (delta / 60);
    
    // 0.4초마다 폭발 이펙트 생성 (총 3번)
    if (bossExplosionCount < 3 && bossExplosionTimer >= (bossExplosionCount + 1) * 0.4) {
      const ecx = bossToRemove.x + bossToRemove.width / 2;
      const ecy = bossToRemove.y + bossToRemove.height / 2;
      createExplosion(ecx, ecy, 5.0);
      bossExplosionCount++;
    }
    
    // 3번 폭발 후 보스 제거 및 클리어 상태로 전환
    if (bossExplosionCount >= 3 && bossExplosionTimer >= 1.2) {
      // 보스 제거
      const bossIndex = enemies.indexOf(bossToRemove);
      if (bossIndex !== -1) {
        enemies.splice(bossIndex, 1);
      }
      
      // 클리어까지 경과 시간 계산
      clearElapsedTime = (Date.now() - gameStartTime) / 1000; // 초 단위
      
      // 시간 보너스 점수 계산 (빠를수록 높은 점수)
      // 기준 시간보다 빠르면 보너스 점수, 느리면 기본 점수만
      const baseTime = 100; // 기준 시간 (초)
      const timeScorePerSecond = 40; // 초당 점수
      if (clearElapsedTime <= baseTime) {
        // 기준 시간보다 빠르면: (기준 시간 - 실제 시간) * 초당 점수 + 기본 점수
        timeBonus = Math.floor((baseTime - clearElapsedTime) * timeScorePerSecond + baseTime * timeScorePerSecond);
      } else {
        // 기준 시간보다 느리면: 기본 점수만 (시간이 길어질수록 감소)
        const overTime = clearElapsedTime - baseTime;
        timeBonus = Math.max(0, Math.floor(baseTime * timeScorePerSecond - overTime * 10));
      }
      
      // 점수 계산
      baseScore = 1000;
      lifeBonus = player.lives * 500;
      bombBonus = bombUsedInBossFight ? 0 : 2000;
      clearScore = baseScore + lifeBonus + bombBonus + timeBonus;
      score += clearScore;
      
      // 클리어 상태로 전환
      cleared = true;
      clearTime = 0;
      clearDelay = 0;
      showClear = false;
      showBombBonus = false;
      showLifeBonus = false;
      showScore = false;
      bossExploding = false;
      bossToRemove = null;
    }
  }
  
  // 클리어 상태면 시간 누적
  if (cleared) {
    clearDelay += (delta / 60);
    clearTime += (delta / 60);
    
    // 딜레이 후 순차적으로 문구 표시
    if (clearDelay >= 1.0) {
      showClear = true;
    }
    if (clearDelay >= 1.5) {
      showBombBonus = true;
    }
    if (clearDelay >= 2.0) {
      showLifeBonus = true;
    }
    if (clearDelay >= 2.5) {
      showTimeBonus = true;
    }
    if (clearDelay >= 3.0) {
      showScore = true;
    }
  }
  
  // 보스전 시작 여부 확인
  if (!bossFightStarted) {
    for (const e of enemies) {
      if (e.type === "boss") {
        bossFightStarted = true;
        break;
      }
    }
  }

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 게임 오버나 클리어가 아니면 플레이어 이동 및 발사
  if (!gameOver && !cleared) {
    movePlayer(delta);
    // 게임 시작 직후가 아니고, 발사 가능할 때만 발사
    if (justStarted) {
      justStarted = false; // 다음 프레임부터는 발사 가능
    } else if (isShooting()) {
      shoot();
    }
  }

  // 클리어 상태가 아니면 게임 요소 업데이트
  if (!cleared) {
    drawPlayer();
    updateBullets(delta);
    updateAndDrawEnemies(delta);
    updateBomb(delta);
    drawBomb();
  }
  
  // 폭발 이펙트는 클리어 상태에서도 업데이트 (보스 폭발 이펙트 표시를 위해)
  updateExplosions(delta);

  // 클리어 상태가 아니면 충돌 판정 수행
  if (!cleared) {
    // 충돌 판정: 플레이어 탄 vs 적
    for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    // 보스 폭발 중이거나 페이즈 전환 중이면 충돌 판정 스킵
    if ((e === bossToRemove && bossExploding) || (e === bossToTransition && bossPhaseTransition)) {
      continue;
    }
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      if (
        b.x < e.x + e.width &&
        b.x + b.width > e.x &&
        b.y < e.y + e.height &&
        b.y + b.height > e.y
      ) {
        e.hp = (e.hp != null ? e.hp : 1) - (b.damage ?? 1);
        if (e.hp <= 0) {
          // 보스의 경우: 1단계에서 체력이 0이 되면 폭발 이펙트 후 2단계로 전환
          if (e.type === "boss" && e.phase === 1 && !bossPhaseTransition) {
            // 화면 안의 모든 적 탄 제거
            for (let k = enemyBullets.length - 1; k >= 0; k--) {
              enemyBullets.splice(k, 1);
            }
            
            // 체력을 즉시 회복 (폭발 이펙트 전에 회복하여 버그 방지)
            e.hp = e.maxHp;
            
            // 보스를 중앙으로 이동 (2페이즈 전환 전)
            if (e._bossCenterX != null) {
              e.x = e._bossCenterX;
            } else {
              e.x = (GAME_WIDTH - e.width) / 2;
            }
            e._bossMoveState = null; // 이동 상태 초기화
            
            // 보스 페이즈 전환 폭발 시퀀스 시작
            bossPhaseTransition = true;
            bossPhaseTransitionCount = 0;
            bossPhaseTransitionTimer = 0;
            bossToTransition = e;
            // 보스 객체에 폭발 플래그 설정 (공격 및 피격 차단)
            e._exploding = true;
            
            // 보스는 아직 2단계로 전환하지 않음 (폭발 후 전환)
            continue; // enemies.splice(i, 1)를 실행하지 않음
          } else {
            // 일반 적이거나 보스 2단계에서 체력이 0이 되면 제거
            const ecx = e.x + e.width / 2;
            const ecy = e.y + e.height / 2;
            const size = (e.type === "boss") ? 2.5 : 1.0;
            createExplosion(ecx, ecy, size);
            
            // 보스 처치 시 폭발 시퀀스 시작
            if (e.type === "boss" && !bossExploding) {
              // 화면 안의 모든 적 탄 제거
              for (let k = enemyBullets.length - 1; k >= 0; k--) {
                enemyBullets.splice(k, 1);
              }
              
              // 보스 폭발 시퀀스 시작
              bossExploding = true;
              bossExplosionCount = 0;
              bossExplosionTimer = 0;
              bossToRemove = e;
              // 보스 객체에 폭발 플래그 설정 (enemies.js에서 공격을 막기 위해)
              e._exploding = true;
              
              // 보스는 아직 제거하지 않음 (폭발 후 제거)
              continue; // enemies.splice(i, 1)를 실행하지 않음
            }
            
            // 일반 적은 즉시 제거
            enemies.splice(i, 1);
          }
        }
        bullets.splice(j, 1);
        // 보스 처치 시에는 일반 점수 추가하지 않음
        if (e.type !== "boss") {
          score += 1;
        }
        break;
      }
    }
    }

    // 적 vs 플레이어 충돌 판정
    if (!player.dead && !player.invincible && !player.respawning && !player.bombing) {
    const pcx = player.x + player.width / 2;
    const pcy = player.y + player.height / 2;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      // 보스 폭발 중이거나 페이즈 전환 중이면 충돌 판정 스킵
      if ((e === bossToRemove && bossExploding) || (e === bossToTransition && bossPhaseTransition)) {
        continue;
      }
      const ecx = e.x + e.width / 2;
      const ecy = e.y + e.height / 2;
      const er = Math.max(e.width, e.height) / 2;
      const dx = ecx - pcx;
      const dy = ecy - pcy;
      const dist = Math.hypot(dx, dy);
      if (dist <= player.hitRadius + er) {
        // 플레이어 폭발 이펙트
        const pcx = player.x + player.width / 2;
        const pcy = player.y + player.height / 2;
        createExplosion(pcx, pcy, 1.2);
        
        if (takeDamage()) {
          // 게임오버
          player.dead = true;
          gameOver = true;
          gameOverTime = 0;
        }
        break;
      }
    }
    }

    // 적 탄 vs 플레이어 히트박스(원) 판정
    if (!player.dead && !player.invincible && !player.respawning && !player.bombing) {
    const pcx = player.x + player.width / 2;
    const pcy = player.y + player.height / 2;
    for (let k = enemyBullets.length - 1; k >= 0; k--) {
      const b = enemyBullets[k];
      const bcx = b.x + b.width / 2;
      const bcy = b.y + b.height / 2;
      const br = Math.max(b.width, b.height) / 2;
      const dx = bcx - pcx;
      const dy = bcy - pcy;
      const dist = Math.hypot(dx, dy);
      if (dist <= player.hitRadius + br) {
        enemyBullets.splice(k, 1);
        
        // 플레이어 폭발 이펙트
        const pcx = player.x + player.width / 2;
        const pcy = player.y + player.height / 2;
        createExplosion(pcx, pcy, 1.2);
        
        if (takeDamage()) {
          // 게임오버
          player.dead = true;
          gameOver = true;
          gameOverTime = 0;
        }
        break;
      }
    }
    }
  }

  // UI 그리기 (클리어 상태가 아닐 때만)
  if (!cleared) {
    ctx.fillStyle = COLORS.text;
    ctx.font = "18px Orbitron, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${score}`, 10, 30);
    
    // 목숨 표시 (fighter.png 사용, 점수 위쪽에 작게, 오른쪽으로 이동)
    if (!gameOver) {
    const lifeSize = 20;
    const lifeY = 5;
    const lifeStartX = canvas.width - (player.lives * (lifeSize + 5)) - 10; // 오른쪽에서 시작
    for (let i = 0; i < player.lives; i++) {
      const lifeX = lifeStartX + i * (lifeSize + 5);
      if (IMAGES.player.complete) {
        ctx.drawImage(IMAGES.player, lifeX, lifeY, lifeSize, lifeSize);
      } else {
        ctx.fillStyle = COLORS.player;
        ctx.fillRect(lifeX, lifeY, lifeSize, lifeSize);
      }
    }
    
      // 폭탄 개수 표시
      ctx.fillStyle = COLORS.text;
      ctx.font = "16px Orbitron, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`BOMB: ${player.bombs}`, 10, 55);
    }
  }
  
  // 게임 오버 문구 (느리게 깜빡임)
  if (gameOver) {
    // 1초 주기로 깜빡임 (0.5초 켜짐, 0.5초 꺼짐)
    const blink = Math.floor(gameOverTime * 2) % 2 === 0;
    if (blink) {
      ctx.fillStyle = "white";
      ctx.font = "32px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 20);
      ctx.font = "20px Orbitron, sans-serif";
      ctx.fillText("Press SPACE to Restart", canvas.width / 2, canvas.height / 2 + 20);
    }
  }
  
  // 클리어 화면
  if (cleared) {
    ctx.fillStyle = "white";
    ctx.font = "36px Orbitron, sans-serif";
    ctx.textAlign = "center";
    const centerX = canvas.width / 2;
    let y = 80; // 위쪽 중앙에서 시작
    
    // CLEAR (순차적으로 표시)
    if (showClear) {
      ctx.fillText("CLEAR", centerX, y);
      y += 60;
    } else {
      y += 60;
    }
    
    // BOOM BONUS!! + (폭탄 보너스 점수) [2줄이 한번에, 순차적으로 표시]
    if (showBombBonus && bombBonus > 0) {
      ctx.font = "24px Orbitron, sans-serif";
      ctx.fillText("BOOM BONUS!!", centerX, y);
      y += 30;
      ctx.fillText(`+ ${bombBonus.toLocaleString()}`, centerX, y);
      y += 50;
    } else if (showBombBonus) {
      y += 20;
    } else {
      y += 20;
    }
    
    // 남은 목숨 수 : (목숨 수) + (목숨 수에 비례한 보너스 점수) [2줄이 한번에, 순차적으로 표시]
    if (showLifeBonus) {
      ctx.font = "24px Orbitron, sans-serif";
      ctx.fillText(`남은 목숨 수 : ${player.lives}`, centerX, y);
      y += 30;
      ctx.fillText(`+ ${lifeBonus.toLocaleString()}`, centerX, y);
      y += 50;
    } else {
      y += 50;
    }
    
    // 시간 보너스 : (클리어 시간) + (시간 보너스 점수) [2줄이 한번에, 순차적으로 표시]
    if (showTimeBonus) {
      ctx.font = "24px Orbitron, sans-serif";
      const minutes = Math.floor(clearElapsedTime / 60);
      const seconds = Math.floor(clearElapsedTime % 60);
      const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      ctx.fillText(`클리어 시간 : ${timeString}`, centerX, y);
      y += 30;
      ctx.fillText(`+ ${timeBonus.toLocaleString()}`, centerX, y);
      y += 50;
    } else {
      y += 50;
    }
    
    // SCORE : (총합 점수) [순차적으로 표시]
    if (showScore) {
      ctx.font = "28px Orbitron, sans-serif";
      ctx.fillText(`SCORE : ${score.toLocaleString()}`, centerX, y);
      y += 60;
    } else {
      y += 60;
    }
    
    // RETRY? (깜빡임, 모든 문구가 표시된 후에만)
    if (showScore) {
      ctx.font = "24px Orbitron, sans-serif";
      const blink = Math.floor(clearTime * 2) % 2 === 0;
      if (blink) {
        ctx.fillText("RETRY?", centerX, y);
      }
    }
  }

  requestAnimationFrame(update);
}

// 시작 전 대기 문구
function drawStartScreen() {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "20px Orbitron, sans-serif";
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = "center";
  const centerX = canvas.width / 2;
  let y = canvas.height / 2;
  ctx.fillText("Press SPACE to Start", centerX, y);
  y += 40;
  ctx.font = "16px Orbitron, sans-serif";
  ctx.fillText("Z : 사격", centerX, y);
  y += 25;
  ctx.fillText("X : 폭탄", centerX, y);
}

drawStartScreen();
