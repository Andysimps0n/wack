# Fixed wheel scroll speed

## Goal

Make apple crush scrolling feel the same on every device by ignoring native wheel delta magnitude and advancing the page by a fixed pixel step per wheel event.

## Behavior

- On `wheel`: `preventDefault`, then scroll by `sign(deltaY) * PIXELS_PER_TICK`.
- Ignore events where `deltaY === 0` (horizontal gestures).
- Native scroll at document ends still no-ops via `scrollBy`.
- Touch drag, keyboard, and scrollbar dragging stay native (out of scope).
- Active only for the apple theme (butter has no scroll story).

## Architecture

| Piece | Role |
| --- | --- |
| `hooks/useFixedWheelScroll.js` | Experimental one-file hook: wheel hijack + tunable constant |
| `App.jsx` | Call the hook when `theme === 'apple'` |

`useScrollProgress` is unchanged — it still reads normalized `scrollY`.

Tunable at top of the hook file:

```js
const PIXELS_PER_TICK = 40 // start value; raise = faster crush
```

## Error handling

- Listener uses `{ passive: false }` so `preventDefault` works.
- Remove listener on unmount.

## Out of scope

- Time-based velocity / smoothing
- Touch / keyboard / scrollbar normalization
- Butter theme scroll
- Changing `300vh`, `0.7` remap, or crush constants

## Success criteria

1. Mouse wheel and trackpad both advance crush by a consistent step feel (tunable via one constant).
2. Scroll up rewinds; scroll down advances.
3. Hook is disposable: delete the file + one App call to revert.
