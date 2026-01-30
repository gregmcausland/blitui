/**
 * Diff engine - Compare buffers and emit minimal updates
 */

import { Cell, Style } from './cell.js';
import { CellBuffer } from './buffer.js';
import { OutputComposer } from './composer.js';

/**
 * A span of dirty (changed) cells within a row
 */
export interface DirtySpan {
  row: number;
  startCol: number;
  endCol: number; // exclusive
  cells: Cell[];
}

/**
 * Find all dirty spans in a row by comparing back and front buffers
 */
export function findDirtySpansInRow(
  backBuffer: CellBuffer,
  frontBuffer: CellBuffer,
  row: number
): DirtySpan[] {
  const spans: DirtySpan[] = [];
  const width = backBuffer.width;

  let spanStart = -1;
  let spanCells: Cell[] = [];

  for (let col = 0; col < width; col++) {
    const backCell = backBuffer.get(col, row);
    const frontCell = frontBuffer.get(col, row);

    const isDirty = !backCell || !frontCell || !backCell.equals(frontCell);

    if (isDirty) {
      if (spanStart === -1) {
        // Start new span
        spanStart = col;
        spanCells = [];
      }
      spanCells.push(backCell || new Cell());
    } else {
      if (spanStart !== -1) {
        // End current span
        spans.push({
          row,
          startCol: spanStart,
          endCol: col,
          cells: spanCells,
        });
        spanStart = -1;
        spanCells = [];
      }
    }
  }

  // Handle span that extends to end of row
  if (spanStart !== -1) {
    spans.push({
      row,
      startCol: spanStart,
      endCol: width,
      cells: spanCells,
    });
  }

  return spans;
}

/**
 * Find all dirty spans across the entire buffer
 */
export function findAllDirtySpans(
  backBuffer: CellBuffer,
  frontBuffer: CellBuffer
): DirtySpan[] {
  const allSpans: DirtySpan[] = [];

  for (let row = 0; row < backBuffer.height; row++) {
    const rowSpans = findDirtySpansInRow(backBuffer, frontBuffer, row);
    allSpans.push(...rowSpans);
  }

  return allSpans;
}

/**
 * Check if an entire row is unchanged
 */
export function isRowClean(
  backBuffer: CellBuffer,
  frontBuffer: CellBuffer,
  row: number
): boolean {
  const width = backBuffer.width;

  for (let col = 0; col < width; col++) {
    const backCell = backBuffer.get(col, row);
    const frontCell = frontBuffer.get(col, row);

    if (!backCell || !frontCell || !backCell.equals(frontCell)) {
      return false;
    }
  }

  return true;
}

/**
 * Count total dirty cells across all spans
 */
export function countDirtyCells(spans: DirtySpan[]): number {
  return spans.reduce((sum, span) => sum + span.cells.length, 0);
}

/**
 * Emit the escape sequences needed to render dirty spans
 */
export function emitDirtySpans(
  spans: DirtySpan[],
  composer: OutputComposer,
  cursorStartRow: number = 0
): void {
  let currentStyle: Style | null = null;

  for (const span of spans) {
    // Move cursor to span start
    composer.moveTo(span.startCol, cursorStartRow + span.row);

    // Write each cell in the span
    for (let i = 0; i < span.cells.length; i++) {
      const cell = span.cells[i];

      // Skip shadow cells (they're part of a wide character)
      if (cell.isShadow()) {
        continue;
      }

      // Update style if needed
      if (!currentStyle || !currentStyle.equals(cell.style)) {
        composer.setStyle(cell.style);
        currentStyle = cell.style;
      }

      // Write the character
      if (cell.width === 2) {
        composer.writeWithWidth(cell.char, 2);
        // Skip the shadow cell that follows
        i++;
      } else {
        composer.writeWithWidth(cell.char, 1);
      }
    }
  }
}

