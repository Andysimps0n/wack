// Tunables for the resistance-based apple crush.

// How much of the apple's height the plate must push through before the
// apple shatters (0 = breaks on touch, 1 = breaks only when fully flat).
export const BREAK_THRESHOLD = 0.45;

// Y scale of the apple at the moment it breaks. Keeping this equal to
// 1 - BREAK_THRESHOLD makes the apple's top follow the plate's bottom
// exactly, so the plate never clips through the apple.
export const MIN_SQUASH_Y = 1 - BREAK_THRESHOLD;

// How much the apple bulges outward on X/Z at full squeeze.
export const MAX_BULGE_XZ = 1.2;
