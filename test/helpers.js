// Shared test helpers: configurations, registers and transfers built inline, checked in memory or written into a
// temporary folder that is removed after the test. Paths are built with resolve() from forward-slash names, so the same
// test runs on Linux, macOS and Windows. The line a test expects is found with lineOf(), which counts lines the way the
// readers do, so a test never holds a line number worked out by hand for one system only. No test reads the clock, the
// time zone or the locale. Every name is made up and every address is one character written many times.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { checkTexts, main } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'token-transfer-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The line (from 1) of the n-th place where needle starts in text.
export function lineOf(text, needle, n = 1) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return text.slice(0, at).split('\n').length;
}

// A made-up address of one character, or of a short run of characters, written to 40 hex digits.
export const addr = (c = '1') => `0x${c.repeat(40 / c.length)}`;

const drop = (out) => {
  for (const [k, v] of Object.entries(out)) if (v === undefined) delete out[k];
  return out;
};

// A configuration that passes every check: an ERC-3643 token of 1000 whole tokens, three allowed countries, the claim
// KYC, ten holders at most and five in the United States, a cap of 50% and one class with a lock-up of 100 days. over
// replaces fields of each part, and a field or a part set to undefined is left out.
export function config(over = {}) {
  const parts = {
    token: { name: 'Harbor Example Tower Token', symbol: 'HXT', standard: 'ERC-3643', decimals: 0, totalSupply: '1000' },
    compliance: { allowedCountries: ['US', 'GB', 'DE'], requiredClaims: ['KYC'], maxHolders: 10, maxHoldersPerCountry: { US: 5 }, maxHolding: '50%', investorClasses: [{ name: 'reg-d', lockupDays: 100 }] },
    roles: { owner: addr('a'), agents: [addr('b')], multisig: true },
    controls: { pausable: true, forcedTransfer: true, recovery: true }
  };
  const out = {};
  for (const [k, v] of Object.entries(parts)) {
    if (Object.hasOwn(over, k) && over[k] === undefined) continue;
    out[k] = drop({ ...v, ...(over[k] ?? {}) });
  }
  for (const [k, v] of Object.entries(over)) if (!Object.hasOwn(parts, k) && v !== undefined) out[k] = v;
  return out;
}

// A holder that passes every check; over replaces fields, and a field set to undefined is left out.
export const holder = (over = {}) => drop({ address: addr('1'), country: 'US', investorClass: 'reg-d', claims: ['KYC'], balance: '400', acquiredDay: 0, ...over });

// Four holders that add up to the supply of config(): three with a balance and one registered with none.
export const HOLDERS = [
  holder(),
  holder({ address: addr('2'), country: 'GB', balance: '350' }),
  holder({ address: addr('3'), country: 'DE', balance: '250', acquiredDay: 10 }),
  holder({ address: addr('4'), balance: '0', acquiredDay: undefined })
];

// A transfer that passes every check: 100 tokens from the first holder to the second on day 200.
export const transfer = (over = {}) => drop({ id: 'T-1', from: addr('1'), to: addr('2'), amount: '100', day: 200, ...over });

export const text = (obj) => `${JSON.stringify(obj, null, 2)}\n`;

// The texts of a run: the configuration, and the register and the transfers when they are given (as lists, written as
// JSON, or as texts with their format).
export function texts({ cfg = config(), holders = HOLDERS, transfers = null } = {}) {
  const out = { config: { text: typeof cfg === 'string' ? cfg : text(cfg) } };
  if (holders !== null) out.register = typeof holders === 'object' && holders.text !== undefined ? holders : { text: text({ holders }), format: 'json' };
  if (transfers !== null) out.transfers = typeof transfers === 'object' && transfers.text !== undefined ? transfers : { text: text({ transfers }), format: 'json' };
  return out;
}

// The findings of a run in memory.
export const findingsOf = (parts = {}) => checkTexts(texts(parts)).findings;

// The ids of the findings of a run.
export const idsOf = (parts = {}) => findingsOf(parts).map((f) => f.id);

// The findings of one check.
export const ofCheck = (parts, id) => findingsOf(parts).filter((f) => f.id === id);

// The findings of one check for one transfer added after the default ones.
export const ofTransfer = (t, id, parts = {}) => ofCheck({ ...parts, transfers: [t] }, id);

// A CSV table of rows of objects, with the header taken from the keys of all rows in the order they first appear; a
// list is written with its items separated by ";".
export function csvText(rows, header = [...new Set(rows.flatMap((r) => Object.keys(r)))]) {
  const field = (v) => {
    if (v === undefined) return '';
    const s = Array.isArray(v) ? v.join(';') : String(v);
    return /[",\r\n]/.test(s) ? `"${s.split('"').join('""')}"` : s;
  };
  return `${[header.join(','), ...rows.map((r) => header.map((h) => field(r[h])).join(','))].join('\n')}\n`;
}

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, base) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// Writes the files and runs the command line in the folder.
export async function run(files, args) {
  return withFiles(files, (dir) => cli(args, dir));
}

// A clean configuration with its register and a clean transfer, and a set whose transfer is made inside the lock-up, for
// the command line tests.
export const GOOD = { 'token.json': text(config()), 'register.json': text({ holders: HOLDERS }), 'transfers.json': text({ transfers: [transfer()] }) };
export const BAD = { ...GOOD, 'transfers.json': text({ transfers: [transfer({ day: 50 })] }) };
export const ARGS = ['token.json', '--register', 'register.json', '--transfers', 'transfers.json'];

// The time a hostile test may take: four times as long when the runner collects coverage, which sets NODE_V8_COVERAGE.
export const allowed = (ms) => (process.env.NODE_V8_COVERAGE ? ms * 4 : ms);
