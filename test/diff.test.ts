import { describe, it, expect, beforeEach } from 'vitest';
import { CellBuffer } from '../src/buffer.js';
import { Style, Color, Attr } from '../src/cell.js';
import { OutputComposer } from '../src/composer.js';
import {
  findDirtySpansInRow,
  findAllDirtySpans,
  isRowClean,
  countDirtyCells,
  emitOptimizedDiff,
  forceFullDiff,
} from '../src/diff.js';

describe('Diff Engine', () => {
  let backBuffer: CellBuffer;
  let frontBuffer: CellBuffer;
  let composer: OutputComposer;

  beforeEach(() => {
    backBuffer = new CellBuffer(10, 5);
    frontBuffer = new CellBuffer(10, 5);
    composer = new OutputComposer('truecolor');
  });

  describe('findDirtySpansInRow', () => {
    it('returns empty array when row is clean', () => {
      backBuffer.putString(0, 0, 'Hello');
      frontBuffer.putString(0, 0, 'Hello');

      const spans = findDirtySpansInRow(backBuffer, frontBuffer, 0);
      expect(spans).toHaveLength(0);
    });

    it('finds a single dirty span', () => {
      backBuffer.putString(0, 0, 'Hello');
      frontBuffer.putString(0, 0, 'Hallo');

      const spans = findDirtySpansInRow(backBuffer, frontBuffer, 0);
      expect(spans).toHaveLength(1);
      expect(spans[0].startCol).toBe(1);
      expect(spans[0].endCol).toBe(2);
    });

    it('finds multiple dirty spans', () => {
      backBuffer.putString(0, 0, 'ABCDEFGHIJ');
      frontBuffer.putString(0, 0, 'XBCDYFGHZJ');

      const spans = findDirtySpansInRow(backBuffer, frontBuffer, 0);
      expect(spans).toHaveLength(3);
      expect(spans[0].startCol).toBe(0); // A vs X
      expect(spans[1].startCol).toBe(4); // E vs Y
      expect(spans[2].startCol).toBe(8); // I vs Z
    });

    it('coalesces adjacent dirty cells', () => {
      backBuffer.putString(0, 0, 'ABCDE');
      frontBuffer.putString(0, 0, 'XXXXX');

      const spans = findDirtySpansInRow(backBuffer, frontBuffer, 0);
      expect(spans).toHaveLength(1);
      expect(spans[0].startCol).toBe(0);
      expect(spans[0].endCol).toBe(5);
      expect(spans[0].cells).toHaveLength(5);
    });

    it('handles dirty span at end of row', () => {
      backBuffer.putString(7, 0, 'ABC');
      frontBuffer.clear();

      const spans = findDirtySpansInRow(backBuffer, frontBuffer, 0);
      expect(spans).toHaveLength(1);
      expect(spans[0].startCol).toBe(7);
      expect(spans[0].endCol).toBe(10);
    });
  });

  describe('findAllDirtySpans', () => {
    it('finds spans across multiple rows', () => {
      backBuffer.putString(0, 0, 'Row 0');
      backBuffer.putString(0, 2, 'Row 2');
      frontBuffer.clear();

      const spans = findAllDirtySpans(backBuffer, frontBuffer);

      // Should have spans for rows 0 and 2
      const rows = new Set(spans.map(s => s.row));
      expect(rows.has(0)).toBe(true);
      expect(rows.has(2)).toBe(true);
    });
  });

  describe('isRowClean', () => {
    it('returns true for identical rows', () => {
      backBuffer.putString(0, 1, 'Same');
      frontBuffer.putString(0, 1, 'Same');

      expect(isRowClean(backBuffer, frontBuffer, 1)).toBe(true);
    });

    it('returns false for different rows', () => {
      backBuffer.putString(0, 1, 'Different');
      frontBuffer.putString(0, 1, 'Changed');

      expect(isRowClean(backBuffer, frontBuffer, 1)).toBe(false);
    });

    it('detects style differences', () => {
      const style1 = new Style(Color.ansi('red'));
      const style2 = new Style(Color.ansi('blue'));

      backBuffer.putString(0, 1, 'Test', style1);
      frontBuffer.putString(0, 1, 'Test', style2);

      expect(isRowClean(backBuffer, frontBuffer, 1)).toBe(false);
    });
  });

  describe('countDirtyCells', () => {
    it('counts total dirty cells across spans', () => {
      backBuffer.putString(0, 0, 'AB');
      backBuffer.putString(5, 0, 'CD');
      frontBuffer.clear();

      const spans = findDirtySpansInRow(backBuffer, frontBuffer, 0);
      expect(countDirtyCells(spans)).toBe(4);
    });
  });

  describe('emitOptimizedDiff', () => {
    it('emits nothing when buffers are identical', () => {
      backBuffer.putString(0, 0, 'Hello');
      frontBuffer.putString(0, 0, 'Hello');

      const stats = emitOptimizedDiff(backBuffer, frontBuffer, composer);
      const output = composer.flush();

      expect(stats.dirtyCells).toBe(0);
      expect(stats.skippedRows).toBe(5);
      expect(output).toBe('');
    });

    it('emits only changed content', () => {
      backBuffer.putString(0, 0, 'Hello');
      backBuffer.putString(0, 1, 'World');
      frontBuffer.putString(0, 0, 'Hallo');
      frontBuffer.putString(0, 1, 'World');

      const stats = emitOptimizedDiff(backBuffer, frontBuffer, composer);

      expect(stats.dirtyCells).toBe(1); // Only the 'e' changed
      expect(stats.skippedRows).toBe(4); // Rows 1-4 unchanged
    });

    it('handles full row changes', () => {
      // Use text without spaces so it forms a single span
      backBuffer.putString(0, 2, 'NewLine!!');
      frontBuffer.clear();

      const stats = emitOptimizedDiff(backBuffer, frontBuffer, composer);
      const output = composer.flush();

      // Should have at least one span for the changed text
      expect(stats.spans).toBeGreaterThanOrEqual(1);
      expect(output).toContain('NewLine!!');
    });

    it('uses optimal cursor movement', () => {
      // Create two separated changes on same row
      backBuffer.putString(0, 0, 'A');
      backBuffer.putString(9, 0, 'B');
      frontBuffer.putString(0, 0, 'X');
      frontBuffer.putString(9, 0, 'X');

      const stats = emitOptimizedDiff(backBuffer, frontBuffer, composer);

      expect(stats.cursorMoves).toBe(2);
    });

    it('tracks style changes', () => {
      const redStyle = new Style(Color.ansi('red'));
      const blueStyle = new Style(Color.ansi('blue'));

      backBuffer.putString(0, 0, 'Red', redStyle);
      backBuffer.putString(3, 0, 'Blue', blueStyle);
      frontBuffer.clear();

      const stats = emitOptimizedDiff(backBuffer, frontBuffer, composer);

      expect(stats.styleChanges).toBeGreaterThanOrEqual(2);
    });
  });

  describe('forceFullDiff', () => {
    it('renders entire buffer', () => {
      backBuffer.putString(0, 0, 'Line 1');
      backBuffer.putString(0, 1, 'Line 2');

      const stats = forceFullDiff(backBuffer, composer);

      expect(stats.dirtyCells).toBe(backBuffer.width * backBuffer.height);
      expect(stats.skippedRows).toBe(0);

      const output = composer.flush();
      expect(output).toContain('Line 1');
      expect(output).toContain('Line 2');
    });

    it('handles wide characters', () => {
      backBuffer.putString(0, 0, '你好世界');

      const stats = forceFullDiff(backBuffer, composer);
      const output = composer.flush();

      expect(output).toContain('你好世界');
    });
  });

  describe('style handling in diff', () => {
    it('maintains style across span boundaries', () => {
      const style = new Style(Color.ansi('green'), Color.DEFAULT, Attr.BOLD);

      backBuffer.putString(0, 0, 'Styled', style);
      frontBuffer.clear();

      emitOptimizedDiff(backBuffer, frontBuffer, composer);
      const output = composer.flush();

      // Should contain SGR codes for green and bold
      expect(output).toMatch(/\x1b\[\d+(;\d+)*m/);
    });

    it('optimizes repeated styles', () => {
      const style = new Style(Color.ansi('red'));

      // Fill entire row with same style
      for (let i = 0; i < 10; i++) {
        backBuffer.putChar(i, 0, 'X', style);
      }
      frontBuffer.clear();

      const stats = emitOptimizedDiff(backBuffer, frontBuffer, composer);

      // Should only need one style change
      expect(stats.styleChanges).toBe(1);
    });
  });
});
