// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between five screens: title, play, paused, game over and win.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|nova|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady (and
// window.__shotScreen) for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  ACT_DASH,
  ACT_NOVA,
  EVENT_COIN,
  EVENT_HIT,
  EVENT_LEVEL,
  EVENT_NOVA,
  EVENT_OVER,
  EVENT_WIN,
  createWorld,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_DASH,
  ACTION_MUTE,
  ACTION_NOVA,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import {
  isMuted,
  playCollect,
  playDash,
  playHit,
  playLevel,
  playNova,
  playOver,
  playWin,
  toggleMute,
  unlockAudio,
} from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** How long a level banner stays on screen, in seconds. */
const BANNER_SECONDS = 2.2;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, null, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      window.__shotReady = true;
      window.__shotScreen = scene.screen;
      window.__shotScore = world.state.score;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let banner = null;
  let bannerUntil = 0;
  let time = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function showBanner(text) {
    banner = text;
    bannerUntil = time + BANNER_SECONDS;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    banner = null;
    screen = SCREEN_PLAY;
    unlockAudio();
    announce('Playing. Catch shards, dodge wisps, press E when the Nova is ready.');
  }

  function endGame(won) {
    if (won) {
      screen = SCREEN_WIN;
      playWin();
      announce(`Harvest complete. Score ${world.state.score}. Best ${Math.max(best, world.state.score)}.`);
    } else {
      screen = SCREEN_OVER;
      playOver();
      announce(`Game over. Score ${world.state.score}. Best ${Math.max(best, world.state.score)}.`);
    }
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      const nowMuted = toggleMute();
      announce(nowMuted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      unlockAudio();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
      else if (screen === SCREEN_WIN) {
        // Keep playing past the win, endlessly.
        screen = SCREEN_PLAY;
        announce('Playing on. Endless harvest.');
      } else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_WIN || screen === SCREEN_OVER || screen === SCREEN_PAUSED)) {
      startGame();
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function step(frameActions, firstStep) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, 0, 0, null, 0, true);
      return;
    }
    const steer = input.steer();
    const pointer = input.pointer();
    const target = pointer.held ? renderer.toField(pointer.x, pointer.y) : null;
    // Dash and Nova are one-shot actions: apply them on the frame's first substep only.
    let worldActions = 0;
    if (firstStep) {
      if (frameActions & ACTION_DASH) worldActions |= ACT_DASH;
      if (frameActions & ACTION_NOVA) worldActions |= ACT_NOVA;
      if (frameActions & ACTION_DASH) playDash();
    }
    const events = world.step(STEP, steer.x, steer.y, target, worldActions, false);
    if (events & EVENT_COIN) playCollect(world.state.comboMultiplier);
    if (events & EVENT_NOVA) playNova();
    if (events & EVENT_LEVEL) {
      playLevel();
      showBanner(`LEVEL ${world.state.level} — the wisps quicken`);
      if (world.state.level === 4 || world.state.level === 7) {
        announce(`Level ${world.state.level}. Extra life.`);
      }
    }
    if (events & EVENT_HIT) {
      playHit();
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    const frameActions = input.takeActions();
    handleActions(frameActions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += dt;
      let firstStep = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(frameActions, firstStep);
        firstStep = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    if (banner !== null && time > bannerUntil) banner = null;
    renderer.draw(world.state, screen, best, banner, time);
  }

  // Leaving the tab pauses a running game rather than letting wisps hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Nova Harvest. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