/**
 * Optimized diff that coalesces adjacent spans on the same row
 * and uses relative cursor movement when beneficial
 */
export function emitOptimizedDiff(
  backBuffer: CellBuffer,
  frontBuffer: CellBuffer,
  composer: OutputComposer,
  cursorStartRow: number = 0
): DiffStats {
  const stats: DiffStats = {
    totalCells: backBuffer.width * backBuffer.height,
    dirtyCells: 0,
    skippedRows: 0,
    spans: 0,
    cursorMoves: 0,
    styleChanges: 0,
  };

  let currentStyle: Style | null = null;
  let cursorX = -1;
  let cursorY = -1;

  for (let row = 0; row < backBuffer.height; row++) {
    // Quick check if entire row is clean
    if (isRowClean(backBuffer, frontBuffer, row)) {
      stats.skippedRows++;
      continue;
    }

    const spans = findDirtySpansInRow(backBuffer, frontBuffer, row);
    stats.spans += spans.length;

    for (const span of spans) {
      stats.dirtyCells += span.cells.length;

      // Determine if we need to move the cursor
      const targetX = span.startCol;
      const targetY = cursorStartRow + span.row;

      if (cursorX !== targetX || cursorY !== targetY) {
        // Choose most efficient cursor movement
        if (cursorY === targetY && cursorX >= 0) {
          // Same row, use relative movement if close
          const dx = targetX - cursorX;
          if (Math.abs(dx) <= 4) {
            composer.moveRelative(dx, 0);
          } else {
            composer.moveToColumn(targetX);
          }
        } else {
          // Different row or unknown position
          composer.moveTo(targetX, targetY);
        }
        stats.cursorMoves++;
        cursorX = targetX;
        cursorY = targetY;
      }

      // Write cells
      for (let i = 0; i < span.cells.length; i++) {
        const cell = span.cells[i];

        if (cell.isShadow()) {
          cursorX++;
          continue;
        }

        // Update style if needed
        if (!currentStyle || !currentStyle.equals(cell.style)) {
          composer.setStyle(cell.style);
          currentStyle = cell.style;
          stats.styleChanges++;
        }

        // Write character
        if (cell.width === 2) {
          composer.writeWithWidth(cell.char, 2);
          cursorX += 2;
          i++; // Skip shadow
        } else {
          composer.writeWithWidth(cell.char, 1);
          cursorX++;
        }
      }
    }
  }

  return stats;
}

/**
 * Statistics from a diff operation
 */
export interface DiffStats {
  totalCells: number;
  dirtyCells: number;
  skippedRows: number;
  spans: number;
  cursorMoves: number;
  styleChanges: number;
}

/**
 * Force a full redraw by marking all cells as dirty
 * Useful after resize or when front buffer state is unknown
 */
export function forceFullDiff(
  backBuffer: CellBuffer,
  composer: OutputComposer,
  cursorStartRow: number = 0
): DiffStats {
  const stats: DiffStats = {
    totalCells: backBuffer.width * backBuffer.height,
    dirtyCells: backBuffer.width * backBuffer.height,
    skippedRows: 0,
    spans: backBuffer.height,
    cursorMoves: backBuffer.height,
    styleChanges: 0,
  };

  let currentStyle: Style | null = null;

  for (let row = 0; row < backBuffer.height; row++) {
    composer.moveTo(0, cursorStartRow + row);

    for (let col = 0; col < backBuffer.width; col++) {
      const cell = backBuffer.get(col, row);
      if (!cell) continue;

      if (cell.isShadow()) continue;

      if (!currentStyle || !currentStyle.equals(cell.style)) {
        composer.setStyle(cell.style);
        currentStyle = cell.style;
        stats.styleChanges++;
      }

      if (cell.width === 2) {
        composer.writeWithWidth(cell.char, 2);
        col++; // Skip shadow cell
      } else {
        composer.writeWithWidth(cell.char, 1);
      }
    }
  }

  return stats;
}
