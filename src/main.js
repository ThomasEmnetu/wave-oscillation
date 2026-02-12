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
let mouse = { x: -1000, y: -1000, vx: 0, vy: 0, prevX: -1000, prevY: -1000, speed: 0 };

// Grid of velocities (water simulation)
let waterVelocityX = [];
let waterVelocityY = [];
let waterHeight = []; // displacement height

// Trail points from cursor movement
let cursorTrail = [];
const MAX_TRAIL = 20;

// Ambient life systems
let windAngle = 0;
let windStrength = 0;
let windTargetAngle = Math.random() * Math.PI * 2;
let windTargetStrength = 0.3 + Math.random() * 0.5;
let lastMicroDisturbance = 0;
let breathPhase = 0;

// Ripple class
class Ripple {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.birth = time;
    this.radius = 0;
    this.microRipple = false; // Set to true for subtle ambient ripples
  }

  get age() {
    return time - this.birth;
  }

  get alive() {
    return this.age < RIPPLE_LIFESPAN;
  }

  get strength() {
    // Fade out over lifetime
    const base = 1 - (this.age / RIPPLE_LIFESPAN);
    // Micro ripples are smaller/subtler
    return this.microRipple ? base * 0.3 : base;
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
  
  // Initialize water simulation grids
  const size = cols * rows;
  waterVelocityX = new Array(size).fill(0);
  waterVelocityY = new Array(size).fill(0);
  waterHeight = new Array(size).fill(0);
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
  const newVx = mouse.x - mouse.prevX;
  const newVy = mouse.y - mouse.prevY;
  mouse.vx = newVx * 0.4 + mouse.vx * 0.6;
  mouse.vy = newVy * 0.4 + mouse.vy * 0.6;
  mouse.speed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);
  
  // Add to cursor trail when moving
  if (mouse.speed > 1 && mouse.x > 0 && mouse.y > 0) {
    cursorTrail.push({
      x: mouse.x,
      y: mouse.y,
      vx: mouse.vx,
      vy: mouse.vy,
      age: 0,
      strength: Math.min(mouse.speed / 10, 1)
    });
    if (cursorTrail.length > MAX_TRAIL) {
      cursorTrail.shift();
    }
  }
  
  // Age and remove old trail points
  cursorTrail = cursorTrail.filter(p => {
    p.age += 0.016;
    return p.age < 1.5;
  });
  
  mouse.prevX = mouse.x;
  mouse.prevY = mouse.y;
  
  // === AMBIENT LIFE SYSTEMS ===
  
  // Breathing swell - slow undulation across entire surface
  breathPhase += 0.008;
  
  // Wind slowly shifts direction (like real weather)
  windAngle += (windTargetAngle - windAngle) * 0.002;
  windStrength += (windTargetStrength - windStrength) * 0.005;
  
  // Occasionally shift wind target
  if (Math.random() < 0.001) {
    windTargetAngle = Math.random() * Math.PI * 2;
    windTargetStrength = 0.2 + Math.random() * 0.6;
  }
  
  // Apply gentle wind current to all water
  const windVx = Math.cos(windAngle) * windStrength * 0.02;
  const windVy = Math.sin(windAngle) * windStrength * 0.02;
  
  for (let i = 0; i < waterVelocityX.length; i++) {
    waterVelocityX[i] += windVx;
    waterVelocityY[i] += windVy;
  }
  
  // Random micro-disturbances (insects landing, leaves falling, small fish)
  if (time - lastMicroDisturbance > 0.3 + Math.random() * 2) {
    lastMicroDisturbance = time;
    
    // Random position
    const disturbX = Math.random() * width;
    const disturbY = Math.random() * height;
    const disturbCol = Math.floor(disturbX / CELL_SIZE);
    const disturbRow = Math.floor(disturbY / CELL_SIZE);
    const disturbStrength = 0.5 + Math.random() * 2;
    const disturbRadius = 2 + Math.floor(Math.random() * 3);
    
    // Create small localized disturbance
    for (let dy = -disturbRadius; dy <= disturbRadius; dy++) {
      for (let dx = -disturbRadius; dx <= disturbRadius; dx++) {
        const c = disturbCol + dx;
        const r = disturbRow + dy;
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > disturbRadius) continue;
        
        const idx = r * cols + c;
        const influence = (1 - dist / disturbRadius) * disturbStrength;
        waterHeight[idx] += influence;
      }
    }
    
    // 20% chance to spawn a tiny ripple (like a water strider)
    if (Math.random() < 0.2) {
      ripples.push(new Ripple(disturbX, disturbY));
      // Make it a smaller, subtler ripple by reducing its effective strength
      ripples[ripples.length - 1].microRipple = true;
    }
  }
  
  // Water physics simulation
  // Apply forces from cursor trail (drag through water)
  for (const point of cursorTrail) {
    const col = Math.floor(point.x / CELL_SIZE);
    const row = Math.floor(point.y / CELL_SIZE);
    const radius = 4 + point.strength * 3;
    const fadeStrength = 1 - (point.age / 1.5);
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const c = col + dx;
        const r = row + dy;
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radius) continue;
        
        const idx = r * cols + c;
        const influence = (1 - dist / radius) * fadeStrength * point.strength;
        
        // Push water in direction of cursor movement
        waterVelocityX[idx] += point.vx * influence * 0.15;
        waterVelocityY[idx] += point.vy * influence * 0.15;
        
        // Also create height displacement (wake)
        waterHeight[idx] += influence * 3;
      }
    }
  }
  
  // Propagate water - each cell influences neighbors
  const newHeight = new Array(cols * rows).fill(0);
  const damping = 0.96;
  const spread = 0.25;
  
  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      const idx = row * cols + col;
      
      // Average of neighbors
      const avg = (
        waterHeight[idx - 1] +
        waterHeight[idx + 1] +
        waterHeight[idx - cols] +
        waterHeight[idx + cols]
      ) / 4;
      
      // Velocity affects height
      waterVelocityX[idx] *= damping;
      waterVelocityY[idx] *= damping;
      
      // New height based on wave propagation
      newHeight[idx] = (avg - waterHeight[idx]) * spread + waterHeight[idx] * damping;
      
      // Add velocity contribution
      newHeight[idx] += (waterVelocityX[idx] + waterVelocityY[idx]) * 0.1;
    }
  }
  waterHeight = newHeight;
  
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
      
      // Get water displacement at this cell
      const wh = waterHeight[idx];
      const wvx = waterVelocityX[idx];
      const wvy = waterVelocityY[idx];
      
      // Position offset based on water velocity (drag effect)
      const offsetX = wvx * 2;
      const offsetY = wvy * 2;
      
      const x = baseX + offsetX;
      const y = baseY + offsetY;
      
      // Complex ambient waves - multiple frequencies for organic feel
      const nx = col / cols;
      const ny = row / rows;
      
      // Breathing swell - long slow waves
      const breathWave = Math.sin(breathPhase + nx * 2 + ny * 1.5) * 0.06;
      
      // Wind-driven ripples - direction follows wind
      const windWaveX = Math.sin(nx * 8 + time * windStrength * 2 + windAngle) * 0.04 * windStrength;
      const windWaveY = Math.sin(ny * 6 + time * windStrength * 1.5 + windAngle * 0.7) * 0.04 * windStrength;
      
      // Organic noise-like pattern (pseudo-perlin using multiple sine waves)
      const organic1 = Math.sin(nx * 12.7 + ny * 4.3 + time * 0.7) * 0.03;
      const organic2 = Math.sin(nx * 7.1 - ny * 9.2 + time * 0.4) * 0.025;
      const organic3 = Math.sin(nx * 3.3 + ny * 5.7 - time * 0.55) * 0.02;
      
      let wave = breathWave + windWaveX + windWaveY + organic1 + organic2 + organic3;
      
      // Add water height to wave
      wave += wh * 0.15;
      
      // Add ripple influences
      let rippleSum = 0;
      let rippleCount = 0;
      
      for (const ripple of ripples) {
        const influence = ripple.getInfluence(baseX, baseY);
        if (influence !== 0) {
          rippleSum += influence;
          rippleCount++;
        }
      }
      
      if (rippleCount > 1) {
        const interferenceBoost = 1 + (rippleCount - 1) * 0.4;
        rippleSum *= interferenceBoost;
      }
      
      wave += rippleSum;
      
      // Water disturbance adds to intensity
      const disturbance = Math.abs(wh) + Math.sqrt(wvx * wvx + wvy * wvy);
      const disturbBoost = Math.min(disturbance / 10, 0.6);
      
      // Calculate intensity
      const rawIntensity = (wave + 1) / 2 + disturbBoost;
      const intensity = Math.min(1, Math.max(0, rawIntensity));
      
      // Interference detection
      const isInterference = rippleCount > 1;
      const interferenceStrength = Math.abs(rippleSum);
      
      // Character selection
      const charValue = Math.min(1, Math.max(0, (wave * 1.5 + 1) / 2 + disturbBoost));
      const charIdx = Math.floor(charValue * (CHARS.length - 1));
      const char = CHARS[Math.min(charIdx, CHARS.length - 1)];
      
      // Ocean color palette
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
      
      // Disturbed water glows brighter (foam/splash effect)
      if (disturbance > 1) {
        light = Math.min(100, light + disturbance * 8);
        sat = Math.max(0, sat - disturbance * 5);
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
