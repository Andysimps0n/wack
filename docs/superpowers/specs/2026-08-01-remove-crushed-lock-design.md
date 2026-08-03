# Remove crushed-phase lock

## Goal

When scroll compression reaches `BREAK_THRESHOLD`, the apple must not permanently lock flat. Squash stays driven by scroll so scrolling up restores height.

## Behavior

- Scroll down → squash (unchanged mapping via `BREAK_THRESHOLD`).
- At / past `BREAK_THRESHOLD` → stay at max squash; no phase change, no lock.
- Scroll up → squash follows scroll; at `0` → `"intact"`.
- Wax chips still break on the crush line and do not heal.

## Changes

- `Apple.jsx`: remove `"crushed"` early-return, threshold lock branch, and unused `applyCrushedShape`.
- `crush.js`: comment update — threshold means “fully flat by this progress,” not “lock forever.”

## Out of scope

- Remapping squash across full scroll `0–1`.
- Wax break / heal behavior.
