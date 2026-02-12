const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Config
const CELL_SIZE = 12;
const CHARS = ' .·:∴∷⁖⁘#@';
const MAX_RIPPLES = 50; // Single unified pool - all ripples interact
const RIPPLE_SPEED = 280;
const RIPPLE_LIFESPAN = 6;
const WAKE_ANGLE = 0.35; // ~20 degrees in radians (Kelvin wake angle)

// State
let width, height, cols, rows;
let ripples = [];
let time = 0;

// Cursor state - for gaze and wake effects
let mouse = { x: -1000, y: -1000, prevX: -1000, prevY: -1000 };
let lastWakeRipple = 0;
let wakeDistance = 0; // accumulated distance traveled

// Ambient life - subtle background motion
let breathPhase = 0;
let lastMicroRipple = 0;

// Ripple class
class Ripple {
  constructor(x, y, type = 'normal') {
    this.x = x;
    this.y = y;
    this.birth = time;
    this.type = type; // 'normal', 'micro', or 'wake'
  }

  get age() {
    return time - this.birth;
  }

  get lifespan() {
    // Wake ripples die faster
    return this.type === 'wake' ? RIPPLE_LIFESPAN * 0.4 : RIPPLE_LIFESPAN;
  }

  get alive() {
    return this.age < this.lifespan;
  }

  get strength() {
    const base = 1 - (this.age / this.lifespan);
    if (this.type === 'wake') return base * 0.18; // Subtle but visible V-wake
    if (this.type === 'micro') return base * 0.25;
    return base;
  }

  get speed() {
    // Wake ripples spread outward from V pattern
    return this.type === 'wake' ? RIPPLE_SPEED * 0.6 : RIPPLE_SPEED;
  }

  getInfluence(px, py) {
    const dist = Math.sqrt((px - this.x) ** 2 + (py - this.y) ** 2);
    const radius = this.age * this.speed;
    const ringWidth = this.type === 'wake' ? 50 : (120 + this.age * 50);
    
    const ringDist = Math.abs(dist - radius);
    if (ringDist > ringWidth) return 0;
    
    // Multiple frequency components like real water
    const freq1 = Math.sin((dist - radius) * 0.1);
    const freq2 = Math.sin((dist - radius) * 0.2) * 0.5;
    const freq3 = Math.sin((dist - radius) * 0.05) * 0.3;
    const wave = freq1 + freq2 + freq3;
    
    const falloff = 1 - (ringDist / ringWidth);
    
    return wave * falloff * this.strength;
  }
}

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  cols = Math.ceil(width / CELL_SIZE);
  rows = Math.ceil(height / CELL_SIZE);
}

function addRipple(x, y, type = 'normal') {
  ripples.push(new Ripple(x, y, type));
  
  // Unified pool - when over limit, remove the ripple closest to death
  // This is natural: dying ripples fade out, healthy ones persist
  if (ripples.length > MAX_RIPPLES) {
    let lowestLife = Infinity;
    let lowestIdx = 0;
    
    for (let i = 0; i < ripples.length; i++) {
      const r = ripples[i];
      const remainingLife = 1 - (r.age / r.lifespan);
      if (remainingLife < lowestLife) {
        lowestLife = remainingLife;
        lowestIdx = i;
      }
    }
    
    ripples.splice(lowestIdx, 1);
  }
}

