/**
 * blitui - Flicker-free Terminal Rendering Core
 *
 * A TypeScript library for high-fidelity, flicker-free terminal rendering.
 */

// Cell types and utilities
export {
  Cell,
  Style,
  Color,
  Attr,
  type Attrs,
  type ColorDepth,
  type AnsiColor,
  type RGB,
  getDisplayWidth,
  getGraphemeWidth,
  graphemes,
} from './cell.js';

// Buffer
export {
  CellBuffer,
  type Rect,
} from './buffer.js';

// Output composer
export {
  OutputComposer,
} from './composer.js';

// Diff engine
export {
  findDirtySpansInRow,
  findAllDirtySpans,
  isRowClean,
  countDirtyCells,
  emitDirtySpans,
  emitOptimizedDiff,
  forceFullDiff,
  type DirtySpan,
  type DiffStats,
} from './diff.js';

// Renderer
export {
  Renderer,
  createInlineRenderer,
  createFullScreenRenderer,
  type RenderMode,
  type RendererOptions,
  type RenderStats,
} from './renderer.js';

// Terminal utilities
export {
  getTerminalSize,
  isTTY,
  detectColorDepth,
  detectCapabilities,
  enableRawMode,
  disableRawMode,
  onResize,
  removeAllResizeHandlers,
  writeOutput,
  nextFrame,
  requestAnimationFrame,
  type TerminalSize,
  type ResizeHandler,
  type TerminalCapabilities,
} from './terminal.js';
