import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { ActiveCollisionTypes } from "@dimforge/rapier3d-compat";
import { MathUtils } from "three";

export const START_Y = 8;
const END_Y = 1.5;
export default function MetalPlane({ progress, planeYRef }) {
  const bodyRef = useRef(null);

  useFrame(() => {
    if (!bodyRef.current) return;

    // MathUtils.lerp(a, b, c) calculates what c-pertentage between a and b is.

    const y = MathUtils.lerp(START_Y, END_Y, progress);
    planeYRef.current = y;
    bodyRef.current.setNextKinematicTranslation({ x: 0, y, z: 0 });
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      position={[0, START_Y, 0]}
      colliders={false}
      name="metal-plane"
    >
      {/* KINEMATIC_FIXED lets this kinematic plate register contact with the
          fixed (unbroken) apple body, which Rapier skips by default. */}
      <CuboidCollider
        args={[3, 0.125, 3]}
        activeCollisionTypes={
          ActiveCollisionTypes.DEFAULT | ActiveCollisionTypes.KINEMATIC_FIXED
        }
      />
      <mesh>
        <boxGeometry args={[6, 0.25, 6]} />
        <meshStandardMaterial color="#9ea4ad" metalness={0.9} roughness={0.3} />
      </mesh>
    </RigidBody>
  );
}
