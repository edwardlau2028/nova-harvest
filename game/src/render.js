// Canvas drawing: a fixed 1280x720 logical field scaled to the window, a pre-rendered nebula
// backdrop with a twinkling starfield, glow sprites for the ship, shards and wisps, additive
// particles, the Nova shockwave, the HUD and the title, pause, game-over and win screens.

import { FIELD, FONT, PALETTE, PLAYER, SHARD, WISP } from './config.js';
import { KIND_DARTER, KIND_MINI, KIND_SPLITTER } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

const TAU = Math.PI * 2;

/** Deterministic starfield: a tiny LCG so the backdrop is the same every load. */
function makeStars(count) {
  let seed = 1234567;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) / 4294967296);
  };
  const stars = [];
  for (let index = 0; index < count; index += 1) {
    stars.push({ x: next() * FIELD.width, y: next() * FIELD.height, r: 0.6 + next() * 1.6, phase: next() * TAU, speed: 0.6 + next() * 1.8 });
  }
  return stars;
}

function makeGlowSprite(color, inner) {
  const size = 96;
  const sprite = document.createElement('canvas');
  sprite.width = size;
  sprite.height = size;
  const ctx = sprite.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(0.35, color);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return sprite;
}

function makeBackdrop() {
  const backdrop = document.createElement('canvas');
  backdrop.width = FIELD.width;
  backdrop.height = FIELD.height;
  const ctx = backdrop.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  sky.addColorStop(0, PALETTE.backdrop);
  sky.addColorStop(0.55, PALETTE.nebulaA);
  sky.addColorStop(1, '#05070f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const blobs = [
    [220, 150, 420, PALETTE.nebulaA],
    [1050, 220, 460, PALETTE.nebulaB],
    [640, 620, 520, PALETTE.nebulaC],
    [900, 90, 300, PALETTE.nebulaB],
  ];
  for (const [x, y, radius, color] of blobs) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  return backdrop;
}

function drawHeart(ctx, x, y, size, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-9, -3, -5, -10, 0, -4);
  ctx.bezierCurveTo(5, -10, 9, -3, 0, 5);
  ctx.closePath();
  ctx.fillStyle = filled ? '#ff5d8f' : 'rgba(255, 93, 143, 0.25)';
  ctx.fill();
  ctx.restore();
}

function drawShip(ctx, x, y, angle, radius, time, moving) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Engine flame, flickering when the ship moves.
  if (moving) {
    const flame = 14 + Math.sin(time * 31) * 5;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.7, 7);
    ctx.lineTo(-radius * 0.7 - flame, 0);
    ctx.lineTo(-radius * 0.7, -7);
    ctx.closePath();
    ctx.fillStyle = '#ffb454';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(radius * 1.3, 0);
  ctx.lineTo(-radius * 0.8, radius * 0.85);
  ctx.lineTo(-radius * 0.4, 0);
  ctx.lineTo(-radius * 0.8, -radius * 0.85);
  ctx.closePath();
  ctx.fillStyle = PALETTE.player;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(radius * 0.25, 0, radius * 0.28, 0, TAU);
  ctx.fillStyle = PALETTE.playerCore;
  ctx.fill();
  ctx.restore();
}

function drawShard(ctx, sprite, x, y, spin, radius) {
  const size = radius * 5.2;
  ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.beginPath();
  ctx.moveTo(0, -radius * 1.5);
  ctx.lineTo(radius * 0.55, 0);
  ctx.lineTo(0, radius * 1.5);
  ctx.lineTo(-radius * 0.55, 0);
  ctx.closePath();
  ctx.fillStyle = PALETTE.shard;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.32, 0, TAU);
  ctx.fillStyle = PALETTE.shardCore;
  ctx.fill();
  ctx.restore();
}

