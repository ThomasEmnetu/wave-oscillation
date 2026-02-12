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

// Ambient life - subtle background motion
let breathPhase = 0;
let lastMicroRipple = 0;

// Ripple class
class Ripple {
  constructor(x, y, micro = false) {
    this.x = x;
    this.y = y;
    this.birth = time;
    this.micro = micro;
  }

  get age() {
    return time - this.birth;
  }

  get alive() {
    return this.age < RIPPLE_LIFESPAN;
  }

  get strength() {
    const base = 1 - (this.age / RIPPLE_LIFESPAN);
    return this.micro ? base * 0.25 : base;
  }

  getInfluence(px, py) {
    const dist = Math.sqrt((px - this.x) ** 2 + (py - this.y) ** 2);
    const radius = this.age * RIPPLE_SPEED;
    const ringWidth = 120 + this.age * 50;
    
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

function addRipple(x, y, micro = false) {
  ripples.push(new Ripple(x, y, micro));
  
  if (ripples.length > MAX_RIPPLES) {
    ripples.shift();
  }
}

function render() {
  time += 0.016;
  
  // Slow breathing phase
  breathPhase += 0.006;
  
  // Occasional micro-ripples (insects, fish, rain drops)
  if (time - lastMicroRipple > 1.5 + Math.random() * 4) {
    lastMicroRipple = time;
    const rx = Math.random() * width;
    const ry = Math.random() * height;
    addRipple(rx, ry, true);
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

// Touch support
document.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const touch of e.touches) {
    addRipple(touch.clientX, touch.clientY);
  }
}, { passive: false });

// Init
resize();
render();
