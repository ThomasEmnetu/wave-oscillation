const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Config
const CELL_SIZE = 14;
const CHARS = ' .·:∴∷⁖⁘#@';
const MAX_RIPPLES = 30;
const RIPPLE_SPEED = 280;
const RIPPLE_LIFESPAN = 6;
const WAKE_ANGLE = 0.33; // ~19 degrees (Kelvin wake angle)

// State
let width, height, cols, rows;
let ripples = [];
let time = 0;

// Cursor state
let mouse = { x: -1000, y: -1000, prevX: -1000, prevY: -1000 };
let wakeDistance = 0;

// Ambient life
let breathPhase = 0;
let lastRaindrop = 0;
let raindrops = [];

// Raindrop - falls from above, spawns micro ripple on impact
class Raindrop {
  constructor(x, targetY) {
    this.x = x;
    this.y = -40;
    this.targetY = targetY;
    this.speed = 220 + Math.random() * 120;
    this.length = 18 + Math.random() * 14;
  }
  get landed() { return this.y >= this.targetY; }
  update(dt) { this.y += this.speed * dt; }
}

// Ripple class - used for ALL ripples (clicks, wake, ambient)
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
    if (this.type === 'wake') return RIPPLE_LIFESPAN * 0.5;
    return RIPPLE_LIFESPAN;
  }

  get alive() {
    return this.age < this.lifespan;
  }

  get strength() {
    const base = 1 - (this.age / this.lifespan);
    if (this.type === 'wake') return base * 0.08;
    if (this.type === 'micro') return base * 0.25;
    return base;
  }

  get speed() {
    if (this.type === 'wake') return RIPPLE_SPEED * 0.6;
    return RIPPLE_SPEED;
  }

  getInfluence(px, py) {
    const ddx = px - this.x;
    const ddy = py - this.y;
    const radius = this.age * this.speed;
    const ringWidth = this.type === 'wake' ? 60 : (120 + this.age * 50);
    const bound = radius + ringWidth;
    // Bounding box reject — avoids expensive sqrt for distant cells
    if (ddx > bound || ddx < -bound || ddy > bound || ddy < -bound) return 0;
    
    const dist = Math.sqrt(ddx * ddx + ddy * ddy);
    const ringDist = Math.abs(dist - radius);
    if (ringDist > ringWidth) return 0;
    
    const delta = dist - radius;
    const wave = Math.sin(delta * 0.12) + Math.sin(delta * 0.2) * 0.45;
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
  
  if (ripples.length > MAX_RIPPLES) {
    // Remove ripple closest to death
    let lowestLife = Infinity;
    let lowestIdx = 0;
    for (let i = 0; i < ripples.length; i++) {
      const remaining = 1 - (ripples[i].age / ripples[i].lifespan);
      if (remaining < lowestLife) {
        lowestLife = remaining;
        lowestIdx = i;
      }
    }
    ripples.splice(lowestIdx, 1);
  }
}