function drawWisp(ctx, sprite, wisp, time) {
  const radius = wisp.kind === KIND_MINI ? WISP.miniRadius : WISP.radius;
  const color = wisp.kind === KIND_DARTER ? PALETTE.darter : wisp.kind === KIND_MINI ? PALETTE.wispMini : PALETTE.wisp;
  const size = radius * 6;
  ctx.drawImage(sprite, wisp.x - size / 2, wisp.y - size / 2, size, size);
  // Spiky outline.
  ctx.save();
  ctx.translate(wisp.x, wisp.y);
  ctx.beginPath();
  const spikes = 9;
  for (let index = 0; index <= spikes * 2; index += 1) {
    const angle = (index / (spikes * 2)) * TAU + time * 0.7;
    const r = index % 2 === 0 ? radius * 1.25 : radius * 0.8;
    if (index === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
    else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  // Eyes that look toward the player.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-radius * 0.32, -radius * 0.15, radius * 0.22, 0, TAU);
  ctx.arc(radius * 0.32, -radius * 0.15, radius * 0.22, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a0b16';
  ctx.beginPath();
  ctx.arc(-radius * 0.32, -radius * 0.15, radius * 0.11, 0, TAU);
  ctx.arc(radius * 0.32, -radius * 0.15, radius * 0.11, 0, TAU);
  ctx.fill();
  ctx.restore();
  // A darter about to dash flashes a warning ring.
  if (wisp.kind === KIND_DARTER && wisp.state === 1) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 24);
    ctx.strokeStyle = PALETTE.darter;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wisp.x, wisp.y, radius + 12, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // A splitter wears a second ring so the player can tell it apart.
  if (wisp.kind === KIND_SPLITTER) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(wisp.x, wisp.y, radius * 0.62, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const backdrop = makeBackdrop();
  const stars = makeStars(150);
  const shardGlow = makeGlowSprite('rgba(255, 215, 106, 0.55)', 'rgba(255, 243, 196, 0.9)');
  const wispGlow = makeGlowSprite('rgba(255, 93, 143, 0.5)', 'rgba(255, 158, 196, 0.85)');
  const shipGlow = makeGlowSprite('rgba(127, 231, 255, 0.5)', 'rgba(255, 255, 255, 0.85)');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    scale = Math.min(width / FIELD.width, height / FIELD.height);
    offsetX = (width - FIELD.width * scale) / 2;
    offsetY = (height - FIELD.height * scale) / 2;
    ctx.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * offsetX, ratio * offsetY);
  }

  window.addEventListener('resize', resize);
  resize();

  /** Page pixels back into field coordinates (for pointer steering). */
  function toField(pageX, pageY) {
    return { x: (pageX - offsetX) / scale, y: (pageY - offsetY) / scale };
  }

  function panel(x, y, width, height) {
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.fill();
  }

  function bar(x, y, width, height, fraction, fill, label) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, height / 2);
    ctx.fill();
    if (fraction > 0) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(height, width * Math.min(1, fraction)), height, height / 2);
      ctx.fill();
    }
    if (label) {
      ctx.fillStyle = PALETTE.text;
      ctx.font = `600 ${Math.floor(height * 0.85)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + width / 2, y + height / 2 + 1);
    }
  }

  function drawHud(state, best, time) {
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('SCORE', 28, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(String(state.score), 28, 72);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 28, 98);
    // Level and lives, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText(`LEVEL ${state.level}`, FIELD.width - 28, 34);
    for (let index = 0; index < 5; index += 1) {
      drawHeart(ctx, FIELD.width - 36 - index * 30, 62, 22, index < state.lives);
    }
    // Combo, bottom left.
    if (state.comboChain > 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.shard;
      ctx.font = `700 26px ${FONT}`;
      ctx.fillText(`COMBO x${state.comboMultiplier}`, 28, FIELD.height - 52);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 14px ${FONT}`;
      ctx.fillText(`${state.comboChain} chained`, 28, FIELD.height - 28);
      bar(28, FIELD.height - 18, 150, 7, state.comboTimer / SHARD.comboWindow, PALETTE.shard, null);
    }
    // Dash cooldown, bottom right.
    ctx.textAlign = 'right';
    ctx.fillStyle = state.player.dashCooldown <= 0 ? PALETTE.good : PALETTE.muted;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(state.player.dashCooldown <= 0 ? 'DASH READY  [SPACE]' : 'DASH …', FIELD.width - 28, FIELD.height - 52);
    bar(FIELD.width - 178, FIELD.height - 40, 150, 7, 1 - state.player.dashCooldown / PLAYER.dashCooldown, PALETTE.good, null);
    // Nova meter, bottom centre.
    const ready = state.novaCharge >= 100;
    const pulse = ready ? 0.7 + 0.3 * Math.sin(time * 6) : 1;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.textAlign = 'center';
    ctx.fillStyle = ready ? PALETTE.nova : PALETTE.muted;
    ctx.font = `700 16px ${FONT}`;
    ctx.fillText(ready ? 'NOVA READY — PRESS E' : 'NOVA', FIELD.width / 2, FIELD.height - 52);
    ctx.restore();
    bar(FIELD.width / 2 - 130, FIELD.height - 40, 260, 12, state.novaCharge / 100, PALETTE.nova, null);
  }

  function drawTitle(state, best, time) {
    ctx.fillStyle = 'rgba(5, 7, 15, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    const bob = Math.sin(time * 1.6) * 6;
    ctx.fillStyle = PALETTE.nova;
    ctx.font = `800 84px ${FONT}`;
    ctx.fillText('NOVA HARVEST', FIELD.width / 2, 218 + bob);
    ctx.fillStyle = PALETTE.shard;
    ctx.font = `600 24px ${FONT}`;
    ctx.fillText('Catch the falling starlight. Dodge the wisps. Unleash the Nova.', FIELD.width / 2, 262 + bob);
    panel(FIELD.width / 2 - 300, 308, 600, 168);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText('WASD / ARROWS — fly   •   SPACE — dash through wisps', FIELD.width / 2, 344);
    ctx.fillText('E — fire the Nova when the meter is full', FIELD.width / 2, 378);
    ctx.fillText('Hold the mouse to steer  •  P — pause  •  M — mute', FIELD.width / 2, 412);
    ctx.fillText('Chain shards to raise your combo. Reach 5000 to win.', FIELD.width / 2, 446);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 17px ${FONT}`;
    if (best > 0) ctx.fillText(`Best harvest: ${best}`, FIELD.width / 2, 522);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 26px ${FONT}`;
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 3);
    ctx.fillText('Press ENTER or click to start', FIELD.width / 2, 578);
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(5, 7, 15, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 56px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 8);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 20px ${FONT}`;
    ctx.fillText('Press P or Enter to keep playing', FIELD.width / 2, FIELD.height / 2 + 36);
  }

  function drawOver(state, best, time) {
    ctx.fillStyle = 'rgba(10, 4, 12, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.wisp;
    ctx.font = `800 64px ${FONT}`;
    ctx.fillText('HARVEST LOST', FIELD.width / 2, 272);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(`Score ${state.score}   •   Best ${Math.max(best, state.score)}`, FIELD.width / 2, 336);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText(`Level ${state.level}  •  ${state.comboChain} chained at the end`, FIELD.width / 2, 376);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 24px ${FONT}`;
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 3);
    ctx.fillText('Press ENTER to try again', FIELD.width / 2, 448);
    ctx.globalAlpha = 1;
  }

  function drawWin(state, best, time) {
    ctx.fillStyle = 'rgba(4, 12, 10, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.good;
    ctx.font = `800 64px ${FONT}`;
    ctx.fillText('HARVEST COMPLETE!', FIELD.width / 2, 272);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(`Score ${state.score}   •   Best ${Math.max(best, state.score)}`, FIELD.width / 2, 336);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillText('You gathered 5000 starlight and lit the nebula.', FIELD.width / 2, 376);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 24px ${FONT}`;
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 3);
    ctx.fillText('ENTER — keep playing   •   R — start over', FIELD.width / 2, 448);
    ctx.globalAlpha = 1;
  }

  function draw(state, screen, best, banner, time) {
    ctx.clearRect(0, 0, FIELD.width, FIELD.height);
    ctx.save();
    if (state.shake > 0) {
      const magnitude = state.shake * 9;
      ctx.translate((Math.random() - 0.5) * magnitude, (Math.random() - 0.5) * magnitude);
    }
    ctx.drawImage(backdrop, 0, 0);
    for (const star of stars) {
      ctx.globalAlpha = 0.35 + 0.6 * (0.5 + 0.5 * Math.sin(time * star.speed + star.phase));
      ctx.fillStyle = PALETTE.star;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const shard of state.shards) {
      if (shard.active) drawShard(ctx, shardGlow, shard.x, shard.y, shard.spin, SHARD.radius);
    }
    for (const wisp of state.wisps) {
      if (wisp.active) drawWisp(ctx, wispGlow, wisp, time);
    }
    // Additive particles.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of state.particles) {
      if (!particle.active) continue;
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // The player ship, blinking while invulnerable (except while dashing).
    const blinking = state.player.invulnerable > 0 && state.player.dashTimer <= 0 && Math.floor(time * 12) % 2 === 0;
    if (!blinking) {
      const size = PLAYER.radius * 4.6;
      ctx.drawImage(shipGlow, state.player.x - size / 2, state.player.y - size / 2, size, size);
      const speed = Math.sqrt(state.player.vx * state.player.vx + state.player.vy * state.player.vy);
      drawShip(ctx, state.player.x, state.player.y, state.player.angle, PLAYER.radius, time, speed > 40);
    }
    // The Nova shockwave.
    if (state.novaRing > 0) {
      const progress = 1 - state.novaRing;
      ctx.save();
      ctx.globalAlpha = state.novaRing * 0.9;
      ctx.strokeStyle = PALETTE.nova;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, 40 + progress * state.novaRingMax, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = state.novaRing * 0.25;
      ctx.fillStyle = PALETTE.nova;
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, 40 + progress * state.novaRingMax, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // Flash overlay (hit red, nova white).
    if (state.flash > 0) {
      ctx.save();
      ctx.globalAlpha = state.flash * 0.35;
      ctx.fillStyle = state.flashColor;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.restore();
    }
    ctx.restore();

    if (screen === SCREEN_TITLE) {
      drawHud(state, best, time);
      drawTitle(state, best, time);
    } else if (screen === SCREEN_PLAY) {
      drawHud(state, best, time);
      if (banner !== null) {
        ctx.textAlign = 'center';
        ctx.fillStyle = PALETTE.good;
        ctx.font = `800 34px ${FONT}`;
        ctx.globalAlpha = 0.9;
        ctx.fillText(banner, FIELD.width / 2, 150);
        ctx.globalAlpha = 1;
      }
    } else if (screen === SCREEN_PAUSED) {
      drawHud(state, best, time);
      drawPaused();
    } else if (screen === SCREEN_OVER) {
      drawOver(state, best, time);
    } else if (screen === SCREEN_WIN) {
      drawHud(state, best, time);
      drawWin(state, best, time);
    }
  }

  return { draw, resize, toField };
}
