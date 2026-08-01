import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  RigidBody,
  BallCollider,
  interactionGroups,
} from "@react-three/rapier";
import { ActiveCollisionTypes } from "@dimforge/rapier3d-compat";
import {
  Box3,
  DoubleSide,
  FrontSide,
  Group,
  MathUtils,
  MeshPhysicalMaterial,
  Vector3,
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
  WAX_CHIP_SPAWN_OFFSET,
  WAX_CHIP_COLLISION_DELAY_FRAMES,
} from "../constants/crush";
import {
  collectWaxSlices,
  isWaxMesh,
  sliceRestTopY,
  splitWaxFromApple,
} from "../utils/waxContact";

const APPLE_POSITION = [0, 2, 0];
const APPLE_SCALE = 2;
const PLANE_HALF_THICKNESS = 0.125;


const APPLE_GROUPS = interactionGroups(2, [0, 1]);
const CHIP_GROUPS = interactionGroups(1, [0, 2]);



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

    if (isWaxMesh(child, WAX_SLICE_PREFIX)) {
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
  const appleBodyRef = useRef(null);
  const colliderRef = useRef(null);

  const [chips, setChips] = useState([]);
  const chipsRef = useRef(chips);
  chipsRef.current = chips;
  const chipAgeRef = useRef(new Map());

  // Split the GLB into: fruit (collides), stem/leaf (looks only), wax (looks
  // only until chips snap off).
  const { fruitBody, stemAndLeaf, waxGroup } = useMemo(() => {
    const clone = whole.scene.clone(true);
    configureAppleMaterials(clone);
    const { bodyRoot, waxGroup } = splitWaxFromApple(clone, WAX_SLICE_PREFIX);

    const stemAndLeaf = new Group();
    stemAndLeaf.name = "AppleDecor";

    const toMove = [];
    bodyRoot.traverse((child) => {
      if (
        child.isMesh &&
        (child.name === "AppleLeaf" || child.name === "AppleStem")
      ) {
        toMove.push(child);
      }
    });

    bodyRoot.add(stemAndLeaf);
    for (const mesh of toMove) stemAndLeaf.attach(mesh);
    bodyRoot.remove(stemAndLeaf);

    return { fruitBody: bodyRoot, stemAndLeaf, waxGroup };
  }, [whole.scene]);

  // Model-space box of the fruit only — used to resize the CuboidCollider
  // each frame so physics tracks the squashed visual (MeshCollider cannot).
  const fruitShape = useMemo(() => {
    const box = new Box3().setFromObject(fruitBody);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    return {
      halfX: size.x / 2,
      halfY: size.y / 2,
      halfZ: size.z / 2,
      centerX: center.x,
      centerY: center.y,
      centerZ: center.z,
    };
  }, [fruitBody]);

  const waxSlices = useMemo(
    () => collectWaxSlices(waxGroup, WAX_SLICE_PREFIX),
    [waxGroup]
  );

  const bounds = useMemo(() => {
    const box = new Box3().setFromObject(whole.scene);
    return { minY: box.min.y, maxY: box.max.y, height: box.max.y - box.min.y };
  }, [whole.scene]);

  // Approximate fruit with a sphere. Radius blends the three scaled half-axes
  // so it shrinks as the apple flattens and grows a bit as it bulges on XZ.
  function appleRadius(squashY, bulgeXZ) {
    return (
      ((fruitShape.halfX * bulgeXZ +
        fruitShape.halfY * squashY +
        fruitShape.halfZ * bulgeXZ) /
        3) *
      APPLE_SCALE
    );
  }

  // Collider lives on the RigidBody (not inside visualRef), so we set radius
  // and local translation ourselves every frame.
  function syncAppleCollider(squashY, bulgeXZ, groupY) {
    const col = colliderRef.current;
    if (!col) return;
    col.setRadius(appleRadius(squashY, bulgeXZ));
    col.setTranslationWrtParent({
      x: fruitShape.centerX * APPLE_SCALE * bulgeXZ,
      y: groupY + fruitShape.centerY * APPLE_SCALE * squashY,
      z: fruitShape.centerZ * APPLE_SCALE * bulgeXZ,
    });
  }

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
    // Enable apple collision on chips after the spawn delay — runs even
    // after the apple has shattered so late chips still get group updates.
    const ages = chipAgeRef.current;
    const readyIds = [];
    for (const chip of chipsRef.current) {
      if (chip.appleCollision) continue;
      const age = (ages.get(chip.id) ?? 0) + 1;
      ages.set(chip.id, age);
      if (age >= WAX_CHIP_COLLISION_DELAY_FRAMES) {
        readyIds.push(chip.id);
      }
    }
    if (readyIds.length > 0) {
      const readySet = new Set(readyIds);
      setChips((prev) =>
        prev.map((chip) =>
          readySet.has(chip.id) ? { ...chip, appleCollision: true } : chip
        )
      );
    }

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
      visualRef.current.position.set(0, 0, 0);
      syncAppleCollider(1, 1, 0);
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

    // Local Y only — RigidBody already sits at APPLE_POSITION.
    const groupY = bounds.minY * APPLE_SCALE * (1 - squashY);
    visualRef.current.position.set(0, groupY, 0);
    syncAppleCollider(squashY, bulgeXZ, groupY);

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
        chipAgeRef.current.set(slice.id, 0);
        detachedNow.push({
          id: slice.id,
          object: slice.object,
          // Nudge outward so the hull starts clear of the apple body.
          // Chip RigidBodies use world space; add APPLE_POSITION back on Y.
          position: [
            APPLE_POSITION[0] + slice.outward.x * WAX_CHIP_SPAWN_OFFSET,
            APPLE_POSITION[1] + groupY,
            APPLE_POSITION[2] + slice.outward.z * WAX_CHIP_SPAWN_OFFSET,
          ],
          scale: [chipScale, chipScale, chipScale],
          velocity: [
            slice.outward.x * WAX_CHIP_IMPULSE,
            0.35,
            slice.outward.z * WAX_CHIP_IMPULSE,
          ],
          appleCollision: false,
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
        position={APPLE_POSITION}
        ref={appleBodyRef}
        type="fixed"
        colliders={false}
        collisionGroups={APPLE_GROUPS}
        activeCollisionTypes={
          ActiveCollisionTypes.DEFAULT | ActiveCollisionTypes.KINEMATIC_FIXED
        }
        onCollisionEnter={handleCollisionEnter}
      >
        {/* Approximate fruit sphere — radius updated in useFrame with squash. */}
        <BallCollider
          ref={colliderRef}
          args={[appleRadius(1, 1)]}
          position={[
            fruitShape.centerX * APPLE_SCALE,
            fruitShape.centerY * APPLE_SCALE,
            fruitShape.centerZ * APPLE_SCALE,
          ]}
        />
        <group ref={visualRef} scale={APPLE_SCALE}>
          <primitive object={fruitBody} />
          <primitive object={stemAndLeaf} />
          <primitive object={waxGroup} />
        </group>
      </RigidBody>
    </>
  );
}

useGLTF.preload("/models/apple_c1.glb");
useGLTF.preload("/models/broken_apple15.glb");
