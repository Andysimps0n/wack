import { Box3, Group, Vector3 } from "three";
import { WAX_SLICE_PREFIX } from "../constants/crush";

export function isWaxMesh(child, prefix = WAX_SLICE_PREFIX) {
  if (!child?.isMesh) return false;
  const materialName = child.material?.name ?? "";
  return child.name.startsWith(prefix) || materialName === "AppleWaxMat";
}

// Pull wax meshes into a sibling group so the apple body can get its own
// MeshCollider without wrapping the wax shell (which would overlap chips).
export function splitWaxFromApple(root, prefix = WAX_SLICE_PREFIX) {
  const waxGroup = new Group();
  waxGroup.name = "WaxCoat";

  const toMove = [];
  root.traverse((child) => {
    if (isWaxMesh(child, prefix)) toMove.push(child);
  });

  // attach() keeps each mesh's world transform while reparenting.
  root.add(waxGroup);
  for (const mesh of toMove) {
    waxGroup.attach(mesh);
  }
  root.remove(waxGroup);

  return { bodyRoot: root, waxGroup };
}

export function collectWaxSlices(root, prefix) {
  const slices = [];
  const box = new Box3();
  const center = new Vector3();

  root.traverse((child) => {
    if (!child.isMesh || !child.name.startsWith(prefix)) return;

    // the information is saved in the parameter
    box.setFromObject(child);
    box.getCenter(center);

    // the direction of chip when detaching
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
// breaks once the virtual crush line passes its original (rest) height.
export function sliceRestTopY(slice, appleBaseY, appleScale) {
  return appleBaseY + slice.localMaxY * appleScale;
}

const waxBox = new Box3();
const waxCorner = new Vector3();

/**
 * World-space distance from a point to the closest point on a wax AABB.
 * Used to keep squish knock-off local to the press — an infinite plane would
 * otherwise count far-side wax as "already penetrated".
 */
export function waxDistanceToPoint(slice, point) {
  waxBox.setFromObject(slice.object);
  waxBox.clampPoint(point, waxCorner);
  return waxCorner.distanceTo(point);
}

/**
 * How far the plane has pushed past the nearest point on a wax slice's AABB,
 * counting only wax the plane is approaching from the outside.
 *
 * Signed distance of a point X: (X - planeOrigin) · outwardNormal
 * - minSigned > 0              → plane has not reached the wax → 0
 * - maxSigned < 0              → wax is entirely behind the plane (other side
 *                                of the apple / already inside) → 0
 * - straddling the plane       → penetration = -minSigned
 */
export function waxPlanePenetration(slice, planeOrigin, outwardNormal) {
  waxBox.setFromObject(slice.object);
  const { min, max } = waxBox;

  let minSigned = Infinity;
  let maxSigned = -Infinity;

  for (let ix = 0; ix < 2; ix++) {
    for (let iy = 0; iy < 2; iy++) {
      for (let iz = 0; iz < 2; iz++) {
        waxCorner.set(
          ix === 0 ? min.x : max.x,
          iy === 0 ? min.y : max.y,
          iz === 0 ? min.z : max.z
        );
        const signed =
          (waxCorner.x - planeOrigin.x) * outwardNormal.x +
          (waxCorner.y - planeOrigin.y) * outwardNormal.y +
          (waxCorner.z - planeOrigin.z) * outwardNormal.z;
        if (signed < minSigned) minSigned = signed;
        if (signed > maxSigned) maxSigned = signed;
      }
    }
  }

  // Still outside — plane hasn't touched this chip.
  if (minSigned >= 0) return 0;
  // Entirely behind the plane (e.g. opposite side of the apple). An infinite
  // plane always "contains" that half of space; it is not a real crush.
  if (maxSigned < 0) return 0;

  // Plane cuts through the AABB: how deep past the nearest corner.
  return -minSigned;
}
