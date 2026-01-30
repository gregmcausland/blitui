/**
 * Terminal utilities - size detection, raw mode, capability detection
 */

import { type ColorDepth } from './cell.js';

/**
 * Terminal size information
 */
export interface TerminalSize {
  columns: number;
  rows: number;
}

/**
 * Get the current terminal size
 */
export function getTerminalSize(): TerminalSize {
  return {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  };
}

/**
 * Check if stdout is a TTY
 */
export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Detect the terminal's color depth capability
 */
export function detectColorDepth(): ColorDepth {
  // Check if TTY at all
  if (!isTTY()) {
    return 'none';
  }

  // COLORTERM is the most reliable indicator for truecolor
  const colorTerm = process.env.COLORTERM;
  if (colorTerm === 'truecolor' || colorTerm === '24bit') {
    return 'truecolor';
  }

  // Check terminal emulator specific env vars
  const term = process.env.TERM || '';
  const termProgram = process.env.TERM_PROGRAM || '';

  // Known truecolor terminals
  if (
    termProgram === 'iTerm.app' ||
    termProgram === 'Apple_Terminal' ||
    termProgram === 'Hyper' ||
    termProgram === 'vscode' ||
    term.includes('256color') && (
      termProgram === 'Terminus' ||
      process.env.WT_SESSION // Windows Terminal
    )
  ) {
    return 'truecolor';
  }

  // 256 color support
  if (term.includes('256color') || term.includes('256')) {
    return '256';
  }

  // Check for basic color support
  if (
    term.includes('color') ||
    term.includes('ansi') ||
    term.includes('xterm') ||
    term.includes('vt100') ||
    term.includes('screen')
  ) {
    return '16';
  }

  // Check FORCE_COLOR env var
  const forceColor = process.env.FORCE_COLOR;
  if (forceColor !== undefined) {
    if (forceColor === '0') return 'none';
    if (forceColor === '1') return '16';
    if (forceColor === '2') return '256';
    if (forceColor === '3') return 'truecolor';
  }

  // Default to 16 colors for TTYs
  return '16';
}

/**
 * State for raw mode
 */
let originalRawMode: boolean | undefined;

/**
 * Enable raw mode on stdin
 * In raw mode, input is not line-buffered and ctrl+c doesn't send SIGINT
 */
export function enableRawMode(): void {
  if (process.stdin.isTTY) {
    originalRawMode = process.stdin.isRaw;
    process.stdin.setRawMode(true);
  }
}

/**
 * Disable raw mode on stdin (restore original state)
 */
export function disableRawMode(): void {
  if (process.stdin.isTTY && originalRawMode !== undefined) {
    process.stdin.setRawMode(originalRawMode);
    originalRawMode = undefined;
  }
}

/**
 * Type for resize event handler
 */
export type ResizeHandler = (size: TerminalSize) => void;

// Store handlers for cleanup
const resizeHandlers = new Set<() => void>();

/**
 * Register a handler for terminal resize events
 * Returns a function to unregister the handler
 */
export function onResize(handler: ResizeHandler): () => void {
  const wrappedHandler = () => {
    handler(getTerminalSize());
  };

  process.stdout.on('resize', wrappedHandler);
  resizeHandlers.add(wrappedHandler);

  return () => {
    process.stdout.off('resize', wrappedHandler);
    resizeHandlers.delete(wrappedHandler);
  };
}

/**
 * Remove all registered resize handlers
 */
export function removeAllResizeHandlers(): void {
  for (const handler of resizeHandlers) {
    process.stdout.off('resize', handler);
  }
  resizeHandlers.clear();
}

/**
 * Terminal capability detection result
 */
export interface TerminalCapabilities {
  colorDepth: ColorDepth;
  isTTY: boolean;
  columns: number;
  rows: number;
  supportsAlternateScreen: boolean;
  supportsBracketedPaste: boolean;
  supportsMouse: boolean;
  unicode: boolean;
}

/**
 * Detect all terminal capabilities
 */
export function detectCapabilities(): TerminalCapabilities {
  const size = getTerminalSize();
  const tty = isTTY();
  const term = process.env.TERM || '';

  return {
    colorDepth: detectColorDepth(),
    isTTY: tty,
    columns: size.columns,
    rows: size.rows,
    // Most modern terminals support these
    supportsAlternateScreen: tty && term !== 'dumb',
    supportsBracketedPaste: tty && term !== 'dumb',
    supportsMouse: tty && term !== 'dumb',
    // Check for unicode support (simplified check)
    unicode: isUnicodeSupported(),
  };
}

/**
 * Check if the terminal supports Unicode
 */
function isUnicodeSupported(): boolean {
  // Check CI environments that typically support Unicode
  if (process.env.CI) {
    return process.env.GITHUB_ACTIONS !== undefined ||
           process.env.GITLAB_CI !== undefined ||
           process.env.CIRCLECI !== undefined;
  }

  // Check locale settings
  const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_CTYPE || '';
  if (lang.toLowerCase().includes('utf')) {
    return true;
  }

  // Windows Terminal and modern Windows console support Unicode
  if (process.platform === 'win32') {
    return process.env.WT_SESSION !== undefined ||
           parseInt(process.env.ConEmuANSI || '0', 10) === 1;
  }

  // Default to true for Unix-like systems with a TTY
  return isTTY();
}

/**
 * Write output to stdout atomically
 */
export function writeOutput(output: string): void {
  process.stdout.write(output);
}

/**
 * Create a promise that resolves on the next frame (for animation timing)
 */
export function nextFrame(fps: number = 60): Promise<void> {
  const frameTime = Math.floor(1000 / fps);
  return new Promise(resolve => setTimeout(resolve, frameTime));
}

/**
 * Request animation frame style loop for terminal
 */
export function requestAnimationFrame(
  callback: (deltaTime: number) => boolean | void,
  fps: number = 60
): () => void {
  let lastTime = Date.now();
  let running = true;

  const frameTime = Math.floor(1000 / fps);

  const loop = () => {
    if (!running) return;

    const now = Date.now();
    const delta = now - lastTime;
    lastTime = now;

    const result = callback(delta);

    if (result === false) {
      running = false;
      return;
    }

    const elapsed = Date.now() - now;
    const delay = Math.max(0, frameTime - elapsed);
    setTimeout(loop, delay);
  };

  setTimeout(loop, 0);

  return () => {
    running = false;
  };
}
