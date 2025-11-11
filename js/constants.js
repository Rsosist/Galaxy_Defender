// constants.js
// -----------------------------
// 전역에서 공통으로 사용하는 상수 및 객체
// -----------------------------

// 🖼️ 캔버스 초기화
export const canvas = document.getElementById("game");
export const ctx = canvas.getContext("2d");

// 💡 게임 크기
export const GAME_WIDTH = canvas.width;
export const GAME_HEIGHT = canvas.height;

// 🎨 색상 팔레트
export const COLORS = {
  background: "#111",
  player: "cyan",
  bullet: "lime",
  enemy: "red",
  boss: "purple",
  text: "white",
  border: "cyan",
};

// ⚙️ 게임 기본 설정
export const CONFIG = {
  fps: 60,
  playerSpeed: 4,
  bulletSpeed: 10,
  enemyBaseSpeed: 2,
  bossSpeed: 1.5,
};

// 🎵 사운드 (필요 시 추가)
export const SOUNDS = {
  shoot: new Audio("./assets/sound/shoot.mp3"),
  explosion: new Audio("./assets/sound/explosion.mp3"),
  boss: new Audio("./assets/sound/boss_entrance.mp3"),
};

// 사운드 볼륨 미리 조정
for (const s of Object.values(SOUNDS)) {
  s.volume = 0.3;
}

// 🧮 프레임 보정용 (60fps = delta 1)
export const FRAME_TIME = 1000 / CONFIG.fps;

// 🖼️ 이미지 로드
export const IMAGES = {
  player: new Image(),
  enemy: new Image(),
  tank: new Image(),
  boss: new Image()
};

IMAGES.player.src = "./images/fighter.png";
IMAGES.enemy.src = "./images/ufo.png";
IMAGES.tank.src = "./images/tank.png";
IMAGES.boss.src = "./images/boss.png";
