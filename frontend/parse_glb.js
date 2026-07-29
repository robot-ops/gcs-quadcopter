import fs from 'fs';
import path from 'path';

const filePath = 'd:\\Redesma\\Dummy\\uav-quadcopter\\frontend\\public\\drone.glb';

try {
  const fileBuffer = fs.readFileSync(filePath);
  const chunkLength = fileBuffer.readUInt32LE(12);
  const jsonString = fileBuffer.toString('utf8', 20, 20 + chunkLength);
  const gltf = JSON.parse(jsonString);
  
  console.log('Extensions Used:', gltf.extensionsUsed);
  console.log('Extensions Required:', gltf.extensionsRequired);
} catch (err) {
  console.error('Error:', err);
}