function render() {
  time += 0.016;
  
  // Slow breathing phase
  breathPhase += 0.006;
  
  // === V-WAKE EFFECT (Kelvin Wake) ===
  // Like a boat, cursor creates diagonal waves spreading outward at angles
  if (mouse.x > 0 && mouse.prevX > 0) {
    const dx = mouse.x - mouse.prevX;
    const dy = mouse.y - mouse.prevY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = dist; // cursor speed this frame
    
    wakeDistance += dist;
    
    // Spawn wake ripples every ~30 pixels of movement
    // Faster movement = spawn more frequently for denser wake
    const spawnThreshold = Math.max(20, 35 - speed * 0.5);
    
    if (wakeDistance > spawnThreshold && dist > 2) {
      wakeDistance = 0;
      
      // Calculate direction angle of movement
      const moveAngle = Math.atan2(dy, dx);
      
      // Spawn TWO ripples at angles to create V pattern
      // Left wake arm
      const leftAngle = moveAngle + Math.PI - WAKE_ANGLE;
      const leftDist = 15 + speed * 0.5;
      const leftX = mouse.x + Math.cos(leftAngle) * leftDist;
      const leftY = mouse.y + Math.sin(leftAngle) * leftDist;
      
      // Right wake arm  
      const rightAngle = moveAngle + Math.PI + WAKE_ANGLE;
      const rightDist = 15 + speed * 0.5;
      const rightX = mouse.x + Math.cos(rightAngle) * rightDist;
      const rightY = mouse.y + Math.sin(rightAngle) * rightDist;
      
      addRipple(leftX, leftY, 'wake');
      addRipple(rightX, rightY, 'wake');
    }
  }
  mouse.prevX = mouse.x;
  mouse.prevY = mouse.y;
  
  // Occasional micro-ripples (insects, fish, rain drops)
  if (time - lastMicroRipple > 1.5 + Math.random() * 4) {
    lastMicroRipple = time;
    const rx = Math.random() * width;
    const ry = Math.random() * height;
    addRipple(rx, ry, 'micro');
  }
  
  // Clean up dead ripples
  ripples = ripples.filter(r => r.alive);
  
  // Clear
  ctx.fillStyle = '#2858a8';
  ctx.fillRect(0, 0, width, height);
  
  ctx.font = `${CELL_SIZE}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * CELL_SIZE + CELL_SIZE / 2;
      const y = row * CELL_SIZE + CELL_SIZE / 2;
      
      const nx = col / cols;
      const ny = row / rows;
      
      // Subtle breathing swell
      const breathWave = Math.sin(breathPhase + nx * 2 + ny * 1.5) * 0.04;
      
      // Gentle organic texture
      const organic1 = Math.sin(nx * 12.7 + ny * 4.3 + time * 0.5) * 0.02;
      const organic2 = Math.sin(nx * 7.1 - ny * 9.2 + time * 0.3) * 0.015;
      
      let wave = breathWave + organic1 + organic2;
      
      // Ripple influences - this is the main show
      let rippleSum = 0;
      let rippleCount = 0;
      
      for (const ripple of ripples) {
        const influence = ripple.getInfluence(x, y);
        if (influence !== 0) {
          rippleSum += influence;
          rippleCount++;
        }
      }
      
      // Interference boost
      if (rippleCount > 1) {
        const interferenceBoost = 1 + (rippleCount - 1) * 0.4;
        rippleSum *= interferenceBoost;
      }
      
      wave += rippleSum;
      
      // === GAZE FOCUS EFFECT ===
      // Soft luminosity increase near cursor - like light focusing where you look
      const cursorDist = Math.sqrt((x - mouse.x) ** 2 + (y - mouse.y) ** 2);
      const gazeRadius = 120;
      let gazeFocus = 0;
      if (cursorDist < gazeRadius) {
        // Soft falloff
        gazeFocus = (1 - cursorDist / gazeRadius) ** 2;
        // Add subtle shimmer near cursor
        wave += Math.sin(time * 3 + cursorDist * 0.1) * gazeFocus * 0.08;
      }
      
      // Intensity for color
      const rawIntensity = (wave + 1) / 2;
      const intensity = Math.min(1, Math.max(0, rawIntensity));
      
      // Character selection
      const charValue = Math.min(1, Math.max(0, (wave * 1.5 + 1) / 2));
      const charIdx = Math.floor(charValue * (CHARS.length - 1));
      const char = CHARS[Math.min(charIdx, CHARS.length - 1)];
      
      // Color - interference zones
      const isInterference = rippleCount > 1;
      const interferenceStrength = Math.abs(rippleSum);
      
      let hue, sat, light;
      
      if (isInterference && interferenceStrength > 0.3) {
        if (wave > 0.2) {
          hue = 200;
          sat = 20 + (1 - intensity) * 40;
          light = 70 + intensity * 30;
        } else if (wave < -0.2) {
          hue = 220;
          sat = 70;
          light = 30 + intensity * 30;
        } else {
          hue = 210;
          sat = 40 + intensity * 20;
          light = 50 + intensity * 40;
        }
      } else {
        hue = 215;
        sat = 30 + (1 - intensity) * 50;
        light = 45 + intensity * 55;
      }
      
      // Gaze focus adds subtle brightness (like light refracting where you look)
      if (gazeFocus > 0) {
        light = Math.min(100, light + gazeFocus * 15);
        sat = Math.max(0, sat - gazeFocus * 10);
      }
      
      const alpha = 0.4 + intensity * 0.6;

      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
      ctx.fillText(char, x, y);
    }
  }

  requestAnimationFrame(render);
}

// Events
window.addEventListener('resize', resize);

document.addEventListener('click', e => {
  addRipple(e.clientX, e.clientY);
});

document.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

document.addEventListener('mouseleave', () => {
  mouse.x = -1000;
  mouse.y = -1000;
});

// Touch support
document.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const touch of e.touches) {
    addRipple(touch.clientX, touch.clientY);
  }
}, { passive: false });

document.addEventListener('touchmove', e => {
  if (e.touches.length > 0) {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
  }
});

document.addEventListener('touchend', () => {
  mouse.x = -1000;
  mouse.y = -1000;
});

// Init
resize();
render();
