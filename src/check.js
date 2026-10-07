// A run: read the configuration as JSON and the register and the transfers as JSON or CSV, look for keys and seeds in
// each, read the fields, run the checks and build the report object that the formats write.

import { analyze } from './analyze.js';
import { readConfig } from './config.js';
import { CsvError, csvNodes, readCsv } from './csv.js';
import { LEVELS, NOTICE, POINTS, pointPage } from './data.js';
import { formatDecimal } from './decimal.js';
import { FILE_LIMITS, InputError, displayPath, locateInput, readInputText } from './files.js';
import { JsonError, readJson } from './json.js';
import { readRegister } from './register.js';
import { RULES, decide, ruleById } from './rules.js';
import { findSecrets } from './secrets.js';
import { safeText } from './text.js';
import { readTransfers } from './transfers.js';

export const LIMITS = { ...FILE_LIMITS };

export { InputError };

// The three files a run reads, in the order the report names them, and how a message names each.
export const INPUTS = ['config', 'register', 'transfers'];
export const INPUT_NAMES = { config: 'configuration', register: 'register', transfers: 'transfers file' };

const clean = (t, max = 900) => safeText(t, max);

const ORDER = { error: 0, warning: 1, info: 2 };

// The basis of a rule: the points with their pages.
function basisOf(rule) {
  return rule.basis.map((id) => {
    const page = pointPage(id);
    return { text: POINTS[id].text, source: page.title, url: page.url };
  });
}

// The format of a register or transfers file: by its extension, and otherwise by its first character that is not a
// space, a brace or a bracket for JSON and anything else for CSV. The configuration is always read as JSON.
export function formatOf(name, text) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.json')) return 'json';
  const first = text.trimStart()[0];
  return first === '{' || first === '[' ? 'json' : 'csv';
}

// The search for keys and seeds is the one of the sibling tools, kept unchanged in src/secrets.js; its finding is named
// for a configuration there and for any of the three files here.
const asFile = (f, file) => ({ ...f, id: 'secret-in-file', file, subject: null, message: f.message.replace(/^The configuration holds/, 'The file holds') });

// The nodes of one text, with no file system: { format, source, findings, notes }. source is null when the text is not
// JSON or CSV the readers can follow, and findings then holds one file-unreadable finding with its line.
export function parseText(text, format, file) {
  const name = INPUT_NAMES[file];
  const unreadable = (error, what) => ({ format, source: null, findings: [{ id: 'file-unreadable', file, line: error.line, column: error.column, message: `The ${name} is not ${what} the reader can follow: ${error.message}. Nothing in the file was checked.`, subject: null }], notes: [`the ${name} was not checked, because the file is not ${what} the reader can follow`] });
  const findings = [];
  if (format === 'csv') {
    let table;
    try {
      table = readCsv(text);
    } catch (error) {
      if (!(error instanceof CsvError)) throw error;
      return unreadable(error, 'CSV');
    }
    // A column named twice: the first is read, and the rest are left out.
    const seen = new Set();
    const keep = table.header.map((h) => {
      if (h.value !== '' && seen.has(h.value)) {
        findings.push({ id: 'field-duplicate', file, line: h.line, column: h.column, message: `The column "${h.value.length > 120 ? `${h.value.slice(0, 117)}...` : h.value}" is named twice in the header of the ${name}; the tool reads the first and left this one out of every check.`, subject: null });
        return false;
      }
      seen.add(h.value);
      return true;
    });
    const kept = { header: table.header.filter((_, j) => keep[j]), rows: table.rows.map((r) => ({ line: r.line, cells: r.cells.filter((_, j) => keep[j]) })) };
    const nodes = csvNodes(kept);
    findings.push(...findSecrets(nodes.byColumn).map((f) => asFile(f, file)));
    return { format, source: { format, header: nodes.byColumn.entries, rows: nodes.rows }, findings, notes: [] };
  }
  let root;
  try {
    root = readJson(text);
  } catch (error) {
    if (!(error instanceof JsonError)) throw error;
    return unreadable(error, 'JSON');
  }
  findings.push(...findSecrets(root).map((f) => asFile(f, file)));
  return { format, source: { format, root }, findings, notes: [] };
}

