// Command line: token-transfer-check <config.json> [--register <file>] [--transfers <file>] [options]

import { readFileSync } from 'node:fs';
import { InputError, LIMITS, checkFiles } from './check.js';
import { LEVELS } from './data.js';
import { listChecksJson, listChecksMarkdown, listChecksText, toJson, toMarkdown, toSarif, toText } from './report.js';
import { RULES } from './rules.js';
import { safeText } from './text.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson, sarif: toSarif };
const LISTS = { text: listChecksText, markdown: listChecksMarkdown, json: listChecksJson };

export const USAGE = `Usage: token-transfer-check <config.json> [--register <file>] [--transfers <file>] [options]

Reads the compliance configuration of a tokenized asset (JSON: the token with its decimals and total supply, the allowed
investor countries, the required investor claims, the largest number of holders overall and by country, the largest
holding of one investor, the lock-up of each investor class in days, the owner and the agents, and whether the token is
pausable and has forced transfers and recovery), and optionally its holder register and a list of proposed transfers
(JSON or CSV), and lists what would break the asset's own rules before it reaches the chain: a transfer to an investor
without the required claims or from a country that is not allowed, a transfer that would take the holders over the
limit overall or in a country, a holding above the cap, a transfer of tokens still in their lock-up by the transfer's
own day, an amount with more decimals than the token, holdings that do not add up to the total supply, a transfer from
or to a frozen wallet or of more than the free balance, a configuration with no agent or with one key behind forced
transfers, a token that cannot be paused, unknown countries, holders or transfer ids written twice and malformed
addresses. A private key or a seed in a file is an error whose value is never shown. It reads the files and is not legal
advice: it contacts no chain, fetches nothing, runs nothing, reads no clock and writes nothing to disk.

Options:
  --register <file>        the holder register, JSON or CSV
  --transfers <file>       the proposed transfers, JSON or CSV; needs --register
  --format <name>          text, markdown, json or sarif (default: text)
  --json                   the same as --format json
  --min-severity <level>   the lowest level of a finding that is shown: ${LEVELS.join(', ')} (default: info)
  --fail-on <level>        the lowest level of a finding that fails the run: ${LEVELS.join(', ')} (default: error)
  --explain                show the points of the pages behind each finding (text, markdown and JSON)
  --list-checks            list the checks with their level and kind, and exit
  --help                   show this text
  --version                show the version

Checks: ${RULES.map((r) => r.id).join(', ')}.

Exit codes: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

export function parseArgs(argv) {
  const o = { paths: [], register: null, transfers: null, format: null, json: false, minSeverity: null, failOn: null, explain: false, listChecks: false, help: false, version: false };
  const once = (name, current, value) => {
    if (current !== null) throw new Error(`${name} was given twice`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new Error(`${a} needs a value`);
      if (v === '-') throw new Error('reading from standard input is not supported; give a file');
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--json') o.json = true;
    else if (a === '--list-checks') o.listChecks = true;
    else if (a === '--register') o.register = once(a, o.register, next());
    else if (a === '--transfers') o.transfers = once(a, o.transfers, next());
    else if (a === '--format') o.format = once(a, o.format, next());
    else if (a === '--min-severity') o.minSeverity = once(a, o.minSeverity, next());
    else if (a === '--fail-on') o.failOn = once(a, o.failOn, next());
    else if (a === '-') throw new Error('reading from standard input is not supported; give a file');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else {
      if (o.paths.length === 1) throw new Error('give one configuration file; the register and the transfers go after --register and --transfers');
      o.paths.push(a);
    }
  }
  if (o.json) {
    if (o.format !== null && o.format !== 'json') throw new Error(`--json and --format ${o.format} ask for two formats; give one`);
    o.format = 'json';
  }
  if (o.format === null) o.format = 'text';
  if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown, json or sarif)`);
  for (const [flag, v] of [['--min-severity', o.minSeverity], ['--fail-on', o.failOn]]) if (v !== null && !LEVELS.includes(v)) throw new Error(`${flag}: unknown level ${v} (${LEVELS.join(', ')})`);
  if (o.listChecks && o.format === 'sarif') throw new Error('--list-checks has no SARIF form; use text, markdown or json');
  if (!o.help && !o.version && !o.listChecks) {
    if (o.paths.length !== 1) throw new Error('give the configuration file, such as token-transfer-check token.json');
    if ([...o.paths, o.register, o.transfers].some((p) => p !== null && isUrl(p))) throw new Error('give a local path; the tool never fetches a URL');
    if (o.transfers !== null && o.register === null) throw new Error('--transfers needs --register: the investors a transfer goes to, and the balances it comes from, are read from the register');
    if (o.explain && o.format === 'sarif') throw new Error('--explain adds the points of the pages to the text, markdown and JSON reports; the sarif format has no place for them');
  }
  return o;
}

const clean = (text) => safeText(text, 1500);

// Exit code: 0 no finding at or above the fail-on level, 1 a finding at or above it, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = undefined, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`token-transfer-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  if (o.listChecks) {
    io.out(LISTS[o.format]());
    return 0;
  }
  let report;
  try {
    report = await checkFiles({ paths: { config: o.paths[0], register: o.register, transfers: o.transfers }, minSeverity: o.minSeverity ?? 'info', failOn: o.failOn ?? 'error', version: VERSION, limits: { ...LIMITS, ...(limits ?? {}) }, base });
  } catch (error) {
    if (error instanceof InputError) io.err(`token-transfer-check: no result, the input has ${error.problems.length === 1 ? 'a problem' : 'problems'}:\n${error.problems.map((p) => `  ${clean(p)}`).join('\n')}\n`);
    else io.err(`token-transfer-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report, { explain: o.explain }));
  return report.result.pass ? 0 : 1;
}
