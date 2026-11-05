import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayLoad, levelOf, programLoad } from '../js/body-map.js';
import { attendanceStats, buildHistories, e1rm, exerciseTrend, habitImpact, journeyStats, performanceByDate, setScore, suggestDay, weeklySeries } from '../js/stats.js';
import { addDays, parseNum, parseRepsText, repsToText, weekStart } from '../js/util.js';

const set = (weight, reps, extra = {}) => ({ weight, reps, done: true, ...extra });
const session = (date, sets, exerciseId = 'bench', dayId = 'a') => ({ date, dayId, entries: [{ exerciseId, sets }] });

test('parseNum accepts Persian digits and decimal separators', () => {
  assert.equal(parseNum('۱۲٫۵'), 12.5);
  assert.equal(parseNum('٤٠'), 40);
  assert.equal(parseNum(''), null);
  assert.equal(parseNum('abc'), null);
  assert.equal(parseNum('-3'), null);
});

test('e1rm uses Epley and treats a single rep as the weight itself', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.equal(e1rm(100, 10), 100 * (1 + 10 / 30));
  assert.equal(e1rm(0, 10), 0);
});

test('weeks start on Saturday', () => {
  assert.equal(weekStart('2026-11-05'), '2026-10-31'); // Thursday -> Saturday before
  assert.equal(weekStart('2026-10-31'), '2026-10-31');
});

test('history ignores warmups and unfinished sets', () => {
  const h = buildHistories([session('2026-01-01', [set(40, 10, { warmup: true }), set(60, 8), { weight: 100, reps: 5, done: false }])]).get('bench');
  assert.equal(h[0].count, 1);
  assert.equal(h[0].topWeight, 60);
  assert.equal(h[0].volume, 480);
});

test('PRs are flagged only when beating every earlier session', () => {
  const h = buildHistories([session('2026-01-01', [set(60, 8)]), session('2026-01-03', [set(60, 8)]), session('2026-01-05', [set(62.5, 8)])]).get('bench');
  assert.deepEqual(h.map((x) => x.pr), [false, false, true]);
});

test('bodyweight exercises are scored on reps', () => {
  const h = buildHistories([session('2026-01-01', [set(0, 8)]), session('2026-01-03', [set(0, 10)])]).get('bench');
  assert.equal(h.weighted, false);
  assert.equal(h[1].score, 10);
  assert.equal(h[1].pr, true);
});

test('trend detects progress, plateaus and needs enough history', () => {
  const run = (weights) => buildHistories(weights.map((w, i) => session(addDays('2026-01-01', i * 3), [set(w, 5)]))).get('bench');
  assert.equal(exerciseTrend(run([60, 62, 64]), '2026-02-01').status, 'new');
  assert.equal(exerciseTrend(run([60, 61, 62, 64, 66, 68]), '2026-02-01').status, 'up');
  const flat = exerciseTrend(run([70, 70, 70, 70, 70, 70]), '2026-02-01');
  assert.equal(flat.status, 'flat');
  assert.equal(flat.stalled, true);
  assert.equal(exerciseTrend(run([70, 70, 70, 60, 60, 60]), '2026-02-01').status, 'down');
});

test('performance is relative to the recent baseline and needs two prior sessions', () => {
  const list = [60, 60, 66].map((w, i) => session(addDays('2026-01-01', i), [set(w, 1)]));
  const perf = performanceByDate(buildHistories(list));
  assert.deepEqual(Object.keys(perf), ['2026-01-03']);
  assert.equal(Math.round(perf['2026-01-03']), 110);
});

test('habit impact reports too few samples, then a clear difference', () => {
  const tracker = { id: 'c', type: 'check' };
  const perf = {};
  const daily = {};
  for (let i = 0; i < 12; i++) {
    const d = addDays('2026-01-01', i);
    const on = i % 2 === 0;
    perf[d] = (on ? 105 : 98) + (i % 3) * 0.5;
    daily[d] = { date: d, values: on ? { c: true } : { other: 1 } };
  }
  const r = habitImpact(perf, daily, tracker);
  assert.equal(r.enough, true);
  assert.equal(r.nHi, 6);
  assert.ok(r.diff > 5);
  assert.equal(r.strong, true);
  assert.equal(habitImpact({ '2026-01-01': 100 }, daily, tracker).enough, false);
});

test('days with no habit logged at all are excluded, not counted as skipped', () => {
  const tracker = { id: 'c', type: 'check' };
  const r = habitImpact({ '2026-01-01': 100 }, { '2026-01-01': { date: '2026-01-01', gym: true, values: {} } }, tracker);
  assert.equal(r.samples, 0);
});

test('target reps parse as a single number, a range or a per-set list', () => {
  assert.deepEqual(parseRepsText('12'), { repsMin: 12, repsMax: 12, repScheme: null });
  assert.deepEqual(parseRepsText('۸-۱۲'), { repsMin: 8, repsMax: 12, repScheme: null });
  assert.deepEqual(parseRepsText('۸،۱۰،۱۲'), { repsMin: 8, repsMax: 12, repScheme: [8, 10, 12] });
  assert.deepEqual(parseRepsText(''), { repsMin: null, repsMax: null, repScheme: null });
  assert.equal(repsToText({ repScheme: [8, 10, 12] }), '8,10,12');
  assert.equal(repsToText({ repsMin: 8, repsMax: 12 }), '8-12');
  assert.equal(repsToText({ repsMin: 12, repsMax: 12 }), '12');
});

