import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from '../src/index.js';
import { BAD, EXPECTED, GOOD, GOOD_EXPECTED, UNWANTED, run } from '../tools/example.mjs';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');
const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');
const BAD_FILES = ['examples/bad/config.json', 'examples/bad/register.csv', 'examples/bad/transfers.json'];
const GOOD_FILES = ['examples/good/config.json', 'examples/good/register.csv', 'examples/good/transfers.csv'];

test('examples: the bad token fails with the report that is saved in examples/output', async () => {
  const r = await run(BAD);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('bad.txt'));
  for (const e of EXPECTED) assert.ok(r.out.includes(e), e);
  for (const u of UNWANTED) assert.ok(!r.out.includes(u), u);
});

test('examples: the good token passes at error, warning and info level with the report that is saved', async () => {
  const r = await run(GOOD);
  assert.equal(r.code, 0);
  assert.equal(r.out, await saved('good.txt'));
  for (const e of GOOD_EXPECTED) assert.ok(r.out.includes(e), e);
  assert.equal((await run([...GOOD, '--fail-on', 'warning'])).code, 0);
  assert.equal((await run([...GOOD, '--fail-on', 'info'])).code, 0);
  assert.doesNotMatch(r.out, /ERROR {4}|WARNING {2}/);
});

test('examples: every output saved in examples/output is the real output, in all four formats for both tokens', async () => {
  const outputs = {
    'bad-explain.txt': [...BAD, '--explain'],
    'bad.md': [...BAD, '--format', 'markdown'],
    'bad-explain.md': [...BAD, '--format', 'markdown', '--explain'],
    'bad.json': [...BAD, '--json', '--explain'],
    'bad.sarif': [...BAD, '--format', 'sarif'],
    'good.md': [...GOOD, '--format', 'markdown'],
    'good.json': [...GOOD, '--json'],
    'good.sarif': [...GOOD, '--format', 'sarif'],
    'checks.txt': ['--list-checks'],
    'checks.json': ['--list-checks', '--format', 'json']
  };
  for (const [name, args] of Object.entries(outputs)) assert.equal((await run(args)).out, await saved(name), name);
});

test('examples: every check but three fires on the bad token, each on the line built for it', async () => {
  const report = JSON.parse((await run([...BAD, '--json'])).out);
  const lines = {};
  for (const f of BAD_FILES) lines[f] = (await readFile(resolve(root, f), 'utf8')).split('\n');
  const at = (file, needle, n = 1) => {
    let seen = 0;
    for (let i = 0; i < lines[file].length; i += 1) if (lines[file][i].includes(needle) && (seen += 1) === n) return `${file}:${i + 1}`;
    throw new Error(`${needle} x${n}`);
  };
  const [C, R, T] = BAD_FILES;
  const of = (id) => report.findings.filter((f) => f.id === id).map((f) => f.at).sort();
  const sorted = (...a) => a.sort();
  assert.deepEqual(of('field-duplicate'), [`${R}:1`]);
  assert.deepEqual(of('secret-in-file'), [at(C, '"seedPhrase"')]);
  assert.deepEqual(of('field-unknown'), [at(T, '"note"')]);
  assert.deepEqual(of('field-invalid'), [at(R, 'founders')]);
  assert.deepEqual(of('field-missing'), sorted(at(R, '12.5'), at(T, 'T-15')));
  assert.deepEqual(of('agent-single-key'), [at(C, '"agents"')]);
  assert.deepEqual(of('pause-missing'), [at(C, '"pausable"')]);
  assert.deepEqual(of('recovery-missing'), [at(C, '"recovery"')]);
  assert.deepEqual(of('standard-unknown'), [at(C, '"standard"')]);
  assert.deepEqual(of('country-unknown'), sorted(at(C, '"allowedCountries"'), at(R, ',TW,')));
  assert.deepEqual(of('address-malformed'), sorted(at(R, '0x1234,'), at(T, '"0x12345"')));
  assert.deepEqual(of('amount-decimals'), sorted(at(R, '12.5'), at(T, '"2.5"')));
  assert.deepEqual(of('amount-invalid'), [at(T, '"T-11"')]);
  assert.deepEqual(of('holder-duplicate'), [at(R, 'the first row again')]);
  assert.deepEqual(of('investor-claims-missing'), sorted(at(R, ',DE,reg-s,KYC,8000'), at(T, '"T-07"'), at(T, '"T-08"')));
  assert.deepEqual(of('investor-country-not-allowed'), sorted(at(R, ',FR,'), at(T, '"T-09"')));
  assert.deepEqual(of('holder-limit'), [at(T, '"T-02"')]);
  assert.deepEqual(of('country-holder-limit'), [at(T, '"T-02"')]);
  assert.deepEqual(of('holding-above-cap'), sorted(at(R, ',25000,'), at(T, '"T-06"')));
  assert.deepEqual(of('supply-mismatch'), [at(C, '"totalSupply"')]);
  assert.deepEqual(of('transfer-id-duplicate'), [at(T, '"T-03"', 2)]);
  assert.deepEqual(of('address-frozen'), sorted(at(T, '"T-03"'), at(T, '"T-04"')));
  assert.deepEqual(of('balance-insufficient'), [at(T, '"T-05"')]);
  assert.deepEqual(of('transfer-in-lockup'), [at(T, '"T-01"')]);
  // The configuration has an agent, so agent-missing cannot fire next to agent-single-key; forced transfers are on, so
  // that one key holds them; and every file can be read. The tests of test/rules.test.js and test/config.test.js cover
  // those.
  assert.deepEqual(report.rules.filter((r) => r.findings === 0).map((r) => r.id), ['file-unreadable', 'agent-missing', 'forced-transfer-missing']);
  assert.equal(report.rules.length, RULES.length);
});

