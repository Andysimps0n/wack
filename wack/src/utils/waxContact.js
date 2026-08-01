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
// breaks once the plate crushes past its original (rest) height.
export function sliceRestTopY(slice, appleBaseY, appleScale) {
  return appleBaseY + slice.localMaxY * appleScale;
}
