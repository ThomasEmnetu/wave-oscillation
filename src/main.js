import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

// ─── Canvas Setup ───────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')

// ─── Config ─────────────────────────────────────────────────────────────────
const CELL_SIZE = 14
const CHARS = ' .·:∴∷⁖⁘#@'
const MAX_RIPPLES = 30
const RIPPLE_SPEED = 280
const RIPPLE_LIFESPAN = 6
const WAKE_ANGLE = 0.33

// Text rendering config
const TEXT_FONT_SIZE = 18
const TEXT_LINE_HEIGHT = 26
const TEXT_FONT = `${TEXT_FONT_SIZE}px "Georgia", "Palatino", serif`
const TEXT_MARGIN_X = 80
const TEXT_COLOR_BASE = [220, 235, 255]
const WAVE_DISPLACEMENT_Y = 12 // max vertical displacement per character
const WAVE_DISPLACEMENT_X = 3  // max horizontal displacement per character
const CHAR_WAVE_SCALE = 0.06   // wave frequency along text

// Sample text content that flows on the water
const SAMPLE_TEXTS = [
  `The ocean is a mighty harmonist. Waves crash and recede in endless rhythm, each crest a note in nature's symphony. Beneath the surface, currents weave through depths unknown, carrying stories from distant shores.`,
  `Water does not resist. Water flows. When you plunge your hand into it, all you feel is a caress. Water is not a solid wall, it will not stop you. But water always goes where it wants to go, and nothing in the end can stand against it.`,
  `The voice of the sea speaks to the soul. The touch of the sea is sensuous, enfolding the body in its soft, close embrace. In one drop of water are found all the secrets of all the oceans.`,
  `There is one spectacle grander than the sea, that is the sky; there is one spectacle grander than the sky, that is the interior of the soul. The sea lives in every one of us.`
]

// ─── State ──────────────────────────────────────────────────────────────────
let width, height, cols, rows
let ripples = []
let time = 0

// Cursor state
let mouse = { x: -1000, y: -1000, prevX: -1000, prevY: -1000 }
let wakeDistance = 0

// Ambient life
let breathPhase = 0
let lastRaindrop = 0
let raindrops = []

// Pretext state
let preparedTexts = []
let layoutLines = []
let textBlockY = 0

// ─── Raindrop ───────────────────────────────────────────────────────────────
class Raindrop {
  constructor(x, targetY) {
    this.x = x
    this.y = -40
    this.targetY = targetY
    this.speed = 220 + Math.random() * 120
    this.length = 18 + Math.random() * 14
  }
  get landed() { return this.y >= this.targetY }
  update(dt) { this.y += this.speed * dt }
}

// ─── Ripple ─────────────────────────────────────────────────────────────────
class Ripple {
  constructor(x, y, type = 'normal') {
    this.x = x
    this.y = y
    this.birth = time
    this.type = type
  }

  get age() { return time - this.birth }

  get lifespan() {
    if (this.type === 'wake') return RIPPLE_LIFESPAN * 0.5
    return RIPPLE_LIFESPAN
  }

  get alive() { return this.age < this.lifespan }

  get strength() {
    const base = 1 - (this.age / this.lifespan)
    if (this.type === 'wake') return base * 0.08
    if (this.type === 'micro') return base * 0.25
    return base
  }

  get speed() {
    if (this.type === 'wake') return RIPPLE_SPEED * 0.6
    return RIPPLE_SPEED
  }

  getInfluence(px, py) {
    const ddx = px - this.x
    const ddy = py - this.y
    const radius = this.age * this.speed
    const ringWidth = this.type === 'wake' ? 60 : (120 + this.age * 50)
    const bound = radius + ringWidth
    if (ddx > bound || ddx < -bound || ddy > bound || ddy < -bound) return 0

    const dist = Math.sqrt(ddx * ddx + ddy * ddy)
    const ringDist = Math.abs(dist - radius)
    if (ringDist > ringWidth) return 0

    const delta = dist - radius
    const wave = Math.sin(delta * 0.12) + Math.sin(delta * 0.2) * 0.45
    const falloff = 1 - (ringDist / ringWidth)

    return wave * falloff * this.strength
  }
}

