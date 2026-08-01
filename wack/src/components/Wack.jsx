import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import SpotLight from "./SpotLight";
import CubeBackground from "./CubeBackground";
import Apple from "./Apple";
import MetalPlane, { START_Y } from "./MetalPlane";
import CameraSetup from "./CameraSetup";

export default function Wack({ scrollProgress }) {
  // Live Y position of the metal plane, shared between MetalPlane (writes it
  // every frame) and Apple (reads it to measure compression). A ref keeps
  // this out of React state so it doesn't re-render the tree 60 times/sec.
  const planeYRef = useRef(START_Y);

  return (
    <div className="wack-wrapper">
      <Canvas
        style={{ backgroundColor: "black" }}
        camera={{ position: [8, 5, 8], fov: 50 }}
      >
        <CameraSetup />

        <Physics gravity={[0, -13, 0]} debug={false}>
          <MetalPlane progress={scrollProgress} planeYRef={planeYRef} />
          <Apple planeYRef={planeYRef} />
          <CubeBackground size={20} />
        </Physics>

        <directionalLight position={[5, 5, 5]} intensity={0.5} />
        <SpotLight intensity={4500} position={[25, 20, 25]} />
      </Canvas>
    </div>
  );
}