// The findings of the texts, with no file system: texts is { config: { text }, register: { text, format },
// transfers: { text, format } }, and register and transfers may be left out. Returns { formats, read, analysis,
// findings, notes }.
export function checkTexts(texts) {
  const findings = [];
  const notes = [];
  const formats = {};
  const read = { config: null, holders: null, transfers: null };
  for (const file of INPUTS) {
    const given = texts[file];
    if (!given) continue;
    const format = file === 'config' ? 'json' : given.format ?? 'json';
    formats[file] = format;
    const parsed = parseText(given.text, format, file);
    findings.push(...parsed.findings);
    notes.push(...parsed.notes);
    if (!parsed.source) continue;
    const r = file === 'config' ? readConfig(parsed.source.root) : file === 'register' ? readRegister(parsed.source) : readTransfers(parsed.source);
    findings.push(...r.findings);
    notes.push(...r.notes);
    if (file === 'config') read.config = r.config;
    else if (file === 'register') read.holders = r.holders;
    else read.transfers = r.transfers;
  }
  if (!read.config) notes.push('the rules of the token could not be read, so the register and the transfers were checked for their form and against each other only');
  const analysis = analyze(read);
  return { formats, read, analysis, findings: [...findings, ...analysis.findings], notes: [...notes, ...analysis.notes] };
}

const lineCount = (text) => {
  const parts = text === '' ? [] : text.split(/\r\n|\r|\n/);
  return parts.length > 0 && parts.at(-1) === '' ? parts.length - 1 : parts.length;
};

// The token as the report shows it.
function tokenOf(config) {
  if (!config) return null;
  const t = config.token;
  const text = (v, max) => (v === null ? null : clean(v, max));
  return { name: text(t.name, 120), symbol: text(t.symbol, 20), standard: text(t.standard, 40), decimals: t.decimals, totalSupply: t.supply && t.supply.state === 'ok' ? formatDecimal(t.supply.value) : null };
}

// The report object for the findings of the files. files is { config: { file, bytes, lines }, register, transfers },
// with a file that was not given left out.
export function buildReport({ files, checked, version, minSeverity = 'info', failOn = 'error' }) {
  const all = checked.findings.map((f) => {
    const rule = ruleById(f.id);
    const file = files[f.file].file;
    return {
      id: f.id,
      severity: rule.severity,
      message: clean(f.message),
      file,
      input: f.file,
      line: f.line,
      column: f.column,
      at: `${file}:${f.line}`,
      subject: f.subject == null ? null : clean(f.subject, 120),
      fix: rule.fix,
      kind: rule.kind,
      basis: basisOf(rule),
      own: rule.own ?? null
    };
  });
  all.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || INPUTS.indexOf(a.input) - INPUTS.indexOf(b.input) || a.line - b.line || a.column - b.column || a.id.localeCompare(b.id, 'en'));
  const shown = all.filter((f) => LEVELS.indexOf(f.severity) >= LEVELS.indexOf(minSeverity));
  const byLevel = { error: 0, warning: 0, info: 0 };
  for (const f of shown) byLevel[f.severity] += 1;
  const allByLevel = { error: 0, warning: 0, info: 0 };
  for (const f of all) allByLevel[f.severity] += 1;
  const inputs = Object.fromEntries(INPUTS.map((k) => [k, files[k] ? { file: files[k].file, format: checked.formats[k], bytes: files[k].bytes, lines: files[k].lines } : null]));
  const s = checked.analysis.summary;
  return {
    tool: 'token-transfer-check',
    version,
    inputs,
    token: tokenOf(checked.read.config),
    summary: { holders: s.holders, holding: s.holding, sumOfBalances: s.sum, transfers: s.transfers, made: s.made, holdingAfter: s.holdingAfter },
    totals: { findings: shown.length, byLevel, hidden: all.length - shown.length },
    rules: RULES.map((r) => ({ id: r.id, level: r.severity, kind: r.kind, findings: shown.filter((f) => f.id === r.id).length })),
    config: { minSeverity, failOn },
    findings: shown,
    countries: s.countries,
    notes: checked.notes.map((n) => clean(n)),
    notice: NOTICE,
    result: decide(allByLevel, failOn)
  };
}

// Reads the files and builds the report. paths is { config, register, transfers }, each a path or null.
export async function checkFiles({ paths, minSeverity = 'info', failOn = 'error', version, limits = LIMITS, base = process.cwd() }) {
  const problems = [];
  const texts = {};
  const files = {};
  for (const file of INPUTS) {
    if (!paths[file]) continue;
    try {
      const absolute = await locateInput(paths[file], base);
      const { text, bytes } = await readInputText(absolute, base, limits);
      texts[file] = { text, format: file === 'config' ? 'json' : formatOf(absolute, text) };
      files[file] = { file: displayPath(absolute, base), bytes, lines: lineCount(text) };
    } catch (error) {
      if (!(error instanceof InputError)) throw error;
      problems.push(...error.problems);
    }
  }
  if (problems.length) throw new InputError(problems);
  const checked = checkTexts(texts);
  return buildReport({ files, checked, version, minSeverity, failOn });
}
