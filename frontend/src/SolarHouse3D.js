import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// 格式化功率显示 - 统一使用 kW
const formatPower = (value) => {
  if (value === undefined || value === null) return { value: '0.00', unit: 'kW' };
  return { value: value.toFixed(2), unit: 'kW' };
};

const SolarHouse3D = ({ 
  solar = 0,
  grid = 0,
  battery = 0,
  load = 0,
  batteryPercent = 0,
  // 能量流动状态
  solarToHome = false,
  solarToBattery = false,
  batteryToHome = false,
  gridToHome = false,
  solarToGrid = false,
}) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const batteryGlowMeshRef = useRef(null);
  const animationIdRef = useRef(null);

  // 格式化各个功率值
  const solarFormatted = formatPower(solar);
  const gridFormatted = formatPower(Math.abs(grid));
  const batteryFormatted = formatPower(Math.abs(battery));
  const loadFormatted = formatPower(load);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 650;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2d323d);
    sceneRef.current = scene;

    // Camera - 模型大小调整
    const aspect = width / height;
    const viewSize = 6.5;
    const camera = new THREE.OrthographicCamera(
      -viewSize * aspect, viewSize * aspect,
      viewSize, -viewSize,
      0.1, 1000
    );
    camera.position.set(10, 7, 10);
    camera.lookAt(-2, 0, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x8899bb, 0.4);
    fillLight.position.set(-10, 5, -10);
    scene.add(fillLight);

    // Create Scene
    createScene(scene, batteryPercent);

    // Animation
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Resize handler
    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      const aspect = width / height;
      camera.left = -viewSize * aspect;
      camera.right = viewSize * aspect;
      camera.top = viewSize;
      camera.bottom = -viewSize;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current && container.contains(rendererRef.current.domElement)) {
        container.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current?.dispose();
    };
  }, []);

  // Update battery glow when percent changes
  useEffect(() => {
    if (batteryGlowMeshRef.current) {
      const maxH = 0.9;
      const h = (batteryPercent / 100) * maxH;
      batteryGlowMeshRef.current.geometry.dispose();
      batteryGlowMeshRef.current.geometry = new THREE.BoxGeometry(0.58, h, 0.03);
      batteryGlowMeshRef.current.position.y = 0.35 + h / 2;
    }
  }, [batteryPercent]);

  const createScene = (scene, initialBatteryPercent) => {
    // Materials
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x6e7580, roughness: 0.85 });
    const wallSideMaterial = new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.85 });
    const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.7 });
    const solarPanelMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x1a3050, roughness: 0.15, metalness: 0.7
    });
    const solarGridMaterial = new THREE.LineBasicMaterial({ color: 0x3a5575 });
    const solarFrameMaterial = new THREE.LineBasicMaterial({ color: 0x6090b0 });
    const windowMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffdd44, emissive: 0xffcc00, emissiveIntensity: 0.9, roughness: 0.1
    });
    const batteryMaterial = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.3 });
    const batteryGlowMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x00e8bb, emissive: 0x00e8bb, emissiveIntensity: 0.8
    });
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x454b55, roughness: 0.9 });
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x7a8088, roughness: 0.6 });
    const inverterMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4 });

    // Ground
    const ground = new THREE.Mesh(new THREE.BoxGeometry(10, 0.25, 7.5), groundMaterial);
    ground.position.set(1, -0.125, 0);
    ground.receiveShadow = true;
    scene.add(ground);

    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(10.3, 0.1, 7.8),
      new THREE.MeshStandardMaterial({ color: 0x35393f })
    );
    edge.position.set(1, -0.3, 0);
    scene.add(edge);

    // House parameters
    const wallHeight = 2.8;
    const wallWidth = 4.2;
    const wallDepth = 3.9;
    const roofHeight = 1.6;
    const eaveOverhang = 0.35;
    const roofAngle = Math.atan2(roofHeight, wallWidth / 2);

    const houseGroup = new THREE.Group();

    // Front wall
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallWidth, wallHeight, 0.15),
      wallMaterial
    );
    frontWall.position.set(0, wallHeight / 2, wallDepth / 2);
    frontWall.castShadow = true;
    houseGroup.add(frontWall);

    // Back wall
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallWidth, wallHeight, 0.15),
      wallSideMaterial
    );
    backWall.position.set(0, wallHeight / 2, -wallDepth / 2);
    houseGroup.add(backWall);

    // Left wall
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, wallHeight, wallDepth),
      wallSideMaterial
    );
    leftWall.position.set(-wallWidth / 2, wallHeight / 2, 0);
    houseGroup.add(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, wallHeight, wallDepth),
      wallMaterial
    );
    rightWall.position.set(wallWidth / 2, wallHeight / 2, 0);
    houseGroup.add(rightWall);

    // Roof
    const roofLength = Math.sqrt(roofHeight * roofHeight + (wallWidth / 2) * (wallWidth / 2)) + eaveOverhang;
    const roofDepth = wallDepth + eaveOverhang * 2;

    // Left roof
    const leftRoof = new THREE.Mesh(
      new THREE.BoxGeometry(roofLength, 0.12, roofDepth),
      roofMaterial
    );
    leftRoof.position.set(-wallWidth / 4 - eaveOverhang * 0.2, wallHeight + roofHeight / 2, 0);
    leftRoof.rotation.z = roofAngle;
    leftRoof.castShadow = true;
    houseGroup.add(leftRoof);

    // Right roof
    const rightRoof = new THREE.Mesh(
      new THREE.BoxGeometry(roofLength, 0.12, roofDepth),
      roofMaterial
    );
    rightRoof.position.set(wallWidth / 4 + eaveOverhang * 0.2, wallHeight + roofHeight / 2, 0);
    rightRoof.rotation.z = -roofAngle;
    rightRoof.castShadow = true;
    houseGroup.add(rightRoof);

    // Ridge
    const ridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, roofDepth),
      roofMaterial
    );
    ridge.position.set(0, wallHeight + roofHeight + 0.1, 0);
    houseGroup.add(ridge);

    // Roof triangles
    const triShape = new THREE.Shape();
    triShape.moveTo(-wallWidth / 2, 0);
    triShape.lineTo(0, roofHeight);
    triShape.lineTo(wallWidth / 2, 0);
    triShape.lineTo(-wallWidth / 2, 0);
    const triGeo = new THREE.ShapeGeometry(triShape);

    const frontTri = new THREE.Mesh(triGeo, wallMaterial);
    frontTri.position.set(0, wallHeight, wallDepth / 2 + 0.08);
    houseGroup.add(frontTri);

    const backTri = new THREE.Mesh(triGeo, wallSideMaterial);
    backTri.position.set(0, wallHeight, -wallDepth / 2 - 0.08);
    backTri.rotation.y = Math.PI;
    houseGroup.add(backTri);

    // Solar panels
    const panelRows = 5;
    const panelCols = 4;
    const panelWidth = 0.5;
    const panelH = 0.6;
    const gap = 0.08;

    const solarGroup = new THREE.Group();
    const totalW = panelCols * panelWidth + (panelCols - 1) * gap;
    const totalH = panelRows * panelH + (panelRows - 1) * gap;

    for (let row = 0; row < panelRows; row++) {
      for (let col = 0; col < panelCols; col++) {
        const localX = -totalW / 2 + panelWidth / 2 + col * (panelWidth + gap);
        const localZ = -totalH / 2 + panelH / 2 + row * (panelH + gap);

        const panelGeo = new THREE.BoxGeometry(panelWidth, 0.04, panelH);
        const panel = new THREE.Mesh(panelGeo, solarPanelMaterial);
        panel.position.set(localX, 0.02, localZ);
        solarGroup.add(panel);

        const edgesGeo = new THREE.EdgesGeometry(panelGeo);
        const edges = new THREE.LineSegments(edgesGeo, solarFrameMaterial);
        edges.position.set(localX, 0.02, localZ);
        solarGroup.add(edges);

        for (let i = 1; i <= 2; i++) {
          const lineZ = localZ - panelH / 2 + i * panelH / 3;
          const pts = [
            new THREE.Vector3(localX - panelWidth / 2 + 0.02, 0.04, lineZ),
            new THREE.Vector3(localX + panelWidth / 2 - 0.02, 0.04, lineZ)
          ];
          const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
          solarGroup.add(new THREE.Line(lineGeo, solarGridMaterial));
        }

        const vPts = [
          new THREE.Vector3(localX, 0.04, localZ - panelH / 2 + 0.02),
          new THREE.Vector3(localX, 0.04, localZ + panelH / 2 - 0.02)
        ];
        const vLineGeo = new THREE.BufferGeometry().setFromPoints(vPts);
        solarGroup.add(new THREE.Line(vLineGeo, solarGridMaterial));
      }
    }

    solarGroup.rotation.z = -roofAngle;
    solarGroup.position.set(wallWidth / 4 + 0.3, wallHeight + roofHeight / 2 + 0.15, 0);
    houseGroup.add(solarGroup);

    // Window
    const windowGroup = new THREE.Group();
    const winBg = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.4, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x2a2f38 })
    );
    windowGroup.add(winBg);

    const glassGeo = new THREE.BoxGeometry(0.45, 0.55, 0.08);
    [[-0.26, 0.32], [0.26, 0.32], [-0.26, -0.32], [0.26, -0.32]].forEach(([x, y]) => {
      const glass = new THREE.Mesh(glassGeo, windowMaterial);
      glass.position.set(x, y, 0.05);
      windowGroup.add(glass);
    });

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a4048 });
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.08, 0.12), frameMat);
    crossH.position.z = 0.06;
    windowGroup.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.35, 0.12), frameMat);
    crossV.position.z = 0.06;
    windowGroup.add(crossV);

    windowGroup.position.set(0.8, 1.5, wallDepth / 2 + 0.08);
    houseGroup.add(windowGroup);

    houseGroup.position.set(1.5, 0, 0);
    scene.add(houseGroup);

    // Battery
    const batteryGroup = new THREE.Group();
    const batt = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.5, 0.45), batteryMaterial);
    batt.position.y = 0.75;
    batt.castShadow = true;
    batteryGroup.add(batt);

    const display = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 1.0, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x1a1a1a })
    );
    display.position.set(0, 0.8, 0.24);
    batteryGroup.add(display);

    const maxGlowH = 0.9;
    const glowH = (initialBatteryPercent / 100) * maxGlowH;
    const batteryGlowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.58, glowH, 0.03),
      batteryGlowMaterial
    );
    batteryGlowMesh.position.set(0, 0.35 + glowH / 2, 0.25);
    batteryGroup.add(batteryGlowMesh);
    batteryGlowMeshRef.current = batteryGlowMesh;

    const led = new THREE.Mesh(
      new THREE.CircleGeometry(0.04, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ff88 })
    );
    led.position.set(0, 1.35, 0.24);
    batteryGroup.add(led);

    batteryGroup.position.set(-0.5, 0, 2.8);
    scene.add(batteryGroup);

    // Inverter
    const inverterGroup = new THREE.Group();
    const inv = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.15), inverterMaterial);
    inverterGroup.add(inv);

    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.18, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    screen.position.set(0, 0.08, 0.09);
    inverterGroup.add(screen);

    const invLed = new THREE.Mesh(
      new THREE.CircleGeometry(0.025, 16),
      new THREE.MeshBasicMaterial({ color: 0x22cc55 })
    );
    invLed.position.set(0, -0.12, 0.09);
    inverterGroup.add(invLed);

    inverterGroup.position.set(0.6, 1.1, 2.8);
    scene.add(inverterGroup);

    // Power pole
    const poleGroup = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 4.5, 8),
      poleMaterial
    );
    pole.position.y = 2.25;
    pole.castShadow = true;
    poleGroup.add(pole);

    const beamGeo = new THREE.BoxGeometry(1.0, 0.06, 0.06);
    const beam1 = new THREE.Mesh(beamGeo, poleMaterial);
    beam1.position.set(0, 4.3, 0);
    poleGroup.add(beam1);

    const beam2 = new THREE.Mesh(beamGeo, poleMaterial);
    beam2.position.set(0, 3.9, 0);
    poleGroup.add(beam2);

    const insGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.1, 8);
    const insMat = new THREE.MeshStandardMaterial({ color: 0x99aabb });
    [-0.35, 0, 0.35].forEach(x => {
      const ins = new THREE.Mesh(insGeo, insMat);
      ins.position.set(x, 4.4, 0);
      poleGroup.add(ins);
    });

    poleGroup.position.set(-3.5, 0, 1.5);
    scene.add(poleGroup);

    // Wire
    const wirePoints = [
      new THREE.Vector3(-3.5, 4.2, 1.5),
      new THREE.Vector3(-2, 3, 2),
      new THREE.Vector3(0.6, 1.4, 2.8)
    ];
    const wireCurve = new THREE.CatmullRomCurve3(wirePoints);
    const wire = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(wireCurve.getPoints(30)),
      new THREE.LineBasicMaterial({ color: 0x555555 })
    );
    scene.add(wire);

    // Carport
    const carportGroup = new THREE.Group();
    const pillarGeo = new THREE.BoxGeometry(0.08, 1.9, 0.08);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x5a6068 });
    [[0.9, 0.7], [0.9, -0.7], [-0.9, 0.7], [-0.9, -0.7]].forEach(([x, z]) => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, 0.95, z);
      pillar.castShadow = true;
      carportGroup.add(pillar);
    });

    const cpRoof = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 1.8), roofMaterial);
    cpRoof.position.y = 1.95;
    cpRoof.castShadow = true;
    carportGroup.add(cpRoof);

    carportGroup.position.set(4.2, 0, 0.3);
    scene.add(carportGroup);

    // Car
    const carGroup = new THREE.Group();
    const carMat = new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.5, roughness: 0.4 });

    const carBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.75), carMat);
    carBody.position.y = 0.28;
    carBody.castShadow = true;
    carGroup.add(carBody);

    const carTop = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.32, 0.68), carMat);
    carTop.position.set(-0.08, 0.58, 0);
    carGroup.add(carTop);

    const cwMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, metalness: 0.3, roughness: 0.1 });
    const cwGeo = new THREE.BoxGeometry(0.75, 0.28, 0.04);
    const cw1 = new THREE.Mesh(cwGeo, cwMat);
    cw1.position.set(-0.08, 0.58, 0.36);
    carGroup.add(cw1);
    const cw2 = new THREE.Mesh(cwGeo, cwMat);
    cw2.position.set(-0.08, 0.58, -0.36);
    carGroup.add(cw2);

    const wheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.08, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    [[-0.45, 0.42], [0.45, 0.42], [-0.45, -0.42], [0.45, -0.42]].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(x, 0.13, z);
      wheel.rotation.x = Math.PI / 2;
      carGroup.add(wheel);
    });

    carGroup.position.set(4.2, 0, 0.3);
    carGroup.rotation.y = -0.25;
    scene.add(carGroup);
  };

  return (
    <div className="relative w-full h-full min-h-[280px]" style={{ background: '#2d323d' }}>
      {/* Labels - 紧凑版 */}
      <div className="absolute top-[15px] left-[10px] text-white z-10">
        <div className="text-[10px] text-white/50">Solar</div>
        <div className="text-[14px] font-semibold">
          {solarFormatted.value} <span className="text-[10px] font-normal opacity-85">{solarFormatted.unit}</span>
        </div>
      </div>
      <div className="absolute top-[70px] left-[10px] text-white z-10">
        <div className="text-[10px] text-white/50">Grid</div>
        <div className="text-[14px] font-semibold">
          {gridFormatted.value} <span className="text-[10px] font-normal opacity-85">{gridFormatted.unit}</span>
        </div>
      </div>
      <div className="absolute top-[135px] left-[10px] text-white z-10">
        <div className="text-[10px] text-white/50">Battery</div>
        <div className="text-[14px] font-semibold">
          {batteryFormatted.value} <span className="text-[10px] font-normal opacity-85">{batteryFormatted.unit}</span>
        </div>
      </div>
      <div className="absolute top-[200px] left-[10px] text-white z-10">
        <div className="text-[10px] text-white/50">Load</div>
        <div className="text-[14px] font-semibold">
          {loadFormatted.value} <span className="text-[10px] font-normal opacity-85">{loadFormatted.unit}</span>
        </div>
      </div>

      {/* SVG Connection Lines - 调整为紧凑版viewBox */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-[5]" viewBox="0 0 400 320" preserveAspectRatio="xMidYMid meet">
        <style>{`
          .conn-line {
            stroke: rgba(255,255,255,0.4);
            stroke-width: 1;
            fill: none;
          }
          .energy-flow {
            stroke-width: 2;
            stroke-linecap: round;
            fill: none;
            stroke-dasharray: 6 8;
          }
          .flow-solar {
            stroke: #fbbf24;
            filter: drop-shadow(0 0 4px #fbbf24);
          }
          .flow-battery {
            stroke: #00e8bb;
            filter: drop-shadow(0 0 4px #00e8bb);
          }
          .flow-grid {
            stroke: #60a5fa;
            filter: drop-shadow(0 0 4px #60a5fa);
          }
          .flow-down {
            animation: flowDown 1.5s linear infinite;
          }
          .flow-right {
            animation: flowRight 1.5s linear infinite;
          }
          @keyframes flowDown {
            0% { stroke-dashoffset: 28; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes flowRight {
            0% { stroke-dashoffset: 28; }
            100% { stroke-dashoffset: 0; }
          }
        `}</style>
        
        {/* Label connection lines - 调整后的坐标 */}
        {/* <polyline className="conn-line" points="55,22 75,22 75,55 195,55" />
        <polyline className="conn-line" points="55,77 95,77" />
        <polyline className="conn-line" points="55,145 100,145" />
        <polyline className="conn-line" points="55,210 75,210 75,195 205,195" /> */}
        
        {/* Energy flow lines - 紧凑版坐标 280,140 280,192 185,192*/}
        {solarToGrid && (
          <polyline className="energy-flow flow-solar flow-down" points="250,90 250,70 155,70" />
        )}
        {solarToHome && (
          <polyline className="energy-flow flow-solar flow-down" points="265,148 265,176 240,176" />
        )}
        {solarToBattery && (
          <polyline className="energy-flow flow-solar flow-down" points="250,135 175,135 175,155" />
        )}
        {gridToHome && (
          <polyline className="energy-flow flow-grid flow-right" points="190,169 220,169" />
        )}
        {batteryToHome && (
          <polyline className="energy-flow flow-battery flow-right" points="180,183 220,183" />
        )}
      </svg>

      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default SolarHouse3D;
