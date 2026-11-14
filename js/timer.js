// Rest timer. It fills the screen so it can be read from a phone mounted on a machine,
// and counts against a deadline so it stays right if the phone throttles the page.
import { fmt } from './util.js';

let deadline = 0;
let total = 0;
let ticker = null;
let alarm = null;
let wakeLock = null;
let audio = null;
let minimized = false;
let nextLabel = '';
let lastBeep = 0;

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

// Browsers only allow sound after a tap, so the audio context is opened while the
// user is tapping a set's check mark, then reused when the rest ends.
function unlockAudio() {
  try {
    audio ||= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch {
    audio = null;
  }
}

function tone(freq, start, length, volume = 0.9) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'square'; // harsher than a sine wave, so it cuts through gym music
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audio.currentTime + start);
  gain.gain.setValueAtTime(0, audio.currentTime + start + length);
  osc.connect(gain).connect(audio.destination);
  osc.start(audio.currentTime + start);
  osc.stop(audio.currentTime + start + length + 0.02);
}

function beepAlarm() {
  if (!audio) return;
  [0, 0.22, 0.44].forEach((t, i) => tone(i % 2 ? 2400 : 1800, t, 0.16));
}

function render() {
  const box = el();
  const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const done = left === 0;
  box.className = `timer show ${minimized ? 'mini' : 'full'} ${done ? 'done' : left <= 10 ? 'soon' : ''}`;
  if (minimized) {
    box.innerHTML = `<button class="timer-mini" data-act="timer-expand" aria-label="نمایش تمام‌صفحه تایمر">
      <span>${done ? 'وقت ست بعده' : 'استراحت'}</span><strong>${done ? '' : label(left)}</strong></button>
      <button class="icon-btn" data-act="timer-stop" aria-label="بستن تایمر">✕</button>`;
    return;
  }
  if (done) {
    box.innerHTML = `<button class="timer-go" data-act="timer-stop">
      <strong>برو!</strong><span>${nextLabel || 'ست بعد'}</span><small>برای بستن لمس کن</small></button>`;
    return;
  }
  const pct = total ? (left / total) * 100 : 0;
  box.innerHTML = `<div class="timer-head"><span>استراحت</span>
      <button class="btn small" data-act="timer-minimize">کوچک کن</button></div>
    <strong class="timer-big" role="timer">${label(left)}</strong>
    <div class="timer-bar"><i style="width:${pct}%"></i></div>
    ${nextLabel ? `<p class="timer-next">${nextLabel}</p>` : ''}
    <div class="timer-actions">
      <button class="btn" data-act="timer-add" data-n="-15">۱۵− ثانیه</button>
      <button class="btn" data-act="timer-add" data-n="15">۱۵+ ثانیه</button>
      <button class="btn primary" data-act="timer-stop">رد کن</button>
    </div>`;
}

function tick() {
  const left = Math.ceil((deadline - Date.now()) / 1000);
  // Short ticks for the last three seconds, so a glance isn't even needed.
  if (left > 0 && left <= 3 && left !== lastBeep && audio) {
    lastBeep = left;
    tone(1200, 0, 0.08, 0.6);
  }
  if (left > 0) {
    render();
    return;
  }
  clearInterval(ticker);
  ticker = null;
  render();
  // Repeats until dismissed, for up to half a minute.
  let rounds = 0;
  const ring = () => {
    beepAlarm();
    navigator.vibrate?.([500, 150, 500, 150, 500]);
    rounds += 1;
    if (rounds >= 15) stopAlarm();
  };
  ring();
  alarm = setInterval(ring, 2000);
}

function stopAlarm() {
  clearInterval(alarm);
  alarm = null;
  navigator.vibrate?.(0);
  releaseScreen();
}

export function startTimer(seconds, next = '') {
  if (!seconds) return;
  unlockAudio();
  stopAlarm();
  total = seconds;
  deadline = Date.now() + seconds * 1000;
  nextLabel = next;
  minimized = false;
  lastBeep = 0;
  clearInterval(ticker);
  ticker = setInterval(tick, 250);
  render();
  holdScreen();
}

export function stopTimer() {
  clearInterval(ticker);
  ticker = null;
  stopAlarm();
  el().className = 'timer';
  el().innerHTML = '';
}

export const timerActions = {
  'timer-add': (btn) => {
    deadline = Math.max(Date.now() + 1000, deadline + Number(btn.dataset.n) * 1000);
    total = Math.max(total, Math.ceil((deadline - Date.now()) / 1000));
    render();
  },
  'timer-stop': stopTimer,
  'timer-minimize': () => {
    minimized = true;
    render();
  },
  'timer-expand': () => {
    minimized = false;
    render();
  },
};

// Android drops the wake lock when the app is backgrounded.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (ticker || alarm)) {
    holdScreen();
    if (ticker) tick();
  }
});

export const restLabel = (setNo, sets, name) => (setNo <= sets ? `بعدی: ست ${fmt(setNo)} از ${fmt(sets)}، ${name}` : `حرکت بعد: ${name}`);
