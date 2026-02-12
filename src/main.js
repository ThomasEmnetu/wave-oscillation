const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Config
const CELL_SIZE = 12;
const CHARS = ' .·:∴∷⁖⁘#@';
const MAX_RIPPLES = 60;
const RIPPLE_SPEED = 280;
const RIPPLE_LIFESPAN = 6;
const WAKE_ANGLE = 0.4; // V-wake half-angle

// State
let width, height, cols, rows;
let ripples = [];
let time = 0;

// Cursor and trail
let mouse = { x: -1000, y: -1000, prevX: -1000, prevY: -1000 };
let cursorTrail = []; // {x, y, angle, birth}
const TRAIL_LIFESPAN = 2.0;

// Ambient
let breathPhase = 0;
let lastRaindrop = 0;
let raindrops = [];

// Raindrop
class Raindrop {
  constructor(x, targetY) {
    this.x = x;
    this.y = -20;
    this.targetY = targetY;
    this.speed = 400 + Math.random() * 200;
  }
  get landed() { return this.y >= this.targetY; }
  update(dt) { this.y += this.speed * dt; }
}

// Ripple - for clicks and raindrop impacts
class Ripple {
  constructor(x, y, type = 'normal') {
    this.x = x;
    this.y = y;
    this.birth = time;
    this.type = type;
  }
  get age() { return time - this.birth; }
  get lifespan() { return this.type === 'micro' ? RIPPLE_LIFESPAN * 0.7 : RIPPLE_LIFESPAN; }
  get alive() { return this.age < this.lifespan; }
  get strength() {
    const base = 1 - (this.age / this.lifespan);
    return this.type === 'micro' ? base * 0.3 : base;
  }
  
  getInfluence(px, py) {
    const dist = Math.sqrt((px - this.x) ** 2 + (py - this.y) ** 2);
    const radius = this.age * RIPPLE_SPEED;
    const ringWidth = 120 + this.age * 50;
    const ringDist = Math.abs(dist - radius);
    if (ringDist > ringWidth) return 0;
    
    const wave = Math.sin((dist - radius) * 0.1) + 
                 Math.sin((dist - radius) * 0.2) * 0.5;
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
    let oldest = 0, maxAge = 0;
    for (let i = 0; i < ripples.length; i++) {
      const age = ripples[i].age / ripples[i].lifespan;
      if (age > maxAge) { maxAge = age; oldest = i; }
    }
    ripples.splice(oldest, 1);
  }
}

// Get wake influence at a point from the cursor trail
function getTrailWake(px, py) {
  let wakeSum = 0;
  
  for (const pt of cursorTrail) {
    const age = time - pt.birth;
    if (age > TRAIL_LIFESPAN) continue;
    
    const strength = (1 - age / TRAIL_LIFESPAN) * 0.35;
    
    const dx = px - pt.x;
    const dy = py - pt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 180 || dist < 5) continue;
    
    // Angle from trail point to cell
    const angleToCell = Math.atan2(dy, dx);
    
    // Direction behind cursor (opposite of movement)
    const behindAngle = pt.angle + Math.PI;
    
    // Angular difference
    let angleDiff = angleToCell - behindAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    const absAngle = Math.abs(angleDiff);
    
    // Only affect cells in V cone behind trail point
    if (absAngle > WAKE_ANGLE * 2) continue;
    
    // V-shape intensity - peaks at the V arms
    const vIntensity = Math.cos((absAngle / WAKE_ANGLE - 1) * Math.PI * 0.5);
    
    // Distance falloff
    const distFalloff = Math.pow(1 - dist / 180, 0.7);
    
    // Wave pattern
    const wave = Math.sin(dist * 0.1 - age * 4);
    
    wakeSum += wave * distFalloff * vIntensity * strength;
  }
  
  return wakeSum;
}