test('timed exercises add no load volume and are scored on duration times speed', () => {
  const timed = new Set(['treadmill', 'plank']);
  const list = [
    session('2026-01-01', [set(4.5, 12)], 'treadmill'),
    session('2026-01-03', [set(5, 12)], 'treadmill'),
    session('2026-01-03', [set(0, 45)], 'plank'),
  ];
  const h = buildHistories(list, timed);
  const t = h.get('treadmill');
  assert.equal(t.isTime, true);
  assert.equal(t[1].volume, 0);
  assert.equal(t[1].score, 60);
  assert.equal(t[1].pr, true);
  assert.equal(h.get('plank')[0].score, 45);
  assert.deepEqual(performanceByDate(h), {});
  assert.equal(setScore(t, 5, 13), 65);
  const w = weeklySeries(list, '2026-01-01', '2026-01-03', timed);
  assert.equal(w.reduce((n, x) => n + x.volume + x.sets, 0), 0);
  assert.equal(w.reduce((n, x) => n + x.sessions, 0), 3); // attendance still counts
});

test('weekly series keeps empty weeks so gaps are visible', () => {
  const w = weeklySeries([session('2026-01-05', [set(50, 10)]), session('2026-01-20', [set(50, 10)])], '2026-01-03', '2026-01-24');
  assert.deepEqual(w.map((x) => x.sessions), [1, 0, 1, 0]);
  assert.equal(w[0].volume, 500);
});

test('attendance streak survives a quiet current week but not a missed one', () => {
  const dates = ['2026-10-20', '2026-10-27'];
  assert.equal(attendanceStats(dates, '2026-11-01').streakWeeks, 2);
  assert.equal(attendanceStats(dates, '2026-11-10').streakWeeks, 0);
  assert.equal(attendanceStats(dates, '2026-10-28').longestGap, 7);
});

test('day suggestion prefers weekdays, otherwise rotates', () => {
  const rotation = [{ id: 'a' }, { id: 'b' }];
  assert.equal(suggestDay(rotation, [], '2026-11-05'), 'a');
  assert.equal(suggestDay(rotation, [session('2026-11-03', [set(50, 5)], 'x', 'a')], '2026-11-05'), 'b');
  assert.equal(suggestDay(rotation, [session('2026-11-03', [set(50, 5)], 'x', 'b')], '2026-11-05'), 'a');
  const weekly = [{ id: 'th', weekdays: [5] }];
  assert.equal(suggestDay(weekly, [], '2026-11-05'), 'th'); // Thursday
  assert.equal(suggestDay(weekly, [], '2026-11-06'), null);
});

test('the cycle anchor puts 14 Aban on day two, then day three, then rest', () => {
  const days = [{ id: 'd1', items: [] }, { id: 'd2', items: [] }, { id: 'd3', items: [] }];
  const cycle = { start: '2026-10-19', rest: 1 };
  assert.equal(suggestDay(days, [], '2026-11-04', cycle), 'd1');
  assert.equal(suggestDay(days, [], '2026-11-05', cycle), 'd2');
  assert.equal(suggestDay(days, [], '2026-11-06', cycle), 'd3');
  assert.equal(suggestDay(days, [], '2026-11-07', cycle), null); // rest
  assert.equal(suggestDay(days, [], '2026-11-08', cycle), 'd1');
  // Choosing another day re-anchors what comes next.
  assert.equal(suggestDay(days, [session('2026-11-05', [set(50, 5)], 'x', 'd1')], '2026-11-06', cycle), 'd2');
});

test('journey matches the reported history and counts what comes after it', () => {
  const journey = { homeFrom: '2026-09-11', gymFrom: '2026-10-18', planEnd: '2026-11-04', planLen: 4, planRest: 1, missed: 2 };
  const cycle = { start: '2026-10-19', rest: 1 };
  const now = journeyStats(journey, cycle, 3, [], '2026-11-05');
  assert.equal(now.homeDays, 37);
  assert.equal(now.dayNumber, 56);
  assert.equal(now.planned, 14);
  assert.equal(now.sessions, 12);
  assert.equal(now.missed, 2);
  const trained = journeyStats(journey, cycle, 3, ['2026-11-05'], '2026-11-05');
  assert.equal(trained.planned, 15);
  assert.equal(trained.sessions, 13);
  const skipped = journeyStats(journey, cycle, 3, ['2026-11-05'], '2026-11-07');
  assert.equal(skipped.planned, 16); // the 6th was due and missed, the 7th is rest
  assert.equal(skipped.missed, 3);
});

test('program load covers each region once per cycle, scaled to a week', () => {
  const exercises = [{ id: 'a', name: 'سرشانه دمبل جفت پرس', muscle: 'سرشانه' }, { id: 'b', name: 'حرکت تازه', muscle: 'ساق' }, { id: 'c', name: 'تردمیل', muscle: 'کاردیو' }];
  const days = [{ items: [{ exerciseId: 'a', sets: 4 }, { exerciseId: 'b', sets: 2 }, { exerciseId: 'c', sets: 1 }] }, { items: [] }, { items: [] }];
  const load = programLoad(days, exercises, 1);
  assert.equal(load.frontDelt.sets, 4 * (7 / 4));
  assert.equal(load.triceps.sets, 2 * (7 / 4)); // secondary counts half
  assert.equal(load.calves.sets, 2 * (7 / 4)); // falls back to the chosen muscle
  assert.equal(Object.keys(load).includes('cardio'), false);
  assert.deepEqual([0, 2, 5, 10, 14.9, 15].map(levelOf), [0, 1, 2, 3, 3, 4]);
  assert.equal(dayLoad(days[0], exercises).frontDelt.sets, 4);
});
