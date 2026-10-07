// Reading fields from the nodes of the JSON reader, or from the nodes src/csv.js builds from a CSV table, for the three
// files the tool reads. Every field is read with the line and column of its key or cell, so a finding can point at it. A
// field that is of the wrong type or unknown is a finding of its own, and its value is left out of the checks that need
// it; nothing that was not read is taken for a value that is fine. Keys of a file are only compared with the names the
// tool reads; no object is built with a key from a file. A value that src/secrets.js marked as a seed or a key is left
// out as if it were not there, and never shown.

import { isArray, isNumber, isObject, isString } from './json.js';
import { parseDecimal } from './decimal.js';

export const where = (e) => ({ line: e.line, column: e.column });

// A text from a file as a message names it: cut at a length, so that a long value does not fill a report.
export const cut = (text, max = 120) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

// A known key that an unknown one is probably meant to be: the same letters in another case or with other separators,
// or one that starts with the other.
export function suggestKey(key, known) {
  const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (k.length < 3) return null;
  const flat = (n) => n.toLowerCase();
  return known.find((n) => flat(n) === k) ?? known.find((n) => flat(n).startsWith(k) || k.startsWith(flat(n))) ?? null;
}

export const describe = (node) => (node.secret ? 'a value that is not shown' : node.kind === 'object' ? 'an object' : node.kind === 'array' ? 'a list' : node.kind === 'null' ? 'null' : node.kind === 'boolean' ? `${node.value}` : node.kind === 'number' ? `the number ${node.raw.length > 40 ? `${node.raw.slice(0, 37)}...` : node.raw}` : 'text');

// Reads an amount: { state, value, text } with state 'ok', 'zero', 'negative' or 'nan'; never through a floating point
// number.
export function readAmount(text) {
  if (text.startsWith('-') && parseDecimal(text.slice(1))) return { state: 'negative', value: null, text };
  const d = parseDecimal(text);
  if (!d) return { state: 'nan', value: null, text };
  if (d.int === 0n) return { state: 'zero', value: d, text };
  return { state: 'ok', value: d, text };
}

const WHOLE = /^(?:0|[1-9][0-9]{0,11})$/;

// The fields of one file, with the findings of what could not be read. file names the file the findings are about:
// 'config', 'register' or 'transfers'.
export class Reader {
  constructor(file) {
    this.file = file;
    this.findings = [];
  }

  add(id, at, message, subject = null) {
    this.findings.push({ id, file: this.file, line: at.line, column: at.column, message, subject });
  }

  // The entries of an object, with a field-unknown finding for each key that is not in known (unless report is false),
  // and the first entry of each known key in a map. A key that names a seed or a key was reported by src/secrets.js and
  // is passed over.
  fields(obj, known, label, report = true) {
    const map = new Map();
    for (const e of obj.entries) {
      if (e.secret) continue;
      if (known.includes(e.key)) map.set(e.key, e);
      else if (report) {
        const near = suggestKey(e.key, known);
        this.add('field-unknown', where(e), `The key "${cut(e.key)}" of ${label} is not one the tool reads, so its value was left out of every check.${near ? ` Did you mean "${near}"?` : ''} The keys of ${label} are ${known.join(', ')}.`);
      }
    }
    return map;
  }

