import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import SpotLight from "./SpotLight";
import CubeBackground from "./CubeBackground";
import CameraSetup from "./CameraSetup";

export default function Butter() {
  return (
    <div className="wack-wrapper">
      <Canvas
        style={{ backgroundColor: "black" }}
        camera={{ position: [8, 5, 8], fov: 50 }}
      >
        <CameraSetup />

        <Physics gravity={[0, -13, 0]}>
          <CubeBackground size={20} color="#f5d76e" />
        </Physics>

        <directionalLight position={[5, 5, 5]} intensity={0.5} />
        <SpotLight intensity={4500} position={[25, 20, 25]} />
      </Canvas>
    </div>
  );
}
