import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  RigidBody,
  BallCollider,
  interactionGroups,
} from "@react-three/rapier";
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
  CLEANUP_HOLD_SEC,
  WHOOSH_SPEED_Y,
  WHOOSH_SCATTER_XZ,
  WHOOSH_CLEAR_Y,
  WHOOSH_CLEAR_TIMEOUT_SEC,
  RESPAWN_HEIGHT_OFFSET,
  RESPAWN_DROP_SEC,
} from "../constants/crush";
import {
  collectWaxSlices,
  isWaxMesh,
  sliceRestTopY,
  splitWaxFromApple,
} from "../utils/waxContact";

const APPLE_POSITION = [0, 2, 0];
const APPLE_SCALE = 2;

const APPLE_GROUPS = interactionGroups(2, [0, 1]);
const CHIP_GROUPS = interactionGroups(1, [0, 2]);
// During the whoosh, collide with nothing so debris flies out cleanly.
const FREE_GROUPS = interactionGroups(2, []);

function randomScatter() {
  return (Math.random() * 2 - 1) * WHOOSH_SCATTER_XZ;
}

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

export default function Apple({
  crushProgress,
  status,
  onStartBlow,
  onCleared,
  onSettled,
}) {
  const whole = useGLTF("/models/apple_c1.glb");
  const isDropping = status === "dropping";

  // Phase is read every frame via ref; React state is not needed for render.
  const phaseRef = useRef(isDropping ? "dropping" : "intact");
  const visualRef = useRef(null);
  const colliderRef = useRef(null);
  const appleBodyRef = useRef(null);
  const chipBodyRefs = useRef(new Map());
  // Latest smash progress — props can change without re-running useFrame setup.
  const crushProgressRef = useRef(crushProgress);
  crushProgressRef.current = crushProgress;
  const statusRef = useRef(status);
  statusRef.current = status;

  const [chips, setChips] = useState([]);
  const chipsRef = useRef(chips);
  chipsRef.current = chips;
  const chipAgeRef = useRef(new Map());

  const whooshAppliedRef = useRef(false);
  const clearedRef = useRef(false);
  const settledRef = useRef(false);
  const blowStartedAtRef = useRef(0);
  const dropElapsedRef = useRef(0);

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

  function changePhase(next) {
    phaseRef.current = next;
  }

  function applyWhoosh() {
    const apple = appleBodyRef.current;
    if (apple) {
      apple.setLinvel(
        { x: randomScatter(), y: WHOOSH_SPEED_Y, z: randomScatter() },
        true
      );
    }

    for (const chip of chipsRef.current) {
      const body = chipBodyRefs.current.get(chip.id);
      if (!body) continue;
      body.setLinvel(
        { x: randomScatter(), y: WHOOSH_SPEED_Y, z: randomScatter() },
        true
      );
    }
  }

  function debrisAllClear() {
    const apple = appleBodyRef.current;
    // Still mounting / already gone — not clear yet while we're blowing.
    if (!apple || apple.translation().y < WHOOSH_CLEAR_Y) return false;

    for (const chip of chipsRef.current) {
      const body = chipBodyRefs.current.get(chip.id);
      if (!body || body.translation().y < WHOOSH_CLEAR_Y) return false;
    }
    return true;
  }

  // After smash finishes, wait then ask the hook to enter "blowing".
  useEffect(() => {
    if (status !== "done") return;
    const timer = setTimeout(() => {
      onStartBlow();
    }, CLEANUP_HOLD_SEC * 1000);
    return () => clearTimeout(timer);
  }, [status, onStartBlow]);

  // Fresh mount during the drop cycle starts high above the rest pose.
  useEffect(() => {
    if (!isDropping) return;
    dropElapsedRef.current = 0;
    settledRef.current = false;
    const body = appleBodyRef.current;
    if (body) {
      body.setNextKinematicTranslation({
        x: APPLE_POSITION[0],
        y: APPLE_POSITION[1] + RESPAWN_HEIGHT_OFFSET,
        z: APPLE_POSITION[2],
      });
    }
  }, [isDropping]);

  useFrame((_, delta) => {
    // Enable apple collision on chips after the spawn delay.
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

    // --- Cleanup: blow debris up, then clear ---
    if (statusRef.current === "blowing") {
      // Re-apply for a few frames in case the body is still "fixed" on the
      // first frame after status flips to "blowing".
      if (!whooshAppliedRef.current) {
        if (blowStartedAtRef.current === 0) {
          blowStartedAtRef.current = performance.now();
        }
        applyWhoosh();
        const apple = appleBodyRef.current;
        if (apple && apple.linvel().y > WHOOSH_SPEED_Y * 0.5) {
          whooshAppliedRef.current = true;
        }
      }

      const timedOut =
        blowStartedAtRef.current > 0 &&
        (performance.now() - blowStartedAtRef.current) / 1000 >=
          WHOOSH_CLEAR_TIMEOUT_SEC;

      if (!clearedRef.current && (debrisAllClear() || timedOut)) {
        clearedRef.current = true;
        onCleared();
      }
      return;
    }

    // --- Respawn: scripted drop from the sky to the rest position ---
    if (statusRef.current === "dropping") {
      const body = appleBodyRef.current;
      if (!body || settledRef.current) return;

      dropElapsedRef.current += delta;
      const t = MathUtils.clamp(
        dropElapsedRef.current / RESPAWN_DROP_SEC,
        0,
        1
      );
      // Ease-out so it slows as it settles into place.
      const eased = 1 - (1 - t) * (1 - t);
      const startY = APPLE_POSITION[1] + RESPAWN_HEIGHT_OFFSET;
      const y = MathUtils.lerp(startY, APPLE_POSITION[1], eased);

      body.setNextKinematicTranslation({
        x: APPLE_POSITION[0],
        y,
        z: APPLE_POSITION[2],
      });

      if (t >= 1) {
        settledRef.current = true;
        body.setNextKinematicTranslation({
          x: APPLE_POSITION[0],
          y: APPLE_POSITION[1],
          z: APPLE_POSITION[2],
        });
        // Next smash needs the normal intact → squeezing path.
        changePhase("intact");
        if (visualRef.current) {
          visualRef.current.scale.setScalar(APPLE_SCALE);
          visualRef.current.position.set(0, 0, 0);
        }
        syncAppleCollider(1, 1, 0);
        onSettled();
      }
      return;
    }

    if (!visualRef.current) return;

    // Scroll 0–1 maps directly to how far a virtual crush line has moved
    // down through the apple's height (no physical plane).
    const appleTop = APPLE_POSITION[1] + bounds.maxY * APPLE_SCALE;
    const appleHeight = bounds.height * APPLE_SCALE;
    const compression = MathUtils.clamp(crushProgressRef.current, 0, 1);
    const crushBottom = appleTop - compression * appleHeight;

    if (phaseRef.current === "intact") {
      if (compression > 0) changePhase("squeezing");
      return;
    }

    // phase === 'squeezing'
    if (compression <= 0) {
      // Scroll returned to the top: spring back to full shape.
      // Chips that already snapped off stay off (wax doesn't heal).
      changePhase("intact");
      visualRef.current.scale.setScalar(APPLE_SCALE);
      visualRef.current.position.set(0, 0, 0);
      syncAppleCollider(1, 1, 0);
      return;
    }

    // Squash: flatten on Y, bulge outward on X/Z as compression grows.
    // Normalize by the threshold so the full squash range plays out during
    // the squeeze (MIN_SQUASH_Y = 1 - BREAK_THRESHOLD).
    const squeezeAmount = Math.min(compression / BREAK_THRESHOLD, 1);
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

    // Wax break: a chip snaps off once the virtual crush line passes the
    // chip's REST-position top. (We compare against where the wax originally
    // was — brittle wax breaks instead of compressing.)
    const detachedNow = [];
    for (const slice of waxSlices) {
      if (slice.detached) continue;

      const restTopY = sliceRestTopY(slice, APPLE_POSITION[1], APPLE_SCALE);

      if (crushBottom - restTopY <= WAX_CONTACT_EPS) {
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

  const isBlowing = status === "blowing";
  const appleBodyType = isBlowing
    ? "dynamic"
    : isDropping
      ? "kinematicPosition"
      : "fixed";
  const appleGroups = isBlowing ? FREE_GROUPS : APPLE_GROUPS;
  const appleStartY = isDropping
    ? APPLE_POSITION[1] + RESPAWN_HEIGHT_OFFSET
    : APPLE_POSITION[1];

  const chipBodies = chips.map((chip) => (
    <RigidBody
      key={chip.id}
      ref={(body) => {
        if (body) chipBodyRefs.current.set(chip.id, body);
        else chipBodyRefs.current.delete(chip.id);
      }}
      type="dynamic"
      colliders="hull"
      position={chip.position}
      linearVelocity={chip.velocity}
      collisionGroups={isBlowing ? FREE_GROUPS : CHIP_GROUPS}
      gravityScale={isBlowing ? 0 : 1}
      mass={WAX_CHIP_MASS}
      linearDamping={isBlowing ? 0 : 0.4}
      angularDamping={0.55}
      restitution={0.02}
      friction={1.4}
      ccd
    >
      <primitive object={chip.object} scale={chip.scale} />
    </RigidBody>
  ));

  return (
    <>
      {chipBodies}
      <RigidBody
        ref={appleBodyRef}
        position={[APPLE_POSITION[0], appleStartY, APPLE_POSITION[2]]}
        type={appleBodyType}
        colliders={false}
        collisionGroups={appleGroups}
        gravityScale={isBlowing ? 0 : 1}
        linearDamping={isBlowing ? 0 : 0}
        ccd={isBlowing}
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
