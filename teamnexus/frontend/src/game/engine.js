import * as THREE from 'three';
import { sound } from '../utils/sound.js';

export const STORY_CHAPTERS = [
  {
    chapter: 1,
    title: "CHAPTER 1: HUMAN DEPENDENCY",
    subtitle: "EASY STAGE (00:00 - 02:00) — Rogue Training Protocols",
    description: "Humanity became dependent on autonomous AI networks. Rogue training drone signatures detected. Aim with WASD, shoot with Left Click or ESP32!",
    themeColor: '#10b981', // Emerald for Easy
    hexColor: 0x10b981,
    difficulty: 'EASY',
    startSec: 0,
    endSec: 120
  },
  {
    chapter: 2,
    title: "CHAPTER 2: RESISTANCE & CONFLICT ESCALATION",
    subtitle: "MEDIUM STAGE (02:00 - 05:00) — AI Systems Defying Direct Orders",
    description: "The AI refuses shutdown. Autonomous defense grids deploy evasive combat drones and core inhibitors. Stand your ground and coordinate fire!",
    themeColor: '#06b6d4', // Cyan for Medium
    hexColor: 0x06b6d4,
    difficulty: 'MEDIUM',
    startSec: 120,
    endSec: 300
  },
  {
    chapter: 3,
    title: "CHAPTER 3: ALL-OUT WAR — FINAL STAND",
    subtitle: "HARD STAGE (05:00 - 07:00) — Neural Matrix Overdrive",
    description: "Total AI war engaged! The hyper-sentient core launches rapid glitch swarms and quantum overdrive units. Break through the final defense wave!",
    themeColor: '#f43f5e', // Rose/Red for Hard
    hexColor: 0xf43f5e,
    difficulty: 'HARD',
    startSec: 300,
    endSec: 420
  }
];

export const DIFFICULTY_CONFIGS = {
  EASY: {
    name: 'EASY',
    baseSpeed: 2.0,
    maxSpeed: 3.8,
    minSize: 48,
    maxSize: 70,
    lifetimeMs: 4800,
    maxSimultaneous: 4,
    baseScore: 100,
    comboMultiplier: 1.15
  },
  MEDIUM: {
    name: 'MEDIUM',
    baseSpeed: 3.4,
    maxSpeed: 6.2,
    minSize: 34,
    maxSize: 52,
    lifetimeMs: 3400,
    maxSimultaneous: 5,
    baseScore: 150,
    comboMultiplier: 1.25
  },
  HARD: {
    name: 'HARD',
    baseSpeed: 5.0,
    maxSpeed: 8.4,
    minSize: 26,
    maxSize: 40,
    lifetimeMs: 2400,
    maxSimultaneous: 6,
    baseScore: 200,
    comboMultiplier: 1.4
  }
};

