# Smash button (playhead-driven crush)

## Goal

Replace scroll-driven apple crushing with a **Smash** button. Clicking it plays `crush.mp3` and compresses the apple over exactly the sound’s duration by driving progress from the audio playhead.

## Behavior

- Apple theme only: show a **Smash** button.
- On click (only from `idle`):
  - Play `/crush.mp3`.
  - Each animation frame: `crushProgress = currentTime / duration` (clamped 0–1).
  - Pass `crushProgress` into `Apple` (same squash / wax logic as before).
- While `smashing` or after `done`: button is disabled (visual + no-op).
- After finish: apple stays fully crushed until page reload (no reset).
- Tall `300vh` page remains, but scroll no longer feeds apple compression.
- Butter theme unchanged.

## Architecture

| Piece | Role |
| --- | --- |
| `hooks/useSmashCrush.js` | Owns `Audio`, state (`idle` / `smashing` / `done`), rAF playhead → `crushProgress` |
| `components/SmashButton.jsx` | Label “smash”; `disabled` when status ≠ `idle`; calls `onSmash` |
| `App.jsx` | Apple theme: hook + button; pass `crushProgress` to `Wack` (not scroll) |
| `Wack.jsx` | Accept `crushProgress`; pass through to `Apple` (drop `/ 0.7` scroll remap) |
| `Apple.jsx` | Rename prop `scrollProgress` → `crushProgress` (logic unchanged) |
| `constants/crush.js` | `CRUSH_SOUND_URL`, `CRUSH_SOUND_DURATION_SEC` fallback, `CRUSH_VOLUME` |

**Data flow:** click → `audio.play()` → rAF reads playhead → `crushProgress` → `Apple` → on ended / progress ≥ 1 → `done`.

## Error handling

- If `audio.duration` not finite yet, use `CRUSH_SOUND_DURATION_SEC` (~1.54) until metadata loads.
- If `play()` rejects, remain `idle` and re-enable the button.
- Cleanup: pause audio, cancel rAF on unmount.

## Out of scope

- Reset / replay after smash
- Butter smash
- Deleting unused scroll-sound / fixed-wheel hooks
- Changing wax / squash constants (`BREAK_THRESHOLD`, etc.)
- Restyling the whole UI beyond a button consistent with the theme switcher
