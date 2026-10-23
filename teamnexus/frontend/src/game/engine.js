import { sound } from '../utils/sound';

export const STORY_CHAPTERS = [
  {
    chapter: 1,
    title: "CHAPTER 1: AI SYSTEM BREACH",
    subtitle: "Rogue Virtual Training Drones Detected",
    description: "Training neural network corrupted. Neutralize hostile simulation drone signatures.",
    themeColor: '#06b6d4',
    startSec: 0,
    endSec: 140
  },
  {
    chapter: 2,
    title: "CHAPTER 2: MODEL TRAINING ZONE",
    subtitle: "AI Matrix Adapting — Increased Velocity",
    description: "Neural core shifting patterns. Heavy armored nodes and erratic vectors active. Coordinate fire!",
    themeColor: '#8b5cf6',
    startSec: 140,
    endSec: 280
  },
  {
    chapter: 3,
    title: "CHAPTER 3: FINAL DEFENSE OVERDRIVE",
    subtitle: "Critical Neural Surge — Maximum Defense",
    description: "Simulation overdrive! Rapid glitch anomalies and high-value cores surging. Maximize team score!",
    themeColor: '#f43f5e',
    startSec: 280,
    endSec: 420
  }
];

const DIFFICULTY_CONFIGS = {
  EASY: {
    name: 'EASY',
    baseSpeed: 2.2,
    maxSpeed: 4.5,
    minSize: 48,
    maxSize: 72,
    lifetimeMs: 4500,
    maxSimultaneous: 3,
    baseScore: 100,
    comboMultiplier: 1.15
  },
  MEDIUM: {
    name: 'MEDIUM',
    baseSpeed: 3.5,
    maxSpeed: 6.5,
    minSize: 36,
    maxSize: 56,
    lifetimeMs: 3400,
    maxSimultaneous: 5,
    baseScore: 150,
    comboMultiplier: 1.25
  },
  HARD: {
    name: 'HARD',
    baseSpeed: 5.0,
    maxSpeed: 9.0,
    minSize: 26,
    maxSize: 42,
    lifetimeMs: 2400,
    maxSimultaneous: 7,
    baseScore: 200,
    comboMultiplier: 1.4
  }
};

export class TargetStrikeEngine {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Difficulty settings
    const diffKey = (options.difficulty || 'MEDIUM').toUpperCase();
    this.diffConfig = DIFFICULTY_CONFIGS[diffKey] || DIFFICULTY_CONFIGS.MEDIUM;

    // Total Duration: Default 420s (7 minutes)
    this.totalDurationSeconds = options.durationSeconds || 420;
    this.initialRemainingSeconds = options.remainingSeconds !== undefined ? options.remainingSeconds : this.totalDurationSeconds;

    this.options = {
      difficulty: diffKey,
      storyEnabled: options.storyEnabled !== false,
      scorePerHit: this.diffConfig.baseScore,
      comboEnabled: options.comboEnabled !== false,
      ...options
    };

    // Callbacks
    this.onScoreUpdate = options.onScoreUpdate || (() => {});
    this.onGameOver = options.onGameOver || (() => {});
    this.onChapterChange = options.onChapterChange || (() => {});

    // Game state
    this.isRunning = false;
    this.isPaused = false;
    this.startTime = null;
    this.timeOffsetMs = (this.totalDurationSeconds - this.initialRemainingSeconds) * 1000;
    this.remainingSeconds = this.initialRemainingSeconds;
    this.currentChapterIndex = 0;
    this.chapterBannerTimer = 0;

    // Crosshair (Player 1: WASD)
    this.crosshair = {
      x: canvas.width / 2,
      y: canvas.height / 2,
      vx: 0,
      vy: 0,
      radius: 20,
      speed: 8.5,
      friction: 0.88,
      color: '#06b6d4',
      isOverTarget: false
    };

    // Key inputs
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

