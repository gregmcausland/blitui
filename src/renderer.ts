/**
 * Renderer - Main rendering engine with double buffering
 */

import { Cell, Style, type ColorDepth } from './cell.js';
import { CellBuffer, type Rect } from './buffer.js';
import { OutputComposer } from './composer.js';
import { emitOptimizedDiff, forceFullDiff, type DiffStats } from './diff.js';
import {
  getTerminalSize,
  detectColorDepth,
  onResize,
  writeOutput,
  type TerminalSize,
} from './terminal.js';

/**
 * Rendering mode
 */
export type RenderMode = 'inline' | 'alternate';

/**
 * Renderer configuration options
 */
export interface RendererOptions {
  /** Rendering mode: 'inline' for scrollback, 'alternate' for full screen */
  mode?: RenderMode;
  /** Width override (default: auto-detect from terminal) */
  width?: number;
  /** Height override (default: auto-detect or region height for inline) */
  height?: number;
  /** Color depth override (default: auto-detect) */
  colorDepth?: ColorDepth;
  /** Show cursor during render (default: false to prevent flicker) */
  showCursorDuringRender?: boolean;
  /** Collect statistics (default: false for performance) */
  collectStats?: boolean;
}

/**
 * Rendering statistics
 */
export interface RenderStats {
  frameCount: number;
  lastDiff: DiffStats | null;
  bytesWritten: number;
  renderTime: number;
}

/**
 * Main renderer class implementing double-buffering for flicker-free updates
 */
export class Renderer {
  private backBuffer: CellBuffer;
  private frontBuffer: CellBuffer;
  private composer: OutputComposer;

  private mode: RenderMode;
  private colorDepth: ColorDepth;
  private showCursorDuringRender: boolean;
  private collectStats: boolean;

  private regionHeight: number;
  private anchorY: number = 0;
  private initialized = false;
  private forceFullRedraw = false;

  private unsubscribeResize: (() => void) | null = null;

  private stats: RenderStats = {
    frameCount: 0,
    lastDiff: null,
    bytesWritten: 0,
    renderTime: 0,
  };

  constructor(options: RendererOptions = {}) {
    this.mode = options.mode ?? 'inline';
    this.colorDepth = options.colorDepth ?? detectColorDepth();
    this.showCursorDuringRender = options.showCursorDuringRender ?? false;
    this.collectStats = options.collectStats ?? false;

    // Determine dimensions
    const termSize = getTerminalSize();
    const width = options.width ?? termSize.columns;
    const height = options.height ?? (this.mode === 'inline' ? 1 : termSize.rows);

    this.regionHeight = height;
    this.backBuffer = new CellBuffer(width, height);
    this.frontBuffer = new CellBuffer(width, height);
    this.composer = new OutputComposer(this.colorDepth);
  }

  /**
   * Get the buffer width
   */
  get width(): number {
    return this.backBuffer.width;
  }

  /**
   * Get the buffer height
   */
  get height(): number {
    return this.backBuffer.height;
  }

  /**
   * Get rendering statistics
   */
  getStats(): RenderStats {
    return { ...this.stats };
  }

  /**
   * Initialize the renderer
   * For inline mode, this reserves space in the terminal
   * For alternate mode, this enters the alternate screen
   */
  init(): void {
    if (this.initialized) return;

    if (this.mode === 'alternate') {
      this.composer.enterAlternateScreen();
      this.composer.hideCursor();
      this.composer.moveHome();
      writeOutput(this.composer.flush());
    } else {
      // Inline mode: reserve space by emitting newlines
      this.reserveSpace(this.regionHeight);
    }

    // Set up resize handler
    this.unsubscribeResize = onResize((size) => this.handleResize(size));

    this.initialized = true;
    this.forceFullRedraw = true;
  }

