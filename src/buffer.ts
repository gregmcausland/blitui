/**
 * CellBuffer - A 2D grid of cells for terminal rendering
 */

import { Cell, Style, graphemes } from './cell.js';

/**
 * A rectangle region within the buffer
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * CellBuffer manages a 2D grid of terminal cells
 */
export class CellBuffer {
  private cells: Cell[];
  private _width: number;
  private _height: number;

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
    this.cells = new Array(width * height);
    this.clear();
  }

  get width(): number {
    return this._width;
  }

  get height(): number {
    return this._height;
  }

  /**
   * Get the index into the cells array for given coordinates
   */
  private index(x: number, y: number): number {
    return y * this._width + x;
  }

  /**
   * Check if coordinates are within bounds
   */
  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this._width && y >= 0 && y < this._height;
  }

  /**
   * Get a cell at the given position
   */
  get(x: number, y: number): Cell | undefined {
    if (!this.inBounds(x, y)) return undefined;
    return this.cells[this.index(x, y)];
  }

  /**
   * Set a cell at the given position
   */
  set(x: number, y: number, cell: Cell): void {
    if (!this.inBounds(x, y)) return;
    this.cells[this.index(x, y)] = cell;
  }

  /**
   * Put a single character at the given position with style
   * Handles wide characters by placing a shadow cell in the next position
   */
  putChar(x: number, y: number, char: string, style: Style = Style.DEFAULT): number {
    if (!this.inBounds(x, y)) return 0;

    // Get grapheme info
    let grapheme = char;
    let width = 1;

    // If the char is multiple graphemes, take just the first
    for (const g of graphemes(char)) {
      grapheme = g.grapheme;
      width = g.width;
      break;
    }

    // Place the main cell
    this.cells[this.index(x, y)] = new Cell(grapheme, style, width);

    // If wide character, place shadow cell
    if (width === 2 && this.inBounds(x + 1, y)) {
      this.cells[this.index(x + 1, y)] = new Cell('', style, 0);
    }

    return width;
  }

  /**
   * Put a string starting at the given position
   * Returns the number of columns consumed
   */
  putString(x: number, y: number, text: string, style: Style = Style.DEFAULT): number {
    let col = x;

    for (const { grapheme, width } of graphemes(text)) {
      if (col >= this._width) break;

      // Check if wide char would overflow
      if (width === 2 && col + 1 >= this._width) break;

      this.putChar(col, y, grapheme, style);
      col += width;
    }

    return col - x;
  }

  /**
   * Fill a rectangular region with a character and style
   */
  fill(rect: Rect, char: string, style: Style = Style.DEFAULT): void {
    const { x, y, width, height } = rect;

    for (let row = y; row < y + height && row < this._height; row++) {
      for (let col = x; col < x + width && col < this._width; col++) {
        if (this.inBounds(col, row)) {
          this.cells[this.index(col, row)] = new Cell(char, style, 1);
        }
      }
    }
  }

  /**
   * Clear the entire buffer to empty cells
   */
  clear(style: Style = Style.DEFAULT): void {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = new Cell(' ', style, 1);
    }
  }

  /**
   * Clear a rectangular region
   */
  clearRect(rect: Rect, style: Style = Style.DEFAULT): void {
    this.fill(rect, ' ', style);
  }

  /**
   * Resize the buffer, preserving content where possible
   */
  resize(newWidth: number, newHeight: number): void {
    const newCells = new Array<Cell>(newWidth * newHeight);

    // Fill with empty cells
    for (let i = 0; i < newCells.length; i++) {
      newCells[i] = new Cell();
    }

    // Copy over existing content
    const copyWidth = Math.min(this._width, newWidth);
    const copyHeight = Math.min(this._height, newHeight);

    for (let y = 0; y < copyHeight; y++) {
      for (let x = 0; x < copyWidth; x++) {
        const oldIdx = y * this._width + x;
        const newIdx = y * newWidth + x;
        newCells[newIdx] = this.cells[oldIdx];
      }
    }

    this._width = newWidth;
    this._height = newHeight;
    this.cells = newCells;
  }

  /**
   * Copy content from another buffer into this one at the given offset
   */
  blit(source: CellBuffer, destX: number, destY: number): void {
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        const cell = source.get(x, y);
        if (cell && this.inBounds(destX + x, destY + y)) {
          this.set(destX + x, destY + y, cell.clone());
        }
      }
    }
  }

  /**
   * Create a deep clone of this buffer
   */
  clone(): CellBuffer {
    const copy = new CellBuffer(this._width, this._height);
    for (let i = 0; i < this.cells.length; i++) {
      copy.cells[i] = this.cells[i].clone();
    }
    return copy;
  }

  /**
   * Copy content from another buffer (must be same size)
   */
  copyFrom(source: CellBuffer): void {
    if (source.width !== this._width || source.height !== this._height) {
      throw new Error('Buffer size mismatch');
    }
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = source.cells[i].clone();
    }
  }

  /**
   * Iterate over all cells with their coordinates
   */
  *[Symbol.iterator](): Generator<{ x: number; y: number; cell: Cell }> {
    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        yield { x, y, cell: this.cells[this.index(x, y)] };
      }
    }
  }

  /**
   * Get an iterator over a single row
   */
  *row(y: number): Generator<{ x: number; cell: Cell }> {
    if (y < 0 || y >= this._height) return;
    for (let x = 0; x < this._width; x++) {
      yield { x, cell: this.cells[this.index(x, y)] };
    }
  }
}
