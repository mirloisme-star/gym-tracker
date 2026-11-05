// The owner's program, loaded once on first run. After that it's edited inside the app.
import { findOrCreateExercise, saveMeta, state } from './store.js';
import { uid } from './util.js';

const REST = 90;
const lift = (name, muscle, sets, reps, extra = {}) => ({ name, muscle, kind: 'strength', sets, repsMin: reps, repsMax: reps, rest: REST, ...extra });
const stretch = () => ({ name: 'حرکات اصلاحی کششی', muscle: 'اصلاحی', kind: 'sec', sets: 3, repsMin: 30, repsMax: 30, rest: 0 });
const treadmill = () => ({ name: 'تردمیل', muscle: 'کاردیو', kind: 'cardio', sets: 1, repsMin: 12, repsMax: 12, rest: 0, targetWeight: 4.5 });

const PROGRAM = [
  ['روز اول', [
    lift('نشر خم دمبل خوابیده', 'سرشانه', 3, 12),
    lift('سرشانه دمبل جفت پرس', 'سرشانه', 3, 12, { repsMin: 8, repScheme: [8, 10, 12], note: 'وزن به ترتیب از بیشترین به کمترین' }),
    lift('فلای برعکس', 'سرشانه', 3, 12),
    lift('جلوبازو دمبل جفت خوابیده', 'جلوبازو', 3, 10),
    lift('جلوبازو دستگاه نشسته', 'جلوبازو', 3, 12),
    lift('پنجه دستگاه', 'ساعد', 3, 12),
    lift('زیر شکم دراگون', 'شکم', 3, 15),
    stretch(),
    treadmill(),
  ]],
  ['روز دوم', [
    lift('پشت پا نشسته', 'پا', 3, 12),
    lift('جلو پا با ماشین', 'پا', 3, 12),
    lift('پرس پا خوابیده', 'پا', 3, 8),
    lift('پشت بازو طناب تکیه', 'پشت‌بازو', 3, 12),
    lift('پشت بازو دمبل تک دو دستی', 'پشت‌بازو', 3, 12),
    lift('ساق ایستاده دستگاه', 'ساق', 3, 12),
    { name: 'پلانک', muscle: 'شکم', kind: 'sec', sets: 3, repsMin: null, repsMax: null, rest: 60, note: 'در حد توان' },
    stretch(),
  ]],
  ['روز سوم', [
    lift('مولتی بالا دستگاه نشسته', 'سینه', 3, 12),
    lift('قفسه فلای دستگاه', 'سینه', 3, 12),
    lift('بارفیکس کمکی', 'پشت', 3, 12),
    lift('زیربغل دوبل جمع از بالا', 'پشت', 3, 12),
    lift('H جفت نشسته', 'پشت', 3, 12),
    lift('پول آور ارنج صاف دمبل', 'پشت', 3, 12),
    lift('زیر شکم دراگون', 'شکم', 3, 12),
    stretch(),
    treadmill(),
  ]],
];

export function seedProgram() {
  if (state.settings.seeded || state.days.length) return;
  state.days = PROGRAM.map(([name, rows]) => ({
    id: uid(),
    name,
    weekdays: [],
    items: rows.map(({ name: exName, muscle, kind, ...item }) => ({
      exerciseId: findOrCreateExercise(exName, muscle, kind).id,
      note: '',
      ...item,
    })),
  }));
  state.settings.seeded = true;
  saveMeta('days');
  saveMeta('exercises');
  saveMeta('settings');
}