  /**
   * Clean up and restore terminal state
   */
  cleanup(): void {
    if (!this.initialized) return;

    if (this.unsubscribeResize) {
      this.unsubscribeResize();
      this.unsubscribeResize = null;
    }

    this.composer.resetStyle();
    this.composer.showCursor();

    if (this.mode === 'alternate') {
      this.composer.leaveAlternateScreen();
    } else {
      // Inline mode: cursor is at bottom of region (from restore after render)
      // Move down one line and to column 0 so next output appears below
      this.composer.moveDown(1);
      this.composer.moveToColumn(0);
    }

    writeOutput(this.composer.flush());
    this.initialized = false;
  }

  /**
   * Reserve space in the terminal for inline mode
   */
  private reserveSpace(lines: number): void {
    // Just emit newlines to reserve space - content appears
    // right where the cursor is in the scrollback
    this.composer.newlines(lines);

    // Save where our anchor point is (bottom of our region)
    this.anchorY = lines - 1;

    writeOutput(this.composer.flush());
  }

  /**
   * Grow the inline region if needed
   */
  private growRegion(newHeight: number): void {
    if (newHeight <= this.regionHeight) return;

    const growth = newHeight - this.regionHeight;

    // Emit additional newlines
    this.composer.saveCursor();
    this.composer.newlines(growth);
    this.composer.restoreCursor();

    // Update tracking
    this.anchorY += growth;
    this.regionHeight = newHeight;

    writeOutput(this.composer.flush());
  }

  /**
   * Handle terminal resize
   */
  private handleResize(size: TerminalSize): void {
    const newWidth = size.columns;
    let newHeight: number;

    if (this.mode === 'alternate') {
      newHeight = size.rows;
    } else {
      // In inline mode, keep the same height but clamp to available space
      newHeight = Math.min(this.regionHeight, size.rows);
    }

    // Resize buffers
    this.backBuffer.resize(newWidth, newHeight);
    this.frontBuffer.resize(newWidth, newHeight);
    this.regionHeight = newHeight;

    // Force full redraw on next render
    this.forceFullRedraw = true;
  }

  /**
   * Manually resize the render region
   */
  resize(width: number, height: number): void {
    if (this.mode === 'inline' && height > this.regionHeight) {
      this.growRegion(height);
    }

    this.backBuffer.resize(width, height);
    this.frontBuffer.resize(width, height);
    this.regionHeight = height;
    this.forceFullRedraw = true;
  }

  /**
   * Put a single character at the given position
   */
  putChar(x: number, y: number, char: string, style: Style = Style.DEFAULT): number {
    return this.backBuffer.putChar(x, y, char, style);
  }

  /**
   * Put a string starting at the given position
   */
  putString(x: number, y: number, text: string, style: Style = Style.DEFAULT): number {
    return this.backBuffer.putString(x, y, text, style);
  }

  /**
   * Fill a rectangle with a character
   */
  fill(rect: Rect, char: string, style: Style = Style.DEFAULT): void {
    this.backBuffer.fill(rect, char, style);
  }

  /**
   * Clear the entire back buffer
   */
  clear(style: Style = Style.DEFAULT): void {
    this.backBuffer.clear(style);
  }

  /**
   * Clear a rectangular region
   */
  clearRect(rect: Rect, style: Style = Style.DEFAULT): void {
    this.backBuffer.clearRect(rect, style);
  }

  /**
   * Get direct access to the back buffer for advanced operations
   */
  getBackBuffer(): CellBuffer {
    return this.backBuffer;
  }

  /**
   * Get a cell from the back buffer
   */
  getCell(x: number, y: number): Cell | undefined {
    return this.backBuffer.get(x, y);
  }