  // An object field: the node, or null when it is missing, a secret or not an object (a finding).
  object(map, key, of, what) {
    const e = map.get(key);
    if (!e) return { value: null, entry: null };
    if (e.value.secret) return { value: null, entry: e, invalid: true };
    if (!isObject(e.value)) {
      this.add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be an object with ${what}.`);
      return { value: null, entry: e, invalid: true };
    }
    return { value: e.value, entry: e };
  }

  // A text field: null when it is missing, empty, of another type or marked as a secret; invalid is true when it is there
  // but could not be read, so that it is not reported as missing too. A number is taken as text when numbers is true (a
  // transfer id written as a number).
  text(map, key, of, numbers = false) {
    const e = map.get(key);
    if (!e) return { value: null, entry: null };
    if (e.value.secret) return { value: null, entry: e, invalid: true };
    if (isNumber(e.value) && numbers) return { value: e.value.raw, entry: e };
    if (!isString(e.value)) {
      this.add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be text.`);
      return { value: null, entry: e, invalid: true };
    }
    if (e.value.value.trim() === '') return { value: null, entry: e };
    return { value: e.value.value.trim(), entry: e, raw: e.value.value };
  }

  // An amount field: { value: the text, entry } with the text of the number or of the string, or null.
  amount(map, key, of) {
    const e = map.get(key);
    if (!e) return { value: null, entry: null };
    if (e.value.secret) return { value: null, entry: e, invalid: true };
    if (!isNumber(e.value) && !isString(e.value)) {
      this.add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be a decimal number, written as a number or as text.`);
      return { value: null, entry: e, invalid: true };
    }
    const t = isNumber(e.value) ? e.value.raw : e.value.value.trim();
    return { value: t === '' ? null : t, entry: e };
  }

  // A whole number from min up to max: null when it is missing or invalid; a missing field is not a finding here. text
  // is true where a CSV cell, or a JSON string of digits, may hold it.
  whole(map, key, of, { min = 0, max, what, text = false }) {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, entry: e ?? null, invalid: Boolean(e) };
    const raw = isNumber(e.value) ? e.value.raw : text && isString(e.value) ? e.value.value.trim() : null;
    if (raw === '' && isString(e.value)) return { value: null, entry: e };
    if (raw === null || !WHOLE.test(raw) || Number(raw) < min || Number(raw) > max) {
      this.add('field-invalid', where(e), `The ${key} of ${of} is ${isString(e.value) ? `"${cut(e.value.value, 40)}"` : describe(e.value)}; it must be a whole number of ${what} from ${min} to ${max}${text ? '' : ', written as a number'}.`);
      return { value: null, entry: e, invalid: true };
    }
    return { value: Number(raw), entry: e };
  }

  // A yes or no field: true or false in JSON, or the text true or false in a CSV cell.
  flag(map, key, of, text = false) {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, entry: e ?? null, invalid: Boolean(e) };
    if (e.value.kind === 'boolean') return { value: e.value.value, entry: e };
    if (text && isString(e.value)) {
      const v = e.value.value.trim().toLowerCase();
      if (v === 'true' || v === 'false') return { value: v === 'true', entry: e };
      if (v === '') return { value: null, entry: e };
    }
    this.add('field-invalid', where(e), `The ${key} of ${of} is ${isString(e.value) ? `"${cut(e.value.value, 40)}"` : describe(e.value)}; it must be true or false.`);
    return { value: null, entry: e, invalid: true };
  }

  // A list of texts: a JSON list of strings, or, where text is true, a CSV cell with the items separated by ";". Each item
  // is { value, node }; an item that is not text is a finding and left out.
  list(map, key, of, text = false) {
    const e = map.get(key);
    if (!e || e.value.secret) return { value: null, entry: e ?? null, invalid: Boolean(e) };
    if (text && isString(e.value)) {
      const items = e.value.value.split(';').map((s) => s.trim()).filter(Boolean).map((value) => ({ value, node: e.value }));
      return { value: items, entry: e };
    }
    if (!isArray(e.value)) {
      this.add('field-invalid', where(e), `The ${key} of ${of} is ${describe(e.value)}; it must be a list of texts${text ? ', or in a CSV cell texts separated by ";"' : ''}.`);
      return { value: null, entry: e, invalid: true };
    }
    const items = [];
    for (const node of e.value.items) {
      if (node.secret) continue;
      if (!isString(node) || node.value.trim() === '') {
        this.add('field-invalid', where(node), `An item of the ${key} of ${of} is ${isString(node) ? 'empty' : describe(node)}; it must be text.`);
        continue;
      }
      items.push({ value: node.value.trim(), node });
    }
    return { value: items, entry: e };
  }
}

// The rows of a register or of a list of transfers: from the nodes of a CSV table, or from the list under listKey of a
// JSON file. An unknown column is reported once, at the header; the keys of the top level of a JSON file are checked
// here. Returns { rows, notes }, with rows null when the file holds no list at all.
export function rowsOf(reader, source, { listKey, rowKeys, what, label, limit }) {
  const notes = [];
  let rows = [];
  if (source.format === 'csv') {
    for (const h of source.header) {
      if (h.secret) continue;
      if (h.key === '') reader.add('field-invalid', where(h), 'A column of the header has no name, so its cells were left out of every check.');
      else if (!rowKeys.includes(h.key)) {
        const near = suggestKey(h.key, rowKeys);
        reader.add('field-unknown', where(h), `The column "${cut(h.key)}" is not one the tool reads, so its cells were left out of every check.${near ? ` Did you mean "${near}"?` : ''} The columns of ${label} are ${rowKeys.join(', ')}.`);
      }
    }
    rows = source.rows;
    if (rows.length === 0) reader.add('field-missing', { line: 1, column: 1 }, `The ${label} holds no ${what}.`);
  } else {
    const root = source.root;
    if (!isObject(root)) {
      reader.add('file-unreadable', where(root), `The top level of the ${label} is ${describe(root)}, not an object with the ${listKey}, so nothing in it was checked.`);
      return { rows: null, notes: [`the ${label} was not checked, because it holds no object at its top level`] };
    }
    const top = reader.fields(root, [listKey, 'notes'], `the ${label}`);
    const le = top.get(listKey);
    if (!le) {
      reader.add('field-missing', where(root), `The ${label} has no ${listKey}.`);
      return { rows: null, notes: [`no ${what} was read from the ${label}`] };
    }
    if (!isArray(le.value)) {
      if (!le.value.secret) reader.add('field-invalid', where(le), `The ${listKey} of the ${label} are ${describe(le.value)}; they must be a list of objects, one for each ${what}.`);
      return { rows: null, notes: [`no ${what} was read from the ${label}`] };
    }
    rows = le.value.items;
    if (rows.length === 0) reader.add('field-missing', where(le), `The ${label} holds no ${what}.`);
  }
  if (rows.length > limit) {
    notes.push(`the ${label} holds ${rows.length} rows; the tool read the first ${limit} and left the rest out`);
    rows = rows.slice(0, limit);
  }
  return { rows, notes };
}
