// The reports: text for a terminal, markdown for a job summary or a pull request, JSON for other tools and SARIF for code
// scanning. Every text that comes from the input (a file name, a token name, an address, a transfer id) was cleaned by
// safeText before it reached the report object. The markdown format also escapes what markdown gives a meaning to, and
// the SARIF format is built as an object and written by JSON.stringify.

import { SOURCES } from './data.js';
import { RULES } from './rules.js';
import { grouped, listText, plural } from './size.js';

const URI = 'https://github.com/INNERLUXES/token-transfer-check';

function findingsLine(r) {
  const b = r.totals.byLevel;
  const parts = ['error', 'warning', 'info'].filter((l) => b[l]).map((l) => `${grouped(b[l])} ${l}`);
  return `${grouped(r.totals.findings)}${parts.length ? ` (${parts.join(', ')})` : ''}${r.totals.hidden ? `; ${grouped(r.totals.hidden)} below ${r.config.minSeverity} not shown` : ''}`;
}

// The files that were read, in one line.
function filesLine(r) {
  return ['config', 'register', 'transfers'].filter((k) => r.inputs[k]).map((k) => `${k} ${r.inputs[k].file} (${r.inputs[k].format.toUpperCase()}, ${plural(r.inputs[k].lines, 'line')}, ${plural(r.inputs[k].bytes, 'byte')})`).join('; ');
}

// What the configuration says of the token, in one line.
function tokenLine(r) {
  const t = r.token;
  if (!t) return 'no configuration was read';
  const name = t.name ?? 'a token with no name';
  return `${name}${t.symbol ? ` (${t.symbol})` : ''}; ${t.standard ?? 'no standard given'}; ${t.decimals === null ? 'decimals not read' : `${t.decimals} decimals`}; total supply ${t.totalSupply ?? 'not read'}`;
}

function registerLine(r) {
  const s = r.summary;
  if (!r.inputs.register) return 'not given';
  if (s.holders === null) return 'no holder was read';
  return `${plural(s.holders, 'holder')}, ${grouped(s.holding)} with a balance above 0; balances add up to ${s.sumOfBalances ?? 'a sum that could not be read'}`;
}

function transfersLine(r) {
  const s = r.summary;
  if (!r.inputs.transfers) return 'not given';
  if (s.transfers === null) return 'no transfer was read';
  if (s.made === null) return `${plural(s.transfers, 'transfer')}, checked for their form only`;
  return `${plural(s.transfers, 'transfer')}, ${grouped(s.made)} taken as made; ${plural(s.holdingAfter, 'holder')} after them`;
}

function table(head, rows, indent = '  ') {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((row) => row[i].length)));
  const line = (cells) => `${indent}${cells.map((c, i) => (i === cells.length - 1 ? c : c.padEnd(widths[i]))).join('  ')}`.trimEnd();
  return [line(head), ...rows.map(line)];
}

const COUNTRY_HEAD = ['country', 'allowed', 'limit', 'holders', 'after transfers'];
const dash = (v) => (v === null || v === undefined ? '-' : typeof v === 'boolean' ? (v ? 'yes' : 'no') : grouped(v));
const countryRows = (r) => r.countries.map((x) => [x.country, dash(x.allowed), dash(x.limit), dash(x.register), dash(x.after)]);

const PAD = ' '.repeat(11);

export function toText(r, { explain = false } = {}) {
  const out = [];
  out.push(`token-transfer-check: ${r.inputs.config.file}`);
  out.push(`files: ${filesLine(r)}`);
  out.push(`token: ${tokenLine(r)}`);
  out.push(`register: ${registerLine(r)}`);
  out.push(`transfers: ${transfersLine(r)}`);
  out.push(`findings: ${findingsLine(r)}`);
  out.push('', `Checks (${grouped(r.rules.length)})`, '');
  out.push(...table(['check', 'level', 'kind', 'findings'], r.rules.map((x) => [x.id, x.level, x.kind, grouped(x.findings)])), '');
  out.push(`Findings (${grouped(r.findings.length)})`, '');
  if (!r.findings.length) out.push('  none', '');
  const width = Math.max(...RULES.map((x) => x.id.length));
  for (const f of r.findings) {
    out.push(`  ${f.severity.toUpperCase().padEnd(8)} ${f.id.padEnd(width)}  ${f.at}`);
    out.push(`${PAD}${f.message}`);
    out.push(`${PAD}fix: ${f.fix}`);
    if (explain) {
      for (const b of f.basis) out.push(`${PAD}basis: ${b.text} (${b.source}, ${b.url})`);
      if (f.own) out.push(`${PAD}the tool's own choice: ${f.own}`);
    }
    out.push('');
  }
  if (r.countries) out.push(`Holders by country (${grouped(r.countries.length)})`, '', ...table(COUNTRY_HEAD, countryRows(r)), '');
  for (const n of r.notes) out.push(`note: ${n}`);
  if (r.notes.length) out.push('');
  out.push(r.notice, '');
  out.push(`RESULT: ${r.result.text}`);
  return `${out.join('\n')}\n`;
}

