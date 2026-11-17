// The game's rules and state, with no drawing and no browser in it: the harvester ship,
// falling star shards, the wisps that hunt it, the combo chain, the Nova meter, dash, lives,
// levels and the win score. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react without the world knowing about screens or sound. Nothing
// here allocates after createWorld returns.

import { FIELD, LEVEL, LIVES, NOVA, PLAYER, POOL, SHARD, WIN_SCORE, WISP } from './config.js';

export const KIND_DRIFTER = 0;
export const KIND_DARTER = 1;
export const KIND_SPLITTER = 2;
export const KIND_MINI = 3;

export const EVENT_COIN = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_NOVA = 8;
export const EVENT_LEVEL = 16;
export const EVENT_WIN = 32;
export const EVENT_DASHKILL = 64;

/** Bit flags the caller passes in as one-shot actions for this step. */
export const ACT_DASH = 1;
export const ACT_NOVA = 2;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    invulnerable: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashX: 0,
    dashY: -1,
  };
  const shards = [];
  for (let index = 0; index < POOL.shards; index += 1) {
    shards.push({ active: false, x: 0, y: 0, speed: 0, phase: 0, spin: 0 });
  }
  const wisps = [];
  for (let index = 0; index < POOL.wisps; index += 1) {
    wisps.push({ active: false, kind: KIND_DRIFTER, x: 0, y: 0, vx: 0, vy: 0, hp: 1, phase: 0, state: 0, timer: 0, tx: 0, ty: 0 });
  }
  const particles = [];
  for (let index = 0; index < POOL.particles; index += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }
  const state = {
    player,
    shards,
    wisps,
    particles,
    score: 0,
    lives: LIVES,
    level: 1,
    elapsed: 0,
    comboChain: 0,
    comboMultiplier: 1,
    comboTimer: 0,
    novaCharge: 0,
    novaRing: 0,
    novaRingMax: 0,
    shake: 0,
    flash: 0,
    flashColor: '#ffffff',
    won: false,
    shardTimer: 0.4,
    wispTimer: 1.2,
    starSeed: 0,
  };

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height * 0.62;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.invulnerable = 0;
    player.dashTimer = 0;
    player.dashCooldown = 0;
    for (const shard of shards) shard.active = false;
    for (const wisp of wisps) wisp.active = false;
    for (const particle of particles) particle.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.comboChain = 0;
    state.comboMultiplier = 1;
    state.comboTimer = 0;
    state.novaCharge = 0;
    state.novaRing = 0;
    state.novaRingMax = 0;
    state.shake = 0;
    state.flash = 0;
    state.won = false;
    state.shardTimer = 0.4;
    state.wispTimer = 3.0;
  }

  function freeShard() {
    for (let index = 0; index < shards.length; index += 1) if (!shards[index].active) return shards[index];
    return null;
  }

  function freeWisp() {
    for (let index = 0; index < wisps.length; index += 1) if (!wisps[index].active) return wisps[index];
    return null;
  }

  function freeParticle() {
    for (let index = 0; index < particles.length; index += 1) if (!particles[index].active) return particles[index];
    return null;
  }

  function burst(x, y, color, count, speed, size) {
    for (let index = 0; index < count; index += 1) {
      const particle = freeParticle();
      if (particle === null) return;
      const angle = random() * TAU;
      const velocity = speed * (0.3 + random() * 0.7);
      particle.active = true;
      particle.x = x;
      particle.y = y;
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = Math.sin(angle) * velocity;
      particle.maxLife = 0.35 + random() * 0.45;
      particle.life = particle.maxLife;
      particle.size = size * (0.6 + random() * 0.8);
      particle.color = color;
    }
  }

  function spawnShard() {
    const shard = freeShard();
    if (shard === null) return;
    shard.active = true;
    shard.x = 30 + random() * (FIELD.width - 60);
    shard.y = -20;
    shard.speed = SHARD.fallSpeed * (0.85 + random() * 0.4);
    shard.phase = random() * TAU;
    shard.spin = random() * TAU;
  }

  function spawnWisp(edge) {
    const wisp = freeWisp();
    if (wisp === null) return;
    // Kind by level: darters from level 2, splitters from level 3.
    let kind = KIND_DRIFTER;
    const roll = random();
    if (state.level >= 3 && roll < 0.2) kind = KIND_SPLITTER;
    else if (state.level >= 2 && roll < 0.45) kind = KIND_DARTER;
    wisp.active = true;
    wisp.kind = kind;
    wisp.hp = kind === KIND_SPLITTER ? 2 : 1;
    wisp.state = 0;
    wisp.timer = 0.8 + random() * 0.8;
    wisp.phase = random() * TAU;
    const side = edge !== undefined ? edge : Math.floor(random() * 4);
    const margin = 30;
    if (side === 0) {
      wisp.x = random() * FIELD.width;
      wisp.y = -margin;
    } else if (side === 1) {
      wisp.x = random() * FIELD.width;
      wisp.y = FIELD.height + margin;
    } else if (side === 2) {
      wisp.x = -margin;
      wisp.y = random() * FIELD.height;
    } else {
      wisp.x = FIELD.width + margin;
      wisp.y = random() * FIELD.height;
    }
    wisp.vx = 0;
    wisp.vy = 0;
  }

  function spawnMini(x, y) {
    const wisp = freeWisp();
    if (wisp === null) return;
    wisp.active = true;
    wisp.kind = KIND_MINI;
    wisp.hp = 1;
    wisp.state = 0;
    wisp.timer = 0;
    wisp.phase = random() * TAU;
    wisp.x = x;
    wisp.y = y;
    wisp.vx = (random() - 0.5) * 120;
    wisp.vy = (random() - 0.5) * 120;
  }

  function wispRadius(wisp) {
    return wisp.kind === KIND_MINI ? WISP.miniRadius : WISP.radius;
  }

  function wispSpeed(wisp) {
    const base = WISP.speed + WISP.speedPerLevel * (state.level - 1);
    if (wisp.kind === KIND_MINI) return base * 1.5;
    if (wisp.kind === KIND_DARTER) return base * 0.8;
    return base;
  }

  /** A wisp destroyed by the dash or the Nova. A splitter dashed apart becomes two minis. */
  function destroyWisp(wisp, byNova) {
    wisp.active = false;
    if (wisp.kind === KIND_SPLITTER && !byNova) {
      spawnMini(wisp.x - 14, wisp.y);
      spawnMini(wisp.x + 14, wisp.y);
    }
  }

  function shardInterval() {
    return Math.max(0.35, SHARD.interval - 0.03 * (state.level - 1));
  }

  function wispInterval() {
    return Math.max(WISP.minInterval, WISP.interval * WISP.intervalScale ** (state.level - 1));
  }

  function movePlayer(dt, steerX, steerY, target) {
    let ax = steerX;
    let ay = steerY;
    if (target !== null) {
      // Pointer steering: accelerate toward the held pointer, easing off near it.
      const dx = target.x - player.x;
      const dy = target.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 12) {
        ax = dx / distance;
        ay = dy / distance;
      } else {
        ax = 0;
        ay = 0;
      }
    }
    const length = Math.sqrt(ax * ax + ay * ay);
    if (length > 0) {
      ax /= length;
      ay /= length;
      player.angle = Math.atan2(ay, ax);
    }
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.vx = player.dashX * PLAYER.dashSpeed;
      player.vy = player.dashY * PLAYER.dashSpeed;
    } else {
      player.vx += ax * PLAYER.accel * dt;
      player.vy += ay * PLAYER.accel * dt;
      const drag = Math.max(0, 1 - PLAYER.drag * dt);
      player.vx *= drag;
      player.vy *= drag;
      const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
      if (speed > PLAYER.maxSpeed) {
        player.vx = (player.vx / speed) * PLAYER.maxSpeed;
        player.vy = (player.vy / speed) * PLAYER.maxSpeed;
      }
    }
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + player.vy * dt));
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (player.dashCooldown > 0) player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  }

  function updateShards(dt) {
    for (let index = 0; index < shards.length; index += 1) {
      const shard = shards[index];
      if (!shard.active) continue;
      shard.y += shard.speed * dt;
      shard.x += Math.sin((state.elapsed + shard.phase) * 2.1) * SHARD.sway * dt;
      shard.spin += dt * 2.4;
      if (shard.x < 12) shard.x = 12;
      if (shard.x > FIELD.width - 12) shard.x = FIELD.width - 12;
      if (shard.y > FIELD.height + 24) shard.active = false;
    }
  }

  function updateWisps(dt, harmless) {
    for (let index = 0; index < wisps.length; index += 1) {
      const wisp = wisps[index];
      if (!wisp.active) continue;
      const dx = player.x - wisp.x;
      const dy = player.y - wisp.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = wispSpeed(wisp);
      if (wisp.kind === KIND_DARTER) {
        // Approach, telegraph, then dash at where the player was.
        wisp.timer -= dt;
        if (wisp.state === 0) {
          wisp.vx += ((dx / distance) * speed * 0.9 - wisp.vx) * Math.min(1, dt * 2);
          wisp.vy += ((dy / distance) * speed * 0.9 - wisp.vy) * Math.min(1, dt * 2);
          if (wisp.timer <= 0) {
            wisp.state = 1;
            wisp.timer = 0.35;
            wisp.tx = player.x;
            wisp.ty = player.y;
          }
        } else if (wisp.state === 1) {
          wisp.vx *= 0.9;
          wisp.vy *= 0.9;
          if (wisp.timer <= 0) {
            wisp.state = 2;
            wisp.timer = 0.42;
            const tdx = wisp.tx - wisp.x;
            const tdy = wisp.ty - wisp.y;
            const td = Math.sqrt(tdx * tdx + tdy * tdy) || 1;
            wisp.vx = (tdx / td) * speed * 2.8;
            wisp.vy = (tdy / td) * speed * 2.8;
          }
        } else {
          if (wisp.timer <= 0) {
            wisp.state = 0;
            wisp.timer = 0.9 + random() * 0.9;
          }
        }
      } else {
        // Drifters, splitters and minis chase with a sideways wobble.
        const wobble = Math.sin((state.elapsed + wisp.phase) * 2.6) * WISP.wobble;
        const nx = -dy / distance;
        const ny = dx / distance;
        wisp.vx += ((dx / distance) * speed + nx * wobble * 0.4 - wisp.vx) * Math.min(1, dt * 1.4);
        wisp.vy += ((dy / distance) * speed + ny * wobble * 0.4 - wisp.vy) * Math.min(1, dt * 1.4);
      }
      wisp.x += wisp.vx * dt;
      wisp.y += wisp.vy * dt;
      if (wisp.x < -60 || wisp.x > FIELD.width + 60 || wisp.y < -60 || wisp.y > FIELD.height + 60) {
        wisp.active = false;
      }
    }
  }

  function updateParticles(dt) {
    for (let index = 0; index < particles.length; index += 1) {
      const particle = particles[index];
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.max(0, 1 - 2.4 * dt);
      particle.vy *= Math.max(0, 1 - 2.4 * dt);
    }
  }

  function collectShard(shard) {
    shard.active = false;
    state.comboChain += 1;
    state.comboTimer = SHARD.comboWindow;
    state.comboMultiplier = Math.min(SHARD.maxMultiplier, 1 + Math.floor(state.comboChain / SHARD.comboStep));
    const points = SHARD.points * state.comboMultiplier;
    state.score += points;
    state.novaCharge = Math.min(NOVA.maxCharge, state.novaCharge + SHARD.novaCharge);
    burst(shard.x, shard.y, '#ffd76a', 10, 170, 3);
    return points;
  }

  /**
   * One fixed step. `steer` is the keyboard vector (-1..1 each way), `target` the held
   * pointer's field position or null, `actions` the ACT_* flags for this step. With `harmless`
   * set (the title screen's backdrop) shards fall but nothing spawns wisps, touches the
   * player or scores.
   */
  function step(dt, steerX, steerY, target, actions, harmless) {
    let events = 0;
    state.elapsed += dt;
    const level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    if (level !== state.level) {
      state.level = level;
      events |= EVENT_LEVEL;
      if ((level === 4 || level === 7) && state.lives < 5) state.lives += 1;
    }
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.comboChain = 0;
        state.comboMultiplier = 1;
      }
    }
    if (state.novaRing > 0) state.novaRing = Math.max(0, state.novaRing - dt / NOVA.linger);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.5);

    if (!harmless && actions & ACT_DASH && player.dashCooldown <= 0 && player.dashTimer <= 0) {
      let dx = steerX;
      let dy = steerY;
      if (dx === 0 && dy === 0) {
        dx = Math.cos(player.angle);
        dy = Math.sin(player.angle);
      }
      const length = Math.sqrt(dx * dx + dy * dy) || 1;
      player.dashX = dx / length;
      player.dashY = dy / length;
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashTime + 0.08);
      burst(player.x, player.y, '#7fe7ff', 8, 120, 3);
    }
    if (!harmless && actions & ACT_NOVA && state.novaCharge >= NOVA.maxCharge) {
      state.novaCharge = 0;
      state.novaRing = 1;
      state.novaRingMax = NOVA.radius;
      state.flash = 1;
      state.flashColor = '#b8f7ff';
      state.shake = 1;
      let cleared = 0;
      for (let index = 0; index < wisps.length; index += 1) {
        const wisp = wisps[index];
        if (!wisp.active) continue;
        if (dist2(wisp.x, wisp.y, player.x, player.y) <= NOVA.radius * NOVA.radius) {
          burst(wisp.x, wisp.y, '#ff5d8f', 12, 200, 3);
          destroyWisp(wisp, true);
          state.score += WISP.novaPoints;
          cleared += 1;
        }
      }
      if (cleared > 0) burst(player.x, player.y, '#b8f7ff', 24, 320, 4);
      events |= EVENT_NOVA;
    }

    movePlayer(dt, steerX, steerY, target);

    state.shardTimer -= dt;
    if (state.shardTimer <= 0) {
      spawnShard();
      state.shardTimer += shardInterval() * (0.7 + random() * 0.6);
    }
    if (!harmless) {
      state.wispTimer -= dt;
      if (state.wispTimer <= 0) {
        spawnWisp();
        state.wispTimer += wispInterval() * (0.7 + random() * 0.6);
      }
    }
    updateShards(dt);
    updateWisps(dt, harmless);

    // Shard pickups.
    for (let index = 0; index < shards.length; index += 1) {
      const shard = shards[index];
      if (!shard.active) continue;
      const radius = SHARD.radius + PLAYER.radius;
      if (!harmless && dist2(shard.x, shard.y, player.x, player.y) < radius * radius) {
        collectShard(shard);
        events |= EVENT_COIN;
      }
    }

    // Wisp contact: a dashing ship shreds them; otherwise a hit costs a life.
    for (let index = 0; index < wisps.length; index += 1) {
      const wisp = wisps[index];
      if (!wisp.active) continue;
      const radius = wispRadius(wisp) + PLAYER.radius - 4;
      if (dist2(wisp.x, wisp.y, player.x, player.y) >= radius * radius) continue;
      if (harmless) continue;
      if (player.dashTimer > 0) {
        burst(wisp.x, wisp.y, '#ff5d8f', 12, 220, 3);
        destroyWisp(wisp, false);
        state.score += PLAYER.dashKillPoints;
        events |= EVENT_DASHKILL;
        continue;
      }
      if (player.invulnerable > 0) continue;
      wisp.active = false;
      state.lives -= 1;
      state.comboChain = 0;
      state.comboMultiplier = 1;
      state.comboTimer = 0;
      player.invulnerable = PLAYER.invulnerable;
      state.shake = 1;
      state.flash = 0.8;
      state.flashColor = '#ff5d8f';
      const dx = player.x - wisp.x;
      const dy = player.y - wisp.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 1;
      player.vx = (dx / distance) * 420;
      player.vy = (dy / distance) * 420;
      burst(player.x, player.y, '#ff5d8f', 18, 260, 4);
      events |= EVENT_HIT;
      if (state.lives <= 0) {
        events |= EVENT_OVER;
        break;
      }
    }

    updateParticles(dt);

    if (!state.won && !harmless && state.score >= WIN_SCORE) {
      state.won = true;
      events |= EVENT_WIN;
    }
    return events;
  }

  reset();
  return { state, reset, step, burst };
}
