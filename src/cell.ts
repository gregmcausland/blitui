/**
 * Cell, Style, and Color types for terminal rendering
 */

// Color depth support levels
export type ColorDepth = 'none' | '16' | '256' | 'truecolor';

// Standard 16 ANSI colors
export type AnsiColor =
  | 'black' | 'red' | 'green' | 'yellow'
  | 'blue' | 'magenta' | 'cyan' | 'white'
  | 'brightBlack' | 'brightRed' | 'brightGreen' | 'brightYellow'
  | 'brightBlue' | 'brightMagenta' | 'brightCyan' | 'brightWhite';

const ANSI_COLOR_CODES: Record<AnsiColor, number> = {
  black: 0, red: 1, green: 2, yellow: 3,
  blue: 4, magenta: 5, cyan: 6, white: 7,
  brightBlack: 8, brightRed: 9, brightGreen: 10, brightYellow: 11,
  brightBlue: 12, brightMagenta: 13, brightCyan: 14, brightWhite: 15,
};

// RGB color values (0-255 for each channel)
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Color representation that can be 16-color ANSI, 256-color, or truecolor RGB
 */
export class Color {
  private constructor(
    private readonly type: 'default' | 'ansi' | '256' | 'rgb',
    private readonly value: number | RGB,
  ) {}

  static readonly DEFAULT = new Color('default', 0);

  static ansi(name: AnsiColor): Color {
    return new Color('ansi', ANSI_COLOR_CODES[name]);
  }

  static ansiCode(code: number): Color {
    if (code < 0 || code > 15) {
      throw new RangeError('ANSI color code must be 0-15');
    }
    return new Color('ansi', code);
  }

  static palette(code: number): Color {
    if (code < 0 || code > 255) {
      throw new RangeError('256-color palette code must be 0-255');
    }
    return new Color('256', code);
  }

  static rgb(r: number, g: number, b: number): Color {
    return new Color('rgb', { r, g, b });
  }

  static hex(hex: string): Color {
    const match = hex.match(/^#?([0-9a-fA-F]{6})$/);
    if (!match) {
      throw new Error(`Invalid hex color: ${hex}`);
    }
    const val = parseInt(match[1], 16);
    return Color.rgb((val >> 16) & 0xff, (val >> 8) & 0xff, val & 0xff);
  }

  isDefault(): boolean {
    return this.type === 'default';
  }

  equals(other: Color): boolean {
    if (this.type !== other.type) return false;
    if (this.type === 'rgb' && other.type === 'rgb') {
      const a = this.value as RGB;
      const b = other.value as RGB;
      return a.r === b.r && a.g === b.g && a.b === b.b;
    }
    return this.value === other.value;
  }

  /**
   * Convert color to ANSI escape sequence parameters for foreground
   */
  toAnsiFg(depth: ColorDepth): string {
    return this.toAnsi(depth, true);
  }

  /**
   * Convert color to ANSI escape sequence parameters for background
   */
  toAnsiBg(depth: ColorDepth): string {
    return this.toAnsi(depth, false);
  }

  private toAnsi(depth: ColorDepth, isFg: boolean): string {
    if (this.type === 'default' || depth === 'none') {
      return isFg ? '39' : '49';
    }

    const baseOffset = isFg ? 0 : 10;

    if (this.type === 'ansi') {
      const code = this.value as number;
      if (code < 8) {
        return String(30 + baseOffset + code);
      }
      return String(90 + baseOffset + (code - 8));
    }

    if (this.type === '256') {
      if (depth === '16') {
        return this.downgrade256To16(this.value as number, isFg);
      }
      const code = this.value as number;
      return isFg ? `38;5;${code}` : `48;5;${code}`;
    }

    // RGB
    const { r, g, b } = this.value as RGB;
    if (depth === 'truecolor') {
      return isFg ? `38;2;${r};${g};${b}` : `48;2;${r};${g};${b}`;
    }
    if (depth === '256') {
      const code = this.rgbTo256(r, g, b);
      return isFg ? `38;5;${code}` : `48;5;${code}`;
    }
    // Downgrade to 16
    const ansi = this.rgbTo16(r, g, b);
    if (ansi < 8) {
      return String(30 + baseOffset + ansi);
    }
    return String(90 + baseOffset + (ansi - 8));
  }

  private downgrade256To16(code: number, isFg: boolean): string {
    const baseOffset = isFg ? 0 : 10;
    let ansi: number;

    if (code < 16) {
      ansi = code;
    } else if (code >= 232) {
      // Grayscale ramp
      const gray = code - 232;
      ansi = gray < 12 ? 0 : 7;
    } else {
      // 6x6x6 color cube
      const idx = code - 16;
      const r = Math.floor(idx / 36);
      const g = Math.floor((idx % 36) / 6);
      const b = idx % 6;
      ansi = this.rgbTo16(r * 51, g * 51, b * 51);
    }

    if (ansi < 8) {
      return String(30 + baseOffset + ansi);
    }
    return String(90 + baseOffset + (ansi - 8));
  }

  private rgbTo256(r: number, g: number, b: number): number {
    // Check if close to grayscale
    if (r === g && g === b) {
      if (r < 8) return 16;
      if (r > 248) return 231;
      return Math.round((r - 8) / 10) + 232;
    }
    // Map to 6x6x6 cube
    const ri = Math.round(r / 51);
    const gi = Math.round(g / 51);
    const bi = Math.round(b / 51);
    return 16 + 36 * ri + 6 * gi + bi;
  }

  private rgbTo16(r: number, g: number, b: number): number {
    const brightness = (r + g + b) / 3;
    const isBright = brightness > 127;

    const rBit = r > 127 ? 1 : 0;
    const gBit = g > 127 ? 1 : 0;
    const bBit = b > 127 ? 1 : 0;

    const base = rBit | (gBit << 1) | (bBit << 2);
    return isBright ? base + 8 : base;
  }
}

// Text attributes as a bitmask for efficient comparison
export const Attr = {
  NONE: 0,
  BOLD: 1 << 0,
  DIM: 1 << 1,
  ITALIC: 1 << 2,
  UNDERLINE: 1 << 3,
  BLINK: 1 << 4,
  REVERSE: 1 << 5,
  HIDDEN: 1 << 6,
  STRIKETHROUGH: 1 << 7,
} as const;

export type Attrs = number;

/**
 * Complete style for a cell: colors and attributes
 */
export class Style {
  constructor(
    public readonly fg: Color = Color.DEFAULT,
    public readonly bg: Color = Color.DEFAULT,
    public readonly attrs: Attrs = Attr.NONE,
  ) {}

