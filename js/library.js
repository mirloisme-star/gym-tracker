// Exercise library: Persian name, English name, the app's muscle group, the body-chart regions
// it trains ([primary], [secondary]) and how it's logged. Pure data, no DOM.

const S = 'strength';
const e = (fa, en, muscle, primary, secondary = [], kind = S) => ({ fa, en, muscle, regions: [primary, secondary], kind });

const PUSH = ['frontDelt', 'triceps'];
const PULL = ['biceps', 'rearDelt'];

export const LIBRARY = [
  // Chest
  e('پرس سینه هالتر', 'Barbell Bench Press', 'سینه', ['chest'], PUSH),
  e('پرس سینه دمبل', 'Dumbbell Bench Press', 'سینه', ['chest'], PUSH),
  e('پرس سینه دستگاه', 'Machine Chest Press', 'سینه', ['chest'], PUSH),
  e('پرس سینه اسمیت', 'Smith Machine Bench Press', 'سینه', ['chest'], PUSH),
  e('پرس بالاسینه هالتر', 'Incline Barbell Bench Press', 'سینه', ['chest', 'frontDelt'], ['triceps']),
  e('پرس بالاسینه دمبل', 'Incline Dumbbell Press', 'سینه', ['chest', 'frontDelt'], ['triceps']),
  e('پرس بالاسینه دستگاه', 'Incline Machine Press', 'سینه', ['chest', 'frontDelt'], ['triceps']),
  e('پرس بالاسینه اسمیت', 'Incline Smith Machine Press', 'سینه', ['chest', 'frontDelt'], ['triceps']),
  e('پرس زیرسینه هالتر', 'Decline Barbell Bench Press', 'سینه', ['chest'], ['triceps']),
  e('پرس زیرسینه دمبل', 'Decline Dumbbell Press', 'سینه', ['chest'], ['triceps']),
  e('قفسه سینه دمبل', 'Dumbbell Fly', 'سینه', ['chest'], ['frontDelt']),
  e('قفسه بالاسینه دمبل', 'Incline Dumbbell Fly', 'سینه', ['chest'], ['frontDelt']),
  e('قفسه فلای دستگاه', 'Pec Deck Fly', 'سینه', ['chest'], ['frontDelt']),
  e('کراس اور سیم‌کش', 'Cable Crossover', 'سینه', ['chest'], ['frontDelt']),
  e('کراس اور از پایین', 'Low-to-High Cable Fly', 'سینه', ['chest', 'frontDelt']),
  e('پول اور دمبل', 'Dumbbell Pullover', 'سینه', ['chest', 'lats'], ['triceps']),
  e('شنا سوئدی', 'Push-up', 'سینه', ['chest'], PUSH),
  e('شنا سوئدی شیب‌دار', 'Incline Push-up', 'سینه', ['chest'], PUSH),
  e('شنا سوئدی دست جمع', 'Diamond Push-up', 'سینه', ['chest', 'triceps'], ['frontDelt']),
  e('دیپ سینه', 'Chest Dip', 'سینه', ['chest', 'triceps'], ['frontDelt']),
  e('مولتی پرس سینه', 'Multi-Press Chest Machine', 'سینه', ['chest'], PUSH),

  // Back
  e('بارفیکس', 'Pull-up', 'پشت', ['lats'], ['biceps', 'traps']),
  e('بارفیکس دست برعکس', 'Chin-up', 'پشت', ['lats', 'biceps']),
  e('بارفیکس کمکی', 'Assisted Pull-up', 'پشت', ['lats'], ['biceps', 'traps']),
  e('زیربغل سیم‌کش از جلو', 'Lat Pulldown', 'پشت', ['lats'], ['biceps', 'rearDelt']),
  e('زیربغل سیم‌کش دست جمع', 'Close-Grip Lat Pulldown', 'پشت', ['lats'], ['biceps']),
  e('زیربغل سیم‌کش دست برعکس', 'Reverse-Grip Lat Pulldown', 'پشت', ['lats', 'biceps']),
  e('زیربغل سیم‌کش از پشت', 'Behind-the-Neck Pulldown', 'پشت', ['lats'], ['traps', 'biceps']),
  e('زیربغل هالتر خم', 'Bent-Over Barbell Row', 'پشت', ['lats', 'traps'], ['biceps', 'rearDelt', 'lowerBack']),
  e('زیربغل هالتر دست برعکس', 'Underhand Barbell Row', 'پشت', ['lats'], ['biceps', 'traps']),
  e('زیربغل دمبل تک خم', 'One-Arm Dumbbell Row', 'پشت', ['lats'], ['biceps', 'rearDelt']),
  e('زیربغل تی‌بار', 'T-Bar Row', 'پشت', ['lats', 'traps'], ['biceps', 'rearDelt']),
  e('قایقی سیم‌کش نشسته', 'Seated Cable Row', 'پشت', ['lats', 'traps'], ['biceps', 'rearDelt']),
  e('قایقی دستگاه', 'Machine Row', 'پشت', ['lats', 'traps'], ['biceps']),
  e('زیربغل دستگاه هامر', 'Hammer Strength Row', 'پشت', ['lats', 'traps'], ['biceps']),
  e('پول اور سیم‌کش', 'Straight-Arm Cable Pulldown', 'پشت', ['lats'], ['triceps']),
  e('ددلیفت', 'Deadlift', 'پشت', ['lowerBack', 'glutes', 'hamstrings'], ['traps', 'quads', 'forearm']),
  e('ددلیفت سومو', 'Sumo Deadlift', 'پا', ['glutes', 'quads', 'hamstrings'], ['lowerBack', 'traps']),
  e('رک پول', 'Rack Pull', 'پشت', ['lowerBack', 'traps'], ['glutes', 'forearm']),
  e('فیله کمر دستگاه', 'Back Extension', 'پشت', ['lowerBack'], ['glutes', 'hamstrings']),
  e('سوپرمن', 'Superman', 'پشت', ['lowerBack'], ['glutes']),
  e('گود مورنینگ', 'Good Morning', 'پشت', ['hamstrings', 'lowerBack'], ['glutes']),
  e('شراگ هالتر', 'Barbell Shrug', 'پشت', ['traps'], ['forearm']),
  e('شراگ دمبل', 'Dumbbell Shrug', 'پشت', ['traps'], ['forearm']),
  e('شراگ اسمیت', 'Smith Machine Shrug', 'پشت', ['traps']),

  // Shoulders
  e('سرشانه هالتر از جلو', 'Barbell Overhead Press', 'سرشانه', ['frontDelt', 'sideDelt'], ['triceps', 'traps']),
  e('سرشانه هالتر از پشت', 'Behind-the-Neck Press', 'سرشانه', ['frontDelt', 'sideDelt'], ['triceps', 'traps']),
  e('سرشانه دمبل نشسته', 'Seated Dumbbell Shoulder Press', 'سرشانه', ['frontDelt', 'sideDelt'], ['triceps', 'traps']),
  e('سرشانه دمبل ایستاده', 'Standing Dumbbell Shoulder Press', 'سرشانه', ['frontDelt', 'sideDelt'], ['triceps', 'traps']),
  e('سرشانه دستگاه', 'Machine Shoulder Press', 'سرشانه', ['frontDelt', 'sideDelt'], ['triceps']),
  e('سرشانه اسمیت', 'Smith Machine Shoulder Press', 'سرشانه', ['frontDelt', 'sideDelt'], ['triceps']),
  e('پرس آرنولد', 'Arnold Press', 'سرشانه', ['frontDelt', 'sideDelt'], ['triceps']),
  e('نشر از جانب دمبل', 'Dumbbell Lateral Raise', 'سرشانه', ['sideDelt'], ['traps']),
  e('نشر از جانب سیم‌کش', 'Cable Lateral Raise', 'سرشانه', ['sideDelt'], ['traps']),
  e('نشر از جانب دستگاه', 'Machine Lateral Raise', 'سرشانه', ['sideDelt']),
  e('نشر از جلو دمبل', 'Dumbbell Front Raise', 'سرشانه', ['frontDelt']),
  e('نشر از جلو هالتر', 'Barbell Front Raise', 'سرشانه', ['frontDelt']),
  e('نشر از جلو صفحه', 'Plate Front Raise', 'سرشانه', ['frontDelt']),
  e('نشر خم دمبل', 'Bent-Over Rear Delt Raise', 'سرشانه', ['rearDelt'], ['traps']),
  e('نشر خم دمبل خوابیده', 'Prone Rear Delt Raise', 'سرشانه', ['rearDelt'], ['traps']),
  e('فلای برعکس', 'Reverse Pec Deck', 'سرشانه', ['rearDelt'], ['traps']),
  e('فیس پول', 'Face Pull', 'سرشانه', ['rearDelt', 'traps'], ['biceps']),
  e('کول هالتر', 'Barbell Upright Row', 'سرشانه', ['sideDelt', 'traps'], ['biceps']),
  e('کول دمبل', 'Dumbbell Upright Row', 'سرشانه', ['sideDelt', 'traps'], ['biceps']),
  e('کول سیم‌کش', 'Cable Upright Row', 'سرشانه', ['sideDelt', 'traps'], ['biceps']),

  // Biceps
  e('جلوبازو هالتر', 'Barbell Curl', 'جلوبازو', ['biceps'], ['forearm']),
  e('جلوبازو هالتر EZ', 'EZ-Bar Curl', 'جلوبازو', ['biceps'], ['forearm']),
  e('جلوبازو دمبل ایستاده', 'Standing Dumbbell Curl', 'جلوبازو', ['biceps'], ['forearm']),
  e('جلوبازو دمبل نشسته', 'Seated Dumbbell Curl', 'جلوبازو', ['biceps'], ['forearm']),
  e('جلوبازو دمبل شیب‌دار', 'Incline Dumbbell Curl', 'جلوبازو', ['biceps']),
  e('جلوبازو چکشی', 'Hammer Curl', 'جلوبازو', ['biceps', 'forearm']),
  e('جلوبازو لاری هالتر', 'Preacher Curl', 'جلوبازو', ['biceps']),
  e('جلوبازو لاری دمبل', 'Dumbbell Preacher Curl', 'جلوبازو', ['biceps']),
  e('جلوبازو تمرکزی', 'Concentration Curl', 'جلوبازو', ['biceps']),
  e('جلوبازو سیم‌کش', 'Cable Curl', 'جلوبازو', ['biceps'], ['forearm']),
  e('جلوبازو سیم‌کش طناب', 'Rope Hammer Curl', 'جلوبازو', ['biceps', 'forearm']),
  e('جلوبازو دستگاه نشسته', 'Machine Biceps Curl', 'جلوبازو', ['biceps']),
  e('جلوبازو عنکبوتی', 'Spider Curl', 'جلوبازو', ['biceps']),
  e('جلوبازو دست برعکس', 'Reverse Curl', 'جلوبازو', ['forearm', 'biceps']),
  e('جلوبازو دمبل جفت خوابیده', 'Lying Dumbbell Curl', 'جلوبازو', ['biceps'], ['forearm']),

  // Triceps
  e('پشت بازو سیم‌کش', 'Triceps Pushdown', 'پشت‌بازو', ['triceps']),
  e('پشت بازو سیم‌کش طناب', 'Rope Pushdown', 'پشت‌بازو', ['triceps']),
  e('پشت بازو سیم‌کش دست برعکس', 'Reverse-Grip Pushdown', 'پشت‌بازو', ['triceps']),
  e('پشت بازو طناب تکیه', 'Overhead Rope Extension', 'پشت‌بازو', ['triceps']),
  e('پشت بازو هالتر خوابیده', 'Skull Crusher', 'پشت‌بازو', ['triceps']),
  e('پشت بازو دمبل خوابیده', 'Lying Dumbbell Extension', 'پشت‌بازو', ['triceps']),
  e('پشت بازو دمبل تک دو دستی', 'Overhead Dumbbell Extension', 'پشت‌بازو', ['triceps']),
  e('پشت بازو دمبل تک خم', 'Dumbbell Kickback', 'پشت‌بازو', ['triceps']),
  e('پشت بازو پرس دست جمع', 'Close-Grip Bench Press', 'پشت‌بازو', ['triceps', 'chest'], ['frontDelt']),
  e('دیپ پشت بازو', 'Triceps Dip', 'پشت‌بازو', ['triceps'], ['chest', 'frontDelt']),
  e('دیپ پشت بازو روی نیمکت', 'Bench Dip', 'پشت‌بازو', ['triceps'], ['frontDelt']),
  e('پشت بازو دستگاه', 'Machine Triceps Extension', 'پشت‌بازو', ['triceps']),

  // Forearms
  e('مچ دست هالتر', 'Barbell Wrist Curl', 'ساعد', ['forearm']),
  e('مچ دست برعکس', 'Reverse Wrist Curl', 'ساعد', ['forearm']),
  e('مچ دست دمبل', 'Dumbbell Wrist Curl', 'ساعد', ['forearm']),
  e('پنجه دستگاه', 'Grip Machine', 'ساعد', ['forearm']),
  e('فارمر واک', "Farmer's Walk", 'ساعد', ['forearm', 'traps'], ['abs']),
  e('آویزان شدن از بارفیکس', 'Dead Hang', 'ساعد', ['forearm'], ['lats'], 'sec'),

  // Legs
  e('اسکات هالتر', 'Barbell Back Squat', 'پا', ['quads', 'glutes'], ['hamstrings', 'lowerBack', 'abs']),
  e('اسکات از جلو', 'Front Squat', 'پا', ['quads'], ['glutes', 'abs']),
  e('اسکات اسمیت', 'Smith Machine Squat', 'پا', ['quads', 'glutes'], ['hamstrings']),
  e('اسکات هاک', 'Hack Squat', 'پا', ['quads'], ['glutes']),
  e('اسکات گابلت دمبل', 'Goblet Squat', 'پا', ['quads', 'glutes'], ['hamstrings', 'abs']),
  e('اسکات بلغاری', 'Bulgarian Split Squat', 'پا', ['quads', 'glutes'], ['hamstrings']),
  e('اسکات سومو', 'Sumo Squat', 'پا', ['glutes', 'quads'], ['hamstrings']),
  e('اسکات بدون وزنه', 'Bodyweight Squat', 'پا', ['quads', 'glutes']),
  e('پرس پا خوابیده', 'Leg Press', 'پا', ['quads', 'glutes'], ['hamstrings']),
  e('پرس پا ۴۵ درجه', '45° Leg Press', 'پا', ['quads', 'glutes'], ['hamstrings']),
  e('جلو پا با ماشین', 'Leg Extension', 'پا', ['quads']),
  e('پشت پا خوابیده', 'Lying Leg Curl', 'پا', ['hamstrings']),
  e('پشت پا نشسته', 'Seated Leg Curl', 'پا', ['hamstrings']),
  e('پشت پا ایستاده', 'Standing Leg Curl', 'پا', ['hamstrings']),
  e('ددلیفت رومانیایی هالتر', 'Romanian Deadlift', 'پا', ['hamstrings', 'glutes'], ['lowerBack', 'forearm']),
  e('ددلیفت رومانیایی دمبل', 'Dumbbell Romanian Deadlift', 'پا', ['hamstrings', 'glutes'], ['lowerBack', 'forearm']),
  e('ددلیفت پا صاف', 'Stiff-Leg Deadlift', 'پا', ['hamstrings', 'glutes'], ['lowerBack']),
  e('لانج دمبل', 'Dumbbell Lunge', 'پا', ['quads', 'glutes'], ['hamstrings']),
  e('لانج هالتر', 'Barbell Lunge', 'پا', ['quads', 'glutes'], ['hamstrings']),
  e('لانج راه‌رفتنی', 'Walking Lunge', 'پا', ['quads', 'glutes'], ['hamstrings']),
  e('لانج معکوس', 'Reverse Lunge', 'پا', ['glutes', 'quads'], ['hamstrings']),
  e('استپ آپ', 'Step-up', 'پا', ['quads', 'glutes']),
  e('هیپ تراست هالتر', 'Barbell Hip Thrust', 'پا', ['glutes'], ['hamstrings']),
  e('پل باسن', 'Glute Bridge', 'پا', ['glutes'], ['hamstrings']),
  e('کیک بک باسن سیم‌کش', 'Cable Glute Kickback', 'پا', ['glutes']),
  e('کیک بک باسن دستگاه', 'Glute Kickback Machine', 'پا', ['glutes']),
  e('ابداکشن دستگاه', 'Hip Abduction Machine', 'پا', ['glutes']),
  e('اداکشن دستگاه', 'Hip Adduction Machine', 'پا', ['quads']),
  e('سیسی اسکات', 'Sissy Squat', 'پا', ['quads']),

  // Calves
  e('ساق ایستاده دستگاه', 'Standing Calf Raise', 'ساق', ['calves']),
  e('ساق نشسته دستگاه', 'Seated Calf Raise', 'ساق', ['calves']),
  e('ساق پا پرس پا', 'Leg Press Calf Raise', 'ساق', ['calves']),
  e('ساق اسمیت', 'Smith Machine Calf Raise', 'ساق', ['calves']),
  e('ساق تک پا دمبل', 'Single-Leg Dumbbell Calf Raise', 'ساق', ['calves']),
  e('ساق خر', 'Donkey Calf Raise', 'ساق', ['calves']),

  // Core
  e('کرانچ', 'Crunch', 'شکم', ['abs']),
  e('کرانچ سیم‌کش', 'Cable Crunch', 'شکم', ['abs']),
  e('کرانچ دستگاه', 'Machine Crunch', 'شکم', ['abs']),
  e('کرانچ معکوس', 'Reverse Crunch', 'شکم', ['abs']),
  e('کرانچ دوچرخه', 'Bicycle Crunch', 'شکم', ['abs', 'obliques']),
  e('دراز و نشست', 'Sit-up', 'شکم', ['abs']),
  e('زیر شکم خلبانی', 'Hanging Leg Raise', 'شکم', ['abs'], ['obliques', 'forearm']),
  e('زیر شکم زانو آویزان', 'Hanging Knee Raise', 'شکم', ['abs'], ['forearm']),
  e('زیر شکم خوابیده', 'Lying Leg Raise', 'شکم', ['abs']),
  e('زیر شکم دراگون', 'Dragon Flag', 'شکم', ['abs'], ['obliques']),
  e('زیر شکم دستگاه', "Captain's Chair Leg Raise", 'شکم', ['abs']),
  e('پلانک', 'Plank', 'شکم', ['abs'], ['obliques'], 'sec'),
  e('پلانک پهلو', 'Side Plank', 'شکم', ['obliques'], ['abs'], 'sec'),
  e('چرخش روسی', 'Russian Twist', 'شکم', ['obliques', 'abs']),
  e('پهلو دمبل', 'Dumbbell Side Bend', 'شکم', ['obliques']),
  e('چرخش سیم‌کش', 'Cable Woodchopper', 'شکم', ['obliques'], ['abs']),
  e('چرخ شکم', 'Ab Wheel Rollout', 'شکم', ['abs'], ['lats']),
  e('مانتین کلایمبر', 'Mountain Climber', 'شکم', ['abs'], ['quads'], 'sec'),
  e('دد باگ', 'Dead Bug', 'شکم', ['abs']),
  e('هالو هولد', 'Hollow Body Hold', 'شکم', ['abs'], [], 'sec'),

  // Full body and conditioning
  e('کلین هالتر', 'Power Clean', 'سایر', ['glutes', 'hamstrings', 'traps'], ['quads', 'lowerBack', 'frontDelt']),
  e('اسنچ هالتر', 'Snatch', 'سایر', ['glutes', 'hamstrings', 'traps'], ['quads', 'sideDelt']),
  e('تراستر', 'Thruster', 'سایر', ['quads', 'frontDelt'], ['glutes', 'triceps']),
  e('کتل‌بل سوئینگ', 'Kettlebell Swing', 'سایر', ['glutes', 'hamstrings'], ['lowerBack', 'frontDelt']),
  e('برپی', 'Burpee', 'سایر', ['quads', 'chest'], ['abs', 'frontDelt']),
  e('طناب نبرد', 'Battle Ropes', 'کاردیو', ['frontDelt'], ['abs'], 'sec'),

  // Cardio
  e('تردمیل', 'Treadmill', 'کاردیو', [], [], 'cardio'),
  e('تردمیل شیب‌دار', 'Incline Treadmill Walk', 'کاردیو', [], ['calves', 'glutes'], 'cardio'),
  e('دوچرخه ثابت', 'Stationary Bike', 'کاردیو', [], ['quads'], 'cardio'),
  e('الپتیکال', 'Elliptical', 'کاردیو', [], [], 'cardio'),
  e('دستگاه پارویی', 'Rowing Machine', 'کاردیو', [], ['lats'], 'cardio'),
  e('پله نوردی', 'Stair Climber', 'کاردیو', [], ['glutes', 'calves'], 'cardio'),
  e('طناب‌زنی', 'Jump Rope', 'کاردیو', [], ['calves'], 'min'),
  e('پیاده‌روی', 'Walking', 'کاردیو', [], [], 'min'),
  e('دویدن', 'Running', 'کاردیو', [], ['calves'], 'min'),
  e('شنا', 'Swimming', 'کاردیو', [], ['lats'], 'min'),
  e('جامپینگ جک', 'Jumping Jacks', 'کاردیو', [], ['calves'], 'sec'),

  // Mobility
  e('حرکات اصلاحی کششی', 'Corrective Stretching', 'اصلاحی', [], [], 'sec'),
  e('کشش همسترینگ', 'Hamstring Stretch', 'اصلاحی', [], [], 'sec'),
  e('کشش چهارسر ران', 'Quad Stretch', 'اصلاحی', [], [], 'sec'),
  e('کشش سینه', 'Chest Stretch', 'اصلاحی', [], [], 'sec'),
  e('کشش سرشانه', 'Shoulder Stretch', 'اصلاحی', [], [], 'sec'),
  e('کشش کمر', 'Lower Back Stretch', 'اصلاحی', [], [], 'sec'),
  e('کشش فلکسور ران', 'Hip Flexor Stretch', 'اصلاحی', [], [], 'sec'),
  e('حرکت گربه و شتر', 'Cat-Cow', 'اصلاحی', [], [], 'sec'),
  e('فوم رولر', 'Foam Rolling', 'اصلاحی', [], [], 'min'),
  e('یوگا', 'Yoga', 'اصلاحی', [], [], 'min'),
  e('گرم کردن', 'Warm-up', 'اصلاحی', [], [], 'min'),
];

// Spelling differences that would otherwise hide a match: Arabic ی/ك, half-spaces, dashes.
export const normalize = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[‌‏‎]/g, ' ')
    .replace(/[-–_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const BY_FA = new Map(LIBRARY.map((x) => [normalize(x.fa), x]));
export const libraryEntry = (name) => BY_FA.get(normalize(name)) || null;

// Every query word has to appear in the Persian or the English name.
export function searchLibrary(query, list = LIBRARY) {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return list;
  return list.filter((x) => {
    const hay = `${normalize(x.fa)} ${normalize(x.en)}`;
    return words.every((w) => hay.includes(w));
  });
}
