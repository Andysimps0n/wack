import { Box3, Vector3 } from "three";

// Pure helpers for the contact-local wax break. Everything here works in
// the apple's rest space (the GLB's own coordinates, before APPLE_SCALE
// and before any squash), so Apple.jsx owns all world-space conversion.

// Walk the loaded apple scene and build one record per wax chip mesh.
// Records are sorted top-to-bottom so the first entries are the first
// chips the plate can reach.
export function collectWaxSlices(root, prefix) {
  const slices = [];
  const box = new Box3();
  const center = new Vector3();

  root.traverse((child) => {
    if (!child.isMesh || !child.name.startsWith(prefix)) return;

    box.setFromObject(child);
    box.getCenter(center);

    // Horizontal direction from the apple's axis to the chip's center,
    // used to "pop" the chip away from the apple when it snaps off.
    const outward = new Vector3(center.x, 0, center.z);
    if (outward.lengthSq() < 1e-6) {
      outward.set(0, 1, 0);
    } else {
      outward.normalize();
    }

    slices.push({
      id: child.name,
      object: child,
      localMinY: box.min.y,
      localMaxY: box.max.y,
      outward,
      detached: false,
    });
  });

  slices.sort((a, b) => b.localMaxY - a.localMaxY);
  return slices;
}

// Where the chip's top sits in world space when the apple is NOT squashed.
// Wax is brittle: it visually squashes with the apple underneath it, but it
// breaks once the plate crushes past its original (rest) height.
export function sliceRestTopY(slice, appleBaseY, appleScale) {
  return appleBaseY + slice.localMaxY * appleScale;
}