  static readonly DEFAULT = new Style();

  withFg(fg: Color): Style {
    return new Style(fg, this.bg, this.attrs);
  }

  withBg(bg: Color): Style {
    return new Style(this.fg, bg, this.attrs);
  }

  withAttrs(attrs: Attrs): Style {
    return new Style(this.fg, this.bg, attrs);
  }

  addAttr(attr: Attrs): Style {
    return new Style(this.fg, this.bg, this.attrs | attr);
  }

  equals(other: Style): boolean {
    return (
      this.fg.equals(other.fg) &&
      this.bg.equals(other.bg) &&
      this.attrs === other.attrs
    );
  }
}

/**
 * A single cell in the terminal grid
 */
export class Cell {
  constructor(
    public char: string = ' ',
    public style: Style = Style.DEFAULT,
    public width: number = 1, // Display width (1 for normal, 2 for wide chars)
  ) {}

  static readonly EMPTY = new Cell();

  /**
   * Check if this cell is a "shadow" cell (second cell of a wide character)
   */
  isShadow(): boolean {
    return this.width === 0;
  }

  equals(other: Cell): boolean {
    return (
      this.char === other.char &&
      this.style.equals(other.style) &&
      this.width === other.width
    );
  }

  clone(): Cell {
    return new Cell(this.char, this.style, this.width);
  }
}

/**
 * Get the display width of a string using Unicode properties
 * Handles wide characters (CJK, emoji) correctly
 */
export function getDisplayWidth(str: string): number {
  let width = 0;
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

  for (const { segment } of segmenter.segment(str)) {
    width += getGraphemeWidth(segment);
  }

  return width;
}

/**
 * Get the display width of a single grapheme cluster
 */
export function getGraphemeWidth(grapheme: string): number {
  if (grapheme.length === 0) return 0;

  const codePoint = grapheme.codePointAt(0)!;

  // Common ASCII fast path
  if (codePoint < 0x80) {
    // Control characters have 0 width
    if (codePoint < 0x20 || codePoint === 0x7f) return 0;
    return 1;
  }

  // Check for wide characters using Unicode East Asian Width property
  // This is a simplified check - covers most common cases
  if (isWideCharacter(codePoint)) {
    return 2;
  }

  // Emoji with modifiers/ZWJ sequences are typically 2 cells wide
  if (grapheme.length > 2 || hasEmojiPresentation(codePoint)) {
    return 2;
  }

  return 1;
}

function isWideCharacter(cp: number): boolean {
  // CJK Unified Ideographs and related blocks
  if (cp >= 0x4e00 && cp <= 0x9fff) return true;
  if (cp >= 0x3400 && cp <= 0x4dbf) return true;
  if (cp >= 0x20000 && cp <= 0x2a6df) return true;
  if (cp >= 0x2a700 && cp <= 0x2b73f) return true;
  if (cp >= 0x2b740 && cp <= 0x2b81f) return true;
  if (cp >= 0x2b820 && cp <= 0x2ceaf) return true;
  if (cp >= 0xf900 && cp <= 0xfaff) return true;
  if (cp >= 0x2f800 && cp <= 0x2fa1f) return true;

  // CJK Symbols and Punctuation
  if (cp >= 0x3000 && cp <= 0x303f) return true;

  // Hiragana and Katakana
  if (cp >= 0x3040 && cp <= 0x30ff) return true;
  if (cp >= 0x31f0 && cp <= 0x31ff) return true;

  // Hangul
  if (cp >= 0xac00 && cp <= 0xd7a3) return true;
  if (cp >= 0x1100 && cp <= 0x11ff) return true;
  if (cp >= 0x3130 && cp <= 0x318f) return true;

  // Fullwidth forms
  if (cp >= 0xff00 && cp <= 0xff60) return true;
  if (cp >= 0xffe0 && cp <= 0xffe6) return true;

  return false;
}

function hasEmojiPresentation(cp: number): boolean {
  // Common emoji ranges
  if (cp >= 0x1f300 && cp <= 0x1f9ff) return true;
  if (cp >= 0x1fa00 && cp <= 0x1faff) return true;
  if (cp >= 0x2600 && cp <= 0x26ff) return true;
  if (cp >= 0x2700 && cp <= 0x27bf) return true;
  return false;
}

/**
 * Segment a string into grapheme clusters with their display widths
 */
export function* graphemes(str: string): Generator<{ grapheme: string; width: number }> {
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

  for (const { segment } of segmenter.segment(str)) {
    yield { grapheme: segment, width: getGraphemeWidth(segment) };
  }
}
