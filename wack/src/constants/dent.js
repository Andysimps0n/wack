// Tunables for drag-to-squish (tangent-plane mesh deformation).

// World-space depth gained per screen pixel of drag-away from the click.
// Larger = plane digs in faster as you drag.
export const SQUISH_DEPTH_SCALE = 0.004;

// Fall-resistance: how far (world units) the squish plane must push PAST
// the nearest point on a wax slice before that chip actually falls.
// Larger = wax holds on longer / needs a deeper squish.
export const SQUISH_WAX_BREAK_DEPTH = 0.12;

// Only wax within this world distance of the press point can fall.
// Prevents the infinite tangent plane from knocking off far-side chips.
export const SQUISH_WAX_RADIUS = 0.55;

// How fast the fruit eases back to rest after release (higher = snappier).
// Used as: alpha = 1 - exp(-rate * dt).
export const SQUISH_RECOVER_RATE = 3.5;

// Stop the recovery loop once every vertex is this close to rest.
export const SQUISH_RECOVER_EPS = 1e-4;
