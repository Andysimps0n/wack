import { SpotLightHelper } from "three";
import { useRef } from "react";
import { useLayoutEffect } from "react";
import { useHelper } from "@react-three/drei";
import CameraLogger from "./CameraLogger";


export default function SpotLight({ position, intensity }) {
  const lightRef = useRef(null);
  const targetRef = useRef(null);

  // useHelper(lightRef, SpotLightHelper, "yellow");
  useLayoutEffect(() => {
    const light = lightRef.current;
    const target = targetRef.current;
    if (!light || !target) return;
    light.target = target;
  }, []);

  return (
    <>
      <CameraLogger />
      <spotLight
        ref={lightRef}
        position={position}
        angle={0.24}
        penumbra={0.1}
        intensity={intensity}
        distance={100} 
      />
      {/* Invisible aim point at the sphere's center (y = 1) */}
      <object3D ref={targetRef} position={[0, 1, 0]} />
    </>
  );
}
