# blitui

Flicker-free terminal rendering core for building high-fidelity terminal user interfaces.

## Features

- **Flicker-free rendering**: Efficient diffing algorithm minimizes terminal updates
- **Rich styling**: Support for colors (ANSI, 256-color, RGB), bold, italic, underline, and more
- **Unicode support**: Proper handling of graphemes and display widths
- **Flexible rendering modes**: Inline and full-screen rendering
- **Performance optimized**: Smart diffing and minimal escape sequence generation
- **TypeScript native**: Written in TypeScript with full type definitions
- **Animation support**: Built-in `requestAnimationFrame` for smooth animations
- **Terminal detection**: Automatic capability and color depth detection

## Installation

```bash
npm install blitui
```

## Requirements

- Node.js >= 16.0.0

## Quick Start

```typescript
import { createInlineRenderer, Style, Color, Attr } from 'blitui';

// Create a renderer with 3 rows
const renderer = createInlineRenderer(3);

// Define styles
const titleStyle = new Style(Color.ansi('cyan'), Color.DEFAULT, Attr.BOLD);
const textStyle = new Style(Color.ansi('white'));

// Render content
renderer.putString(0, 0, 'Hello, blitui!', titleStyle);
renderer.putString(0, 1, 'Flicker-free terminal rendering', textStyle);
renderer.render();

// Clean up when done
renderer.cleanup();
```

## Examples

The `examples/` directory contains several demonstrations:

### Spinner Animation

```bash
npm run example:spinner
```

Demonstrates flicker-free animation with multiple animated spinners.

### Progress Bar

```bash
npm run example:progress
```

Shows progress bar rendering with smooth updates.

### Terminal Resize

```bash
npm run example:resize
```

Demonstrates handling terminal resize events.

## Core Concepts

### Renderer

The renderer is the main interface for drawing to the terminal. Two modes are available:

- **Inline Renderer**: Renders a fixed number of rows inline with terminal output
- **Full-screen Renderer**: Takes over the entire terminal screen

```typescript
import { createInlineRenderer, createFullScreenRenderer } from 'blitui';

// Inline mode - renders 5 rows
const inline = createInlineRenderer(5);

// Full-screen mode
const fullscreen = createFullScreenRenderer();
```

### Styles

Styles define the visual appearance of text:

```typescript
import { Style, Color, Attr } from 'blitui';

// Foreground color only
const simple = new Style(Color.ansi('red'));

// Foreground and background
const highlighted = new Style(
  Color.ansi('white'),
  Color.ansi('blue')
);

// With attributes
const bold = new Style(
  Color.rgb(100, 200, 255),
  Color.DEFAULT,
  Attr.BOLD | Attr.UNDERLINE
);
```

### Colors

Three color modes are supported:

```typescript
// ANSI colors (16 colors)
Color.ansi('red')
Color.ansi('brightCyan')

// 256-color palette
Color.palette(196)

// True color RGB
Color.rgb(255, 128, 64)

// Default terminal color
Color.DEFAULT
```

### Cell Buffer

The `CellBuffer` provides a low-level interface for manipulating the terminal grid:

```typescript
import { CellBuffer, Cell } from 'blitui';

const buffer = new CellBuffer(80, 24);
buffer.setCell(0, 0, new Cell('H', style));
```

### Animation

Use `requestAnimationFrame` for smooth animations:

```typescript
import { requestAnimationFrame } from 'blitui';

let frame = 0;
const stop = requestAnimationFrame((delta) => {
  frame++;
  renderer.clear();
  renderer.putString(0, 0, `Frame: ${frame}`);
  renderer.render();

  // Return false to stop
  if (frame >= 100) return false;
}, 60); // 60 FPS target

// Stop manually
stop();
```

### Terminal Utilities

Various utilities for terminal interaction:

```typescript
import {
  getTerminalSize,
  isTTY,
  detectColorDepth,
  detectCapabilities,
  enableRawMode,
  disableRawMode,
  onResize,
} from 'blitui';

// Get terminal dimensions
const { cols, rows } = getTerminalSize();

// Check if running in a TTY
if (isTTY()) {
  console.log('Running in terminal');
}

// Detect color support
const depth = detectColorDepth(); // 'monochrome' | 'ansi' | 'palette' | 'rgb'

// Handle resize events
onResize((size) => {
  console.log(`Terminal resized to ${size.cols}x${size.rows}`);
});
```

## API Overview

### Renderer

- `putString(x, y, text, style?)`: Write text at position
- `putCell(x, y, cell)`: Write a single cell
- `clear()`: Clear the buffer
- `render()`: Render changes to terminal
- `cleanup()`: Clean up and restore terminal state
- `getStats()`: Get rendering statistics

### Cell & Style

- `Cell(char, style)`: Create a terminal cell
- `Style(fg?, bg?, attrs?)`: Create a style
- `Color.ansi(name)`: ANSI color
- `Color.palette(index)`: 256-color palette
- `Color.rgb(r, g, b)`: True color
- `Attr.BOLD`, `Attr.ITALIC`, `Attr.UNDERLINE`, etc.

### Buffer

- `CellBuffer(width, height)`: Create a cell buffer
- `setCell(x, y, cell)`: Set cell at position
- `getCell(x, y)`: Get cell at position
- `resize(width, height)`: Resize buffer
- `fill(cell, rect?)`: Fill region with cell

### Diff Engine

- `findAllDirtySpans(prev, curr)`: Find changed regions
- `emitOptimizedDiff(prev, curr, composer)`: Generate optimized output
- `forceFullDiff(buffer, composer)`: Force full redraw

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch
```

## License

MIT

## Keywords

Terminal, TUI, Rendering, Flicker-free, TypeScript
