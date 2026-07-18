// import { useGLTF } from "@react-three/drei";

// export default function Apple() {
//   const { scene } = useGLTF("/models/broken_apple2.glb");

//   console.log(scene.children);
//   return (
//     <primitive
//       object={scene}
//       scale={2}
//       position={[0, 2, 0]}
//     />
//   );
// }

import { useGLTF } from "@react-three/drei";

export default function Apple() {
  const { scene } = useGLTF("/models/broken_apple2.glb");

  return (
    <>
      {scene.children.map((piece) => (
        <primitive
          object={scene}
          scale={2}
          position={[0, 2, 0]}
        />
      ))}
    </>
  );
}