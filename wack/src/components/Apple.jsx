import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import { ActiveCollisionTypes } from "@dimforge/rapier3d-compat";
import { Box3, MathUtils } from "three";
import {
  BREAK_THRESHOLD,
  MIN_SQUASH_Y,
  MAX_BULGE_XZ,
} from "../constants/crush";

const APPLE_POSITION = [0, 2, 0];
const APPLE_SCALE = 2;

// Half the metal plate's thickness; its collider bottom sits this far
// below the plane's center Y (see MetalPlane's CuboidCollider args).
const PLANE_HALF_THICKNESS = 0.125;

export default function Apple({ planeYRef }) {
  const whole = useGLTF("/models/apple_wax1.glb");
  const broken = useGLTF("/models/broken_apple15.glb");

  const [phase, setPhase] = useState("intact");
  const phaseRef = useRef("intact");
  const visualRef = useRef(null);
  const wholeApple = useMemo(() => whole.scene.clone(true), [whole.scene]);

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
      changePhase("broken");
      return;
    }
    if (compression <= 0) {
      // Plate lifted off before the threshold: spring back to normal.
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
  });

  if (phase === "broken") {
    return (
      <>
        {pieces.map((piece) => (
          <RigidBody
            key={piece.name}
            type="dynamic"
            colliders="ball"
            position={piece.position}
            restitution={0.1}
            friction={2}
            ccd={false}
          >
            <primitive object={piece.object} scale={APPLE_SCALE} />
          </RigidBody>
        ))}
      </>
    );
  }

  return (
    <RigidBody
      type="fixed"
      colliders="hull"
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
  );
}

useGLTF.preload("/models/apple.glb");
useGLTF.preload("/models/broken_apple2.glb");
