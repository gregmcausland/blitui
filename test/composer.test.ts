import { describe, it, expect, beforeEach } from 'vitest';
import { OutputComposer } from '../src/composer.js';
import { Style, Color, Attr } from '../src/cell.js';

describe('OutputComposer', () => {
  let composer: OutputComposer;

  beforeEach(() => {
    composer = new OutputComposer('truecolor');
  });

  describe('cursor control', () => {
    it('hides cursor', () => {
      composer.hideCursor();
      expect(composer.flush()).toBe('\x1b[?25l');
    });

    it('shows cursor', () => {
      composer.showCursor();
      expect(composer.flush()).toBe('\x1b[?25h');
    });

    it('moves to absolute position', () => {
      composer.moveTo(5, 10);
      // ANSI is 1-indexed, so (5,10) becomes (6,11)
      expect(composer.flush()).toBe('\x1b[11;6H');
    });

    it('moves to home position', () => {
      composer.moveHome();
      expect(composer.flush()).toBe('\x1b[H');
    });

    it('moves up', () => {
      composer.moveUp(3);
      expect(composer.flush()).toBe('\x1b[3A');
    });

    it('moves down', () => {
      composer.moveDown(2);
      expect(composer.flush()).toBe('\x1b[2B');
    });

    it('moves right', () => {
      composer.moveRight(4);
      expect(composer.flush()).toBe('\x1b[4C');
    });

    it('moves left', () => {
      composer.moveLeft(5);
      expect(composer.flush()).toBe('\x1b[5D');
    });

    it('ignores zero movement', () => {
      composer.moveUp(0);
      composer.moveDown(0);
      composer.moveLeft(0);
      composer.moveRight(0);
      expect(composer.flush()).toBe('');
    });

    it('moves to column', () => {
      composer.moveToColumn(7);
      expect(composer.flush()).toBe('\x1b[8G');
    });

    it('does relative movement', () => {
      composer.moveRelative(3, -2);
      const output = composer.flush();
      expect(output).toContain('\x1b[2A'); // Up 2
      expect(output).toContain('\x1b[3C'); // Right 3
    });
  });

  describe('cursor save/restore', () => {
    it('saves cursor position', () => {
      composer.saveCursor();
      expect(composer.flush()).toBe('\x1b7');
    });

    it('restores cursor position', () => {
      composer.restoreCursor();
      expect(composer.flush()).toBe('\x1b8');
    });
  });

  describe('screen control', () => {
    it('clears to end of line', () => {
      composer.clearToEndOfLine();
      expect(composer.flush()).toBe('\x1b[K');
    });

    it('clears entire line', () => {
      composer.clearLine();
      expect(composer.flush()).toBe('\x1b[2K');
    });

    it('clears screen', () => {
      composer.clearScreen();
      expect(composer.flush()).toBe('\x1b[2J');
    });

    it('enters alternate screen', () => {
      composer.enterAlternateScreen();
      expect(composer.flush()).toBe('\x1b[?1049h');
    });

    it('leaves alternate screen', () => {
      composer.leaveAlternateScreen();
      expect(composer.flush()).toBe('\x1b[?1049l');
    });
  });

  describe('text output', () => {
    it('writes text', () => {
      composer.write('Hello, World!');
      expect(composer.flush()).toBe('Hello, World!');
    });

    it('writes multiple parts', () => {
      composer.write('Hello');
      composer.write(' ');
      composer.write('World');
      expect(composer.flush()).toBe('Hello World');
    });

    it('handles empty writes', () => {
      composer.write('');
      expect(composer.flush()).toBe('');
    });

    it('adds newlines', () => {
      composer.newlines(3);
      expect(composer.flush()).toBe('\n\n\n');
    });
  });

  describe('style handling', () => {
    it('resets style', () => {
      composer.resetStyle();
      expect(composer.flush()).toBe('\x1b[0m');
    });

    it('sets foreground color (16 color)', () => {
      const style = new Style(Color.ansi('red'));
      composer.setStyle(style);
      const output = composer.flush();
      expect(output).toContain('31'); // Red foreground
    });

    it('sets background color (16 color)', () => {
      const style = new Style(Color.DEFAULT, Color.ansi('blue'));
      composer.setStyle(style);
      const output = composer.flush();
      expect(output).toContain('44'); // Blue background
    });

    it('sets bright foreground color', () => {
      const style = new Style(Color.ansi('brightRed'));
      composer.setStyle(style);
      const output = composer.flush();
      expect(output).toContain('91'); // Bright red
    });

    it('sets 256 color', () => {
      const composer256 = new OutputComposer('256');
      const style = new Style(Color.palette(196));
      composer256.setStyle(style);
      const output = composer256.flush();
      expect(output).toContain('38;5;196');
    });

    it('sets truecolor', () => {
      const style = new Style(Color.rgb(255, 128, 64));
      composer.setStyle(style);
      const output = composer.flush();
      expect(output).toContain('38;2;255;128;64');
    });

    it('sets bold attribute', () => {
      const style = new Style(Color.DEFAULT, Color.DEFAULT, Attr.BOLD);
      composer.setStyle(style);
      const output = composer.flush();
      expect(output).toContain('1'); // Bold
    });

    it('sets multiple attributes', () => {
      const style = new Style(
        Color.DEFAULT,
        Color.DEFAULT,
        Attr.BOLD | Attr.UNDERLINE | Attr.ITALIC
      );
      composer.setStyle(style);
      const output = composer.flush();
      expect(output).toMatch(/1/); // Bold
      expect(output).toMatch(/3/); // Italic
      expect(output).toMatch(/4/); // Underline
    });

    it('skips redundant style changes', () => {
      const style = new Style(Color.ansi('red'));
      composer.setStyle(style);
      composer.write('A');
      composer.setStyle(style); // Same style
      composer.write('B');

      const output = composer.flush();
      // Should only have one SGR sequence for red
      const matches = output.match(/\x1b\[.*?m/g) || [];
      expect(matches.length).toBe(1);
    });

    it('resets when removing attributes', () => {
      const boldStyle = new Style(Color.DEFAULT, Color.DEFAULT, Attr.BOLD);
      const plainStyle = Style.DEFAULT;

      composer.setStyle(boldStyle);
      composer.write('Bold');
      composer.setStyle(plainStyle);
      composer.write('Plain');

      const output = composer.flush();
      expect(output).toContain('\x1b[0'); // Reset
    });
  });

  describe('color depth downgrade', () => {
    it('downgrades truecolor to 256', () => {
      const composer256 = new OutputComposer('256');
      const style = new Style(Color.rgb(255, 0, 0));
      composer256.setStyle(style);
      const output = composer256.flush();
      expect(output).toContain('38;5;'); // 256-color format
    });

    it('downgrades to 16 colors', () => {
      const composer16 = new OutputComposer('16');
      const style = new Style(Color.rgb(255, 0, 0));
      composer16.setStyle(style);
      const output = composer16.flush();
      // Should use basic SGR codes (may include multiple params)
      expect(output).toMatch(/\x1b\[\d+(;\d+)*m/);
      // Should contain red (31 or 91 for bright)
      expect(output).toMatch(/3[19]/);
    });

    it('outputs default color for none depth', () => {
      const composerNone = new OutputComposer('none');
      const style = new Style(Color.rgb(255, 0, 0));
      composerNone.setStyle(style);
      const output = composerNone.flush();
      expect(output).toContain('39'); // Default foreground
    });
  });

  describe('composition', () => {
    it('composes multiple operations', () => {
      composer.hideCursor();
      composer.moveTo(0, 0);
      composer.setStyle(new Style(Color.ansi('green')));
      composer.write('Status: OK');
      composer.resetStyle();
      composer.showCursor();

      const output = composer.flush();

      expect(output).toContain('\x1b[?25l'); // Hide cursor
      expect(output).toContain('\x1b[1;1H'); // Move to 0,0
      expect(output).toContain('Status: OK');
      expect(output).toContain('\x1b[0m'); // Reset
      expect(output).toContain('\x1b[?25h'); // Show cursor
    });

    it('tracks byte length', () => {
      composer.write('Hello');
      composer.moveTo(0, 0);
      expect(composer.byteLength).toBeGreaterThan(5);
    });

    it('peeks without clearing', () => {
      composer.write('Test');
      const peeked = composer.peek();
      const flushed = composer.flush();

      expect(peeked).toBe('Test');
      expect(flushed).toBe('Test');
    });

    it('resets state after flush', () => {
      composer.write('First');
      composer.flush();
      composer.write('Second');
      expect(composer.flush()).toBe('Second');
    });
  });

  describe('mouse and paste modes', () => {
    it('enables mouse tracking', () => {
      composer.enableMouse();
      expect(composer.flush()).toBe('\x1b[?1000h');
    });

    it('disables mouse tracking', () => {
      composer.disableMouse();
      expect(composer.flush()).toBe('\x1b[?1000l');
    });

    it('enables bracketed paste', () => {
      composer.enableBracketedPaste();
      expect(composer.flush()).toBe('\x1b[?2004h');
    });

    it('disables bracketed paste', () => {
      composer.disableBracketedPaste();
      expect(composer.flush()).toBe('\x1b[?2004l');
    });
  });

  describe('cursor position tracking', () => {
    it('tracks position after moveTo', () => {
      composer.moveTo(5, 10);
      expect(composer.getCursorPosition()).toEqual({ x: 5, y: 10 });
    });

    it('tracks position after relative moves', () => {
      composer.moveTo(5, 5);
      composer.moveRight(3);
      composer.moveDown(2);
      expect(composer.getCursorPosition()).toEqual({ x: 8, y: 7 });
    });

    it('allows manual position tracking', () => {
      composer.setCursorTracking(10, 20);
      expect(composer.getCursorPosition()).toEqual({ x: 10, y: 20 });
    });
  });
});