function render() {
  time += 0.016;
  breathPhase += 0.006;
  
  // === UPDATE CURSOR TRAIL ===
  if (mouse.x > 0 && mouse.prevX > 0) {
    const dx = mouse.x - mouse.prevX;
    const dy = mouse.y - mouse.prevY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 8) {
      cursorTrail.push({
        x: mouse.x,
        y: mouse.y,
        angle: Math.atan2(dy, dx),
        birth: time
      });
      
      // Limit trail length
      if (cursorTrail.length > 50) cursorTrail.shift();
    }
  }
  mouse.prevX = mouse.x;
  mouse.prevY = mouse.y;
  
  // Age out trail
  cursorTrail = cursorTrail.filter(p => (time - p.birth) < TRAIL_LIFESPAN);
  
  // === RAINDROPS ===
  if (time - lastRaindrop > 2 + Math.random() * 3) {
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
  
  // Clean ripples
  ripples = ripples.filter(r => r.alive);
  
  // === RENDER ===
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
      
      // Ambient waves
      const breathWave = Math.sin(breathPhase + nx * 2 + ny * 1.5) * 0.04;
      const organic = Math.sin(nx * 12.7 + ny * 4.3 + time * 0.5) * 0.02;
      
      let wave = breathWave + organic;
      
      // Trail wake - continuous V shape
      wave += getTrailWake(x, y);
      
      // Click ripples
      let rippleSum = 0;
      let rippleCount = 0;
      for (const ripple of ripples) {
        const inf = ripple.getInfluence(x, y);
        if (inf !== 0) {
          rippleSum += inf;
          rippleCount++;
        }
      }
      if (rippleCount > 1) rippleSum *= 1 + (rippleCount - 1) * 0.3;
      wave += rippleSum;
      
      // Gaze focus
      const cursorDist = Math.sqrt((x - mouse.x) ** 2 + (y - mouse.y) ** 2);
      let gazeFocus = 0;
      if (cursorDist < 100) {
        gazeFocus = (1 - cursorDist / 100) ** 2;
        wave += Math.sin(time * 3 + cursorDist * 0.1) * gazeFocus * 0.06;
      }
      
      // Render
      const intensity = Math.min(1, Math.max(0, (wave + 1) / 2));
      const charIdx = Math.floor(Math.min(1, Math.max(0, (wave * 1.5 + 1) / 2)) * (CHARS.length - 1));
      const char = CHARS[Math.min(charIdx, CHARS.length - 1)];
      
      let hue = 215, sat = 30 + (1 - intensity) * 50, light = 45 + intensity * 55;
      
      if (rippleCount > 1 && Math.abs(rippleSum) > 0.3) {
        if (wave > 0.2) { hue = 200; sat = 30; light = 70 + intensity * 30; }
        else if (wave < -0.2) { hue = 220; sat = 70; light = 35 + intensity * 25; }
      }
      
      if (gazeFocus > 0) {
        light = Math.min(100, light + gazeFocus * 12);
        sat = Math.max(0, sat - gazeFocus * 8);
      }
      
      ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${0.4 + intensity * 0.6})`;
      ctx.fillText(char, x, y);
    }
  }

  // Raindrops
  ctx.fillStyle = 'rgba(200, 230, 255, 0.9)';
  for (const drop of raindrops) {
    ctx.fillText('·', drop.x, drop.y);
    ctx.fillText(':', drop.x, drop.y - 8);
  }

  requestAnimationFrame(render);
}

// Events
window.addEventListener('resize', resize);
document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
document.addEventListener('mouseleave', () => { mouse.x = -1000; mouse.y = -1000; });
document.addEventListener('click', e => addRipple(e.clientX, e.clientY));
document.addEventListener('touchstart', e => {
  e.preventDefault();
  for (const t of e.touches) addRipple(t.clientX, t.clientY);
}, { passive: false });
document.addEventListener('touchmove', e => {
  if (e.touches.length > 0) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; }
});
document.addEventListener('touchend', () => { mouse.x = -1000; mouse.y = -1000; });

resize();
render();
