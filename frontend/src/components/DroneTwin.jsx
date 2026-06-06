import { useEffect, useRef, useState } from "react";
import { useTelemetry } from "../context/TelemetryContext";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Loader2 } from "lucide-react";

export default function DroneTwin() {
  const { currentTelemetry, droneState } = useTelemetry();
  const containerRef = useRef(null);
  const [modelLoading, setModelLoading] = useState(true);

  // References for Three.js objects to access outside initialization
  const droneGroupRef = useRef(new THREE.Group());
  const propellersRef = useRef([]);
  const targetYRef = useRef(-0.8);

  // Synchronize Roll, Pitch, Yaw rotation in degrees -> radians
  useEffect(() => {
    if (!droneGroupRef.current) return;

    // Aerospace convention: 
    // Roll represents rotation around X-axis (or local longitudinal axis)
    // Pitch represents rotation around Z-axis (or local lateral axis)
    // Yaw represents rotation around Y-axis (vertical axis)
    const rollRad = (currentTelemetry?.roll || 0) * (Math.PI / 180);
    const pitchRad = (currentTelemetry?.pitch || 0) * (Math.PI / 180);
    const yawRad = (currentTelemetry?.yaw || 0) * (Math.PI / 180);

    // Apply rotation
    droneGroupRef.current.rotation.set(pitchRad, yawRad, rollRad);
  }, [currentTelemetry?.roll, currentTelemetry?.pitch, currentTelemetry?.yaw]);

  // Synchronize Altitude position mapping
  useEffect(() => {
    const rawAlt = currentTelemetry?.altitude || 0.0;
    // Map altitude (0m -> 30m+) to visual Y height (-0.8 on ground to 1.2 in air)
    const targetY = Math.min(1.2, -0.8 + (rawAlt / 15.0) * 1.5);
    targetYRef.current = targetY;
  }, [currentTelemetry?.altitude]);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = null; // transparent background

    // 2. Camera setup
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2, 1.5, 3.5);

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(5, 8, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xf59e0b, 1.5, 10);
    pointLight.position.set(0, 1.5, 0);
    scene.add(pointLight);

    // Ground plane grid (custom matching GCS theme)
    const gridHelper = new THREE.GridHelper(10, 12, 0xd97706, 0xe7e5e4);
    gridHelper.position.y = -0.8;
    scene.add(gridHelper);

    // Shadow catcher invisible plane
    const planeGeom = new THREE.PlaneGeometry(10, 10);
    const planeMat = new THREE.ShadowMaterial({ opacity: 0.15 });
    const planeMesh = new THREE.Mesh(planeGeom, planeMat);
    planeMesh.rotation.x = -Math.PI / 2;
    planeMesh.position.y = -0.8;
    planeMesh.receiveShadow = true;
    scene.add(planeMesh);

    // Parent group for rotation & positioning
    const droneGroup = droneGroupRef.current;
    droneGroup.position.set(0, -0.8, 0);
    scene.add(droneGroup);

    // 5. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // prevent looking below ground grid
    controls.minDistance = 1.2;
    controls.maxDistance = 6.0;

    // Helper: Build procedural quadcopter fallback
    const buildProceduralQuadcopter = () => {
      const bodyGeom = new THREE.SphereGeometry(0.35, 32, 32);
      const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x27272a, // zinc-800
        metalness: 0.85,
        roughness: 0.2
      });
      const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
      bodyMesh.scale.set(1.3, 0.45, 1.3);
      bodyMesh.castShadow = true;
      bodyMesh.receiveShadow = true;
      droneGroup.add(bodyMesh);

      // Amber glass top canopy
      const canopyGeom = new THREE.SphereGeometry(0.22, 32, 32, 0, Math.PI*2, 0, Math.PI/2);
      const canopyMat = new THREE.MeshStandardMaterial({
        color: 0xd97706, // dark amber
        emissive: 0xf59e0b,
        emissiveIntensity: 0.4,
        transparent: true,
        opacity: 0.75,
        metalness: 0.9,
        roughness: 0.1
      });
      const canopyMesh = new THREE.Mesh(canopyGeom, canopyMat);
      canopyMesh.position.y = 0.1;
      canopyMesh.castShadow = true;
      droneGroup.add(canopyMesh);

      // Diagonally structured carbon rods (arms)
      const armMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.9, roughness: 0.4 });
      const armLen = 1.0;
      const armThick = 0.06;
      const dirs = [
        { x: 1, z: 1 },
        { x: -1, z: 1 },
        { x: 1, z: -1 },
        { x: -1, z: -1 }
      ];

      dirs.forEach((dir, idx) => {
        const armGeom = new THREE.CylinderGeometry(armThick, armThick, armLen, 12);
        const armMesh = new THREE.Mesh(armGeom, armMat);
        armMesh.rotation.x = Math.PI / 2;
        const angle = Math.atan2(dir.z, dir.x);
        armMesh.rotation.z = angle - Math.PI / 2;
        armMesh.position.set((dir.x * armLen) / 4, 0, (dir.z * armLen) / 4);
        armMesh.castShadow = true;
        droneGroup.add(armMesh);

        // Brushless Motor mount cylinders
        const motorGeom = new THREE.CylinderGeometry(0.09, 0.09, 0.18, 12);
        const motorMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.95 });
        const motorMesh = new THREE.Mesh(motorGeom, motorMat);
        motorMesh.position.set((dir.x * armLen) / 2, 0.06, (dir.z * armLen) / 2);
        motorMesh.castShadow = true;
        droneGroup.add(motorMesh);

        // Two-blade Props
        const propGeom = new THREE.BoxGeometry(0.65, 0.012, 0.06);
        const propMat = new THREE.MeshStandardMaterial({
          color: idx < 2 ? 0xd97706 : 0x71717a, // Front: Amber, Back: Zinc grey
          transparent: true,
          opacity: 0.9
        });
        const propMesh = new THREE.Mesh(propGeom, propMat);
        propMesh.position.set((dir.x * armLen) / 2, 0.16, (dir.z * armLen) / 2);
        propMesh.castShadow = true;
        droneGroup.add(propMesh);
        propellersRef.current.push(propMesh);
      });
    };

    // 6. Loading Model GLTF / fallback
    const loader = new GLTFLoader();
    loader.load(
      "/assets/quadcopter.glb",
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1.2, 1.2, 1.2);
        model.traverse(node => {
          if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });
        droneGroup.add(model);
        setModelLoading(false);
      },
      undefined,
      () => {
        // Fallback procedural layout
        buildProceduralQuadcopter();
        setModelLoading(false);
      }
    );

    // 7. Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Spin propellers based on active state speeds
      let spinSpeed = 0;
      if (droneState === "TAKEOFF" || droneState === "FLYING") {
        spinSpeed = 0.45;
      } else if (droneState === "LANDING") {
        spinSpeed = 0.28;
      } else if (droneState === "ARMED") {
        spinSpeed = 0.08;
      }

      propellersRef.current.forEach((prop, idx) => {
        const rotationDirection = idx % 2 === 0 ? 1 : -1;
        prop.rotation.y += spinSpeed * rotationDirection;
      });

      // Smoothly interpolate vertical position Y for height feedback
      const currentY = droneGroup.position.y;
      droneGroup.position.y += (targetYRef.current - currentY) * 0.08;

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle container resizing
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [droneState]);

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-radial from-amber-500/5 to-transparent rounded-xl overflow-hidden">
      {modelLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/20 z-10">
          <Loader2 className="animate-spin text-amber-500 mb-2" size={32} />
          <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-widest display-font">
            Loading Virtual Twin...
          </span>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full z-0 cursor-grab active:cursor-grabbing" />
    </div>
  );
}
