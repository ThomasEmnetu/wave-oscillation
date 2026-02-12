const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Config
const CELL_SIZE = 12;
const CHARS = ' .·:∴∷⁖⁘#@';
const MAX_RIPPLES = 20;
const RIPPLE_SPEED = 280;
const RIPPLE_LIFESPAN = 6;

// State
let width, height, cols, rows;
let ripples = [];
let time = 0;
let mouse = { x: -1000, y: -1000, vx: 0, vy: 0, prevX: -1000, prevY: -1000 };

// Grid of displaced positions
let displacements = [];

// Ripple class
class Ripple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.birth = time;
    this.radius = 0;
  }

  get age() {
    return time - this.birth;
  }

  get alive() {
    return this.age < RIPPLE_LIFESPAN;
  }

  get strength() {
    // Fade out over lifetime
    return 1 - (this.age / RIPPLE_LIFESPAN);
  }

  getInfluence(px, py) {
    const dist = Math.sqrt((px - this.x) ** 2 + (py - this.y) ** 2);
    const radius = this.age * RIPPLE_SPEED;
    const ringWidth = 120 + this.age * 50;
    
    // Distance from the ripple ring
    const ringDist = Math.abs(dist - radius);
    
    if (ringDist > ringWidth) return 0;
    
    // More pronounced wave pattern - multiple frequency components like real water
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
  
  // Initialize displacement grid
  displacements = [];
  for (let i = 0; i < cols * rows; i++) {
    displacements.push({ x: 0, y: 0 });
  }
}

function addRipple(x, y) {
  ripples.push(new Ripple(x, y));
  
  // Limit ripple count
  if (ripples.length > MAX_RIPPLES) {
    ripples.shift();
  }
}

function render() {
  time += 0.016;
  
  // Calculate mouse velocity
  mouse.vx = (mouse.x - mouse.prevX) * 0.3 + mouse.vx * 0.7;
  mouse.vy = (mouse.y - mouse.prevY) * 0.3 + mouse.vy * 0.7;
  mouse.prevX = mouse.x;
  mouse.prevY = mouse.y;
  
  // Clean up dead ripples
  ripples = ripples.filter(r => r.alive);
  
  // Clear with ocean blue
  ctx.fillStyle = '#2858a8';
  ctx.fillRect(0, 0, width, height);
  
  ctx.font = `${CELL_SIZE}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      const baseX = col * CELL_SIZE + CELL_SIZE / 2;
      const baseY = row * CELL_SIZE + CELL_SIZE / 2;
      
      // Get current displacement
      const disp = displacements[idx];
      
      // Mouse displacement force
      const dx = baseX - mouse.x;
      const dy = baseY - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const mouseRadius = 80;
      
      if (dist < mouseRadius && dist > 0) {
        const force = (1 - dist / mouseRadius) * 25;
        const angle = Math.atan2(dy, dx);
        // Push away from cursor + add some of cursor's momentum
        disp.x += (Math.cos(angle) * force + mouse.vx * 0.3) * 0.15;
        disp.y += (Math.sin(angle) * force + mouse.vy * 0.3) * 0.15;
      }
      
      // Spring back to original position
      disp.x *= 0.92;
      disp.y *= 0.92;
      
      const x = baseX + disp.x;
      const y = baseY + disp.y;
      
      // Base ambient wave (subtle)
      const nx = col / cols;
      const ny = row / rows;
      let wave = Math.sin(nx * 4 + time * 0.5) * 0.08 + 
                 Math.sin(ny * 3 + time * 0.3) * 0.08;
      
      // Add ripple influences - true superposition
      let rippleSum = 0;
      let rippleCount = 0;
      
      for (const ripple of ripples) {
        const influence = ripple.getInfluence(baseX, baseY);
        if (influence !== 0) {
          rippleSum += influence;
          rippleCount++;
        }
      }
      
      // Interference amplification
      if (rippleCount > 1) {
        const interferenceBoost = 1 + (rippleCount - 1) * 0.4;
        rippleSum *= interferenceBoost;
      }
      
      wave += rippleSum;
      
      // Displacement adds to intensity
      const dispMag = Math.sqrt(disp.x * disp.x + disp.y * disp.y);
      const dispBoost = Math.min(dispMag / 20, 0.5);
      
      // Calculate intensity
      const rawIntensity = (wave + 1) / 2 + dispBoost;
      const intensity = Math.min(1, Math.max(0, rawIntensity));
      
      // Detect interference zones
      const isInterference = rippleCount > 1;
      const interferenceStrength = Math.abs(rippleSum);
      
      // Character selection
      const charValue = Math.min(1, Math.max(0, (wave * 1.5 + 1) / 2 + dispBoost));
      const charIdx = Math.floor(charValue * (CHARS.length - 1));
      const char = CHARS[Math.min(charIdx, CHARS.length - 1)];
      
      // Ocean color palette - bright blue to white
      let hue, sat, light;
      
      if (isInterference && interferenceStrength > 0.3) {
        if (wave > 0.2) {
          // Constructive - bright white/cyan
          hue = 200;
          sat = 20 + (1 - intensity) * 40;
          light = 70 + intensity * 30;
        } else if (wave < -0.2) {
          // Destructive - deeper blue
          hue = 220;
          sat = 70;
          light = 30 + intensity * 30;
        } else {
          hue = 210;
          sat = 40 + intensity * 20;
          light = 50 + intensity * 40;
        }
      } else {
        // Normal - vibrant blue to white spectrum
        hue = 215;
        sat = 30 + (1 - intensity) * 50;
        light = 45 + intensity * 55;
      }
      
      // Displaced areas get brighter
      if (dispMag > 2) {
        light = Math.min(100, light + dispMag * 2);
        sat = Math.max(0, sat - dispMag * 3);
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

document.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

document.addEventListener('mouseleave', () => {
  mouse.x = -1000;
  mouse.y = -1000;
});

document.addEventListener('click', e => {
  addRipple(e.clientX, e.clientY);
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

// Init
resize();
render();
