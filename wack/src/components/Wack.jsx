import { useLayoutEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useHelper } from "@react-three/drei";
import SpotLight from "./SpotLight";
import CubeBackground from "./CubeBackground";
import Apple from "./Apple";
import CameraSetup from "./CameraSetup";


export default function Wack() {
  return (
    <div className="wack-wrapper">
      <Canvas
        style={{ backgroundColor: "black" }}
        camera={{ position: [8, 5, 8], fov: 50 }}
      >

        <CameraSetup />



        <Apple />


        <CubeBackground size={20} />

        <directionalLight position={[5, 5, 5]} intensity={0.5} />
        <SpotLight intensity={4500} position={[25, 20, 25]}  />
        {/* <OrbitControls /> */}
      </Canvas>
    </div>
  );
}
