/**
 * Resize handling demo
 *
 * Demonstrates graceful recovery when the terminal is resized.
 */

import {
  createFullScreenRenderer,
  Style,
  Color,
  Attr,
  requestAnimationFrame,
  getTerminalSize,
} from '../src/index.js';

const renderer = createFullScreenRenderer({ collectStats: true });

const borderStyle = new Style(Color.ansi('blue'));
const titleStyle = new Style(Color.ansi('white'), Color.ansi('blue'), Attr.BOLD);
const textStyle = new Style(Color.ansi('white'));
const highlightStyle = new Style(Color.ansi('yellow'), Color.DEFAULT, Attr.BOLD);
const dimStyle = new Style(Color.ansi('brightBlack'));

function drawBorder(): void {
  const { width, height } = renderer;

  // Top border
  renderer.putString(0, 0, '┌' + '─'.repeat(width - 2) + '┐', borderStyle);

  // Side borders
  for (let y = 1; y < height - 1; y++) {
    renderer.putChar(0, y, '│', borderStyle);
    renderer.putChar(width - 1, y, '│', borderStyle);
  }

  // Bottom border
  renderer.putString(0, height - 1, '└' + '─'.repeat(width - 2) + '┘', borderStyle);
}

function centerText(y: number, text: string, style: Style): void {
  const x = Math.floor((renderer.width - text.length) / 2);
  renderer.putString(x, y, text, style);
}

// Graceful shutdown
process.on('SIGINT', () => {
  renderer.cleanup();
  process.exit(0);
});

let frame = 0;
let lastSize = getTerminalSize();
let resizeCount = 0;

const stop = requestAnimationFrame((delta) => {
  frame++;

  const currentSize = getTerminalSize();
  if (currentSize.columns !== lastSize.columns || currentSize.rows !== lastSize.rows) {
    resizeCount++;
    lastSize = currentSize;
    renderer.resize(currentSize.columns, currentSize.rows);
  }

  renderer.clear();
  drawBorder();

  // Title
  const title = ' Resize Demo - Try resizing your terminal! ';
  const titleX = Math.floor((renderer.width - title.length) / 2);
  renderer.putString(titleX, 0, title, titleStyle);

  // Content
  const centerY = Math.floor(renderer.height / 2);

  centerText(centerY - 3, 'Terminal Size', highlightStyle);
  centerText(centerY - 1, `Width: ${renderer.width} columns`, textStyle);
  centerText(centerY, `Height: ${renderer.height} rows`, textStyle);
  centerText(centerY + 2, `Resize count: ${resizeCount}`, dimStyle);

  // Stats
  const stats = renderer.getStats();
  const statsLine = `Frame: ${frame} | Bytes: ${stats.bytesWritten} | Time: ${stats.renderTime.toFixed(1)}ms`;
  renderer.putString(2, renderer.height - 2, statsLine, dimStyle);

  // Instructions
  const instructions = 'Press Ctrl+C to exit';
  renderer.putString(renderer.width - instructions.length - 2, renderer.height - 2, instructions, dimStyle);

  renderer.render();
}, 30);
