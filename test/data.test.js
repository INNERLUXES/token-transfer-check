import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEST, NOT_A, NOTICE, POINTS, REGISTRY_CODES, RULES, SOURCES, UN_CODES, flat, grouped, listText, plural, pointPage, safeText, source } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const read = (rel) => readFile(resolve(root, rel), 'utf8');
const norm = (t) => t.replace(/\s+/g, ' ');
// The lines of a saved list after its two-line header and the line that names its columns.
const rowsOf = async (file, skip) => (await read(file)).split('\n').slice(skip).filter(Boolean).map((l) => l.split(' | '));

const PLACES = /^https:\/\/(?:eips\.ethereum\.org\/EIPS\/eip-(?:3643|20)|www\.ecfr\.gov\/current\/title-17\/section-230\.144|unstats\.un\.org\/unsd\/methodology\/m49\/overview\/|www\.swift\.com\/swift-resource\/11971\/download|ethereum\.org\/en\/developers\/docs\/accounts\/)$/;

test('every source has an official address, and no number that reads like a year', () => {
  for (const s of SOURCES) {
    assert.match(s.url, PLACES, s.id);
    assert.doesNotMatch(s.url, /(?<!(?:EIP|ERC)[- ]?)\b(?:19|20)\d{2}\b/i, s.id);
    assert.ok(s.title.length > 5);
  }
  assert.equal(new Set(SOURCES.map((s) => s.id)).size, SOURCES.length);
  assert.deepEqual(SOURCES.map((s) => s.id), ['eip-3643', 'eip-20', 'ecfr-144', 'un-m49', 'swift-iban-registry', 'ethereum-accounts']);
  assert.equal(NOTICE, `This report is an input to a review before the transfers reach the chain: ${NOT_A}.`);
  assert.match(NOT_A, /^not legal advice/);
});

test('every source has a text copy under research/sources that starts with its address, and research/sources.md lists it', async () => {
  const notes = await read('research/sources.md');
  for (const s of SOURCES) {
    const copy = await read(s.file);
    assert.ok(copy.startsWith(`Source: ${s.url}\n`), s.file);
    assert.ok(copy.length > 1500, `${s.file} holds the page`);
    assert.ok(notes.includes(s.url), `research/sources.md lists ${s.id}`);
    assert.ok(notes.includes(s.file), `research/sources.md names ${s.file}`);
  }
});

test('every point belongs to a listed source, is written in a sentence of its own and is not a long quotation of its page', async () => {
  for (const [id, p] of Object.entries(POINTS)) {
    const page = source(p.source);
    assert.ok(page, `${id}: the source ${p.source}`);
    assert.equal(pointPage(id), page);
    assert.ok(p.text.length > 40 && p.text.length < 400, id);
    assert.match(p.text, /\.$/, id);
    const copy = norm(await read(page.file));
    // No run of 12 words of the point appears word for word in its page.
    const words = norm(p.text).split(' ');
    for (let i = 0; i + 12 <= words.length; i += 1) assert.ok(!copy.includes(words.slice(i, i + 12).join(' ')), `${id} quotes its page`);
  }
});

test('every point is used by a rule, and every basis of a rule is a point', () => {
  const used = new Set(RULES.flatMap((r) => r.basis));
  for (const id of Object.keys(POINTS)) assert.ok(used.has(id), `${id} is not used by a rule`);
  for (const id of used) assert.ok(Object.hasOwn(POINTS, id), `${id} is not a point`);
});