  /**
   * Render the back buffer to the terminal
   * Uses diff algorithm to minimize output
   */
  render(): void {
    if (!this.initialized) {
      this.init();
    }

    const startTime = this.collectStats ? performance.now() : 0;

    // For inline mode, we need to hide/show cursor each frame
    // For alternate mode, cursor stays hidden (was hidden in init)
    const needsCursorToggle = this.mode === 'inline' && !this.showCursorDuringRender;

    if (needsCursorToggle) {
      this.composer.hideCursor();
    }

    // Perform rendering based on mode
    let diffStats: DiffStats;

    if (this.mode === 'inline') {
      // Inline mode: use relative positioning
      this.composer.saveCursor();
      this.composer.moveUp(this.regionHeight);
      this.composer.moveToColumn(0);

      // Render row by row using relative movement
      diffStats = this.renderInline();

      this.composer.restoreCursor();
    } else {
      // Alternate screen: use absolute positioning with diff optimization
      if (this.forceFullRedraw) {
        diffStats = forceFullDiff(this.backBuffer, this.composer, 0);
        this.forceFullRedraw = false;
      } else {
        diffStats = emitOptimizedDiff(
          this.backBuffer,
          this.frontBuffer,
          this.composer,
          0
        );
      }
    }

    // Reset style
    this.composer.resetStyle();

    // Only show cursor for inline mode (alternate keeps it hidden)
    if (needsCursorToggle) {
      this.composer.showCursor();
    }

    // Flush all output as a single atomic write
    const output = this.composer.flush();
    writeOutput(output);

    // Copy back buffer to front buffer
    this.frontBuffer.copyFrom(this.backBuffer);

    // Update stats
    if (this.collectStats) {
      this.stats.frameCount++;
      this.stats.lastDiff = diffStats;
      this.stats.bytesWritten = Buffer.byteLength(output, 'utf8');
      this.stats.renderTime = performance.now() - startTime;
    }
  }

  /**
   * Render inline using relative positioning (row by row)
   * Used when we don't know our absolute terminal position
   */
  private renderInline(): DiffStats {
    const stats: DiffStats = {
      totalCells: this.backBuffer.width * this.backBuffer.height,
      dirtyCells: 0,
      skippedRows: 0,
      spans: 0,
      cursorMoves: 0,
      styleChanges: 0,
    };

    let currentStyle: Style | null = null;

    for (let row = 0; row < this.backBuffer.height; row++) {
      // Move to start of this row
      if (row > 0) {
        this.composer.moveDown(1);
      }
      this.composer.moveToColumn(0);

      // Always clear the line first to remove any artifacts
      // (e.g., from user input shifting our position)
      this.composer.clearLine();

      stats.cursorMoves++;

      // Render the row content
      for (let col = 0; col < this.backBuffer.width; col++) {
        const cell = this.backBuffer.get(col, row);
        if (!cell || cell.isShadow()) continue;

        stats.dirtyCells++;

        // Update style if needed
        if (!currentStyle || !currentStyle.equals(cell.style)) {
          this.composer.setStyle(cell.style);
          currentStyle = cell.style;
          stats.styleChanges++;
        }

        this.composer.write(cell.char);
      }
      stats.spans++;
    }

    this.forceFullRedraw = false;
    return stats;
  }

  /**
   * Check if a row is identical in back and front buffers
   */
  private isRowClean(row: number): boolean {
    for (let col = 0; col < this.backBuffer.width; col++) {
      const back = this.backBuffer.get(col, row);
      const front = this.frontBuffer.get(col, row);
      if (!back || !front || !back.equals(front)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Force a full redraw on the next render
   */
  invalidate(): void {
    this.forceFullRedraw = true;
  }

  /**
   * Set cursor position (visible after render)
   */
  setCursorPosition(x: number, y: number): void {
    // This will be applied after the next render
    this.composer.moveTo(x, y);
    writeOutput(this.composer.flush());
  }
}

/**
 * Create an inline renderer for rendering within the terminal scrollback
 */
export function createInlineRenderer(
  height: number,
  options: Omit<RendererOptions, 'mode' | 'height'> = {}
): Renderer {
  return new Renderer({
    ...options,
    mode: 'inline',
    height,
  });
}

/**
 * Create a full-screen renderer using the alternate screen buffer
 */
export function createFullScreenRenderer(
  options: Omit<RendererOptions, 'mode'> = {}
): Renderer {
  return new Renderer({
    ...options,
    mode: 'alternate',
  });
}
