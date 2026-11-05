// Rest timer. It counts against a deadline, so it stays right if the phone throttles the page.
import { icons } from './ui.js';

let deadline = 0;
let ticker = null;
let wakeLock = null;

const el = () => document.getElementById('timer');
const label = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

async function holdScreen() {
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) || null;
  } catch {
    wakeLock = null; // not allowed right now; the timer still works
  }
}

function releaseScreen() {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.25;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {
    // sound is optional
  }
}

function tick() {
  const left = Math.ceil((deadline - Date.now()) / 1000);
  const box = el();
  if (left > 0) {
    box.querySelector('[data-time]').textContent = label(left);
    return;
  }
  clearInterval(ticker);
  ticker = null;
  releaseScreen();
  navigator.vibrate?.([250, 120, 250]);
  beep();
  box.classList.add('done');
  box.querySelector('[data-time]').textContent = 'وقت ست بعده';
  setTimeout(() => {
    if (!ticker) stopTimer();
  }, 6000);
}

export function startTimer(seconds) {
  if (!seconds) return;
  deadline = Date.now() + seconds * 1000;
  const box = el();
  box.className = 'timer show';
  box.innerHTML = `<span class="timer-title">استراحت</span>
    <strong data-time>${label(seconds)}</strong>
    <button class="btn small" data-act="timer-add" data-n="-15">۱۵−</button>
    <button class="btn small" data-act="timer-add" data-n="15">۱۵+</button>
    <button class="icon-btn" data-act="timer-stop" aria-label="بستن تایمر">${icons.x}</button>`;
  clearInterval(ticker);
  ticker = setInterval(tick, 500);
  if (!wakeLock) holdScreen();
}

export function stopTimer() {
  clearInterval(ticker);
  ticker = null;
  releaseScreen();
  el().className = 'timer';
}

export const timerActions = {
  'timer-add': (btn) => {
    deadline += Number(btn.dataset.n) * 1000;
    tick();
  },
  'timer-stop': stopTimer,
};

// Android drops the wake lock when the app is backgrounded.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ticker) {
    holdScreen();
    tick();
  }
});
