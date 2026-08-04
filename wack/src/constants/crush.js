// Tunables for the apple crush (smash-button driven).

// Crush audio — progress is driven from the playhead while smashing.
export const CRUSH_SOUND_URL = "/crush.mp3";
// Fallback if metadata has not loaded yet (~actual file length).
export const CRUSH_SOUND_DURATION_SEC = 1.54;
export const CRUSH_VOLUME = 1;

// Cleanup whoosh — played when debris is blown away.
export const WHOOSH_SOUND_URL = "/whoosh.mp3";
export const WHOOSH_VOLUME = 1;

// How far crushProgress (0–1) must go before the apple reaches full squash.
export const BREAK_THRESHOLD = 0.525;

// Y scale of the apple at full squash. Equal to 1 - BREAK_THRESHOLD so the
// visual squash matches the crush-line compression at that progress.
export const MIN_SQUASH_Y = 1 - BREAK_THRESHOLD;

// How much the apple bulges outward on X/Z at full squeeze.
export const MAX_BULGE_XZ = 1;

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

// --- Post-smash cleanup (whoosh → clear → drop a fresh apple) ---

// Pause on the crushed apple before blowing debris away.
export const CLEANUP_HOLD_SEC = 1;

// Upward speed (m/s) applied to apple + chips when the whoosh starts.
export const WHOOSH_SPEED_Y = 22;

// Extra random sideways speed so the whoosh doesn't look identical every time.
export const WHOOSH_SCATTER_XZ = 3;

// World Y above which debris counts as "off screen" and can be removed.
// Keep this just above the camera so we remount the next apple immediately
// instead of waiting for debris to climb far off-screen.
export const WHOOSH_CLEAR_Y = 10;

// Safety: force-clear if debris somehow never reaches WHOOSH_CLEAR_Y.
export const WHOOSH_CLEAR_TIMEOUT_SEC = 0.45;

// How high above the rest position the fresh apple spawns.
export const RESPAWN_HEIGHT_OFFSET = 12;

// Seconds for the scripted drop from spawn height down to rest position.
export const RESPAWN_DROP_SEC = 0.85;
