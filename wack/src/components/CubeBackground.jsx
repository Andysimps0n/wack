export default function CubeBackground({ size }) {
  const half = size / 2;

  return (
    <>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#d9f47e" />
      </mesh>

      {/* Left Wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-half, half, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#d9f47e" />
      </mesh>

      {/* Back Wall */}
      <mesh rotation={[0, 0, 0]} position={[0, half, -half]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#d9f47e" />
      </mesh>
    </>
  );
}
