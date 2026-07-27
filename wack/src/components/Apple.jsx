import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { RigidBody, interactionGroups } from "@react-three/rapier";
import { ActiveCollisionTypes } from "@dimforge/rapier3d-compat";
import {
  Box3,
  DoubleSide,
  FrontSide,
  MathUtils,
  MeshPhysicalMaterial,
} from "three";
import {
  BREAK_THRESHOLD,
  MIN_SQUASH_Y,
  MAX_BULGE_XZ,
  WAX_SLICE_PREFIX,
  WAX_CONTACT_EPS,
  WAX_CHIP_IMPULSE,
  WAX_CHIP_MASS,
  WAX_CHIP_SCALE,
} from "../constants/crush";
import {
  collectWaxSlices,
  sliceRestTopY,
} from "../utils/waxContact";

const APPLE_POSITION = [0, 2, 0];
const APPLE_SCALE = 2;

// Half the metal plate's thickness; its collider bottom sits this far
// below the plane's center Y (see MetalPlane's CuboidCollider args).
const PLANE_HALF_THICKNESS = 0.125;

// Rapier interaction groups. A freshly detached chip's hull overlaps the
// intact apple's hull (the chip hugs the apple's surface), and letting
// those two colliders touch would eject the chip violently. So the apple
// and the chips live in their own groups and both only collide with the
// "everything else" group 0 (floor, plate, broken apple pieces).
const APPLE_GROUPS = interactionGroups(2, [0]);
const CHIP_GROUPS = interactionGroups(1, [0]);

// Translucent wax coat. Crack lines are not drawn — pieces just snap off.
function makeWaxMaterial(source) {
  return new MeshPhysicalMaterial({
    color: source.color?.clone(),
    transparent: true,
    opacity: 0.68,
    transmission: 0.02,
    thickness: 0.38,
    roughness: 0.48,
    metalness: 0,
    ior: 1.45,
    depthWrite: false,
    side: FrontSide,
  });
}

// A detached chip is a thin hollow shell, so keep its material close to the
// attached coat. We only flip to DoubleSide (the open inner face is visible
// while the chip tumbles) and enable depthWrite (a free-floating transparent
// shell sorts against itself badly without it).
function prepareDetachedWax(object) {
  object.traverse((child) => {
    if (!child.isMesh || !child.material) return;
    const mat = child.material;
    mat.depthWrite = true;
    mat.side = DoubleSide;
    mat.needsUpdate = true;
  });
}

function configureAppleMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;

    const materialName = child.material?.name ?? "";
    const isWax =
      child.name.startsWith(WAX_SLICE_PREFIX) ||
      materialName === "AppleWaxMat";

    if (isWax) {
      child.material = makeWaxMaterial(child.material);
      // Draw wax after the opaque apple body so you see through to the fruit.
      child.renderOrder = 2;
      return;
    }

    child.renderOrder = 0;
  });
}

