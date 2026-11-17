// The screenshot scenes behind ?shot=start|play|nova|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (chase the nearest shard, veer away from any wisp close by, dash clear when one gets too
// close), so the frame is what a short game really looks like and the same seed always gives
// the same frame. The end scene plays well for a while, then stops moving, so the wisps catch
// it as they would a tired player.

import { FIELD, STEP } from './config.js';
import { ACT_DASH, ACT_NOVA } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 28;
const GOOD_SECONDS = 18;
const END_LIMIT_SECONDS = 600;
const NOVA_LIMIT_SECONDS = 300;
const SAMPLE = 1 / 30;

/** Steer toward the nearest shard, away from the nearest close wisp. */
function autopilot(state) {
  let shard = null;
  let shardDistance = Infinity;
  for (let index = 0; index < state.shards.length; index += 1) {
    const item = state.shards[index];
    if (!item.active) continue;
    const dx = item.x - state.player.x;
    const dy = item.y - state.player.y;
    const distance = dx * dx + dy * dy;
    if (distance < shardDistance) {
      shardDistance = distance;
      shard = item;
    }
  }
  let wisp = null;
  let wispDistance = Infinity;
  for (let index = 0; index < state.wisps.length; index += 1) {
    const item = state.wisps[index];
    if (!item.active) continue;
    const dx = item.x - state.player.x;
    const dy = item.y - state.player.y;
    const distance = dx * dx + dy * dy;
    if (distance < wispDistance) {
      wispDistance = distance;
      wisp = item;
    }
  }
  let x = 0;
  let y = 0;
  if (shard !== null) {
    const dx = shard.x - state.player.x;
    const dy = shard.y - state.player.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    x += dx / distance;
    y += dy / distance;
  }
  if (wisp !== null && wispDistance < 150 * 150) {
    const dx = state.player.x - wisp.x;
    const dy = state.player.y - wisp.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const weight = 2.4;
    x += (dx / distance) * weight;
    y += (dy / distance) * weight;
  }
  const length = Math.sqrt(x * x + y * y);
  if (length === 0) return { x: 0, y: 0, dash: false };
  const dash = wisp !== null && wispDistance < 80 * 80 && state.player.dashCooldown <= 0;
  return { x: x / length, y: y / length, dash };
}

/**
 * Set `world` to the named scene (start, play, nova or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'nova' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, 0, 0, null, 0, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'nova') {
    // Play until the Nova meter fills, fire it, and stop mid-shockwave.
    for (let index = 0; index < NOVA_LIMIT_SECONDS / STEP; index += 1) {
      const move = autopilot(world.state);
      const actions = (move.dash ? ACT_DASH : 0) | (world.state.novaCharge >= 100 ? ACT_NOVA : 0);
      const events = world.step(STEP, move.x, move.y, null, actions, false);
      if (world.state.novaRing > 0.85) {
        for (let extra = 0; extra < 9; extra += 1) world.step(STEP, 0, 0, null, 0, false);
        return { screen: SCREEN_PLAY, best: world.state.score };
      }
      if (events !== 0 && world.state.lives === 0) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const goodUntil = name === 'end' ? GOOD_SECONDS : Infinity;
  for (let index = 0; index < limit / STEP; index += 1) {
    const elapsed = (index * STEP) | 0;
    const move = elapsed < goodUntil ? autopilot(world.state) : { x: 0, y: 0, dash: false };
    const actions = move.dash ? ACT_DASH : 0;
    const events = world.step(STEP, move.x, move.y, null, actions, false);
    if (world.state.lives === 0) break;
    if (name === 'play' && index * STEP >= PLAY_SECONDS) break;
  }
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
