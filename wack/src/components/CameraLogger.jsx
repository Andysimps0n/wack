import { useThree, useFrame } from "@react-three/fiber";
import { useRef } from "react";


export default function CameraLogger() {
  const { camera } = useThree();
  const last = useRef({ x: 0, y: 0, z: 0 });

  useFrame(() => {
    let { x, y, z } = camera.position;

    if (
      x !== last.current.x ||
      y !== last.current.y ||
      z !== last.current.z
    ) {
      x = Math.ceil(x*100)/100;
      y = Math.ceil(y*100)/100;
      z = Math.ceil(z*100)/100;
      console.log(`x: ${x}, y: ${y}, z: ${z}`);
      last.current = { x, y, z };
    }
  });

  return null;
}