test('examples: the good token holds no finding, and the table of countries is the one of its files', async () => {
  const report = JSON.parse((await run([...GOOD, '--json'])).out);
  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.countries.map((r) => r.country), ['CH', 'DE', 'GB', 'SG', 'US']);
  assert.deepEqual(report.summary, { holders: 8, holding: 6, sumOfBalances: '50000', transfers: 4, made: 4, holdingAfter: 8 });
  assert.equal(report.token.standard, 'ERC-3643');
  assert.deepEqual([report.inputs.register.format, report.inputs.transfers.format], ['csv', 'csv']);
});

test('examples: the same files written with CRLF line ends and as UTF-16 give the same findings', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'token-transfer-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    for (const [files, args] of [[BAD_FILES, BAD], [GOOD_FILES, GOOD]]) {
      const ids = async () => JSON.parse((await run([...args, '--json'], dir)).out).findings.map((f) => `${f.id}:${f.at}:${f.column}`);
      const base = await ids();
      for (const file of files) {
        const text = await readFile(resolve(root, file), 'utf8');
        await writeFile(resolve(dir, file), text.split('\n').join('\r\n'));
        assert.deepEqual(await ids(), base, `${file} with CRLF`);
        await writeFile(resolve(dir, file), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
        assert.deepEqual(await ids(), base, `${file} as UTF-16`);
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('examples: the files are plain ASCII with LF line ends, made up, hold no real key, and every address is one character written many times', async () => {
  for (const f of [...BAD_FILES, ...GOOD_FILES]) {
    const text = await readFile(resolve(root, f), 'utf8');
    assert.ok([...text].every((c) => c.charCodeAt(0) < 128), f);
    assert.ok(!text.includes('\r'), f);
    assert.doesNotMatch(text, /\b(?:19|20)\d{2}\b/, f);
    assert.match(text, /[Mm]ade-up .* for the examples of token-transfer-check/, f);
    for (const m of text.matchAll(/\b0x[0-9a-fA-F]+\b/g)) assert.match(m[0], /^0x(.)\1*$|^0x1234$|^0x12345$/, m[0]);
  }
  const config = await readFile(resolve(root, 'examples/bad/config.json'), 'utf8');
  assert.match(config, /nothing here is legal advice/);
  for (const o of ['bad.txt', 'bad.json', 'bad.md', 'bad.sarif', 'bad-explain.txt', 'bad-explain.md']) assert.ok(!(await saved(o)).includes('lantern'), `${o} does not show the seed`);
});

test('examples: the sample output of the bad token is the one the README shows', async () => {
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const bad = (await saved('bad.txt')).split('\n');
  assert.ok(readme.includes(bad.slice(0, bad.findIndex((l) => l.startsWith('Findings ('))).join('\n')));
  assert.ok(readme.includes(bad.slice(-7).join('\n')));
});