export default function Apple({ planeYRef }) {
  const whole = useGLTF("/models/apple_c1.glb");
  const broken = useGLTF("/models/broken_apple15.glb");

  const [phase, setPhase] = useState("intact");
  const phaseRef = useRef("intact");
  const visualRef = useRef(null);

  // Wax chips that have snapped off and now live as free physics bodies.
  // They persist across the apple's own break (nice debris).
  const [chips, setChips] = useState([]);

  const wholeApple = useMemo(() => {
    const clone = whole.scene.clone(true);

    // this function applies texture to apple.
    // the wax is not replaced; the texture is applied.
    configureAppleMaterials(clone);
    return clone;
  }, [whole.scene]);

  // One record per wax chip mesh (sorted top-to-bottom): rest-space Y
  // bounds and outward pop direction.
  const waxSlices = useMemo(
    () => collectWaxSlices(wholeApple, WAX_SLICE_PREFIX),
    [wholeApple]
  );

  const bounds = useMemo(() => {
    const box = new Box3().setFromObject(whole.scene);
    return { minY: box.min.y, maxY: box.max.y, height: box.max.y - box.min.y };
  }, [whole.scene]);

  // Each root child of broken_apple2.glb is one fragment (a Group holding the
  // fragment's meshes, since each fragment uses two materials), offset from
  // the apple's center. Bake that offset into a world position for its
  // RigidBody (Rapier bodies should not live inside scaled/offset groups).
  const pieces = useMemo(() => {
    return broken.scene.children.map((fragment) => {
      const clone = fragment.clone(true);
      const worldPosition = [
        APPLE_POSITION[0] + fragment.position.x * APPLE_SCALE,
        APPLE_POSITION[1] + fragment.position.y * APPLE_SCALE,
        APPLE_POSITION[2] + fragment.position.z * APPLE_SCALE,
      ];
      clone.position.set(0, 0, 0);
      return { name: fragment.name, object: clone, position: worldPosition };
    });
  }, [broken.scene]);

  function changePhase(next) {
    phaseRef.current = next;
    setPhase(next);
  }

  function handleCollisionEnter({ other }) {
    if (phaseRef.current !== "intact") return;
    if (other.rigidBodyObject?.name !== "metal-plane") return;
    changePhase("squeezing");
  }

  useFrame(() => {
    if (phaseRef.current === "broken" || !visualRef.current) return;

    // How far the plate's bottom has pushed down past the apple's top,
    // as a fraction of the apple's full height.
    const appleTop = APPLE_POSITION[1] + bounds.maxY * APPLE_SCALE;
    const appleHeight = bounds.height * APPLE_SCALE;
    const planeBottom = planeYRef.current - PLANE_HALF_THICKNESS;
    const compression = MathUtils.clamp(
      (appleTop - planeBottom) / appleHeight,
      0,
      1
    );

    if (phaseRef.current === "intact") {
      if (compression > 0) changePhase("squeezing");
      return;
    }

    // phase === 'squeezing'
    if (compression >= BREAK_THRESHOLD) {
      // Apple shatters; already-detached wax chips stay as debris and any
      // wax still attached vanishes along with the intact visual.
      changePhase("broken");
      return;
    }
    if (compression <= 0) {
      // Plate lifted off before the threshold: spring back to normal.
      // Chips that already snapped off stay off (wax doesn't heal).
      changePhase("intact");
      visualRef.current.scale.setScalar(APPLE_SCALE);
      visualRef.current.position.set(...APPLE_POSITION);
      return;
    }

    // Squash: flatten on Y, bulge outward on X/Z as compression grows.
    // Normalize by the threshold so the full squash range plays out during
    // the squeeze; with MIN_SQUASH_Y = 1 - BREAK_THRESHOLD the apple's top
    // exactly tracks the plate's bottom (no clipping through the plate).
    const squeezeAmount = compression / BREAK_THRESHOLD;
    const squashY = MathUtils.lerp(1, MIN_SQUASH_Y, squeezeAmount);
    const bulgeXZ = MathUtils.lerp(1, MAX_BULGE_XZ, squeezeAmount);
    visualRef.current.scale.set(
      APPLE_SCALE * bulgeXZ,
      APPLE_SCALE * squashY,
      APPLE_SCALE * bulgeXZ
    );

    // Shift the group down so the apple's bottom stays planted on the
    // floor while its height shrinks (otherwise it squashes around its
    // center and appears to float).
    const groupY =
      APPLE_POSITION[1] + bounds.minY * APPLE_SCALE * (1 - squashY);
    visualRef.current.position.set(APPLE_POSITION[0], groupY, APPLE_POSITION[2]);

    // Wax break: a chip snaps off once the plate has crushed past the
    // chip's REST-position top. (The squashed mesh always stays below the
    // plate because the apple's top tracks it, so we compare against where
    // the wax originally was — brittle wax breaks instead of compressing.)
    const detachedNow = [];
    for (const slice of waxSlices) {
      if (slice.detached) continue;

      const restTopY = sliceRestTopY(slice, APPLE_POSITION[1], APPLE_SCALE);

      if (planeBottom - restTopY <= WAX_CONTACT_EPS) {
        slice.detached = true;
        slice.object.removeFromParent();
        prepareDetachedWax(slice.object);
        // Use full (un-squashed) scale so the chip keeps its baked shell
        // thickness — inheriting squashY made shards look paper-flat.
        const chipScale = APPLE_SCALE * WAX_CHIP_SCALE;
        detachedNow.push({
          id: slice.id,
          object: slice.object,
          position: [APPLE_POSITION[0], groupY, APPLE_POSITION[2]],
          scale: [chipScale, chipScale, chipScale],
          velocity: [
            slice.outward.x * WAX_CHIP_IMPULSE,
            0.35,
            slice.outward.z * WAX_CHIP_IMPULSE,
          ],
        });
      }
    }
    if (detachedNow.length > 0) {
      setChips((prev) => [...prev, ...detachedNow]);
    }
  });

  const chipBodies = chips.map((chip) => (
    <RigidBody
      key={chip.id}
      type="dynamic"
      colliders="hull"
      position={chip.position}
      linearVelocity={chip.velocity}
      collisionGroups={CHIP_GROUPS}
      mass={WAX_CHIP_MASS}
      linearDamping={0.4}
      angularDamping={0.55}
      restitution={0.02}
      friction={1.4}
      ccd
    >
      <primitive object={chip.object} scale={chip.scale} />
    </RigidBody>
  ));

  if (phase === "broken") {
    return (
      <>
        {chipBodies}
        {pieces.map((piece) => (
          <RigidBody
            key={piece.name}
            type="dynamic"
            colliders="hull"
            position={piece.position}
            restitution={0.1}
            friction={2}
            ccd
          >
            <primitive object={piece.object} scale={APPLE_SCALE} />
          </RigidBody>
        ))}
      </>
    );
  }

  return (
    <>
      {chipBodies}
      <RigidBody
        type="fixed"
        colliders="hull"
        collisionGroups={APPLE_GROUPS}
        // The metal plane is kinematic and this body is fixed; Rapier skips
        // kinematic-vs-fixed contacts unless we opt in explicitly.
        activeCollisionTypes={
          ActiveCollisionTypes.DEFAULT | ActiveCollisionTypes.KINEMATIC_FIXED
        }
        onCollisionEnter={handleCollisionEnter}
      >
        <group ref={visualRef} position={APPLE_POSITION} scale={APPLE_SCALE}>
          <primitive object={wholeApple} />
        </group>
      </RigidBody>
    </>
  );
}

useGLTF.preload("/models/apple_c1.glb");
useGLTF.preload("/models/broken_apple15.glb");
