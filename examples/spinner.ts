/**
 * Animated spinner demo
 *
 * Demonstrates flicker-free animation using inline rendering mode.
 */

import {
  createInlineRenderer,
  Style,
  Color,
  Attr,
  requestAnimationFrame,
} from '../src/index.js';

// Spinner frames
const SPINNERS = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['|', '/', '-', '\\'],
  arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
  circle: ['◐', '◓', '◑', '◒'],
  square: ['◰', '◳', '◲', '◱'],
  arrows: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  bounce: ['⠁', '⠂', '⠄', '⠂'],
  clock: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
};

const renderer = createInlineRenderer(4, { collectStats: true });

const spinnerStyle = new Style(Color.ansi('cyan'), Color.DEFAULT, Attr.BOLD);
const labelStyle = new Style(Color.ansi('white'));
const dimStyle = new Style(Color.ansi('brightBlack'));
const successStyle = new Style(Color.ansi('green'), Color.DEFAULT, Attr.BOLD);

let frame = 0;
let elapsedMs = 0;
const duration = 5000; // Run for 5 seconds

// Graceful shutdown
process.on('SIGINT', () => {
  renderer.cleanup();
  console.log('\nInterrupted');
  process.exit(0);
});

console.log('Spinner Demo - Demonstrating flicker-free animation\n');

const stop = requestAnimationFrame((delta) => {
  elapsedMs += delta;
  frame++;

  if (elapsedMs >= duration) {
    // Final frame
    renderer.clear();
    renderer.putString(0, 0, '✓', successStyle);
    renderer.putString(2, 0, 'Complete!', successStyle);
    renderer.putString(0, 2, `Rendered ${frame} frames in ${(elapsedMs / 1000).toFixed(1)}s`, dimStyle);
    renderer.render();
    renderer.cleanup();
    console.log('\n');
    return false; // Stop animation
  }

  renderer.clear();

  // Row 0: Dots spinner
  const dotsFrame = SPINNERS.dots[frame % SPINNERS.dots.length];
  renderer.putString(0, 0, dotsFrame, spinnerStyle);
  renderer.putString(2, 0, 'Loading resources...', labelStyle);

  // Row 1: Arc spinner
  const arcFrame = SPINNERS.arc[frame % SPINNERS.arc.length];
  renderer.putString(0, 1, arcFrame, spinnerStyle);
  renderer.putString(2, 1, 'Compiling modules...', labelStyle);

  // Row 2: Arrows spinner
  const arrowFrame = SPINNERS.arrows[frame % SPINNERS.arrows.length];
  renderer.putString(0, 2, arrowFrame, spinnerStyle);
  renderer.putString(2, 2, 'Syncing data...', labelStyle);

  // Row 3: Stats
  const stats = renderer.getStats();
  const fps = frame > 0 ? Math.round(frame / (elapsedMs / 1000)) : 0;
  const statsText = `Frame: ${frame} | FPS: ${fps} | Bytes: ${stats.bytesWritten}`;
  renderer.putString(0, 3, statsText, dimStyle);

  renderer.render();
}, 60);
