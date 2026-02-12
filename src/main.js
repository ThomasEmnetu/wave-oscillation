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
let mouse = { x: -1000, y: -1000 };

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
  
  // Clean up dead ripples
  ripples = ripples.filter(r => r.alive);
  
  // Clear
  ctx.fillStyle = '#06060c';
  ctx.fillRect(0, 0, width, height);
  
  ctx.font = `${CELL_SIZE}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * CELL_SIZE + CELL_SIZE / 2;
      const y = row * CELL_SIZE + CELL_SIZE / 2;
      
      // Base ambient wave (subtle)
      const nx = col / cols;
      const ny = row / rows;
      let wave = Math.sin(nx * 4 + time * 0.5) * 0.08 + 
                 Math.sin(ny * 3 + time * 0.3) * 0.08;
      
      // Add ripple influences - true superposition
      let rippleSum = 0;
      let rippleCount = 0;
      
      for (const ripple of ripples) {
        const influence = ripple.getInfluence(x, y);
        if (influence !== 0) {
          rippleSum += influence;
          rippleCount++;
        }
      }
      
      // Interference amplification - when multiple ripples overlap,
      // constructive interference creates bigger peaks,
      // destructive interference creates deeper troughs
      if (rippleCount > 1) {
        // Amplify the interference effect when waves overlap
        const interferenceBoost = 1 + (rippleCount - 1) * 0.4;
        rippleSum *= interferenceBoost;
      }
      
      wave += rippleSum;
      
      // Mouse hover - subtle glow
      const mouseDist = Math.sqrt((x - mouse.x) ** 2 + (y - mouse.y) ** 2);
      const mouseGlow = Math.max(0, 1 - mouseDist / 100) * 0.3;
      
      // Calculate intensity with more dramatic range
      // Clamp but allow the math to go further for color
      const rawIntensity = (wave + 1) / 2 + mouseGlow;
      const intensity = Math.min(1, Math.max(0, rawIntensity));
      
      // Detect interference zones for special coloring
      const isInterference = rippleCount > 1;
      const interferenceStrength = Math.abs(rippleSum);
      
      // Character - use wave value for more variation
      const charValue = Math.min(1, Math.max(0, (wave * 1.5 + 1) / 2 + mouseGlow));
      const charIdx = Math.floor(charValue * (CHARS.length - 1));
      const char = CHARS[Math.min(charIdx, CHARS.length - 1)];
      
      // Color - shift hue in interference zones
      let hue, sat, light;
      
      if (isInterference && interferenceStrength > 0.3) {
        // Interference zones get warmer/different hue
        // Constructive = brighter, more saturated
        // Destructive = darker, desaturated
        if (wave > 0.2) {
          // Constructive - bright cyan/white
          hue = 190 + wave * 20;
          sat = 70 + interferenceStrength * 20;
          light = 30 + intensity * 60 + interferenceStrength * 15;
        } else if (wave < -0.2) {
          // Destructive - deeper blue/purple
          hue = 240 + wave * 30;
          sat = 50 + interferenceStrength * 20;
          light = 10 + intensity * 40;
        } else {
          // Neutral zone
          hue = 210 + wave * 30;
          sat = 60 + intensity * 20;
          light = 20 + intensity * 55;
        }
      } else {
        // Normal single ripple coloring
        hue = 200 + wave * 30;
        sat = 60 + intensity * 20;
        light = 15 + intensity * 70;
      }
      
      const alpha = 0.2 + intensity * 0.8;

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
