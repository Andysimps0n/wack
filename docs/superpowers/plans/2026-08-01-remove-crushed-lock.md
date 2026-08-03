# Remove Crushed Lock Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the permanent crushed lock so the apple can un-squash when scroll goes back up.

**Architecture:** Delete the `"crushed"` phase path in `Apple.jsx`. Keep scroll-driven squash with `BREAK_THRESHOLD` only as the “fully flat” amount.

**Tech Stack:** React, R3F, Rapier

## Global Constraints

- Wax chips stay detached (no heal).
- Do not remap squash across full scroll `0–1`.

---

### Task 1: Remove crushed lock from Apple

**Files:**
- Modify: `wack/src/components/Apple.jsx`
- Modify: `wack/src/constants/crush.js`

- [x] Remove `applyCrushedShape`
- [x] Remove early return for `phase === "crushed"`
- [x] Remove `compression >= BREAK_THRESHOLD` lock branch
- [x] Update `BREAK_THRESHOLD` / `MIN_SQUASH_Y` comments
- [ ] Manual test: scroll past threshold, scroll back up — apple rises
