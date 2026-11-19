# Progress

A personal gym tracker for one user, used on an Android phone at the gym. It is an offline web app (PWA) with no backend, and all data stays on the phone.

- **Live app:** https://mirloisme-star.github.io/gym-tracker/
- **Repository:** https://github.com/mirloisme-star/gym-tracker (branch `main`, deployed through GitHub Pages)
- **Current version:** service worker `gym-v4`, commit `beb47d9` (2026-11-14)

## Timeline

| Date | Commit | What changed |
|---|---|---|
| 2026-11-05 | `00be408` | First version: the program, set logging, the daily log, the dashboard, backup and offline mode. |
| 2026-11-05 | `1ace103` | Added the training history, a redesigned stats section and a first 3D muscle map. |
| 2026-11-14 | `beb47d9` | Full-screen rest timer. The 3D body was replaced by a 2D front and back muscle map. |

## What works

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
- **Journey card:** adherence, the day count since the start, and a timeline of the home phase and the gym phase.
- **Overview:** sessions per week, total volume, records, a weekly chart and an attendance heatmap.
- **Body:** the front and back muscle map in three modes (program per week, today, logged). Each muscle is coloured by sets per week, and tapping one shows its sets and exercises.
- **Exercises:** an estimated one-rep max (Epley formula) and the trend for each exercise.
- **Habits:** compares sessions on days with and without a habit, for example coffee. A habit needs at least 4 sessions in each group.

### Program tab
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
- Tests: `npm test` (18 tests, all passing).
- **Muscle artwork:** from `react-native-body-highlighter` (MIT License, © 2022 ELABBASSI Hicham). `js/body-paths.js` is built with `node tools/build-body-paths.cjs <package folder>`.
  - The artwork has one deltoid per view. `js/body-svg.js` cuts it into the side head and the front or rear head.
  - The infraspinatus counts as rear delt.

## Open items

- **Not tested on a real phone:** beep volume, vibration and the screen wake lock. The beep follows the phone's media volume.
- **Home-phase length not confirmed:** the user first said 31 days, but the dates give 37. The app shows 37.
- **Possible 3D view:** the user asked about a 3D model. The Merck Manuals model can't be used because of copyright. Z-Anatomy or BodyParts3D (open licenses) could work, at roughly 2–5 MB after trimming. Nothing has been decided.
