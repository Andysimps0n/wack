import { Vector3 } from "three";

export function dentMesh(mesh, localPointt, localInward, radius, strength) {
  const position = mesh.geometry.attributes.position;
  if (!position) return;
 
  const vertex = new Vector3()
  const direction = localInward.clone().normalize();

  for (let i = 0; i < position.count; i++){
   vertex.fromBufferAttribute(position, i);
   const distance = vertex.distanceTo(localPoint)
   if (distance >= radius) continue

    d
 }

}