test('docs/rules-and-sources.md lists every page with its copy and every check with its level, kind and points', async () => {
  const doc = await read('docs/rules-and-sources.md');
  for (const s of SOURCES) assert.ok(doc.includes(s.url) && doc.includes(s.file), s.id);
  for (const r of RULES) {
    const section = doc.split(/^## /m).find((p) => p.startsWith(`${r.id}\n`));
    assert.ok(section, r.id);
    assert.ok(section.includes(`- Level: ${r.severity}`), r.id);
    assert.ok(section.includes('- Cannot see: '), r.id);
    for (const b of r.basis) assert.ok(section.includes(POINTS[b].text), `${r.id}: ${b}`);
    if (r.kind === 'best practice') assert.ok(norm(section).includes(BEST), r.id);
    if (r.own) assert.ok(section.includes(r.own), `${r.id}: its own choice`);
  }
});

test('the documented checks name a page, the best practice checks say what is their own choice, and the input checks rest on no page', () => {
  for (const r of RULES.filter((x) => x.kind === 'documented')) {
    assert.ok(r.basis.length > 0, r.id);
    assert.equal(r.own, undefined, r.id);
  }
  for (const r of RULES.filter((x) => x.kind === 'best practice')) assert.ok(r.own && r.own.includes(BEST), `${r.id} says what is its own choice`);
  for (const r of RULES.filter((x) => x.kind === 'input')) assert.deepEqual(r.basis, [], r.id);
});

test('the pages say what the documented checks rest on', async () => {
  const erc = norm(await read('research/sources/eip-3643-t-rex.txt'));
  for (const s of [
    '**MUST** define an Agent role and an Owner (token issuer) role',
    '**MUST** be able to force transfers from an Agent wallet',
    '**MUST** have a recovery system in case an investor loses access to his private key',
    '**MUST** be able to freeze tokens on the wallet of investors if needed, partially or totally',
    '**MUST** have the possibility to pause the token',
    "The sender **MUST** hold enough free balance (total balance - frozen tokens, if any)",
    'The receiver **MUST** be whitelisted on the Identity Registry and verified (hold the necessary claims on his onchain Identity)',
    "The sender's wallet **MUST NOT** be frozen",
    "The receiver's wallet **MUST NOT** be frozen",
    'there is a fixed maximum number of token holders to respect (can be a limited number of holders per country as well)',
    'check if the transfer respects rules setting a maximum amount of tokens per investor',
    'This country code is set in accordance with the ISO-3166 standard.',
    'the accepted countries for the circulation of the token',
    'to manage supply, transfer rules, lockups, and any other requirements in the management of a security',
    'a cap on the percentage held by any single investor',
    'only the agent(s) can add or remove identities in the registry'
  ]) assert.ok(erc.includes(s), s);
  assert.ok(erc.includes('status: Final'), 'ERC-3643 is final');
  const erc20 = norm(await read('research/sources/eip-20-token-standard.txt'));
  assert.ok(erc20.includes('Returns the number of decimals the token uses - e.g. `8`, means to divide the token amount by `100000000` to get its user representation.'));
  assert.ok(erc20.includes('Returns the total token supply.'));
  assert.ok(erc20.includes("The function SHOULD `throw` if the message caller's account balance does not have enough tokens to spend."));
  assert.ok(erc20.includes('Transfers of 0 values MUST be treated as normal transfers'));
  const rule = norm(await read('research/sources/ecfr-17-cfr-230-144-d.txt'));
  assert.ok(rule.includes('(d) Holding period for restricted securities.'));
  assert.ok(rule.includes('a minimum of six months must elapse between the later of the date of the acquisition of the securities from the issuer'));
  assert.ok(rule.includes('a minimum of one year must elapse between the later of the date of the acquisition of the securities from the issuer'));
  assert.ok(rule.includes('for a period of at least 90 days immediately before the sale'));
  assert.ok(rule.includes('not legal advice'), 'the header of the copy says it is an example');
  const m49 = await read('research/sources/un-m49-country-codes.txt');
  assert.ok(m49.includes('Country or Area | M49 Code | ISO-alpha2 Code | ISO-alpha3 Code'));
  assert.ok(m49.includes('United Kingdom of Great Britain and Northern Ireland | 826 | GB | GBR'));
  assert.ok(!m49.includes('| TW |'), 'the UN table lists no code for Taiwan');
  assert.ok(!m49.includes('| XK |'), 'the UN table lists no code for Kosovo');
  const registry = await read('research/sources/swift-iban-registry.txt');
  for (const code of REGISTRY_CODES) assert.match(registry, new RegExp(`^Kosovo \\| ${code} \\|`, 'm'));
  const eth = norm(await read('research/sources/ethereum-org-accounts.txt'));
  assert.ok(eth.includes('This means an Externally owned account (EOA) has a 42-character address (20-byte segment which is 40 hexadecimal characters plus the `0x` prefix).'));
});

test('the copies of the ERC pages leave out the authors and the line of the day the page was created', async () => {
  for (const file of ['research/sources/eip-3643-t-rex.txt', 'research/sources/eip-20-token-standard.txt']) {
    const copy = await read(file);
    assert.doesNotMatch(copy, /^(?:author|created):/m, file);
    assert.match(copy, /^status: Final$/m, file);
  }
});

test('the country codes are the ISO alpha-2 codes of the saved copy of the UN table, in order', async () => {
  const rows = await rowsOf('research/sources/un-m49-country-codes.txt', 7);
  assert.deepEqual(UN_CODES, rows.map((r) => r[2]).sort());
});

test('size helpers: grouped numbers, lists for a sentence and plurals', () => {
  assert.equal(grouped(12345), '12,345');
  assert.equal(grouped(10n ** 12n), '1,000,000,000,000');
  assert.equal(listText(['a']), 'a');
  assert.equal(listText(['a', 'b']), 'a and b');
  assert.equal(listText(['a', 'b', 'c']), 'a, b and c');
  assert.equal(listText(['a', 'b', 'c', 'd', 'e'], 3), 'a, b, c and 2 more');
  assert.equal(plural(1, 'line'), '1 line');
  assert.equal(plural(2, 'holder'), '2 holders');
});

test('text helpers: safeText replaces control, direction and separator characters and caps the length; flat folds white space', () => {
  const bad = ['a', String.fromCharCode(0x1b), '[31m', String.fromCharCode(0x202e), 'b', String.fromCharCode(0x2028), 'c', String.fromCharCode(7), 'd', String.fromCharCode(0x85), 'e'].join('');
  const out = safeText(bad);
  assert.ok(![...out].some((c) => c.charCodeAt(0) < 32 || [0x202e, 0x2028, 0x85].includes(c.charCodeAt(0))));
  assert.equal(safeText('x'.repeat(50), 10), 'xxxxxxx...');
  assert.equal(safeText('short', 10), 'short');
  assert.equal(flat('  a \n  b\t c '), 'a b c');
});
