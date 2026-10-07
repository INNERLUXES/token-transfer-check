import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSV_LIMITS, CsvError, checkTexts, csvNodes, formatOf, readCsv } from '../src/index.js';
import { HOLDERS, csvText, texts, transfer } from './helpers.js';

const fails = (text, pattern, line, column) => assert.throws(() => readCsv(text), (e) => e instanceof CsvError && pattern.test(e.message) && (line === undefined || (e.line === line && e.column === column)), JSON.stringify(text.slice(0, 40)));
const csvRun = (register, transfers = null) => checkTexts(texts({ holders: { text: register, format: 'csv' }, transfers: transfers === null ? null : { text: transfers, format: 'csv' } }));

test('readCsv: a header, rows and the line and column of every field', () => {
  const t = readCsv('a, b ,c\n1,2,3\n4,,6\n');
  assert.deepEqual(t.header.map((h) => h.value), ['a', 'b', 'c'], 'header names are trimmed');
  assert.deepEqual(t.rows.map((r) => r.cells.map((c) => c.value)), [['1', '2', '3'], ['4', '', '6']]);
  assert.deepEqual(t.rows.map((r) => r.line), [2, 3]);
  assert.deepEqual([t.rows[1].cells[2].line, t.rows[1].cells[2].column], [3, 4]);
});

test('readCsv: quoted fields hold commas, quotes written twice and line ends, which count as lines', () => {
  const t = readCsv('name,note\n"Example, Ltd","say ""hi""\nagain"\nnext,x\n');
  assert.equal(t.rows[0].cells[0].value, 'Example, Ltd');
  assert.equal(t.rows[0].cells[1].value, 'say "hi"\nagain');
  assert.equal(t.rows[1].line, 4);
  assert.equal(readCsv('a\n""\n').rows[0].cells[0].value, '');
});

test('readCsv: LF, CRLF and CR line ends give the same rows and lines, and empty lines at the end are allowed', () => {
  for (const sep of ['\n', '\r\n', '\r']) {
    const t = readCsv(['a,b', '1,2', '"x', 'y",3', '', ''].join(sep));
    assert.deepEqual(t.rows.map((r) => r.line), [2, 3], JSON.stringify(sep));
    assert.equal(t.rows[1].cells[0].value, `x${sep}y`);
  }
  assert.equal(readCsv('a,b\n1,2').rows.length, 1, 'no line end at the end of the file');
});

test('readCsv: what is not a strict table stops the reader with the line and column', () => {
  fails('', /holds no header row/, 1, 1);
  fails('\n\n', /holds no header row/);
  fails('a,b\n1\n', /the row has 1 field and the header has 2/, 2, 1);
  fails('a,b\n1,2,3\n', /the row has 3 fields and the header has 2/, 2, 1);
  fails('a\n1\n\n2\n', /an empty line inside the table/, 3, 1);
  fails('a,b\nx"y,2\n', /a quote inside a field that does not start with one/, 2, 2);
  fails('a,b\n"x"y,2\n', /text after the closing quote/, 2, 4);
  fails('a,b\n1,"open\n', /a quoted field is not closed/, 2, 3);
});

test('readCsv: the limits of rows, columns and the length of a field stop the reader with the limit named', () => {
  assert.throws(() => readCsv(`a\n${'1\n'.repeat(4)}`, { ...CSV_LIMITS, maxRows: 3 }), /more than 3 rows/);
  assert.throws(() => readCsv('a,b,c\n1,2,3\n', { ...CSV_LIMITS, maxColumns: 2 }), /more than 2 fields/);
  assert.throws(() => readCsv('a\nabcdef\n', { ...CSV_LIMITS, maxFieldLength: 5 }), /longer than 5 characters/);
  assert.throws(() => readCsv('a\n"abcdef"\n', { ...CSV_LIMITS, maxFieldLength: 5 }), /longer than 5 characters/);
  assert.equal(CSV_LIMITS.maxRows, 100000);
});

test('csvNodes: the cells by column for the search for secrets and by row for the reader, sharing one node per cell', () => {
  const t = readCsv('a,b\n1,\n3,4\n');
  const n = csvNodes(t);
  assert.deepEqual(n.byColumn.entries.map((e) => [e.key, e.value.items.length]), [['a', 2], ['b', 2]]);
  assert.deepEqual(n.rows.map((r) => r.entries.map((e) => e.key)), [['a'], ['a', 'b']], 'an empty cell is not an entry');
  assert.equal(n.byColumn.entries[1].value.items[1], n.rows[1].entries[1].value);
  assert.equal(n.rows[1].entries[1].line, 3);
});

