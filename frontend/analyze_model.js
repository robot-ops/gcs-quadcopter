import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Minimal browser mocks for Node.js
global.self = {};
global.window = {
  document: {
    createElement: () => ({})
  }
};
global.document = global.window.document;
global.URL = {
  createObjectURL: () => '',
  revokeObjectURL: () => ''
};

const filePath = path.resolve('public/drone.glb');

try {
  const fileBuffer = fs.readFileSync(filePath);
  const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);

  const loader = new GLTFLoader();
  loader.parse(
    arrayBuffer,
    '',
    (gltf) => {
      const model = gltf.scene;

      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      model.scale.set(1, 1, 1);
      model.updateMatrixWorld(true);

      console.log('=== Individual Mesh Bounding Boxes ===');
      let meshCount = 0;
      model.traverse((node) => {
        if (node.isMesh) {
          meshCount++;
          const localBox = new THREE.Box3().setFromObject(node);
          const size = new THREE.Vector3();
          localBox.getSize(size);
          const center = new THREE.Vector3();
          localBox.getCenter(center);
          
          if (size.x > 100 || size.y > 100 || size.z > 100) {
            console.log(`Mesh ${meshCount}: name="${node.name}" (HUGE)`);
            console.log(`  Size:`, size.x, size.y, size.z);
            console.log(`  Center:`, center.x, center.y, center.z);
          } else {
            console.log(`Mesh ${meshCount}: name="${node.name}" - Size: ${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)} - Center: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}`);
          }
        }
      });
    },
    (err) => {
      console.error('Error parsing GLTF:', err);
    }
  );
} catch (err) {
  console.error('Error running script:', err);
}
