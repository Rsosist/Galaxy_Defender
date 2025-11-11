import { player } from "./player.js";
import { ctx, canvas, COLORS, CONFIG } from "./constants.js";
import { enemies } from "./enemies.js";

export const bullets = [];

export function shoot() {
  if (player.cooldown <= 0) {
    const cx = player.x + player.width / 2;
    const y = player.y;
    const laneOffset = 8;
    // 1) 왼쪽 직선탄
    bullets.push({ x: cx - laneOffset - 3, y, width: 6, height: 10, speed: CONFIG.bulletSpeed, type: "straight", damage: 1 });
    // 2) 오른쪽 직선탄
    bullets.push({ x: cx + laneOffset - 3, y, width: 6, height: 10, speed: CONFIG.bulletSpeed, type: "straight", damage: 1 });
    // 3) 유도탄 (가장 가까운 적)
    bullets.push({ x: cx - 3, y, width: 6, height: 10, speed: CONFIG.bulletSpeed * 0.95, type: "homing", damage: 1, vx: 0, vy: -CONFIG.bulletSpeed });

    // 발사 간격 줄이기
    player.cooldown = 6;
    // 사운드 있을 때만 재생
    if (typeof Audio !== "undefined" && window.SOUNDS?.shoot) {
      window.SOUNDS.shoot.currentTime = 0;
      window.SOUNDS.shoot.play().catch(() => {});
    }
  }
}

export function updateBullets(delta) {
  if (player.cooldown > 0) player.cooldown -= delta;

  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.type === "homing") {
      // 가장 가까운 적 찾기
      let nearest = null;
      let bestD2 = Infinity;
      const bx = b.x + b.width / 2;
      const by = b.y + b.height / 2;
      for (let k = 0; k < enemies.length; k++) {
        const e = enemies[k];
        const ex = e.x + e.width / 2;
        const ey = e.y + e.height / 2;
        const dx = ex - bx;
        const dy = ey - by;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestD2) { bestD2 = d2; nearest = e; }
      }
      if (nearest) {
        const ex = nearest.x + nearest.width / 2;
        const ey = nearest.y + nearest.height / 2;
        const dx = ex - bx;
        const dy = ey - by;
        const len = Math.hypot(dx, dy) || 1;
        b.vx = (dx / len) * b.speed;
        b.vy = (dy / len) * b.speed;
      }
      b.x += (b.vx ?? 0) * delta;
      b.y += (b.vy ?? -b.speed) * delta;
    } else {
      // 직선 탄은 위로
      b.y -= b.speed * delta;
    }
    
    // 플레이어 탄 렌더링: 작은 원형에 빛나는 효과
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const r = Math.max(b.width, b.height) / 2;
    
    // 외곽 후광 (노란색)
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 255, 100, 0.4)";
    ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    
    // 중간 레이어 (주황색)
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 200, 50, 0.7)";
    ctx.arc(cx, cy, r * 1.2, 0, Math.PI * 2);
    ctx.fill();
    
    // 중심 (밝은 노란색/흰색)
    ctx.beginPath();
    ctx.fillStyle = "rgba(255, 255, 200, 0.95)";
    ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    
    if (b.y + b.height < 0) bullets.splice(i, 1);
  }
}
