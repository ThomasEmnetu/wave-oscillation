# Ripple · Pretext

Interactive wave oscillation rendered as ASCII art on canvas, with flowing text powered by [@chenglou/pretext](https://github.com/chenglou/pretext).

## Features

- Real-time ripple physics with click, cursor wake, and ambient raindrops
- Text paragraphs laid out using pretext's DOM-free line breaking
- Per-character wave displacement, rotation, and color modulation
- Cursor proximity glow on nearby text
- Responsive — re-layouts text on resize without DOM reflow

## Run

Open `index.html` with any local server:

```
npx serve .
```

Or use VS Code Live Server. The importmap loads pretext from CDN — no install step needed.

## Stack

- Vanilla JS + Canvas 2D
- [@chenglou/pretext](https://github.com/chenglou/pretext) for text measurement & layout
