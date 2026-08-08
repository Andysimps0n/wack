import { Vector3 } from "three";

// Scratch vectors so hot drag samples don't allocate every vertex.
const originLocal = new Vector3();
const tipLocal = new Vector3();
const normalLocal = new Vector3();
const vertex = new Vector3();
const toVertex = new Vector3();

/**
 * Snapshot each mesh's vertex positions as the undeformed "rest" shape.
 * Call once after cloning geometries, before any squish.
 */
export function captureRestPositions(root) {
  root.traverse((child) => {
    const position = child.geometry?.attributes?.position;
    if (!child.isMesh || !position) return;
    child.userData.restPosition = new Float32Array(position.array);
  });
}

/** Instantly put every fruit mesh back to its rest shape. */
export function restoreRestPositions(root) {
  root.traverse((child) => {
    const rest = child.userData?.restPosition;
    const position = child.geometry?.attributes?.position;
    if (!rest || !position) return;
    position.array.set(rest);
    position.needsUpdate = true;
    child.geometry.computeVertexNormals();
  });
}

/**
 * Ease every vertex a fraction of the way toward rest.
 * @returns {number} max |delta| across all components (for "are we done?")
 */
export function lerpMeshesTowardRest(root, alpha) {
  let maxDelta = 0;

  root.traverse((child) => {
    const rest = child.userData?.restPosition;
    const position = child.geometry?.attributes?.position;
    if (!rest || !position) return;

    const arr = position.array;
    for (let i = 0; i < arr.length; i++) {
      const delta = rest[i] - arr[i];
      const step = delta * alpha;
      arr[i] += step;
      const abs = Math.abs(delta);
      if (abs > maxDelta) maxDelta = abs;
    }
    position.needsUpdate = true;
    child.geometry.computeVertexNormals();
  });

  return maxDelta;
}

/**
 * Hard-clamp mesh vertices against an infinite plane (metal-plate style).
 * Any vertex on the outward side of the plane is projected onto it.
 *
 * @param {import("three").Mesh} mesh
 * @param {Vector3} planeOriginWorld - a point on the plane (world space)
 * @param {Vector3} outwardNormalWorld - unit normal pointing out of the fruit
 */
export function squishMeshWithPlane(mesh, planeOriginWorld, outwardNormalWorld) {
  const position = mesh.geometry?.attributes?.position;
  if (!position) return;

  // Convert the world plane into this mesh's local space.
  // Tip trick: transform origin and origin+normal, then subtract — that gives
  // a direction that respects the mesh's scale/rotation without a Matrix3.
  originLocal.copy(planeOriginWorld);
  mesh.worldToLocal(originLocal);

  tipLocal.copy(planeOriginWorld).add(outwardNormalWorld);
  mesh.worldToLocal(tipLocal);

  normalLocal.subVectors(tipLocal, originLocal);
  if (normalLocal.lengthSq() < 1e-12) return;
  normalLocal.normalize();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);
    const signedDist = toVertex.subVectors(vertex, originLocal).dot(normalLocal);
    if (signedDist <= 0) continue;

    // Project onto the plane: V' = V - N * d
    vertex.addScaledVector(normalLocal, -signedDist);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  position.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}
