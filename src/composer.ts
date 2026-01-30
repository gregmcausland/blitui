/**
 * OutputComposer - Builds escape sequences for terminal output
 */

import { Color, Style, Attr, type Attrs, type ColorDepth } from './cell.js';

// Common escape sequences
const ESC = '\x1b';
const CSI = `${ESC}[`;

/**
 * OutputComposer builds a single string of escape sequences and text
 * for atomic terminal writes
 */
export class OutputComposer {
  private parts: string[] = [];
  private currentStyle: Style | null = null;
  private cursorX = 0;
  private cursorY = 0;
  private colorDepth: ColorDepth;

  constructor(colorDepth: ColorDepth = 'truecolor') {
    this.colorDepth = colorDepth;
  }

  /**
   * Reset internal state for a new composition
   */
  reset(): void {
    this.parts = [];
    this.currentStyle = null;
    this.cursorX = 0;
    this.cursorY = 0;
  }

  /**
   * Hide the cursor
   */
  hideCursor(): void {
    this.parts.push(`${CSI}?25l`);
  }

  /**
   * Show the cursor
   */
  showCursor(): void {
    this.parts.push(`${CSI}?25h`);
  }

  /**
   * Move cursor to absolute position (1-indexed for ANSI)
   */
  moveTo(x: number, y: number): void {
    // ANSI uses 1-based coordinates
    this.parts.push(`${CSI}${y + 1};${x + 1}H`);
    this.cursorX = x;
    this.cursorY = y;
  }

  /**
   * Move cursor to home position (0,0)
   */
  moveHome(): void {
    this.parts.push(`${CSI}H`);
    this.cursorX = 0;
    this.cursorY = 0;
  }

  /**
   * Move cursor up N lines
   */
  moveUp(n: number): void {
    if (n <= 0) return;
    this.parts.push(`${CSI}${n}A`);
    this.cursorY = Math.max(0, this.cursorY - n);
  }

  /**
   * Move cursor down N lines
   */
  moveDown(n: number): void {
    if (n <= 0) return;
    this.parts.push(`${CSI}${n}B`);
    this.cursorY += n;
  }

  /**
   * Move cursor right N columns
   */
  moveRight(n: number): void {
    if (n <= 0) return;
    this.parts.push(`${CSI}${n}C`);
    this.cursorX += n;
  }

  /**
   * Move cursor left N columns
   */
  moveLeft(n: number): void {
    if (n <= 0) return;
    this.parts.push(`${CSI}${n}D`);
    this.cursorX = Math.max(0, this.cursorX - n);
  }

  /**
   * Move cursor relative to current position
   * Uses the most efficient escape sequence
   */
  moveRelative(dx: number, dy: number): void {
    if (dy < 0) this.moveUp(-dy);
    else if (dy > 0) this.moveDown(dy);

    if (dx < 0) this.moveLeft(-dx);
    else if (dx > 0) this.moveRight(dx);
  }

  /**
   * Move cursor to column within current row
   */
  moveToColumn(x: number): void {
    this.parts.push(`${CSI}${x + 1}G`);
    this.cursorX = x;
  }

  /**
   * Move cursor to the optimal position
   * Chooses between absolute and relative moves based on efficiency
   */
  moveToOptimal(targetX: number, targetY: number): void {
    const dx = targetX - this.cursorX;
    const dy = targetY - this.cursorY;

    // Calculate cost of absolute move: ESC[r;cH = 4-8 bytes
    const absLen = `${CSI}${targetY + 1};${targetX + 1}H`.length;

    // Calculate cost of relative moves
    let relLen = 0;
    if (dy !== 0) relLen += `${CSI}${Math.abs(dy)}${dy < 0 ? 'A' : 'B'}`.length;
    if (dx !== 0) relLen += `${CSI}${Math.abs(dx)}${dx < 0 ? 'D' : 'C'}`.length;

    // Use the shorter option
    if (relLen > 0 && relLen < absLen) {
      this.moveRelative(dx, dy);
    } else if (dx !== 0 || dy !== 0) {
      this.moveTo(targetX, targetY);
    }
  }

