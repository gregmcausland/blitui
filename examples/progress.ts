/**
 * Progress bar demo
 *
 * Demonstrates efficient updates where only the changed portion is redrawn.
 */

import {
  createInlineRenderer,
  Style,
  Color,
  Attr,
  requestAnimationFrame,
} from '../src/index.js';

const renderer = createInlineRenderer(6, { collectStats: true });

const titleStyle = new Style(Color.ansi('white'), Color.DEFAULT, Attr.BOLD);
const progressStyle = new Style(Color.ansi('green'));
const emptyStyle = new Style(Color.ansi('brightBlack'));
const percentStyle = new Style(Color.ansi('cyan'));
const dimStyle = new Style(Color.ansi('brightBlack'));

interface Task {
  name: string;
  progress: number;
  speed: number;
}

const tasks: Task[] = [
  { name: 'Downloading', progress: 0, speed: 0.8 },
  { name: 'Processing', progress: 0, speed: 0.5 },
  { name: 'Uploading', progress: 0, speed: 0.3 },
];

const BAR_WIDTH = 30;

function drawProgressBar(row: number, task: Task): void {
  const filled = Math.floor((task.progress / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;

  // Label
  renderer.putString(0, row, task.name.padEnd(12), titleStyle);

  // Progress bar
  renderer.putString(12, row, '[', dimStyle);
  renderer.putString(13, row, '█'.repeat(filled), progressStyle);
  renderer.putString(13 + filled, row, '░'.repeat(empty), emptyStyle);
  renderer.putString(13 + BAR_WIDTH, row, ']', dimStyle);

  // Percentage
  const pct = `${Math.floor(task.progress).toString().padStart(3)}%`;
  renderer.putString(14 + BAR_WIDTH, row, pct, percentStyle);
}

// Graceful shutdown
process.on('SIGINT', () => {
  renderer.cleanup();
  console.log('\nInterrupted');
  process.exit(0);
});

console.log('Progress Bar Demo - Efficient partial updates\n');

let frame = 0;
let allComplete = false;

const stop = requestAnimationFrame((delta) => {
  frame++;

  // Update progress
  let anyActive = false;
  for (const task of tasks) {
    if (task.progress < 100) {
      task.progress = Math.min(100, task.progress + task.speed);
      anyActive = true;
    }
  }

  if (!anyActive && !allComplete) {
    allComplete = true;
  }

  renderer.clear();

  // Draw progress bars
  for (let i = 0; i < tasks.length; i++) {
    drawProgressBar(i, tasks[i]);
  }

  // Stats row
  const stats = renderer.getStats();
  const dirtyCells = stats.lastDiff?.dirtyCells ?? 0;
  const totalCells = stats.lastDiff?.totalCells ?? 0;
  const efficiency = totalCells > 0 ? ((1 - dirtyCells / totalCells) * 100).toFixed(1) : '0';

  renderer.putString(
    0,
    4,
    `Frame: ${frame} | Dirty: ${dirtyCells}/${totalCells} cells | Efficiency: ${efficiency}%`,
    dimStyle
  );
  renderer.putString(
    0,
    5,
    `Bytes written: ${stats.bytesWritten} | Render time: ${stats.renderTime.toFixed(2)}ms`,
    dimStyle
  );

  renderer.render();

  if (allComplete && frame > 100) {
    renderer.cleanup();
    console.log('\nAll tasks complete!\n');
    return false;
  }
}, 30);
