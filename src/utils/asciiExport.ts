/**
 * HÕIMU Terminal & Hardware Output Export Utilities
 * Supports plain text (.txt), ANSI escape sequences for Linux terminal (`cat`),
 * and 7-bit clean ASCII for Pi / MicroPython serial output.
 */

export interface AsciiGridCell {
  char: string;
  type?: 'user' | 'peer' | 'resource' | 'sos' | 'terrain' | 'fog' | 'empty';
  title?: string;
  styleClass?: string;
}

// Convert unicode glyphs to strictly 7-bit ASCII characters (+#^) for serial terminals
export function unicodeToAscii(char: string): string {
  switch (char) {
    case '♣':
      return '+'; // Forest -> '+'
    case '□':
      return '#'; // Building -> '#'
    case '▲':
      return '^'; // Hill -> '^'
    case '≈':
    case '~':
      return '~'; // Water -> '~'
    case '·':
      return '.'; // Explored dot -> '.'
    case '☉':
      return 'O'; // Peer -> 'O'
    case '⚡':
      return 'E'; // Energy -> 'E'
    case '↑':
      return '^';
    case '↓':
      return 'v';
    case '←':
      return '<';
    case '→':
      return '>';
    case '↖':
      return '^';
    case '↗':
      return '^';
    case '↘':
      return 'v';
    case '↙':
      return 'v';
    case '!':
      return '!';
    case '@':
      return '@';
    case '?':
      return '?';
    default:
      return char;
  }
}

function getCellCharAndType(cell: string | AsciiGridCell): { char: string; type: string } {
  if (typeof cell === 'string') {
    return { char: cell, type: 'terrain' };
  }
  return { char: cell.char || ' ', type: cell.type || 'terrain' };
}

/**
 * Returns plain text string representation of the grid
 */
export function exportAsciiToTxt(
  grid: (string | AsciiGridCell)[][],
  asciiOnly = false
): string {
  const lines = grid.map((row) =>
    row
      .map((c) => {
        const { char } = getCellCharAndType(c);
        return asciiOnly ? unicodeToAscii(char) : char;
      })
      .join('')
  );
  return lines.join('\n');
}

/**
 * Export grid as ANSI escape string for native terminal color rendering (`cat map.ansi`)
 */
export function exportAsciiToAnsi(
  grid: (string | AsciiGridCell)[][],
  theme: 'phosphor' | 'amber' | 'paper' | 'night' | string = 'phosphor',
  asciiOnly = false
): string {
  // ANSI Color codes
  const RESET = '\x1b[0m';

  let fgDefault = '\x1b[32m'; // Green
  let bgDefault = '\x1b[40m'; // Black BG
  let fgDim = '\x1b[2;32m';
  let fgUser = '\x1b[1;37;42m'; // Bold White on Green BG
  let fgPeer = '\x1b[1;36m'; // Cyan
  let fgResource = '\x1b[1;33m'; // Yellow
  let fgSos = '\x1b[1;31m'; // Red

  if (theme === 'amber') {
    fgDefault = '\x1b[33m'; // Amber
    bgDefault = '\x1b[40m';
    fgDim = '\x1b[2;33m';
    fgUser = '\x1b[1;37;43m'; // White on Amber BG
    fgPeer = '\x1b[1;33m';
    fgResource = '\x1b[33m';
    fgSos = '\x1b[1;31m';
  } else if (theme === 'paper') {
    bgDefault = '\x1b[47m'; // White BG
    fgDefault = '\x1b[30m'; // Black Text
    fgDim = '\x1b[2;30m';
    fgUser = '\x1b[1;37;40m'; // White on Black BG
    fgPeer = '\x1b[1;30m';
    fgResource = '\x1b[1;34m';
    fgSos = '\x1b[1;31m';
  } else if (theme === 'night') {
    fgDefault = '\x1b[31m'; // Red Text
    bgDefault = '\x1b[40m';
    fgDim = '\x1b[2;31m';
    fgUser = '\x1b[1;37;41m'; // White on Red BG
    fgPeer = '\x1b[1;35m';
    fgResource = '\x1b[1;33m';
    fgSos = '\x1b[1;37;41m';
  }

  const lines = grid.map((row) => {
    let rowAnsi = bgDefault;
    row.forEach((cell) => {
      const { char, type } = getCellCharAndType(cell);
      const renderedChar = asciiOnly ? unicodeToAscii(char) : char;

      if (renderedChar === '@' || type === 'user') {
        rowAnsi += `${fgUser}${renderedChar}${RESET}${bgDefault}`;
      } else if (renderedChar === '☉' || renderedChar === 'O' || type === 'peer') {
        rowAnsi += `${fgPeer}${renderedChar}${RESET}${bgDefault}`;
      } else if (type === 'resource' || ['F', '⚡', 'E', 'T', 'S', 'C', 'B'].includes(renderedChar)) {
        rowAnsi += `${fgResource}${renderedChar}${RESET}${bgDefault}`;
      } else if (renderedChar === '!' || type === 'sos') {
        rowAnsi += `${fgSos}${renderedChar}${RESET}${bgDefault}`;
      } else if (renderedChar === '·' || renderedChar === '.' || type === 'fog' || type === 'empty') {
        rowAnsi += `${fgDim}${renderedChar}${RESET}${bgDefault}`;
      } else {
        rowAnsi += `${fgDefault}${renderedChar}${RESET}${bgDefault}`;
      }
    });
    return rowAnsi + RESET;
  });

  return lines.join('\n') + '\n';
}

/**
 * Returns clean 7-bit ASCII-only string with max width 80 chars for serial terminal output
 */
export function renderForSerial(
  grid: (string | AsciiGridCell)[][],
  maxWidth = 80
): string {
  const lines = grid.map((row) => {
    const rawRow = row
      .map((c) => {
        const { char } = getCellCharAndType(c);
        return unicodeToAscii(char);
      })
      .join('');
    return rawRow.slice(0, maxWidth);
  });
  return lines.join('\r\n');
}

/**
 * Download string content as file helper
 */
export function downloadString(content: string, filename: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Backward compatibility exports
export function exportToTxt(
  grid: (string | AsciiGridCell)[][],
  filename = 'hoimu_map_viewport.txt',
  asciiOnly = false
): void {
  const content = exportAsciiToTxt(grid, asciiOnly);
  downloadString(content, filename);
}

export function exportToAnsi(
  grid: (string | AsciiGridCell)[][],
  theme: string = 'phosphor',
  filename = 'hoimu_map.ansi',
  asciiOnly = false
): void {
  const content = exportAsciiToAnsi(grid, theme, asciiOnly);
  downloadString(content, filename);
}