// ─── Pretext Integration ────────────────────────────────────────────────────
function prepareTextLayouts() {
  const maxWidth = width - TEXT_MARGIN_X * 2
  if (maxWidth < 100) return

  preparedTexts = []
  layoutLines = []

  for (const text of SAMPLE_TEXTS) {
    const prepared = prepareWithSegments(text, TEXT_FONT)
    const result = layoutWithLines(prepared, maxWidth, TEXT_LINE_HEIGHT)
    preparedTexts.push(prepared)
    layoutLines.push(result.lines)
  }

  // Position text blocks vertically centered with spacing
  const totalTextHeight = layoutLines.reduce(
    (sum, lines) => sum + lines.length * TEXT_LINE_HEIGHT + 40, 0
  )
  textBlockY = Math.max(60, (height - totalTextHeight) / 2)
}

function getWaveAt(x, y) {
  const nx = x / width
  const ny = y / height

  // Breathing swell
  const breathWave = Math.sin(breathPhase + nx * 2 + ny * 1.5) * 0.04
  const organic1 = Math.sin(nx * 12.7 + ny * 4.3 + time * 0.5) * 0.02
  const organic2 = Math.sin(nx * 7.1 - ny * 9.2 + time * 0.3) * 0.015

  let wave = breathWave + organic1 + organic2

  // Ripple influences
  for (const ripple of ripples) {
    const influence = ripple.getInfluence(x, y)
    if (influence !== 0) wave += influence
  }

  // Gaze focus
  const cursorDist = Math.sqrt((x - mouse.x) ** 2 + (y - mouse.y) ** 2)
  const gazeRadius = 120
  if (cursorDist < gazeRadius) {
    const gazeFocus = (1 - cursorDist / gazeRadius) ** 2
    wave += Math.sin(time * 3 + cursorDist * 0.1) * gazeFocus * 0.08
  }

  return wave
}

// ─── Resize ─────────────────────────────────────────────────────────────────
function resize() {
  width = window.innerWidth
  height = window.innerHeight
  canvas.width = width
  canvas.height = height
  cols = Math.ceil(width / CELL_SIZE)
  rows = Math.ceil(height / CELL_SIZE)
  prepareTextLayouts()
}

// ─── Ripple Management ──────────────────────────────────────────────────────
function addRipple(x, y, type = 'normal') {
  ripples.push(new Ripple(x, y, type))

  if (ripples.length > MAX_RIPPLES) {
    let lowestLife = Infinity
    let lowestIdx = 0
    for (let i = 0; i < ripples.length; i++) {
      const remaining = 1 - (ripples[i].age / ripples[i].lifespan)
      if (remaining < lowestLife) {
        lowestLife = remaining
        lowestIdx = i
      }
    }
    ripples.splice(lowestIdx, 1)
  }
}

