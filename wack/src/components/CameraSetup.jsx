import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

export default function CameraSetup() {
  const { camera } = useThree();

  useEffect(() => {
    camera.position.set(8, 5, 8);
    camera.lookAt(0, 2, 0); // Focus here instead of (0,0,0)
  }, [camera]);

  return null;
}