  /**
   * Set the text style (colors and attributes)
   * Only emits escape sequences if the style has changed
   */
  setStyle(style: Style): void {
    if (this.currentStyle?.equals(style)) return;

    const params: string[] = [];

    // Check if we need to reset
    const needReset = this.currentStyle !== null && (
      // Reset if removing attributes (can't selectively remove most)
      (this.currentStyle.attrs & ~style.attrs) !== 0
    );

    if (needReset || this.currentStyle === null) {
      params.push('0');
      this.currentStyle = null;
    }

    // Apply attributes
    if (style.attrs !== Attr.NONE) {
      if (style.attrs & Attr.BOLD) params.push('1');
      if (style.attrs & Attr.DIM) params.push('2');
      if (style.attrs & Attr.ITALIC) params.push('3');
      if (style.attrs & Attr.UNDERLINE) params.push('4');
      if (style.attrs & Attr.BLINK) params.push('5');
      if (style.attrs & Attr.REVERSE) params.push('7');
      if (style.attrs & Attr.HIDDEN) params.push('8');
      if (style.attrs & Attr.STRIKETHROUGH) params.push('9');
    }

    // Apply foreground color
    if (this.currentStyle === null || !this.currentStyle.fg.equals(style.fg)) {
      params.push(style.fg.toAnsiFg(this.colorDepth));
    }

    // Apply background color
    if (this.currentStyle === null || !this.currentStyle.bg.equals(style.bg)) {
      params.push(style.bg.toAnsiBg(this.colorDepth));
    }

    if (params.length > 0) {
      this.parts.push(`${CSI}${params.join(';')}m`);
    }

    this.currentStyle = style;
  }

  /**
   * Reset all text attributes to default
   */
  resetStyle(): void {
    this.parts.push(`${CSI}0m`);
    this.currentStyle = null;
  }

  /**
   * Write text at current cursor position
   */
  write(text: string): void {
    if (text.length === 0) return;
    this.parts.push(text);
    // Update cursor position (simplified - doesn't handle newlines or wide chars)
    this.cursorX += text.length;
  }

  /**
   * Write text and track cursor position with actual width
   */
  writeWithWidth(text: string, width: number): void {
    if (text.length === 0) return;
    this.parts.push(text);
    this.cursorX += width;
  }

  /**
   * Clear from cursor to end of line
   */
  clearToEndOfLine(): void {
    this.parts.push(`${CSI}K`);
  }

  /**
   * Clear from cursor to beginning of line
   */
  clearToStartOfLine(): void {
    this.parts.push(`${CSI}1K`);
  }

  /**
   * Clear the entire current line
   */
  clearLine(): void {
    this.parts.push(`${CSI}2K`);
  }

  /**
   * Clear from cursor to end of screen
   */
  clearToEndOfScreen(): void {
    this.parts.push(`${CSI}J`);
  }

  /**
   * Clear from cursor to beginning of screen
   */
  clearToStartOfScreen(): void {
    this.parts.push(`${CSI}1J`);
  }

  /**
   * Clear entire screen (use sparingly - causes flicker)
   */
  clearScreen(): void {
    this.parts.push(`${CSI}2J`);
  }

  /**
   * Save cursor position
   */
  saveCursor(): void {
    this.parts.push(`${ESC}7`);
  }

  /**
   * Restore cursor position
   */
  restoreCursor(): void {
    this.parts.push(`${ESC}8`);
  }

  /**
   * Enter alternate screen buffer
   */
  enterAlternateScreen(): void {
    this.parts.push(`${CSI}?1049h`);
  }

  /**
   * Leave alternate screen buffer
   */
  leaveAlternateScreen(): void {
    this.parts.push(`${CSI}?1049l`);
  }

  /**
   * Enable mouse tracking (basic click)
   */
  enableMouse(): void {
    this.parts.push(`${CSI}?1000h`);
  }

  /**
   * Disable mouse tracking
   */
  disableMouse(): void {
    this.parts.push(`${CSI}?1000l`);
  }

  /**
   * Enable bracketed paste mode
   */
  enableBracketedPaste(): void {
    this.parts.push(`${CSI}?2004h`);
  }

  /**
   * Disable bracketed paste mode
   */
  disableBracketedPaste(): void {
    this.parts.push(`${CSI}?2004l`);
  }

  /**
   * Add a raw escape sequence
   */
  raw(sequence: string): void {
    this.parts.push(sequence);
  }

  /**
   * Add newlines (for reserving space in inline mode)
   */
  newlines(count: number): void {
    for (let i = 0; i < count; i++) {
      this.parts.push('\n');
    }
    this.cursorY += count;
    this.cursorX = 0;
  }

  /**
   * Set the internal cursor position tracking without emitting escape codes
   */
  setCursorTracking(x: number, y: number): void {
    this.cursorX = x;
    this.cursorY = y;
  }

  /**
   * Get the current tracked cursor position
   */
  getCursorPosition(): { x: number; y: number } {
    return { x: this.cursorX, y: this.cursorY };
  }

  /**
   * Flush all accumulated output and return as a single string
   */
  flush(): string {
    const output = this.parts.join('');
    this.reset();
    return output;
  }

  /**
   * Get the current accumulated output without clearing
   */
  peek(): string {
    return this.parts.join('');
  }

  /**
   * Get the number of bytes accumulated
   */
  get byteLength(): number {
    return this.parts.reduce((sum, part) => sum + Buffer.byteLength(part, 'utf8'), 0);
  }
}
