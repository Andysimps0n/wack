// Tunables for the resistance-based apple crush.

// How much of the apple's height the plate must push through before the
// apple shatters (0 = breaks on touch, 1 = breaks only when fully flat).
export const BREAK_THRESHOLD = 0.625;

// Y scale of the apple at the moment it breaks. Keeping this equal to
// 1 - BREAK_THRESHOLD makes the apple's top follow the plate's bottom
// exactly, so the plate never clips through the apple.
export const MIN_SQUASH_Y = 1 - BREAK_THRESHOLD;

// How much the apple bulges outward on X/Z at full squeeze.
export const MAX_BULGE_XZ = 1.2;

// --- Wax breaking (contact-based, independent of BREAK_THRESHOLD) ---

// Meshes in apple_c1.glb whose name starts with this are wax chips.
export const WAX_SLICE_PREFIX = "AppleWax_";

// A chip snaps off when the plate's bottom gets within this world-space
// distance of the chip's rest-position top (slightly early, so the plate
// never visibly overlaps unbroken wax).
export const WAX_CONTACT_EPS = 0.02;

// Outward speed (m/s) given to a chip the moment it snaps off.
// Keep this modest so heavier chips don't fly like paper.
export const WAX_CHIP_IMPULSE = 5;

// Rapier mass for a detached wax chip. Higher = settles faster, less floaty.
export const WAX_CHIP_MASS = 10 * 1000;

// Extra uniform scale applied when a chip snaps off. The mesh already has
// Solidify thickness; this just reads a bit chunkier in flight.
export const WAX_CHIP_SCALE = 1 ;