// Text for a markdown table cell or line: the characters markdown gives a meaning to are escaped.
const md = (t) => String(t).replace(/[\\`*_{}[\]<>()#+!|~]/g, (c) => `\\${c}`).replace(/\r?\n/g, ' ');

export function toMarkdown(r, { explain = false } = {}) {
  const out = [];
  out.push(`# token-transfer-check: ${md(r.inputs.config.file)}`, '');
  out.push(`- Files: ${md(filesLine(r))}`);
  out.push(`- Token: ${md(tokenLine(r))}`);
  out.push(`- Register: ${md(registerLine(r))}`);
  out.push(`- Transfers: ${md(transfersLine(r))}`);
  out.push(`- Findings: ${md(findingsLine(r))}`);
  out.push(`- Result: **${md(r.result.text)}**`, '');
  out.push('## Findings', '');
  if (!r.findings.length) out.push('None.', '');
  else {
    out.push('| Level | Check | Where | Message |', '| --- | --- | --- | --- |');
    for (const f of r.findings) out.push(`| ${f.severity} | ${f.id} | ${md(f.at)} | ${md(f.message)} Fix: ${md(f.fix)} |`);
    out.push('');
  }
  if (explain) {
    out.push('## Basis', '');
    const seen = new Set();
    for (const f of r.findings) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push(`### ${f.id}`, '');
      for (const b of f.basis) out.push(`- ${md(b.text)} (${md(b.source)}, <${b.url}>)`);
      if (f.own) out.push(`- The tool's own choice: ${md(f.own)}`);
      if (!f.basis.length && !f.own) out.push('- A problem with one of the files itself; it rests on no page.');
      out.push('');
    }
  }
  if (r.countries) {
    out.push(`## Holders by country (${grouped(r.countries.length)})`, '');
    out.push('| Country | Allowed | Limit | Holders | After transfers |', '| --- | --- | ---: | ---: | ---: |');
    for (const row of countryRows(r)) out.push(`| ${row.map(md).join(' | ')} |`);
    out.push('');
  }
  for (const n of r.notes) out.push(`Note: ${md(n)}`, '');
  out.push(`${md(r.notice)}`, '');
  return `${out.join('\n')}`;
}

export function toJson(r, { explain = false } = {}) {
  const out = { ...r, findings: r.findings.map((f) => (explain ? f : { ...f, basis: undefined, own: undefined })) };
  return `${JSON.stringify(out, null, 2)}\n`;
}

const SARIF_LEVEL = { error: 'error', warning: 'warning', info: 'note' };

// SARIF 2.1.0: the checks as rules of the driver, the files as the artifacts, and one result for each finding with its
// file, line and column. The table of holders by country has no place in SARIF and is left out.
export function toSarif(r) {
  const files = ['config', 'register', 'transfers'].filter((k) => r.inputs[k]).map((k) => r.inputs[k].file);
  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'token-transfer-check',
            version: r.version,
            informationUri: URI,
            rules: RULES.map((x) => ({
              id: x.id,
              name: x.id,
              shortDescription: { text: x.summary },
              help: { text: `${x.fix} (${x.kind})` },
              defaultConfiguration: { level: SARIF_LEVEL[x.severity] },
              properties: { kind: x.kind }
            }))
          }
        },
        artifacts: files.map((uri) => ({ location: { uri } })),
        results: r.findings.map((f) => ({
          ruleId: f.id,
          ruleIndex: RULES.findIndex((x) => x.id === f.id),
          level: SARIF_LEVEL[f.severity],
          message: { text: `${f.message} Fix: ${f.fix}` },
          locations: [{ physicalLocation: { artifactLocation: { uri: f.file, index: files.indexOf(f.file) }, region: { startLine: f.line, startColumn: f.column } } }],
          properties: { kind: f.kind, input: f.input, subject: f.subject }
        })),
        properties: { notice: r.notice, result: r.result.text, sources: SOURCES.map((s) => s.url) }
      }
    ]
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
}

// The list of checks, for --list-checks.
export function listChecksText() {
  const width = Math.max(...RULES.map((x) => x.id.length));
  const out = ['token-transfer-check checks', ''];
  for (const x of RULES) out.push(`  ${x.id.padEnd(width)}  ${x.severity.padEnd(7)}  ${x.kind.padEnd(13)}  ${x.summary}`);
  out.push('', `A documented check rests on ${listText(['ERC-3643', 'ERC-20', 'Rule 144 (d) in the eCFR, as an example of a lock-up', 'the UN M49 table', 'the IBAN registry of Swift', 'ethereum.org'], 8)}; a best practice check is this tool's own choice and says so in its message. An input check is about one of the files itself. None of it is legal advice.`, '');
  return out.join('\n');
}

export function listChecksMarkdown() {
  const out = ['# token-transfer-check checks', '', '| Check | Level | Kind | What it looks at |', '| --- | --- | --- | --- |'];
  for (const x of RULES) out.push(`| ${x.id} | ${x.severity} | ${x.kind} | ${md(x.summary)} |`);
  out.push('');
  return out.join('\n');
}

export function listChecksJson() {
  return `${JSON.stringify(RULES.map((x) => ({ id: x.id, severity: x.severity, kind: x.kind, summary: x.summary, fix: x.fix, basis: x.basis, own: x.own ?? null })), null, 2)}\n`;
}
