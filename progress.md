# Progress

A personal gym tracker for one user, used on an Android phone at the gym. It is an offline web app (PWA) with no backend, and all data stays on the phone.

- **Live app:** https://mirloisme-star.github.io/gym-tracker/
- **Repository:** https://github.com/mirloisme-star/gym-tracker (branch `main`, deployed through GitHub Pages)
- **Current version:** service worker `gym-v6` (not yet published)

## Timeline

| Date | Commit | What changed |
|---|---|---|
| 2026-11-05 | `00be408` | First version: the program, set logging, the daily log, the dashboard, backup and offline mode. |
| 2026-11-05 | `1ace103` | Added the training history, a redesigned stats section and a first 3D muscle map. |
| 2026-11-14 | `beb47d9` | Full-screen rest timer. The 3D body was replaced by a 2D front and back muscle map. |
| 2026-11-19 | (pending) | Sporty redesign, home screen, onboarding for new users with 4 program templates, daily AI coach (GapGPT, user's own key), finish-workout screen, post-workout photos, new app icon and welcome photo. |

## What works

### Home tab (new)
- Greeting, the AI coach's daily message, a weekly goal ring with week streak, a 7-day strip, today's workout card with an estimated duration, and recent records.

### First run (new)
- New users go through onboarding: name, goal, level, a program template (full body 3-day, upper/lower 4-day, push/pull/legs, the owner's 3-day split, or empty) and a weekly goal. A backup can be restored from the welcome screen.

### AI coach (new)
- Works for everyone without a key: the app calls the owner's Cloudflare Worker `https://gym-coach.mirloisme.workers.dev/coach` (code in `worker/`), which holds the owner's GapGPT key as a secret (`wrangler secret put GAPGPT_KEY`) and picks a model from the key's list (currently `claude-opus-5-5`). Limits: allowed origins only, facts capped at 8000 characters, 8 messages per IP per day, 300 per day in total (KV namespace `LIMITS`). A user can still enter their own GapGPT key in settings to use it directly. Once a day a summary of the last 14 days (sessions, records, trends, habits) is sent and the model writes 2–4 Persian sentences. The key stays on the phone, never in backups or in the public code.

### Finish workout and photos (new)
- "پایان تمرین" shows sets, volume, minutes, records and the muscles worked, and offers a selfie. The photo downloads to the gallery and a small copy is kept for before/after comparison in the stats tab.

### Workout tab
- Shows the user's three-day program, loaded from their paper plan in `js/seed.js`.
- Suggests today's day from the 3-on, 1-off cycle.
- Each set takes a weight and reps, or only a duration for timed exercises (plank, stretching, treadmill).
- New fields are pre-filled with last time's numbers. In a pyramid, the matching set from last time is used.
- Shows a toast when a set beats the previous best.

### Rest timer
- Starts when a set is ticked and fills the screen with large digits, so it can be read from a distance with the phone in a holder.
- Shows the next set under the digits, for example "Set 2 of 3, seated leg curl".
- Turns amber in the last 10 seconds, with short beeps in the last 3.
- When rest ends, the screen flashes green with «برو!» ("Go!"). The beep and vibration repeat every 2 seconds until the screen is tapped, for at most 30 seconds.
- Has buttons for −15 s, +15 s, skip and minimize.
- Sound is switched on during the set tap, because Android only plays sound that starts from a tap. The screen stays awake during rest.

### Daily tab
- Logs gym attendance, supplements, coffee, sleep, body weight, energy and nutrition, plus a free note.

### Stats tab
- **Weight (new):** a log-today input, current/change/min/max tiles, and a chart of every entry with a 7-day moving average (`js/facts.js`). Home shows a weight card with a sparkline.
- **Facts from your data (new, replaces troubleshooting):** built from the user's own logs in `js/facts.js`: weight change and sudden swings, volume vs the previous 7 days, heaviest lift, records this month vs last, record jumps of 10%+, sudden drops, best vs worst progressing exercise over 60 days, stalled lifts, sessions and habits (sleep, coffee, supplements…) vs the previous 7 days. Filterable by topic.
- **Journey card:** adherence, the day count since the start, and a timeline of the home phase and the gym phase.
- **Overview:** sessions per week, total volume, records, a weekly chart and an attendance heatmap.
- **Body:** the front and back muscle map in three modes (program per week, today, logged). Each muscle is coloured by sets per week, and tapping one shows its sets and exercises.
- **Exercises:** an estimated one-rep max (Epley formula) and the trend for each exercise.
- **Habits:** compares sessions on days with and without a habit, for example coffee. A habit needs at least 4 sessions in each group.

### Program tab
- **Exercise library (new):** 181 exercises in `js/library.js`, each with a Persian and English name, muscle group, body-chart regions and log type. The picker (`js/picker.js`) searches both languages (tolerant of Arabic ی/ک and half-spaces), filters by muscle, adds several at once, and still allows a custom exercise. Timed and cardio picks get matching default targets. English names show under exercise names.
- Edit days and exercises, including name, muscle, type, sets, reps (`12`, `8-12` or `8,10,12`), rest and treadmill speed.

### Settings
- Backup to a file, share it, and restore from it. Broken or unrelated files are rejected.
- Install the app, choose trackers, set the default rest and rest days, and pick a light or dark theme.

## Training history (built in)

- **Home training:** from 20 Shahrivar (2026-09-11), daily stretching, mobility and cardio.
- **Gym:** from 26 Mehr (2026-10-18), three days on and one day off, with 2 missed sessions by early Aban.
- **Cycle anchor:** the cycle starts on 2026-10-19, so that 14 Aban (2026-11-05) is day two, as the user reported.
- These values live in `settings.journey` and `settings.cycle.start` in `js/store.js`. They always come from the code, not from saved data.

## Technical notes

- Vanilla JavaScript with ES modules and no build step. Data is stored in IndexedDB.
- The interface is right-to-left Persian. It uses the Vazirmatn font with Persian digits and the Persian calendar.
- After any change, bump `VERSION` in `sw.js`, and add new files to its `FILES` list.
- Tests: `npm test` (22 tests, all passing).
- **Muscle artwork:** from `react-native-body-highlighter` (MIT License, © 2022 ELABBASSI Hicham). `js/body-paths.js` is built with `node tools/build-body-paths.cjs <package folder>`.
  - The artwork has one deltoid per view. `js/body-svg.js` cuts it into the side head and the front or rear head.
  - The infraspinatus counts as rear delt.

## Open items

- **AI coach:** tested live through the worker on 2026-11-19, from the app on localhost. Not yet tested from inside Iran: workers.dev may be filtered there; a custom domain would fix that.
- **Photo download on a real phone:** verify that the picture appears in the gallery.

- **Not tested on a real phone:** beep volume, vibration and the screen wake lock. The beep follows the phone's media volume.
- **Home-phase length not confirmed:** the user first said 31 days, but the dates give 37. The app shows 37.
- **Possible 3D view:** the user asked about a 3D model. The Merck Manuals model can't be used because of copyright. Z-Anatomy or BodyParts3D (open licenses) could work, at roughly 2–5 MB after trimming. Nothing has been decided.
