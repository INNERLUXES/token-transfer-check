// A CSV reader of the tool's own, for a batch written as a table with a header row. It keeps the line and column where
// each field starts, so a finding can point at the cell to look at. It reads comma-separated fields (RFC 4180): a field
// may be put in double quotes, and then holds commas, line ends and quotes written twice; lines end with CRLF, LF or CR,
// and a line end inside quotes counts as a line. It is strict, because a field read in the wrong place moves an amount
// or an account to another payment: a quote inside a field that does not start with one, text after the closing quote
// of a field, a quoted field that is never closed, a row with more or fewer fields than the header and an empty line
// inside the table are errors with the line and column. Empty lines at the end of the file are allowed. The reader is
// one loop over the characters, with no recursion, and it stops at limits of rows, columns and the length of a field.
//
// The result:
//   { header: [cell], rows: [{ line, cells: [cell] }] }   with a cell { value, line, column }

export const CSV_LIMITS = { maxRows: 100000, maxColumns: 200, maxFieldLength: 100000 };

export class CsvError extends Error {
  constructor(message, line, column) {
    super(message);
    this.name = 'CsvError';
    this.line = line;
    this.column = column;
  }
}

export function readCsv(text, limits = CSV_LIMITS) {
  const n = text.length;
  let i = 0;
  let line = 1;
  let lineStart = 0;
  const fail = (message, l, c) => {
    throw new CsvError(`${message} at line ${l}, column ${c}`, l, c);
  };
  const records = [];
  let record = null;
  let blank = null;

  while (i < n || record !== null) {
    if (record === null) {
      // A line that is empty: allowed only when nothing but empty lines follows it.
      const c = text[i];
      if (c === '\n' || c === '\r') {
        if (blank === null) blank = line;
        i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
        line += 1;
        lineStart = i;
        continue;
      }
      if (blank !== null) fail('an empty line inside the table', blank, 1);
      if (records.length > limits.maxRows) fail(`the file holds more than ${limits.maxRows} rows`, line, 1);
      record = { line, cells: [] };
    }
    const fl = line;
    const fc = i - lineStart + 1;
    let value = '';
    if (text[i] === '"') {
      i += 1;
      let from = i;
      while (true) {
        if (i >= n) fail('a quoted field is not closed', fl, fc);
        const c = text[i];
        if (c === '"') {
          if (text[i + 1] === '"') {
            value += text.slice(from, i + 1);
            i += 2;
            from = i;
            continue;
          }
          value += text.slice(from, i);
          i += 1;
          break;
        }
        if (c === '\n' || c === '\r') {
          i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
          line += 1;
          lineStart = i;
        } else i += 1;
        if (i - from + value.length > limits.maxFieldLength) fail(`a field is longer than ${limits.maxFieldLength} characters`, fl, fc);
      }
      if (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') fail('text after the closing quote of a field', line, i - lineStart + 1);
    } else {
      const from = i;
      while (i < n && text[i] !== ',' && text[i] !== '\n' && text[i] !== '\r') {
        if (text[i] === '"') fail('a quote inside a field that does not start with one; put the field in quotes and write the quote twice', line, i - lineStart + 1);
        i += 1;
        if (i - from > limits.maxFieldLength) fail(`a field is longer than ${limits.maxFieldLength} characters`, fl, fc);
      }
      value = text.slice(from, i);
    }
    record.cells.push({ value, line: fl, column: fc });
    if (record.cells.length > limits.maxColumns) fail(`a row has more than ${limits.maxColumns} fields`, fl, fc);
    if (i < n && text[i] === ',') {
      i += 1;
      continue;
    }
    // The end of a record: a line end or the end of the file.
    records.push(record);
    record = null;
    if (i < n) {
      i += text[i] === '\r' && text[i + 1] === '\n' ? 2 : 1;
      line += 1;
      lineStart = i;
    }
  }
  if (records.length === 0) fail('the file holds no header row', 1, 1);
  const [head, ...rows] = records;
  for (const r of rows) {
    if (r.cells.length !== head.cells.length) fail(`the row has ${r.cells.length} ${r.cells.length === 1 ? 'field' : 'fields'} and the header has ${head.cells.length}`, r.line, 1);
  }
  return { header: head.cells.map((c) => ({ ...c, value: c.value.trim() })), rows };
}

// The table as the nodes of the JSON reader, so that the search for keys and seeds and the batch reader read a CSV file
// the way they read a JSON one.
//   byColumn  one object with an entry for each column of the header, whose value is the list of its cells: a column
//             named for a key or a seed is found once, at the header, and every cell under it is marked
//   rows      one object for each row, with an entry for each column whose cell is not empty
// Both hold the same cell nodes, so a cell marked as a secret is marked in both. Columns are kept as lists of entries,
// never as properties of an object, so a column named __proto__ is only a name.
export function csvNodes(table) {
  const cell = (c) => ({ kind: 'string', value: c.value, raw: c.value, line: c.line, column: c.column });
  const grid = table.rows.map((r) => r.cells.map(cell));
  const byColumn = {
    kind: 'object',
    line: 1,
    column: 1,
    entries: table.header.map((h, j) => ({ key: h.value, line: h.line, column: h.column, value: { kind: 'array', line: h.line, column: h.column, items: grid.map((g) => g[j]) } }))
  };
  const rows = table.rows.map((r, k) => ({
    kind: 'object',
    line: r.line,
    column: 1,
    entries: table.header.map((h, j) => ({ key: h.value, line: grid[k][j].line, column: grid[k][j].column, value: grid[k][j] })).filter((e) => e.value.value.trim() !== '')
  }));
  return { byColumn, rows };
}
