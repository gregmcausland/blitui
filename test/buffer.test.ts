import { describe, it, expect, beforeEach } from 'vitest';
import { CellBuffer } from '../src/buffer.js';
import { Cell, Style, Color, Attr } from '../src/cell.js';

describe('CellBuffer', () => {
  let buffer: CellBuffer;

  beforeEach(() => {
    buffer = new CellBuffer(10, 5);
  });

  describe('constructor', () => {
    it('creates buffer with correct dimensions', () => {
      expect(buffer.width).toBe(10);
      expect(buffer.height).toBe(5);
    });

    it('initializes all cells as empty spaces', () => {
      for (const { cell } of buffer) {
        expect(cell.char).toBe(' ');
        expect(cell.width).toBe(1);
      }
    });
  });

  describe('inBounds', () => {
    it('returns true for valid coordinates', () => {
      expect(buffer.inBounds(0, 0)).toBe(true);
      expect(buffer.inBounds(9, 4)).toBe(true);
      expect(buffer.inBounds(5, 2)).toBe(true);
    });

    it('returns false for out of bounds coordinates', () => {
      expect(buffer.inBounds(-1, 0)).toBe(false);
      expect(buffer.inBounds(0, -1)).toBe(false);
      expect(buffer.inBounds(10, 0)).toBe(false);
      expect(buffer.inBounds(0, 5)).toBe(false);
    });
  });

  describe('get/set', () => {
    it('sets and gets cells correctly', () => {
      const cell = new Cell('X', Style.DEFAULT, 1);
      buffer.set(3, 2, cell);

      const retrieved = buffer.get(3, 2);
      expect(retrieved?.char).toBe('X');
    });

    it('returns undefined for out of bounds', () => {
      expect(buffer.get(-1, 0)).toBeUndefined();
      expect(buffer.get(100, 0)).toBeUndefined();
    });

    it('ignores sets to out of bounds', () => {
      const cell = new Cell('X');
      buffer.set(-1, 0, cell);
      buffer.set(100, 0, cell);
      // Should not throw
    });
  });

  describe('putChar', () => {
    it('puts a single character', () => {
      buffer.putChar(2, 1, 'A');
      expect(buffer.get(2, 1)?.char).toBe('A');
    });

    it('puts a character with style', () => {
      const style = new Style(Color.ansi('red'), Color.DEFAULT, Attr.BOLD);
      buffer.putChar(2, 1, 'B', style);

      const cell = buffer.get(2, 1);
      expect(cell?.char).toBe('B');
      expect(cell?.style.attrs).toBe(Attr.BOLD);
    });

    it('returns the width consumed', () => {
      expect(buffer.putChar(0, 0, 'A')).toBe(1);
    });

    it('handles wide characters', () => {
      const width = buffer.putChar(0, 0, '你');
      expect(width).toBe(2);

      const mainCell = buffer.get(0, 0);
      expect(mainCell?.char).toBe('你');
      expect(mainCell?.width).toBe(2);

      const shadowCell = buffer.get(1, 0);
      expect(shadowCell?.isShadow()).toBe(true);
    });
  });

  describe('putString', () => {
    it('puts a string of characters', () => {
      buffer.putString(1, 0, 'Hello');

      expect(buffer.get(1, 0)?.char).toBe('H');
      expect(buffer.get(2, 0)?.char).toBe('e');
      expect(buffer.get(3, 0)?.char).toBe('l');
      expect(buffer.get(4, 0)?.char).toBe('l');
      expect(buffer.get(5, 0)?.char).toBe('o');
    });

    it('returns total width consumed', () => {
      const width = buffer.putString(0, 0, 'Test');
      expect(width).toBe(4);
    });

    it('truncates at buffer edge', () => {
      const width = buffer.putString(8, 0, 'Hello');
      expect(width).toBe(2); // Only 'He' fits
    });

    it('handles mixed width characters', () => {
      const width = buffer.putString(0, 0, 'A你B');
      expect(width).toBe(4); // A=1, 你=2, B=1

      expect(buffer.get(0, 0)?.char).toBe('A');
      expect(buffer.get(1, 0)?.char).toBe('你');
      expect(buffer.get(2, 0)?.isShadow()).toBe(true);
      expect(buffer.get(3, 0)?.char).toBe('B');
    });
  });

  describe('fill', () => {
    it('fills a rectangular region', () => {
      buffer.fill({ x: 2, y: 1, width: 3, height: 2 }, '#');

      expect(buffer.get(2, 1)?.char).toBe('#');
      expect(buffer.get(3, 1)?.char).toBe('#');
      expect(buffer.get(4, 1)?.char).toBe('#');
      expect(buffer.get(2, 2)?.char).toBe('#');
      expect(buffer.get(1, 1)?.char).toBe(' '); // Outside rect
    });

    it('clips to buffer bounds', () => {
      buffer.fill({ x: 8, y: 3, width: 5, height: 5 }, 'X');
      expect(buffer.get(9, 4)?.char).toBe('X');
      // Should not throw for out of bounds
    });
  });

  describe('clear', () => {
    it('clears entire buffer to spaces', () => {
      buffer.putString(0, 0, 'Test');
      buffer.clear();

      for (const { cell } of buffer) {
        expect(cell.char).toBe(' ');
      }
    });

    it('applies style to cleared cells', () => {
      const style = new Style(Color.ansi('white'), Color.ansi('blue'));
      buffer.clear(style);

      const cell = buffer.get(0, 0);
      expect(cell?.style.bg.equals(Color.ansi('blue'))).toBe(true);
    });
  });

  describe('resize', () => {
    it('preserves content when growing', () => {
      buffer.putString(0, 0, 'Hello');
      buffer.resize(20, 10);

      expect(buffer.width).toBe(20);
      expect(buffer.height).toBe(10);
      expect(buffer.get(0, 0)?.char).toBe('H');
      expect(buffer.get(4, 0)?.char).toBe('o');
    });

    it('truncates content when shrinking', () => {
      buffer.putString(0, 0, 'Hello World');
      buffer.resize(5, 2);

      expect(buffer.width).toBe(5);
      expect(buffer.height).toBe(2);
      expect(buffer.get(0, 0)?.char).toBe('H');
      expect(buffer.get(4, 0)?.char).toBe('o');
    });
  });

  describe('clone', () => {
    it('creates an independent copy', () => {
      buffer.putString(0, 0, 'Original');
      const clone = buffer.clone();

      buffer.putString(0, 0, 'Modified');

      expect(buffer.get(0, 0)?.char).toBe('M');
      expect(clone.get(0, 0)?.char).toBe('O');
    });
  });

  describe('blit', () => {
    it('copies from source buffer', () => {
      const source = new CellBuffer(3, 2);
      source.putString(0, 0, 'AB');
      source.putString(0, 1, 'CD');

      buffer.blit(source, 2, 1);

      expect(buffer.get(2, 1)?.char).toBe('A');
      expect(buffer.get(3, 1)?.char).toBe('B');
      expect(buffer.get(2, 2)?.char).toBe('C');
      expect(buffer.get(3, 2)?.char).toBe('D');
    });
  });

  describe('row iterator', () => {
    it('iterates over a single row', () => {
      buffer.putString(0, 2, 'Test');

      const cells = [...buffer.row(2)];
      expect(cells.length).toBe(10);
      expect(cells[0].cell.char).toBe('T');
      expect(cells[3].cell.char).toBe('t');
    });
  });
});