// ─── Render ─────────────────────────────────────────────────────────────────
function render() {
  time += 0.016
  breathPhase += 0.006

  // === V-WAKE (Kelvin Wake) ===
  if (mouse.x > 0 && mouse.prevX > 0) {
    const dx = mouse.x - mouse.prevX
    const dy = mouse.y - mouse.prevY
    const dist = Math.sqrt(dx * dx + dy * dy)

    wakeDistance += dist

    if (wakeDistance > 40 && dist > 2) {
      wakeDistance = 0
      const moveAngle = Math.atan2(dy, dx)

      const leftAngle = moveAngle + Math.PI - WAKE_ANGLE
      const leftX = mouse.x + Math.cos(leftAngle) * 20
      const leftY = mouse.y + Math.sin(leftAngle) * 20

      const rightAngle = moveAngle + Math.PI + WAKE_ANGLE
      const rightX = mouse.x + Math.cos(rightAngle) * 20
      const rightY = mouse.y + Math.sin(rightAngle) * 20

      addRipple(leftX, leftY, 'wake')
      addRipple(rightX, rightY, 'wake')
    }
  }
  mouse.prevX = mouse.x
  mouse.prevY = mouse.y

  // === RAINDROPS ===
  if (time - lastRaindrop > 0.8 + Math.random() * 1.5) {
    lastRaindrop = time
    raindrops.push(new Raindrop(
      Math.random() * width,
      Math.random() * height * 0.9 + height * 0.05
    ))
  }

  for (let i = raindrops.length - 1; i >= 0; i--) {
    raindrops[i].update(0.016)
    if (raindrops[i].landed) {
      addRipple(raindrops[i].x, raindrops[i].targetY, 'micro')
      raindrops.splice(i, 1)
    }
  }

  // Clean up dead ripples
  ripples = ripples.filter(r => r.alive)

  // === CLEAR ===
  ctx.fillStyle = '#2858a8'
  ctx.fillRect(0, 0, width, height)

  // === WAVE FIELD (ASCII grid with full ripple response) ===
  ctx.font = `${CELL_SIZE}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * CELL_SIZE + CELL_SIZE / 2
      const y = row * CELL_SIZE + CELL_SIZE / 2

      const nx = col / cols
      const ny = row / rows

      const wave = getWaveAt(x, y)

      const intensity = Math.min(1, Math.max(0, (wave + 1) / 2))
      const charValue = Math.min(1, Math.max(0, (wave * 1.5 + 1) / 2))
      const charIdx = Math.floor(charValue * (CHARS.length - 1))
      const char = CHARS[Math.min(charIdx, CHARS.length - 1)]

      // Color — vivid response to wave state
      let r, g, b
      const t = intensity

      // Count active ripple influences for interference coloring
      let rippleSum = 0
      let rippleCount = 0
      for (const ripple of ripples) {
        const influence = ripple.getInfluence(x, y)
        if (influence !== 0) {
          rippleSum += influence
          rippleCount++
        }
      }

      if (rippleCount > 1 && Math.abs(rippleSum) > 0.3) {
        if (wave > 0.2) {
          r = 140 + t * 115 | 0; g = 175 + t * 80 | 0; b = 210 + t * 45 | 0
        } else if (wave < -0.2) {
          r = 20 + t * 40 | 0; g = 40 + t * 60 | 0; b = 100 + t * 80 | 0
        } else {
          r = 70 + t * 80 | 0; g = 110 + t * 70 | 0; b = 160 + t * 60 | 0
        }
      } else {
        r = 50 + t * 100 | 0; g = 85 + t * 100 | 0; b = 145 + t * 80 | 0
      }

      // Gaze focus brightening
      const cursorDist = Math.sqrt((x - mouse.x) ** 2 + (y - mouse.y) ** 2)
      const gazeRadius = 120
      if (cursorDist < gazeRadius) {
        const gazeFocus = (1 - cursorDist / gazeRadius) ** 2
        const g2 = gazeFocus * 40
        r = Math.min(255, r + g2) | 0; g = Math.min(255, g + g2) | 0; b = Math.min(255, b + g2) | 0
      }

      const alpha = 0.4 + intensity * 0.6
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
      ctx.fillText(char, x, y)
    }
  }

  // === PRETEXT-POWERED FLOWING TEXT ===
  renderFlowingText()

  // === FALLING RAINDROPS ===
  for (const drop of raindrops) {
    const gradient = ctx.createLinearGradient(drop.x, drop.y - drop.length, drop.x, drop.y)
    gradient.addColorStop(0, 'rgba(180, 210, 255, 0)')
    gradient.addColorStop(0.4, 'rgba(200, 225, 255, 0.5)')
    gradient.addColorStop(1, 'rgba(230, 245, 255, 0.9)')
    ctx.strokeStyle = gradient
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(drop.x, drop.y - drop.length)
    ctx.lineTo(drop.x, drop.y)
    ctx.stroke()

    // Bright tip
    ctx.fillStyle = 'rgba(240, 250, 255, 0.95)'
    ctx.fillRect(drop.x - 0.5, drop.y - 1, 1.5, 2)
  }

  requestAnimationFrame(render)
}

// ─── Flowing Text Renderer (Pretext-powered) ────────────────────────────────
function renderFlowingText() {
  if (layoutLines.length === 0) return

  ctx.font = TEXT_FONT
  ctx.textBaseline = 'alphabetic'

  let currentY = textBlockY

  for (let blockIdx = 0; blockIdx < layoutLines.length; blockIdx++) {
    const lines = layoutLines[blockIdx]
    if (!lines) continue

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]
      const baseY = currentY + lineIdx * TEXT_LINE_HEIGHT
      const baseX = TEXT_MARGIN_X

      // Render each character with wave displacement
      let charX = baseX
      for (let charIdx = 0; charIdx < line.text.length; charIdx++) {
        const ch = line.text[charIdx]
        if (ch === ' ') {
          charX += ctx.measureText(' ').width
          continue
        }

        const worldX = charX
        const worldY = baseY

        // Get wave influence at this character's position
        const wave = getWaveAt(worldX, worldY)

        // Displace character by wave
        const displaceY = wave * WAVE_DISPLACEMENT_Y
        const displaceX = Math.sin(wave * 3 + charIdx * CHAR_WAVE_SCALE + time * 0.8) * WAVE_DISPLACEMENT_X
        const rotation = wave * 0.04 // subtle per-character rotation

        // Color modulation based on wave state
        const waveIntensity = Math.min(1, Math.max(0, (wave + 0.5)))
        const r = TEXT_COLOR_BASE[0] - waveIntensity * 30 | 0
        const g = TEXT_COLOR_BASE[1] - waveIntensity * 20 | 0
        const b = TEXT_COLOR_BASE[2]
        const alpha = 0.6 + waveIntensity * 0.35

        // Proximity glow near cursor
        const cursorDist = Math.sqrt((worldX - mouse.x) ** 2 + (worldY - mouse.y) ** 2)
        let glowBoost = 0
        if (cursorDist < 150) {
          glowBoost = (1 - cursorDist / 150) * 0.4
        }

        ctx.save()
        ctx.translate(charX + displaceX, baseY + displaceY)
        if (Math.abs(rotation) > 0.001) {
          ctx.rotate(rotation)
        }

        // Shadow for depth
        ctx.fillStyle = `rgba(0, 20, 60, ${0.3 + glowBoost * 0.2})`
        ctx.fillText(ch, 1, 2)

        // Main character
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, alpha + glowBoost)})`
        ctx.fillText(ch, 0, 0)

        // Highlight on wave crests
        if (wave > 0.15) {
          ctx.fillStyle = `rgba(255, 255, 255, ${(wave - 0.15) * 0.3})`
          ctx.fillText(ch, 0, 0)
        }

        ctx.restore()
        charX += ctx.measureText(ch).width
      }
    }

    currentY += lines.length * TEXT_LINE_HEIGHT + 40
  }
}

// ─── Events ─────────────────────────────────────────────────────────────────
window.addEventListener('resize', resize)

document.addEventListener('mousemove', e => {
  mouse.x = e.clientX
  mouse.y = e.clientY
})

document.addEventListener('mouseleave', () => {
  mouse.x = -1000
  mouse.y = -1000
})

document.addEventListener('click', e => {
  addRipple(e.clientX, e.clientY)
})

document.addEventListener('touchstart', e => {
  e.preventDefault()
  for (const touch of e.touches) {
    addRipple(touch.clientX, touch.clientY)
  }
}, { passive: false })

document.addEventListener('touchmove', e => {
  if (e.touches.length > 0) {
    mouse.x = e.touches[0].clientX
    mouse.y = e.touches[0].clientY
  }
})

document.addEventListener('touchend', () => {
  mouse.x = -1000
  mouse.y = -1000
})

// ─── Init ───────────────────────────────────────────────────────────────────
resize()
render()
