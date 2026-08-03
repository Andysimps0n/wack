// Tunables for the scroll-driven apple crush.

// How far scrollProgress (0–1) must go before the apple reaches full
// squash. Past this, squash stays at the max until the user scrolls back
// up (no permanent lock — resilience always follows scroll).
export const BREAK_THRESHOLD = 0.525;

// Y scale of the apple at full squash. Keeping this equal to
// 1 - BREAK_THRESHOLD means at that scroll amount the squash matches the
// scroll-driven compression (no leftover "uncrushed" height).
export const MIN_SQUASH_Y = 1 - BREAK_THRESHOLD;

// How much the apple bulges outward on X/Z at full squeeze.
export const MAX_BULGE_XZ = 1.2;

// --- Wax breaking (crush-line based, independent of BREAK_THRESHOLD) ---

// Meshes in apple_c1.glb whose name starts with this are wax chips.
export const WAX_SLICE_PREFIX = "AppleWax_";

// A chip snaps off when the virtual crush line gets within this world-space
// distance of the chip's rest-position top (slightly early, so unbroken wax
// never sits below the crush line).
export const WAX_CONTACT_EPS = 0.02;

// Outward speed (m/s) given to a chip the moment it snaps off.
// Keep this modest so heavier chips don't fly like paper.
export const WAX_CHIP_IMPULSE = 0;

// Debris-scale mass so chips settle on the crushed apple instead of tunneling
// through it (the old 100000 value ignored body contacts).
export const WAX_CHIP_MASS = 2;

// Extra uniform scale applied when a chip snaps off. The mesh already has
// Solidify thickness; this just reads a bit chunkier in flight.
export const WAX_CHIP_SCALE = 1;

// World-space nudge along the chip's outward direction at spawn so the
// convex hull starts slightly clear of the apple body (avoids a pop).
export const WAX_CHIP_SPAWN_OFFSET = 0.04;

// Frames before a new chip is allowed to collide with the apple body.
// During this window it still hits the floor (group 0).
export const WAX_CHIP_COLLISION_DELAY_FRAMES = 3;
