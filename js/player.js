import { canvas, ctx, COLORS, CONFIG, IMAGES } from "./constants.js";

export const player = {
  x: canvas.width / 2 - 14,
  y: canvas.height - 80,
  width: 50,
  height: 50,
  hitRadius: 6, // 실제 피격 판정 반경
  speed: CONFIG.playerSpeed,
  color: COLORS.player,
  cooldown: 0,
  lives: 3, // 목숨
  invincible: false, // 무적 상태
  invincibleTime: 0, // 무적 시간 (초)
  respawning: false, // 재생성 중
  respawnY: canvas.height, // 재생성 시작 Y (화면 밑)
  targetY: canvas.height - 80, // 목표 Y
  dead: false, // 게임 오버 상태
  bombs: 3, // 폭탄 개수 (최대 3개)
  bombing: false, // 폭탄 발동 중
};

const keys = {};
window.addEventListener("keydown", e => (keys[e.code] = true));
window.addEventListener("keyup", e => (keys[e.code] = false));

export function movePlayer(delta=1) {
  // 재생성 중일 때는 천천히 위로 올라가기
  if (player.respawning) {
    const speed = 1.5 * delta; // 천천히 올라가도록 속도 감소
    player.y -= speed;
    if (player.y <= player.targetY) {
      player.y = player.targetY;
      player.respawning = false;
    }
    return;
  }
  
  // 무적 시간 감소
  if (player.invincible) {
    player.invincibleTime -= (delta / 60);
    if (player.invincibleTime <= 0) {
      player.invincible = false;
    }
  }
  
  const step = player.speed * delta;
  if (keys["ArrowLeft"] && player.x > 0) player.x -= step;
  if (keys["ArrowRight"] && player.x + player.width < canvas.width) player.x += step;
  if (keys["ArrowUp"] && player.y > 0) player.y -= step;
  if (keys["ArrowDown"] && player.y + player.height < canvas.height) player.y += step;
}

export function drawPlayer() {
  // 게임 오버 상태면 그리지 않음
  if (player.dead) return;
  
  // 무적 상태일 때 깜빡임 (60fps 기준 0.1초마다 토글)
  const blink = player.invincible && Math.floor(player.invincibleTime * 10) % 2 === 0;
  if (blink) return; // 깜빡일 때는 그리지 않음
  
  // 플레이어 이미지 그리기
  if (IMAGES.player.complete) {
    ctx.drawImage(IMAGES.player, player.x, player.y, player.width, player.height);
  } else {
    // 이미지 로딩 중일 때는 기본 사각형
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }
  // 히트박스(작은 원) 표시
  const cx = player.x + player.width / 2;
  const cy = player.y + player.height / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, player.hitRadius, 0, Math.PI * 2);
  ctx.fillStyle = "red";
  ctx.fill();
  ctx.closePath();
}

export function resetPlayer() {
  player.x = canvas.width / 2 - 14;
  player.y = canvas.height - 80;
  player.lives = 3;
  player.invincible = false;
  player.invincibleTime = 0;
  player.respawning = false;
  player.cooldown = 0;
  player.dead = false;
  player.bombs = 3;
  player.bombing = false;
}

export function takeDamage() {
  if (player.invincible || player.respawning || player.bombing) return false;
  
  player.lives--;
  // 피격 시 폭탄 3발 복구
  player.bombs = Math.min(3, player.bombs + 3);
  
  if (player.lives <= 0) {
    return true; // 게임오버
  }
  
  // 폭발 이펙트는 main.js에서 처리 (takeDamage 호출 후)
  // 폭발 후 재생성
  player.respawning = true;
  player.y = player.respawnY;
  player.invincible = true;
  player.invincibleTime = 3.0; // 3초 무적
  
  return false; // 계속 진행
}

export function isShooting() {
  // 재생성 중일 때만 발사 불가 (무적 상태에서는 발사 가능)
  if (player.respawning) return false;
  return keys["KeyZ"];
}