test('formatOf: by the extension, and otherwise by the first character', () => {
  assert.equal(formatOf('register.CSV', '{'), 'csv');
  assert.equal(formatOf('register.json', 'a,b'), 'json');
  assert.equal(formatOf('register.txt', '  {"holders": []}'), 'json');
  assert.equal(formatOf('register', '[1]'), 'json');
  assert.equal(formatOf('register.txt', 'address,balance'), 'csv');
});

test('a CSV register and CSV transfers are read like JSON ones: the same clean rows give no finding', () => {
  const r = csvRun(csvText(HOLDERS), csvText([transfer()]));
  assert.deepEqual(r.findings, []);
  assert.equal(r.read.holders.length, 4);
  assert.deepEqual(r.read.holders[0].claims, ['KYC']);
  assert.equal(r.read.transfers[0].day, 200);
  assert.deepEqual(r.formats, { config: 'json', register: 'csv', transfers: 'csv' });
});

test('a CSV cell of claims is split at ";", and true and false are read in any case for frozen', () => {
  const rows = [{ ...HOLDERS[0], claims: 'kyc; ACCREDITATION ;', frozen: 'TRUE' }, { ...HOLDERS[1], frozen: 'false' }, HOLDERS[2], HOLDERS[3]];
  const r = csvRun(csvText(rows));
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.read.holders[0].claims, ['KYC', 'ACCREDITATION']);
  assert.equal(r.read.holders[0].frozen, true);
  assert.equal(r.read.holders[1].frozen, false);
  const bad = csvRun(csvText([{ ...HOLDERS[0], frozen: 'yes', acquiredDay: 'soon' }, ...HOLDERS.slice(1)]));
  assert.deepEqual(bad.findings.map((f) => f.id), ['field-invalid', 'field-invalid']);
  assert.match(bad.findings[0].message, /acquiredDay of holder 0x1{40} is "soon"; it must be a whole number of days from 0 to 10000000\./);
  assert.match(bad.findings[1].message, /frozen of holder 0x1{40} is "yes"; it must be true or false\./);
});

test('a CSV column the tool does not read is reported once at the header, a column named twice is field-duplicate, and one with no name is field-invalid', () => {
  const rows = HOLDERS.map((h) => ({ ...h, walletLabel: 'x', '': 'y' }));
  const r = csvRun(csvText(rows));
  assert.deepEqual(r.findings.map((f) => [f.id, f.line]), [['field-unknown', 1], ['field-invalid', 1]]);
  assert.match(r.findings[0].message, /^The column "walletLabel" is not one the tool reads, so its cells were left out of every check\./);
  assert.match(r.findings[1].message, /^A column of the header has no name/);
  const header = ['address', 'country', 'investorClass', 'claims', 'balance', 'acquiredDay', 'balance'];
  const dupText = `${header.join(',')}\n${HOLDERS.map((h) => [h.address, h.country, h.investorClass, h.claims.join(';'), h.balance, h.acquiredDay ?? '', '9'].join(',')).join('\n')}\n`;
  const dup = csvRun(dupText);
  assert.deepEqual(dup.findings.map((f) => [f.id, f.file, f.line]), [['field-duplicate', 'register', 1]]);
  assert.match(dup.findings[0].message, /^The column "balance" is named twice in the header of the register/);
  assert.deepEqual(dup.read.holders.map((h) => h.balance.text), ['400', '350', '250', '0'], 'the first of the two columns is read');
});

test('a CSV file that is not a strict table is one file-unreadable finding at its line, and nothing else in it is checked', () => {
  const r = csvRun('address,balance\n0x1,"10\n');
  assert.deepEqual(r.findings.map((x) => [x.id, x.file, x.line, x.column]), [['file-unreadable', 'register', 2, 5]]);
  assert.match(r.findings[0].message, /^The register is not CSV the reader can follow: a quoted field is not closed at line 2, column 5\. Nothing in the file was checked\.$/);
  assert.equal(r.read.holders, null);
});

test('a CSV register or list of transfers that is only a header holds nothing, and says so', () => {
  const r = csvRun('address,country,balance\n', 'id,from,to,amount,day\n');
  assert.deepEqual(r.findings.map((f) => [f.id, f.file]), [['field-missing', 'register'], ['field-missing', 'transfers']]);
  assert.match(r.findings[0].message, /^The register holds no holder\.$/);
  assert.match(r.findings[1].message, /^The transfers file holds no transfer\.$/);
});
