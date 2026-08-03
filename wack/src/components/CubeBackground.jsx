import { RigidBody, CuboidCollider } from "@react-three/rapier";

export default function CubeBackground({ size, color = "#d9f47e" }) {
  const half = size / 2;

  return (
    <>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Invisible physics floor so apple pieces land on the visual floor
          instead of falling through it. */}
      <RigidBody type="fixed">
        <CuboidCollider args={[half, 0.1, half]} position={[0, -0.1, 0]} />
      </RigidBody>

      {/* Left Wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-half, half, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Back Wall */}
      <mesh rotation={[0, 0, 0]} position={[0, half, -half]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </>
  );
}