    // Bound handlers
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.lastShotTime = 0;
  }

  start() {
    this.isRunning = true;
    this.isPaused = false;
    this.startTime = performance.now();
    this.lastShotTime = 0;

    // Reset particles & beams
    this.particles = [];
    this.laserBeams = [];
    this.floatingTexts = [];
    this.targets = [];

    // Center crosshair
    this.crosshair.x = this.canvas.width / 2;
    this.crosshair.y = this.canvas.height / 2;

    // Initial Story Chapter
    this.updateChapter(this.getElapsedSeconds());
    this.chapterBannerTimer = 180; // Show banner for 3 seconds

    // Initial Targets populate
    for (let i = 0; i < this.diffConfig.maxSimultaneous; i++) {
      this.spawnTarget();
    }

    // Attach keyboard listeners
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('keyup', this.boundKeyUp);

    // Start 60 FPS Game Loop
    this.loop();
  }

  stop() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('keyup', this.boundKeyUp);
  }

  getElapsedSeconds() {
    if (!this.startTime) return 0;
    const elapsedNow = (performance.now() - this.startTime) + this.timeOffsetMs;
    return Math.min(this.totalDurationSeconds, elapsedNow / 1000.0);
  }

  handleKeyDown(e) {
    if (!this.isRunning || this.isPaused) return;

    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd'].includes(key)) {
      this.keys[key] = true;
      e.preventDefault();
    } else if (e.code === 'Space') {
      if (!this.keys.space) {
        this.keys.space = true;
        this.fireWeapon();
      }
      e.preventDefault();
    }
  }

  handleKeyUp(e) {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd'].includes(key)) {
      this.keys[key] = false;
    } else if (e.code === 'Space') {
      this.keys.space = false;
    }
  }

  updateChapter(elapsedSec) {
    let newIndex = 0;
    for (let i = 0; i < STORY_CHAPTERS.length; i++) {
      if (elapsedSec >= STORY_CHAPTERS[i].startSec) {
        newIndex = i;
      }
    }
    if (newIndex !== this.currentChapterIndex) {
      this.currentChapterIndex = newIndex;
      this.chapterBannerTimer = 180; // 3 seconds banner
      sound.playLevelUp();
      const ch = STORY_CHAPTERS[newIndex];
      this.onChapterChange(ch.chapter, ch.title, ch.description);
    }
  }

  spawnTarget() {
    const now = performance.now();
    const elapsedSec = this.getElapsedSeconds();
    const chapterMult = 1.0 + (this.currentChapterIndex * 0.25);

    // Target Archetypes
    const archetypes = [
      { type: 'drone', color: '#f97316', scoreBonus: 0, label: 'ROGUE DRONE' },
      { type: 'core', color: '#a855f7', scoreBonus: 50, label: 'AI CORE' },
      { type: 'glitch', color: '#06b6d4', scoreBonus: 80, label: 'SPEED GLITCH' },
      { type: 'cube', color: '#eab308', scoreBonus: 150, label: 'QUANTUM CUBE' }
    ];

    // Probability weights by chapter
    let selectedArch = archetypes[0];
    const rand = Math.random();
    if (this.currentChapterIndex === 0) {
      selectedArch = rand < 0.7 ? archetypes[0] : archetypes[1];
    } else if (this.currentChapterIndex === 1) {
      selectedArch = rand < 0.4 ? archetypes[0] : (rand < 0.75 ? archetypes[1] : archetypes[2]);
    } else {
      selectedArch = rand < 0.3 ? archetypes[1] : (rand < 0.7 ? archetypes[2] : archetypes[3]);
    }

    const computedSpeed = (this.diffConfig.baseSpeed + Math.random() * (this.diffConfig.maxSpeed - this.diffConfig.baseSpeed)) * chapterMult;
    const computedSize = Math.max(this.diffConfig.minSize, this.diffConfig.maxSize - Math.random() * 12);

    const padding = computedSize + 40;
    const x = padding + Math.random() * (this.canvas.width - padding * 2);
    const y = padding + Math.random() * (this.canvas.height - padding * 2 - 70);

    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle) * computedSpeed;
    const vy = Math.sin(angle) * computedSpeed;

    this.targets.push({
      id: `tgt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      arch: selectedArch,
      x,
      y,
      vx,
      vy,
      size: computedSize,
      rotation: 0,
      rotSpeed: (Math.random() - 0.5) * 0.08,
      pulse: 0,
      spawnTime: now,
      lifetimeMs: this.diffConfig.lifetimeMs + (Math.random() * 800 - 400),
      hit: false
    });
  }

  fireWeapon() {
    const now = performance.now();
    // 85ms debounce to prevent key chatter while keeping crisp response
    if (now - this.lastShotTime < 85) return;
    this.lastShotTime = now;

    this.totalShots++;
    const shotX = this.crosshair.x;
    const shotY = this.crosshair.y;

    // Laser beam visual
    this.laserBeams.push({
      startX: this.canvas.width / 2,
      startY: this.canvas.height,
      endX: shotX,
      endY: shotY,
      alpha: 1.0,
      color: '#06b6d4'
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

      if (dist <= tgt.size / 2 + 4) {
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
      const pointsAwarded = Math.round(basePoints * (1.0 + (this.currentChapterIndex * 0.15))) + comboBonus;
      this.score += pointsAwarded;

      // Particle explosion
      this.createExplosion(tgt.x, tgt.y, tgt.arch.color, tgt.size);

      // Floating text
      this.floatingTexts.push({
        text: `+${pointsAwarded}${this.combo > 2 ? ` (${this.combo}x COMBO!)` : ''}`,
        x: tgt.x,
        y: tgt.y - 15,
        alpha: 1.0,
        color: this.combo > 3 ? '#facc15' : '#38bdf8'
      });

      sound.playHit();
      if (this.combo % 5 === 0) sound.playCombo();

      // Remove target and spawn replacement
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

    // Telemetry log
    this.shotsTelemetry.push({
      t: Math.round(this.getElapsedSeconds() * 1000),
      x: Math.round(shotX),
      y: Math.round(shotY),
      hit: hitDetected
    });

    this.notifyUpdate();
  }

  createExplosion(x, y, color, size) {
    const count = Math.min(24, Math.floor(size / 2));
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
      currentChapter: STORY_CHAPTERS[this.currentChapterIndex]
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

    this.crosshair.vx = (this.crosshair.vx * this.crosshair.friction) + (ax * this.crosshair.speed);
    this.crosshair.vy = (this.crosshair.vy * this.crosshair.friction) + (ay * this.crosshair.speed);

    this.crosshair.x += this.crosshair.vx;
    this.crosshair.y += this.crosshair.vy;

    // Bounds clamping
    const pad = 24;
    this.crosshair.x = Math.max(pad, Math.min(this.canvas.width - pad, this.crosshair.x));
    this.crosshair.y = Math.max(pad, Math.min(this.canvas.height - pad, this.crosshair.y));

    // Target hover check
    let hover = false;
    for (const tgt of this.targets) {
      const dx = this.crosshair.x - tgt.x;
      const dy = this.crosshair.y - tgt.y;
      if (Math.sqrt(dx * dx + dy * dy) <= tgt.size / 2) {
        hover = true;
        break;
      }
    }
    this.crosshair.isOverTarget = hover;

    // Update Targets & Expire check
    const now = performance.now();
    for (let i = this.targets.length - 1; i >= 0; i--) {
      const tgt = this.targets[i];
      tgt.x += tgt.vx;
      tgt.y += tgt.vy;
      tgt.rotation += tgt.rotSpeed;
      tgt.pulse += 0.05;

      // Bounce off walls
      const half = tgt.size / 2;
      if (tgt.x - half < 20) { tgt.x = 20 + half; tgt.vx *= -1; }
      if (tgt.x + half > this.canvas.width - 20) { tgt.x = this.canvas.width - 20 - half; tgt.vx *= -1; }
      if (tgt.y - half < 20) { tgt.y = 20 + half; tgt.vy *= -1; }
      if (tgt.y + half > this.canvas.height - 70) { tgt.y = this.canvas.height - 70 - half; tgt.vy *= -1; }

      // Lifetime expiry
      if (now - tgt.spawnTime > tgt.lifetimeMs) {
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
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    // Update Lasers
    for (let i = this.laserBeams.length - 1; i >= 0; i--) {
      const b = this.laserBeams[i];
      b.alpha -= 0.12;
      if (b.alpha <= 0) this.laserBeams.splice(i, 1);
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
      duration_ms: Math.round(this.getElapsedSeconds() * 1000),
      shots_telemetry: this.shotsTelemetry
    };

    this.onGameOver(finalTelemetry);
  }

  draw() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;

    // 1. Futuristic Arena Backdrop
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, w, h);

    // Subtle Perspective Grid
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

    // Vignette Glow
    const radGlow = ctx.createRadialGradient(w / 2, h / 2, h / 4, w / 2, h / 2, w / 1.2);
    radGlow.addColorStop(0, 'rgba(6, 182, 212, 0.02)');
    radGlow.addColorStop(1, 'rgba(2, 6, 23, 0.85)');
    ctx.fillStyle = radGlow;
    ctx.fillRect(0, 0, w, h);

    // 2. Render Targets
    for (const tgt of this.targets) {
      ctx.save();
      ctx.translate(tgt.x, tgt.y);
      ctx.rotate(tgt.rotation);

      const size = tgt.size;
      const color = tgt.arch.color;
      const pulseScale = 1.0 + Math.sin(tgt.pulse) * 0.08;

      ctx.scale(pulseScale, pulseScale);

      if (tgt.arch.type === 'drone') {
        // Diamond Rogue Drone
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

        // Core eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

      } else if (tgt.arch.type === 'core') {
        // Armored Hexagon Core
        ctx.fillStyle = 'rgba(168, 85, 247, 0.25)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const px = (size / 2) * Math.cos(a);
          const py = (size / 2) * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

      } else if (tgt.arch.type === 'glitch') {
        // Chevron Glitch
        ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-size / 2, -size / 2);
        ctx.lineTo(size / 2, 0);
        ctx.lineTo(-size / 2, size / 2);
        ctx.lineTo(-size / 4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

      } else {
        // Quantum Datacube
        ctx.fillStyle = 'rgba(234, 179, 8, 0.3)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        ctx.fillRect(-size / 2, -size / 2, size, size);
      }

      ctx.restore();
    }

    // 3. Render Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Render Laser Beams
    for (const b of this.laserBeams) {
      ctx.save();
      ctx.globalAlpha = b.alpha;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(b.startX, b.startY);
      ctx.lineTo(b.endX, b.endY);
      ctx.stroke();
      ctx.restore();
    }

    // 5. Render Floating Combat Text
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 6. Crosshair (WASD Aim - Dual Ring HUD)
    ctx.save();
    const cx = this.crosshair.x;
    const cy = this.crosshair.y;
    const r = this.crosshair.radius;
    const isHover = this.crosshair.isOverTarget;

    ctx.strokeStyle = isHover ? '#f43f5e' : this.crosshair.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = isHover ? '#f43f5e' : '#06b6d4';
    ctx.shadowBlur = isHover ? 14 : 6;

    // Outer circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Inner reticle notches
    const notchLen = 8;
    ctx.beginPath();
    ctx.moveTo(cx - r - notchLen, cy); ctx.lineTo(cx - r + 3, cy);
    ctx.moveTo(cx + r - 3, cy); ctx.lineTo(cx + r + notchLen, cy);
    ctx.moveTo(cx, cy - r - notchLen); ctx.lineTo(cx, cy - r + 3);
    ctx.moveTo(cx, cy + r - 3); ctx.lineTo(cx, cy + r + notchLen);
    ctx.stroke();

    // Center pip
    ctx.fillStyle = isHover ? '#f43f5e' : '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 7. On-Screen Story Banner Notification (Top Center)
    if (this.chapterBannerTimer > 0 && this.options.storyEnabled) {
      const ch = STORY_CHAPTERS[this.currentChapterIndex];
      const bannerAlpha = Math.min(1.0, this.chapterBannerTimer / 30.0);

      ctx.save();
      ctx.globalAlpha = bannerAlpha;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = ch.themeColor;
      ctx.lineWidth = 1.5;

      const bw = 460;
      const bh = 54;
      const bx = (w - bw) / 2;
      const by = 20;

      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = ch.themeColor;
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ch.title, w / 2, by + 22);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText(ch.subtitle, w / 2, by + 40);

      ctx.restore();
    }
  }
}