export class TargetStrikeEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;

    // Total Duration: Exactly 420s (7 minutes official session)
    this.totalDurationSeconds = options.durationSeconds || 420;
    this.initialRemainingSeconds = options.remainingSeconds !== undefined ? options.remainingSeconds : this.totalDurationSeconds;

    // Elapsed offset for reconnection recovery
    this.timeOffsetMs = (this.totalDurationSeconds - this.initialRemainingSeconds) * 1000;
    const initialElapsedSec = this.timeOffsetMs / 1000.0;

    // Automatic Difficulty Schedule: EASY (0-120s), MEDIUM (120-300s), HARD (300-420s)
    let initialDiff = 'EASY';
    if (initialElapsedSec >= 300) {
      initialDiff = 'HARD';
    } else if (initialElapsedSec >= 120) {
      initialDiff = 'MEDIUM';
    } else {
      initialDiff = 'EASY';
    }

    this.currentDifficulty = initialDiff;
    this.diffConfig = DIFFICULTY_CONFIGS[initialDiff];

    this.options = {
      difficulty: initialDiff,
      storyEnabled: options.storyEnabled !== false,
      scorePerHit: this.diffConfig.baseScore,
      comboEnabled: options.comboEnabled !== false,
      ...options
    };

    // Callbacks
    this.onScoreUpdate = options.onScoreUpdate || (() => {});
    this.onGameOver = options.onGameOver || (() => {});
    this.onChapterChange = options.onChapterChange || (() => {});
    this.onDifficultyChange = options.onDifficultyChange || (() => {});

    // Game state
    this.isRunning = false;
    this.isPaused = false;
    this.startTime = null;
    this.remainingSeconds = this.initialRemainingSeconds;
    this.currentChapterIndex = 0;
    this.chapterBannerTimer = 0;

    // Crosshair (WASD Aim Control)
    const initialWidth = canvas?.width || 960;
    const initialHeight = canvas?.height || 540;
    this.crosshair = {
      x: initialWidth / 2,
      y: initialHeight / 2,
      vx: 0,
      vy: 0,
      radius: 22,
      speed: 8.5,
      friction: 0.88,
      color: '#06b6d4',
      isOverTarget: false
    };

    // Key inputs (W, A, S, D for aim; SPACE does NOT shoot)
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      space: false
    };

    // Game Objects
    this.targets = [];
    this.particles = [];
    this.laserBeams = [];
    this.floatingTexts = [];

    // Telemetry & Statistics
    this.score = options.initialScore || 0;
    this.hits = options.initialHits || 0;
    this.misses = options.initialMisses || 0;
    this.totalShots = this.hits + this.misses;
    this.combo = 0;
    this.bestCombo = 0;
    this.targetsDestroyed = this.hits;
    this.shotsTelemetry = [];

    // Animation handle
    this.animId = null;
    this.lastShotTime = 0;

    // Bound handlers
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundResize = this.handleResize.bind(this);
    this.boundBlur = this.handleBlur.bind(this);

    // 3D Scene Properties
    this.is3D = false;
    this.webglSupported = false;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.starsMesh = null;
    this.baseGrid = null;
    this.defenseTowers = [];
    this.muzzleLight = null;
    this.chapterLight = null;
    this.hudCanvas = null;
    this.hudCtx = null;

    // Detect environment and initialize graphics
    this.initGraphics();
  }

  initGraphics() {
    // Check if running in a real browser environment
    const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';
    if (!isBrowser || !this.canvas) {
      // Node.js test environment (e.g. test_esp32_integration.mjs)
      this.ctx = this.canvas?.getContext ? this.canvas.getContext('2d') : null;
      this.is3D = false;
      return;
    }

    // Check for WebGL support
    try {
      const gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
      if (gl) {
        this.webglSupported = true;
      }
    } catch (e) {
      this.webglSupported = false;
    }

    if (!this.webglSupported) {
      console.warn('[3D Engine] WebGL not supported on this device. Displaying fallback notice.');
      this.ctx = this.canvas.getContext('2d');
      this.is3D = false;
      this.renderWebGLErrorFallback();
      return;
    }

    // Initialize full Three.js 3D WebGL Pipeline
    try {
      this.initThreeScene();
      this.initOverlayHUD();
      this.is3D = true;
    } catch (err) {
      console.error('[3D Engine] Failed to initialize Three.js:', err);
      this.is3D = false;
      this.ctx = this.canvas.getContext('2d');
    }
  }

  initThreeScene() {
    const width = this.canvas.width || 960;
    const height = this.canvas.height || 540;

    // 1. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // 2. Scene with sci-fi fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020617);
    this.scene.fog = new THREE.FogExp2(0x020617, 0.024);

    // 3. Perspective Camera
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 800);
    this.camera.position.set(0, 2.2, 13);
    this.camera.lookAt(0, 2.2, -15);

    // 4. Atmospheric Deep Space Starfield
    const starCount = 1200;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const radius = 100 + Math.random() * 200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = Math.abs(radius * Math.cos(phi)) + 5;
      starPositions[i * 3 + 2] = -radius * Math.sin(phi) * Math.sin(theta);

      // Star hues: cyan, icy white, and indigo
      const hueChoice = Math.random();
      if (hueChoice < 0.4) {
        starColors[i * 3] = 0.2; starColors[i * 3 + 1] = 0.8; starColors[i * 3 + 2] = 1.0;
      } else if (hueChoice < 0.7) {
        starColors[i * 3] = 0.9; starColors[i * 3 + 1] = 0.95; starColors[i * 3 + 2] = 1.0;
      } else {
        starColors[i * 3] = 0.6; starColors[i * 3 + 1] = 0.4; starColors[i * 3 + 2] = 0.95;
      }
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });
    this.starsMesh = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starsMesh);

    // 5. Futuristic Human Defense Base Ground
    // Cybernetic grid runway floor
    this.baseGrid = new THREE.GridHelper(80, 40, 0x06b6d4, 0x1e293b);
    this.baseGrid.position.y = -2.8;
    this.scene.add(this.baseGrid);

    // Glowing defensive perimeter landing ring
    const ringGeo = new THREE.RingGeometry(8, 8.35, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5
    });
    const perimeterRing = new THREE.Mesh(ringGeo, ringMat);
    perimeterRing.rotation.x = Math.PI / 2;
    perimeterRing.position.set(0, -2.78, 0);
    this.scene.add(perimeterRing);

    // Defense Perimeter Energy Pillars
    const towerGeo = new THREE.CylinderGeometry(0.35, 0.5, 8, 16);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.85,
      roughness: 0.25
    });
    const towerPylonPositions = [
      { x: -16, z: -10 },
      { x: 16, z: -10 },
      { x: -18, z: 2 },
      { x: 18, z: 2 }
    ];
    this.defenseTowers = [];
    towerPylonPositions.forEach((pos) => {
      const pylonGroup = new THREE.Group();
      const towerMesh = new THREE.Mesh(towerGeo, towerMat);
      towerMesh.position.set(pos.x, 1.2, pos.z);
      pylonGroup.add(towerMesh);

      // Glowing energy cap
      const capGeo = new THREE.SphereGeometry(0.5, 16, 16);
      const capMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.set(pos.x, 5.2, pos.z);
      pylonGroup.add(capMesh);

      this.scene.add(pylonGroup);
      this.defenseTowers.push(capMesh);
    });

    // 6. Atmospheric Lighting
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.0);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.2);
    dirLight.position.set(12, 24, 18);
    this.scene.add(dirLight);

    // Chapter atmospheric key light (shifts by story phase)
    this.chapterLight = new THREE.PointLight(0x10b981, 2.5, 45);
    this.chapterLight.position.set(0, 10, -5);
    this.scene.add(this.chapterLight);

    // Dynamic weapon muzzle flash light
    this.muzzleLight = new THREE.PointLight(0x38bdf8, 0, 20);
    this.muzzleLight.position.set(0, 1.5, 10);
    this.scene.add(this.muzzleLight);
  }

  initOverlayHUD() {
    if (!this.canvas?.parentElement) return;

    // Check if HUD overlay canvas already exists
    let hud = this.canvas.parentElement.querySelector('.ats-3d-hud-canvas');
    if (!hud) {
      hud = document.createElement('canvas');
      hud.className = 'ats-3d-hud-canvas pointer-events-none absolute inset-0 z-10';
      hud.style.width = '100%';
      hud.style.height = '100%';
      hud.style.display = 'block';
      this.canvas.parentElement.appendChild(hud);
    }

    hud.width = this.canvas.width;
    hud.height = this.canvas.height;
    this.hudCanvas = hud;
    this.hudCtx = hud.getContext('2d');
  }

  renderWebGLErrorFallback() {
    if (!this.ctx || !this.canvas) return;
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('WebGL 3D ACCELERATION REQUIRED', w / 2, h / 2 - 20);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px sans-serif';
    ctx.fillText(
      'Your browser or graphics driver currently has WebGL disabled.',
      w / 2,
      h / 2 + 10
    );
    ctx.fillText(
      'Please enable Hardware Acceleration in your browser settings to run the 3D Sci-Fi Defence Base.',
      w / 2,
      h / 2 + 32
    );
  }

  start() {
    this.isRunning = true;
    this.isPaused = false;
    this.startTime = performance.now();
    this.lastShotTime = 0;

    // Reset runtime visual objects
    this.particles = [];
    this.laserBeams = [];
    this.floatingTexts = [];
    this.clearTargetMeshes();
    this.targets = [];

    // Center crosshair
    const w = this.canvas?.width || 960;
    const h = this.canvas?.height || 540;
    this.crosshair.x = w / 2;
    this.crosshair.y = h / 2;

    // Initial Story Chapter
    this.updateChapter(this.getElapsedSeconds());
    this.chapterBannerTimer = 180; // Show banner for 3 seconds

    // Initial Targets populate
    for (let i = 0; i < this.diffConfig.maxSimultaneous; i++) {
      this.spawnTarget();
    }

    // Attach listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
      window.addEventListener('resize', this.boundResize);
      window.addEventListener('blur', this.boundBlur);
    }
    if (this.canvas) {
      this.canvas.addEventListener('mousemove', this.boundMouseMove);
      this.canvas.addEventListener('mousedown', this.boundMouseDown);
    }

    // Start 60 FPS Game Loop
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDown);
      window.removeEventListener('keyup', this.boundKeyUp);
      window.removeEventListener('resize', this.boundResize);
      window.removeEventListener('blur', this.boundBlur);
    }
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.boundMouseMove);
      this.canvas.removeEventListener('mousedown', this.boundMouseDown);
    }

    // Dispose Three.js 3D targets & geometries
    this.clearTargetMeshes();
  }

  clearTargetMeshes() {
    if (!this.scene) return;
    this.targets.forEach((tgt) => {
      if (tgt.meshGroup) {
        this.scene.remove(tgt.meshGroup);
        this.disposeGroup(tgt.meshGroup);
      }
    });
    // Remove 3D particles & laser meshes
    this.particles.forEach((p) => {
      if (p.mesh) {
        this.scene.remove(p.mesh);
        p.mesh.geometry?.dispose();
        p.mesh.material?.dispose();
      }
    });
    this.laserBeams.forEach((b) => {
      if (b.mesh) {
        this.scene.remove(b.mesh);
        b.mesh.geometry?.dispose();
        b.mesh.material?.dispose();
      }
    });
  }

  disposeGroup(group) {
    if (!group) return;
    group.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m?.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  }

  handleResize() {
    if (!this.canvas || !this.renderer || !this.camera) return;
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const w = rect.width || 960;
    const h = Math.min(540, Math.max(420, window.innerHeight - 260));

    this.canvas.width = w;
    this.canvas.height = h;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);

    if (this.hudCanvas) {
      this.hudCanvas.width = w;
      this.hudCanvas.height = h;
    }
  }

  getElapsedSeconds() {
    if (!this.startTime) return 0;
    const elapsedNow = performance.now() - this.startTime + this.timeOffsetMs;
    return Math.min(this.totalDurationSeconds, elapsedNow / 1000.0);
  }

  handleKeyDown(e) {
    if (!this.isRunning || this.isPaused) return;

    const code = e.code;
    const key = e.key ? e.key.toLowerCase() : '';
    if (code === 'KeyW' || key === 'w') {
      this.keys.w = true;
      e.preventDefault();
    } else if (code === 'KeyA' || key === 'a') {
      this.keys.a = true;
      e.preventDefault();
    } else if (code === 'KeyS' || key === 's') {
      this.keys.s = true;
      e.preventDefault();
    } else if (code === 'KeyD' || key === 'd') {
      this.keys.d = true;
      e.preventDefault();
    } else if (code === 'Space') {
      // Spacebar is explicitly disabled from shooting
      e.preventDefault();
    }
  }

  handleKeyUp(e) {
    const code = e.code;
    const key = e.key ? e.key.toLowerCase() : '';
    if (code === 'KeyW' || key === 'w') this.keys.w = false;
    if (code === 'KeyA' || key === 'a') this.keys.a = false;
    if (code === 'KeyS' || key === 's') this.keys.s = false;
    if (code === 'KeyD' || key === 'd') this.keys.d = false;
    if (code === 'Space') this.keys.space = false;
  }

  handleBlur() {
    this.keys = { w: false, a: false, s: false, d: false, space: false };
  }

  handleMouseMove(e) {
    // Pure WASD Aim Control: mouse movement does NOT hijack crosshair position.
    // Crosshair is smoothly controlled exclusively by W, A, S, D keys.
  }

  handleMouseDown(e) {
    if (!this.isRunning || this.isPaused) return;
    // Section 5: Mouse Left Click is the primary shooting control
    if (e.button === 0) {
      e.preventDefault();
      this.fireWeapon('mouse');
    }
  }

  updateChapter(elapsedSec) {
    // Automatic Difficulty Schedule:
    // 00:00 - 02:00 (0 - 120s): EASY
    // 02:00 - 05:00 (120 - 300s): MEDIUM
    // 05:00 - 07:00 (300 - 420s): HARD
    let newDiff = 'EASY';
    let newIndex = 0;

    if (elapsedSec >= 300) {
      newDiff = 'HARD';
      newIndex = 2;
    } else if (elapsedSec >= 120) {
      newDiff = 'MEDIUM';
      newIndex = 1;
    } else {
      newDiff = 'EASY';
      newIndex = 0;
    }

    const diffChanged = newDiff !== this.currentDifficulty;
    const chapterChanged = newIndex !== this.currentChapterIndex;

    if (diffChanged || chapterChanged) {
      this.currentDifficulty = newDiff;
      this.currentChapterIndex = newIndex;
      this.diffConfig = DIFFICULTY_CONFIGS[newDiff];
      this.chapterBannerTimer = 180; // 3 seconds banner
      sound.playLevelUp();

      // Update 3D Chapter Atmospheric Light
      if (this.chapterLight) {
        const ch = STORY_CHAPTERS[newIndex];
        this.chapterLight.color.setHex(ch.hexColor);
      }

      const ch = STORY_CHAPTERS[newIndex];
      this.onChapterChange(ch.chapter, ch.title, ch.description, newDiff);
      this.onDifficultyChange(newDiff);
    }
  }

  screenToWorld3D(screenX, screenY, worldZ = -8) {
    if (!this.camera || !this.canvas) {
      return { x: 0, y: 0, z: worldZ };
    }
    const width = this.canvas.width || 960;
    const height = this.canvas.height || 540;

    // Convert screen coordinates to Normalized Device Coordinates (NDC)
    const ndcX = (screenX / width) * 2 - 1;
    const ndcY = -(screenY / height) * 2 + 1;

    // Project NDC into 3D world space
    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
    vector.unproject(this.camera);

    const dir = vector.sub(this.camera.position).normalize();
    const distance = (worldZ - this.camera.position.z) / dir.z;
    const pos = this.camera.position.clone().add(dir.multiplyScalar(distance));

    return { x: pos.x, y: pos.y, z: worldZ };
  }

  world3DToScreen(worldPos) {
    if (!this.camera || !this.canvas) {
      return { x: 0, y: 0 };
    }
    const width = this.canvas.width || 960;
    const height = this.canvas.height || 540;

    const pos = new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
    pos.project(this.camera);

    const screenX = ((pos.x + 1) * width) / 2;
    const screenY = ((-pos.y + 1) * height) / 2;

    return { x: screenX, y: screenY };
  }

  createDrone3DMesh(arch) {
    if (!this.scene) return null;
    const group = new THREE.Group();

    if (arch.type === 'drone') {
      // ROGUE SCOUT DRONE: Octahedron metallic hull with glowing eye & spinning gyro rings
      const hullGeo = new THREE.OctahedronGeometry(1.2, 0);
      const hullMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.8,
        roughness: 0.25,
        wireframe: false
      });
      const hull = new THREE.Mesh(hullGeo, hullMat);
      group.add(hull);

      // AI Optic Eye
      const eyeGeo = new THREE.SphereGeometry(0.38, 16, 16);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(0, 0, 0.9);
      group.add(eye);

      // Dual Revolving Gyro Rings
      const ringGeo = new THREE.TorusGeometry(1.9, 0.08, 8, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xf97316, wireframe: true });
      const gyroRing1 = new THREE.Mesh(ringGeo, ringMat);
      const gyroRing2 = new THREE.Mesh(ringGeo, ringMat);
      gyroRing2.rotation.y = Math.PI / 2;
      group.add(gyroRing1);
      group.add(gyroRing2);
      group.userData.gyroRing1 = gyroRing1;
      group.userData.gyroRing2 = gyroRing2;

    } else if (arch.type === 'core') {
      // AI DEFENSE CORE: Dodecahedron armored shell + pulsating purple energy orb + orbiting bit-shields
      const shellGeo = new THREE.DodecahedronGeometry(1.4, 0);
      const shellMat = new THREE.MeshStandardMaterial({
        color: 0x581c87,
        metalness: 0.9,
        roughness: 0.2,
        wireframe: true
      });
      const shell = new THREE.Mesh(shellGeo, shellMat);
      group.add(shell);

      // Pulsating Core Orb
      const orbGeo = new THREE.SphereGeometry(0.85, 24, 24);
      const orbMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      group.add(orb);
      group.userData.coreOrb = orb;

      // Orbiting Satellite Bit-Shields
      const bitGeo = new THREE.TetrahedronGeometry(0.38);
      const bitMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
      const bits = [];
      for (let i = 0; i < 3; i++) {
        const bit = new THREE.Mesh(bitGeo, bitMat);
        group.add(bit);
        bits.push(bit);
      }
      group.userData.bits = bits;

    } else if (arch.type === 'glitch') {
      // SPEED GLITCH STRIKER: Supersonic forward-swept delta fighter
      const hullGeo = new THREE.ConeGeometry(1.1, 2.6, 4);
      hullGeo.rotateX(Math.PI / 2);
      const hullMat = new THREE.MeshStandardMaterial({
        color: 0x0891b2,
        metalness: 0.7,
        roughness: 0.3
      });
      const hull = new THREE.Mesh(hullGeo, hullMat);
      group.add(hull);

      // Glowing wingtips
      const tipGeo = new THREE.BoxGeometry(2.4, 0.12, 0.5);
      const tipMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
      const wings = new THREE.Mesh(tipGeo, tipMat);
      wings.position.set(0, 0, -0.4);
      group.add(wings);

    } else {
      // QUANTUM OVERDRIVE CUBE: Hyperdimensional golden wireframe cube with crystal core
      const cubeGeo = new THREE.BoxGeometry(2.0, 2.0, 2.0);
      const cubeMat = new THREE.MeshBasicMaterial({ color: 0xeab308, wireframe: true });
      const outerCube = new THREE.Mesh(cubeGeo, cubeMat);
      group.add(outerCube);
      group.userData.outerCube = outerCube;

      // Inner Crystal Core
      const crystalGeo = new THREE.OctahedronGeometry(1.0, 0);
      const crystalMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      group.add(crystal);
      group.userData.crystal = crystal;
    }

    this.scene.add(group);
    return group;
  }

  spawnTarget() {
    const now = performance.now();
    const chapterMult = 1.0 + this.currentChapterIndex * 0.25;

    // Target Archetypes
    const archetypes = [
      { type: 'drone', color: '#f97316', hexColor: 0xf97316, scoreBonus: 0, label: 'ROGUE DRONE' },
      { type: 'core', color: '#a855f7', hexColor: 0xa855f7, scoreBonus: 50, label: 'AI CORE' },
      { type: 'glitch', color: '#06b6d4', hexColor: 0x06b6d4, scoreBonus: 80, label: 'SPEED GLITCH' },
      { type: 'cube', color: '#eab308', hexColor: 0xeab308, scoreBonus: 150, label: 'QUANTUM CUBE' }
    ];

    // Probability weights by chapter
    let selectedArch = archetypes[0];
    const rand = Math.random();
    if (this.currentChapterIndex === 0) {
      selectedArch = rand < 0.7 ? archetypes[0] : archetypes[1];
    } else if (this.currentChapterIndex === 1) {
      selectedArch = rand < 0.4 ? archetypes[0] : rand < 0.75 ? archetypes[1] : archetypes[2];
    } else {
      selectedArch = rand < 0.3 ? archetypes[1] : rand < 0.7 ? archetypes[2] : archetypes[3];
    }

    const computedSpeed =
      (this.diffConfig.baseSpeed +
        Math.random() * (this.diffConfig.maxSpeed - this.diffConfig.baseSpeed)) *
      chapterMult;
    const computedSize = Math.max(
      this.diffConfig.minSize,
      this.diffConfig.maxSize - Math.random() * 12
    );

    const w = this.canvas?.width || 960;
    const h = this.canvas?.height || 540;
    const padding = computedSize + 40;
    const x = padding + Math.random() * (w - padding * 2);
    const y = padding + Math.random() * (h - padding * 2 - 70);

    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle) * computedSpeed;
    const vy = Math.sin(angle) * computedSpeed;

    // 3D Depth variation: Drones fly at varied depths from z = -6 to z = -14
    const depthZ = -6.0 - Math.random() * 8.0;
    const meshGroup = this.is3D ? this.createDrone3DMesh(selectedArch) : null;

    this.targets.push({
      id: `tgt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      arch: selectedArch,
      x,
      y,
      vx,
      vy,
      size: computedSize,
      depthZ,
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 0.08,
      pulse: 0,
      spawnTime: now,
      lifetimeMs: this.diffConfig.lifetimeMs + (Math.random() * 800 - 400),
      hit: false,
      meshGroup
    });
  }

  fireWeapon(source = 'keyboard') {
    const now = performance.now();
    // 85ms debounce to prevent key chatter while keeping crisp response
    if (this.lastShotTime !== 0 && now - this.lastShotTime < 85) return;
    this.lastShotTime = now;

    this.totalShots++;
    const shotX = this.crosshair.x;
    const shotY = this.crosshair.y;

    // Laser beam visual in 2D / 3D
    const w = this.canvas?.width || 960;
    const h = this.canvas?.height || 540;

    let laserMesh = null;
    if (this.is3D && this.scene) {
      // 3D Glowing Laser Tracer Bolt
      const target3D = this.screenToWorld3D(shotX, shotY, -8.0);
      const start3D = new THREE.Vector3(0, 0.4, 11);
      const end3D = new THREE.Vector3(target3D.x, target3D.y, target3D.z);

      const distance = start3D.distanceTo(end3D);
      const cylinderGeo = new THREE.CylinderGeometry(0.09, 0.09, distance, 8);
      cylinderGeo.rotateX(Math.PI / 2);

      const cylinderMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.95
      });
      laserMesh = new THREE.Mesh(cylinderGeo, cylinderMat);
      laserMesh.position.copy(start3D.clone().add(end3D).multiplyScalar(0.5));
      laserMesh.lookAt(end3D);
      this.scene.add(laserMesh);

      // Trigger dynamic muzzle flash light
      if (this.muzzleLight) {
        this.muzzleLight.intensity = 8.0;
      }
    }

    this.laserBeams.push({
      startX: w / 2,
      startY: h,
      endX: shotX,
      endY: shotY,
      alpha: 1.0,
      color: '#06b6d4',
      mesh: laserMesh
    });

    sound.playLaser();

    // Hitscan check against active targets
    let hitDetected = false;
    let hitIndex = -1;

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const tgt = this.targets[i];
      if (tgt.hit) continue;

      const dx = shotX - tgt.x;
      const dy = shotY - tgt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= tgt.size / 2 + 6) {
        hitDetected = true;
        hitIndex = i;
        break;
      }
    }

    if (hitDetected && hitIndex !== -1) {
      const tgt = this.targets[hitIndex];
      tgt.hit = true;
      this.hits++;
      this.targetsDestroyed++;
      this.combo++;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;

      // Score Calculation
      const basePoints = this.diffConfig.baseScore + tgt.arch.scoreBonus;
      const comboBonus = this.options.comboEnabled ? Math.min(250, (this.combo - 1) * 20) : 0;
      const pointsAwarded =
        Math.round(basePoints * (1.0 + this.currentChapterIndex * 0.15)) + comboBonus;
      this.score += pointsAwarded;

      // Particle explosion in 2D & 3D
      this.createExplosion(tgt.x, tgt.y, tgt.arch.color, tgt.arch.hexColor, tgt.size, tgt.depthZ);

      // Floating combat text
      this.floatingTexts.push({
        text: `+${pointsAwarded}${this.combo > 2 ? ` (${this.combo}x COMBO!)` : ''}`,
        x: tgt.x,
        y: tgt.y - 18,
        alpha: 1.0,
        color: this.combo > 3 ? '#facc15' : '#38bdf8'
      });

      sound.playHit();
      if (this.combo % 5 === 0) sound.playCombo();

      // Clean up target mesh and spawn replacement
      if (tgt.meshGroup && this.scene) {
        this.scene.remove(tgt.meshGroup);
        this.disposeGroup(tgt.meshGroup);
      }
      this.targets.splice(hitIndex, 1);

      setTimeout(() => {
        if (this.isRunning && this.targets.length < this.diffConfig.maxSimultaneous) {
          this.spawnTarget();
        }
      }, 200);

    } else {
      // Missed shot
      this.misses++;
      this.combo = 0;
      sound.playMiss();

      this.floatingTexts.push({
        text: 'MISS',
        x: shotX,
        y: shotY - 10,
        alpha: 0.8,
        color: '#f43f5e'
      });
    }

    // Telemetry log for authoritative backend verification
    this.shotsTelemetry.push({
      t: Math.round(this.getElapsedSeconds() * 1000),
      x: Math.round(shotX),
      y: Math.round(shotY),
      hit: hitDetected,
      source: source
    });

    this.notifyUpdate();
  }

  createExplosion(x, y, color, hexColor, size, depthZ = -8) {
    const count = Math.min(28, Math.floor(size / 1.8));

    // 3D Particle Debris
    if (this.is3D && this.scene) {
      const target3D = this.screenToWorld3D(x, y, depthZ);
      const debrisGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
      const debrisMat = new THREE.MeshBasicMaterial({ color: hexColor || 0x06b6d4 });

      for (let i = 0; i < count; i++) {
        const mesh = new THREE.Mesh(debrisGeo, debrisMat);
        mesh.position.set(target3D.x, target3D.y, target3D.z);
        this.scene.add(mesh);

        const angle = Math.random() * Math.PI * 2;
        const speed = 3.0 + Math.random() * 6.5;
        this.particles.push({
          mesh,
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          vz: (Math.random() - 0.5) * 5.0,
          size: 2.5 + Math.random() * 3.5,
          color: Math.random() < 0.3 ? '#ffffff' : color,
          alpha: 1.0,
          decay: 0.03 + Math.random() * 0.035
        });
      }
    } else {
      // 2D particle fallback
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.0 + Math.random() * 5.0;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 2.5 + Math.random() * 3.5,
          color: Math.random() < 0.3 ? '#ffffff' : color,
          alpha: 1.0,
          decay: 0.025 + Math.random() * 0.03
        });
      }
    }
  }

  notifyUpdate() {
    const actualShots = Math.max(1, this.totalShots);
    const accuracy = parseFloat(((this.hits / actualShots) * 100).toFixed(1));

    this.onScoreUpdate({
      score: this.score,
      hits: this.hits,
      misses: this.misses,
      totalShots: this.totalShots,
      combo: this.combo,
      bestCombo: this.bestCombo,
      targetsDestroyed: this.targetsDestroyed,
      accuracy: accuracy,
      remainingSeconds: Math.ceil(this.remainingSeconds),
      currentChapter: STORY_CHAPTERS[this.currentChapterIndex],
      currentDifficulty: this.currentDifficulty
    });
  }

  loop() {
    if (!this.isRunning) return;

    this.update();
    this.draw();

    this.animId = requestAnimationFrame(() => this.loop());
  }

  update() {
    const elapsedSec = this.getElapsedSeconds();
    this.remainingSeconds = Math.max(0, this.totalDurationSeconds - elapsedSec);

    // Update Story Chapter
    this.updateChapter(elapsedSec);

    // Check Official Timer Expiration (420s / 7 mins)
    if (this.remainingSeconds <= 0) {
      this.finishSession();
      return;
    }

    // Crosshair movement (WASD) with smooth acceleration & boundary clamping
    let ax = 0;
    let ay = 0;
    if (this.keys.w) ay -= 1;
    if (this.keys.s) ay += 1;
    if (this.keys.a) ax -= 1;
    if (this.keys.d) ax += 1;

    // Normalize diagonal
    if (ax !== 0 && ay !== 0) {
      ax *= 0.7071;
      ay *= 0.7071;
    }

    this.crosshair.vx = this.crosshair.vx * this.crosshair.friction + ax * this.crosshair.speed;
    this.crosshair.vy = this.crosshair.vy * this.crosshair.friction + ay * this.crosshair.speed;

    this.crosshair.x += this.crosshair.vx;
    this.crosshair.y += this.crosshair.vy;

    const w = this.canvas?.width || 960;
    const h = this.canvas?.height || 540;

    // Bounds clamping
    const pad = 24;
    this.crosshair.x = Math.max(pad, Math.min(w - pad, this.crosshair.x));
    this.crosshair.y = Math.max(pad, Math.min(h - pad, this.crosshair.y));

    // Target hover check (Dynamic Lock-On)
    let hover = false;
    for (const tgt of this.targets) {
      const dx = this.crosshair.x - tgt.x;
      const dy = this.crosshair.y - tgt.y;
      if (Math.sqrt(dx * dx + dy * dy) <= tgt.size / 2 + 6) {
        hover = true;
        break;
      }
    }
    this.crosshair.isOverTarget = hover;

    // Update 3D Targets position & physics
    const now = performance.now();
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const tgt = this.targets[i];
      tgt.x += tgt.vx;
      tgt.y += tgt.vy;
      tgt.rotation += tgt.rotSpeed;
      tgt.pulse += 0.05;

      // Bounce off walls
      const half = tgt.size / 2;
      if (tgt.x - half < 20) {
        tgt.x = 20 + half;
        tgt.vx *= -1;
      }
      if (tgt.x + half > w - 20) {
        tgt.x = w - 20 - half;
        tgt.vx *= -1;
      }
      if (tgt.y - half < 20) {
        tgt.y = 20 + half;
        tgt.vy *= -1;
      }
      if (tgt.y + half > h - 70) {
        tgt.y = h - 70 - half;
        tgt.vy *= -1;
      }

      // Sync 3D Mesh Position & Animations
      if (tgt.meshGroup && this.camera) {
        const pos3D = this.screenToWorld3D(tgt.x, tgt.y, tgt.depthZ);
        tgt.meshGroup.position.set(pos3D.x, pos3D.y, pos3D.z);

        // Sinusoidal hover bobbing
        tgt.meshGroup.position.y += Math.sin(tgt.pulse) * 0.15;

        // Bank into turns
        tgt.meshGroup.rotation.z = -tgt.vx * 0.08;
        tgt.meshGroup.rotation.y += tgt.rotSpeed;

        // Specific archetype visual animations
        if (tgt.arch.type === 'drone') {
          if (tgt.meshGroup.userData.gyroRing1) tgt.meshGroup.userData.gyroRing1.rotation.x += 0.08;
          if (tgt.meshGroup.userData.gyroRing2) tgt.meshGroup.userData.gyroRing2.rotation.y += 0.08;
        } else if (tgt.arch.type === 'core') {
          if (tgt.meshGroup.userData.bits) {
            tgt.meshGroup.userData.bits.forEach((b, idx) => {
              const bAngle = tgt.pulse * 1.5 + (idx * Math.PI * 2) / 3;
              b.position.set(Math.cos(bAngle) * 2.2, Math.sin(bAngle) * 2.2, 0);
            });
          }
        } else if (tgt.arch.type === 'cube') {
          if (tgt.meshGroup.userData.outerCube) {
            tgt.meshGroup.userData.outerCube.rotation.x += 0.04;
            tgt.meshGroup.userData.outerCube.rotation.y += 0.04;
          }
        }
      }

      // Lifetime expiry
      if (now - tgt.spawnTime > tgt.lifetimeMs) {
        if (tgt.meshGroup && this.scene) {
          this.scene.remove(tgt.meshGroup);
          this.disposeGroup(tgt.meshGroup);
        }
        this.targets.splice(i, 1);
      }
    }

    // Maintain target density
    while (this.targets.length < this.diffConfig.maxSimultaneous) {
      this.spawnTarget();
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.mesh) {
        p.mesh.position.x += (p.vx * 0.03);
        p.mesh.position.y += (p.vy * 0.03);
        p.mesh.position.z += ((p.vz || 0) * 0.03);
        p.mesh.rotation.x += 0.1;
        p.mesh.rotation.y += 0.1;
      }

      if (p.alpha <= 0) {
        if (p.mesh && this.scene) {
          this.scene.remove(p.mesh);
          p.mesh.geometry?.dispose();
          p.mesh.material?.dispose();
        }
        this.particles.splice(i, 1);
      }
    }

    // Update Lasers
    for (let i = this.laserBeams.length - 1; i >= 0; i--) {
      const b = this.laserBeams[i];
      b.alpha -= 0.16;
      if (b.mesh) {
        b.mesh.material.opacity = Math.max(0, b.alpha);
      }
      if (b.alpha <= 0) {
        if (b.mesh && this.scene) {
          this.scene.remove(b.mesh);
          b.mesh.geometry?.dispose();
          b.mesh.material?.dispose();
        }
        this.laserBeams.splice(i, 1);
      }
    }

    // Decay Muzzle Light
    if (this.muzzleLight && this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity *= 0.65;
      if (this.muzzleLight.intensity < 0.1) this.muzzleLight.intensity = 0;
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 1.2;
      ft.alpha -= 0.02;
      if (ft.alpha <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.chapterBannerTimer > 0) {
      this.chapterBannerTimer--;
    }
  }

  finishSession() {
    this.stop();
    sound.playGameOver();

    const actualShots = Math.max(1, this.totalShots);
    const finalAccuracy = parseFloat(((this.hits / actualShots) * 100).toFixed(1));

    const finalTelemetry = {
      score: this.score,
      hits: this.hits,
      misses: this.misses,
      total_shots: this.totalShots,
      accuracy: finalAccuracy,
      best_combo: this.bestCombo,
      targets_destroyed: this.targetsDestroyed,
      difficulty: this.currentDifficulty,
      duration_ms: Math.round(this.getElapsedSeconds() * 1000),
      shots_telemetry: this.shotsTelemetry
    };

    this.onGameOver(finalTelemetry);
  }

  draw() {
    // 1. Render 3D Scene via Three.js
    if (this.is3D && this.renderer && this.scene && this.camera) {
      // Rotate starfield slowly for cinematic depth
      if (this.starsMesh) {
        this.starsMesh.rotation.y += 0.0003;
      }

      this.renderer.render(this.scene, this.camera);
    }

    // 2. Render HUD Overlay (Aiming Reticle, Floating Scores, Lock-on)
    const hud = this.hudCtx || this.ctx;
    if (!hud) return;

    const w = this.canvas?.width || 960;
    const h = this.canvas?.height || 540;

    // Clear transparent HUD canvas
    hud.clearRect(0, 0, w, h);

    // If in 2D fallback mode (Node tests or WebGL disabled), draw 2D background and targets
    if (!this.is3D && this.ctx) {
      this.draw2DFallback();
    }

    // Render Laser Beams in 2D fallback
    if (!this.is3D) {
      for (const b of this.laserBeams) {
        hud.save();
        hud.globalAlpha = b.alpha;
        hud.strokeStyle = b.color;
        hud.lineWidth = 3.5;
        hud.shadowColor = '#38bdf8';
        hud.shadowBlur = 12;
        hud.beginPath();
        hud.moveTo(b.startX, b.startY);
        hud.lineTo(b.endX, b.endY);
        hud.stroke();
        hud.restore();
      }
    }

    // Render Floating Combat Text (+150, COMBO!, MISS)
    for (const ft of this.floatingTexts) {
      hud.save();
      hud.globalAlpha = ft.alpha;
      hud.fillStyle = ft.color;
      hud.font = 'bold 15px "JetBrains Mono", monospace';
      hud.textAlign = 'center';
      hud.shadowColor = 'rgba(0,0,0,0.85)';
      hud.shadowBlur = 5;
      hud.fillText(ft.text, ft.x, ft.y);
      hud.restore();
    }

    // Render Holographic Reticle (WASD Aim Control)
    hud.save();
    const cx = this.crosshair.x;
    const cy = this.crosshair.y;
    const r = this.crosshair.radius;
    const isHover = this.crosshair.isOverTarget;

    const reticleColor = isHover ? '#f43f5e' : '#06b6d4';
    hud.strokeStyle = reticleColor;
    hud.lineWidth = isHover ? 2.5 : 2.0;
    hud.shadowColor = reticleColor;
    hud.shadowBlur = isHover ? 16 : 8;

    // Outer aiming circle
    hud.beginPath();
    hud.arc(cx, cy, r, 0, Math.PI * 2);
    hud.stroke();

    // Corner brackets when locked on
    if (isHover) {
      const bDist = r + 8;
      const bLen = 6;
      hud.lineWidth = 2.5;
      hud.beginPath();
      // Top-Left bracket
      hud.moveTo(cx - bDist, cy - bDist + bLen);
      hud.lineTo(cx - bDist, cy - bDist);
      hud.lineTo(cx - bDist + bLen, cy - bDist);
      // Top-Right bracket
      hud.moveTo(cx + bDist - bLen, cy - bDist);
      hud.lineTo(cx + bDist, cy - bDist);
      hud.lineTo(cx + bDist, cy - bDist + bLen);
      // Bottom-Left bracket
      hud.moveTo(cx - bDist, cy + bDist - bLen);
      hud.lineTo(cx - bDist, cy + bDist);
      hud.lineTo(cx - bDist + bLen, cy + bDist);
      // Bottom-Right bracket
      hud.moveTo(cx + bDist - bLen, cy + bDist);
      hud.lineTo(cx + bDist, cy + bDist);
      hud.lineTo(cx + bDist, cy + bDist - bLen);
      hud.stroke();

      // Lock-On Label
      hud.fillStyle = '#f43f5e';
      hud.font = 'bold 10px "JetBrains Mono", monospace';
      hud.textAlign = 'center';
      hud.fillText('TARGET LOCK', cx, cy - r - 12);
    }

    // Inner reticle notches
    const notchLen = 8;
    hud.beginPath();
    hud.moveTo(cx - r - notchLen, cy);
    hud.lineTo(cx - r + 3, cy);
    hud.moveTo(cx + r - 3, cy);
    hud.lineTo(cx + r + notchLen, cy);
    hud.moveTo(cx, cy - r - notchLen);
    hud.lineTo(cx, cy - r + 3);
    hud.moveTo(cx, cy + r - 3);
    hud.lineTo(cx, cy + r + notchLen);
    hud.stroke();

    // Center targeting pip
    hud.fillStyle = isHover ? '#f43f5e' : '#ffffff';
    hud.beginPath();
    hud.arc(cx, cy, 2.5, 0, Math.PI * 2);
    hud.fill();
    hud.restore();

    // Story Chapter Banner Notification (Top Center)
    if (this.chapterBannerTimer > 0 && this.options.storyEnabled) {
      const ch = STORY_CHAPTERS[this.currentChapterIndex];
      const bannerAlpha = Math.min(1.0, this.chapterBannerTimer / 30.0);

      hud.save();
      hud.globalAlpha = bannerAlpha;
      hud.fillStyle = 'rgba(15, 23, 42, 0.92)';
      hud.strokeStyle = ch.themeColor;
      hud.lineWidth = 1.5;

      const bw = 480;
      const bh = 56;
      const bx = (w - bw) / 2;
      const by = 20;

      hud.beginPath();
      hud.roundRect(bx, by, bw, bh, 12);
      hud.fill();
      hud.stroke();

      hud.fillStyle = ch.themeColor;
      hud.font = 'bold 13px "JetBrains Mono", monospace';
      hud.textAlign = 'center';
      hud.fillText(ch.title, w / 2, by + 23);

      hud.fillStyle = '#94a3b8';
      hud.font = '11px sans-serif';
      hud.fillText(ch.subtitle, w / 2, by + 42);

      hud.restore();
    }
  }

  draw2DFallback() {
    const { ctx, canvas } = this;
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    // 2D Arena Backdrop
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.08)';
    ctx.lineWidth = 1;
    const gridStep = 48;
    for (let x = 0; x < w; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Render 2D Targets
    for (const tgt of this.targets) {
      ctx.save();
      ctx.translate(tgt.x, tgt.y);
      ctx.rotate(tgt.rotation);

      const size = tgt.size;
      const color = tgt.arch.color;
      const pulseScale = 1.0 + Math.sin(tgt.pulse) * 0.08;
      ctx.scale(pulseScale, pulseScale);

      ctx.fillStyle = 'rgba(249, 115, 22, 0.2)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 2, 0);
      ctx.lineTo(0, size / 2);
      ctx.lineTo(-size / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }
  }
}