function render() {
  time += 0.016;
  breathPhase += 0.006;
  
  // === V-WAKE (Kelvin Wake) - simple circular ripples at V positions ===
  if (mouse.x > 0 && mouse.prevX > 0) {
    const dx = mouse.x - mouse.prevX;
    const dy = mouse.y - mouse.prevY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    wakeDistance += dist;
    
    // Spawn wake ripples every ~40 pixels
    if (wakeDistance > 40 && dist > 2) {
      wakeDistance = 0;
      
      // Direction cursor is moving
      const moveAngle = Math.atan2(dy, dx);
      
      // Spawn ripples BEHIND cursor at V angles
      // Left arm - behind and to the left
      const leftAngle = moveAngle + Math.PI - WAKE_ANGLE;
      const leftX = mouse.x + Math.cos(leftAngle) * 20;
      const leftY = mouse.y + Math.sin(leftAngle) * 20;
      
      // Right arm - behind and to the right
      const rightAngle = moveAngle + Math.PI + WAKE_ANGLE;
      const rightX = mouse.x + Math.cos(rightAngle) * 20;
      const rightY = mouse.y + Math.sin(rightAngle) * 20;
      
      addRipple(leftX, leftY, 'wake');
      addRipple(rightX, rightY, 'wake');
    }
  }
  mouse.prevX = mouse.x;
  mouse.prevY = mouse.y;
  
  // === RAINDROPS ===
  if (time - lastRaindrop > 1.5 + Math.random() * 2.5) {
    lastRaindrop = time;
    raindrops.push(new Raindrop(
      Math.random() * width,
      Math.random() * height * 0.9 + height * 0.05
    ));
  }
  
  for (let i = raindrops.length - 1; i >= 0; i--) {
    raindrops[i].update(0.016);
    if (raindrops[i].landed) {
      addRipple(raindrops[i].x, raindrops[i].targetY, 'micro');
      raindrops.splice(i, 1);
    }
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
      const organic1 = Math.sin(nx * 12.7 + ny * 4.3 + time * 0.5) * 0.02;
      const organic2 = Math.sin(nx * 7.1 - ny * 9.2 + time * 0.3) * 0.015;
      
      let wave = breathWave + organic1 + organic2;
      
      // Ripple influences
      let rippleSum = 0;
      let rippleCount = 0;
      
      for (const ripple of ripples) {
        const influence = ripple.getInfluence(x, y);
        if (influence !== 0) {
          rippleSum += influence;
          rippleCount++;
        }
      }
      
      if (rippleCount > 1) {
        rippleSum *= 1 + (rippleCount - 1) * 0.3;
      }
      
      wave += rippleSum;
      
      // Gaze focus effect
      const cursorDist = Math.sqrt((x - mouse.x) ** 2 + (y - mouse.y) ** 2);
      const gazeRadius = 120;
      let gazeFocus = 0;
      if (cursorDist < gazeRadius) {
        gazeFocus = (1 - cursorDist / gazeRadius) ** 2;
        wave += Math.sin(time * 3 + cursorDist * 0.1) * gazeFocus * 0.08;
      }
      
      // Intensity and character
      const intensity = Math.min(1, Math.max(0, (wave + 1) / 2));
      const charValue = Math.min(1, Math.max(0, (wave * 1.5 + 1) / 2));
      const charIdx = Math.floor(charValue * (CHARS.length - 1));
      const char = CHARS[Math.min(charIdx, CHARS.length - 1)];
      
      // Color — use direct RGB to avoid slow hsla() parsing
      let r, g, b;
      const t = intensity;
      
      if (rippleCount > 1 && Math.abs(rippleSum) > 0.3) {
        if (wave > 0.2) {
          r = 140 + t * 115 | 0; g = 175 + t * 80 | 0; b = 210 + t * 45 | 0;
        } else if (wave < -0.2) {
          r = 20 + t * 40 | 0; g = 40 + t * 60 | 0; b = 100 + t * 80 | 0;
        } else {
          r = 70 + t * 80 | 0; g = 110 + t * 70 | 0; b = 160 + t * 60 | 0;
        }
      } else {
        r = 50 + t * 100 | 0; g = 85 + t * 100 | 0; b = 145 + t * 80 | 0;
      }
      
      if (gazeFocus > 0) {
        const g2 = gazeFocus * 40;
        r = Math.min(255, r + g2) | 0; g = Math.min(255, g + g2) | 0; b = Math.min(255, b + g2) | 0;
      }
      
      const alpha = (0.4 + intensity * 0.6);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fillText(char, x, y);
    }
  }

  // Falling raindrops — visible streaks
  for (const drop of raindrops) {
    const gradient = ctx.createLinearGradient(drop.x, drop.y - drop.length, drop.x, drop.y);
    gradient.addColorStop(0, 'rgba(180, 210, 255, 0)');
    gradient.addColorStop(0.4, 'rgba(200, 225, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(230, 245, 255, 0.9)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y - drop.length);
    ctx.lineTo(drop.x, drop.y);
    ctx.stroke();
    
    // Bright tip
    ctx.fillStyle = 'rgba(240, 250, 255, 0.95)';
    ctx.fillRect(drop.x - 0.5, drop.y - 1, 1.5, 2);
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

resize();
render();
