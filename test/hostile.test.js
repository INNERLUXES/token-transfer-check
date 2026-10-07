import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { JSON_LIMITS, REGISTER_LIMITS, TRANSFER_LIMITS, checkTexts } from '../src/index.js';
import { ARGS, GOOD, addr, allowed, cli, config, csvText, holder, run, text, texts, transfer, withFiles } from './helpers.js';

// Each test builds input meant to make the tool slow or to exhaust the stack or the memory, and checks that it ends with
// an answer in good time. The time allowed is four times as long under coverage (NODE_V8_COVERAGE is set only when
// coverage is on).

function timed(fn) {
  const start = process.hrtime.bigint();
  const value = fn();
  return { value, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}

// A made-up address for a number: 0x and the number in hex, padded with zeros to 40 digits.
const nth = (i) => `0x${(i + 1).toString(16).padStart(40, '0')}`;

test('the most holders and transfers the files may hold, as CSV, each transfer checked against the state, in good time', () => {
  const n = REGISTER_LIMITS.maxHolders;
  const holders = Array.from({ length: n }, (_, i) => holder({ address: nth(i), balance: i < 1000 ? '1' : '0' }));
  const transfers = Array.from({ length: TRANSFER_LIMITS.maxTransfers }, (_, i) => transfer({ id: `T${i}`, from: nth(i % 1000), to: nth(1000 + (i % 99000)), amount: '1', day: 200 + (i % 7) }));
  const cfg = config({ token: { totalSupply: '1000' }, compliance: { maxHolders: 1000000, maxHoldersPerCountry: undefined } });
  const { value, ms } = timed(() => checkTexts(texts({ cfg, holders: { text: csvText(holders), format: 'csv' }, transfers: { text: csvText(transfers), format: 'csv' } })));
  assert.equal(value.read.holders.length, n);
  assert.equal(value.analysis.summary.made, 1000, 'each of the thousand holders sends its one token once');
  assert.equal(value.findings.filter((f) => f.id === 'balance-insufficient').length, TRANSFER_LIMITS.maxTransfers - 1000);
  assert.ok(ms < allowed(30000), `took ${ms} ms`);
});

test('deep nesting ends with a file-unreadable finding at the limit, never a stack overflow, and the secret scan does not recurse', () => {
  const deep = `${'['.repeat(100000)}${']'.repeat(100000)}`;
  const { value } = timed(() => checkTexts({ config: { text: deep } }));
  assert.equal(value.findings[0].id, 'file-unreadable');
  assert.match(value.findings[0].message, new RegExp(`nested more than ${JSON_LIMITS.maxDepth} deep`));
  const nested = `{"notes": ${'['.repeat(JSON_LIMITS.maxDepth - 1)}"x"${']'.repeat(JSON_LIMITS.maxDepth - 1)}, "holders": []}`;
  assert.ok(checkTexts(texts({ holders: { text: nested, format: 'json' } })).findings.some((f) => f.id === 'field-missing'));
  const keyed = `{"privateKey": ${'{"a": '.repeat(JSON_LIMITS.maxDepth - 1)}1${'}'.repeat(JSON_LIMITS.maxDepth - 1)}}`;
  assert.equal(checkTexts({ config: { text: keyed } }).findings.filter((f) => f.id === 'secret-in-file').length, 1);
});

test('amounts with thousands of digits, and numbers with a huge exponent, are refused, not worked out', () => {
  const huge = `1${'0'.repeat(5000)}`;
  const { value, ms } = timed(() => checkTexts(texts({ cfg: config({ token: { totalSupply: huge }, compliance: { maxHolding: huge } }), transfers: [transfer({ amount: huge })] })));
  assert.ok(value.findings.some((f) => f.id === 'amount-invalid' && f.file === 'config'));
  assert.ok(value.findings.some((f) => f.id === 'amount-invalid' && f.file === 'transfers'));
  assert.ok(value.findings.some((f) => f.id === 'field-invalid' && /maxHolding/.test(f.message)));
  assert.ok(value.findings.every((f) => f.message.length < 700));
  assert.ok(ms < allowed(3000), `took ${ms} ms`);
  const exp = checkTexts(texts({ transfers: { text: text({ transfers: [transfer({ amount: 1 })] }).replace('"amount": 1', '"amount": 1e999999'), format: 'json' } }));
  assert.ok(exp.findings.some((f) => f.id === 'amount-invalid'));
  const days = checkTexts(texts({ transfers: [transfer({ day: Number.MAX_SAFE_INTEGER })] }));
  assert.ok(days.findings.some((f) => f.id === 'field-invalid' && /day of transfer T-1/.test(f.message)));
});

test('long strings, long names and long fields are read in good time, and the messages stay short', () => {
  const long = config({ token: { name: 'n'.repeat(200000) } });
  const { value, ms } = timed(() => checkTexts(texts({ cfg: long, transfers: [transfer({ id: 'i'.repeat(200000) })] })));
  assert.deepEqual(value.findings, []);
  assert.ok(ms < allowed(5000), `took ${ms} ms`);
  const wide = checkTexts(texts({ transfers: [transfer({ to: `0x${'1'.repeat(200000)}` })] }));
  const f = wide.findings.find((x) => x.id === 'address-malformed');
  assert.ok(f.message.length < 600);
  const csv = timed(() => checkTexts(texts({ holders: { text: `address,notes\n${addr()},"${'q'.repeat(90000)}"\n`, format: 'csv' } })));
  assert.ok(csv.ms < allowed(3000), `took ${csv.ms} ms`);
  assert.equal(checkTexts(texts({ holders: { text: `address\n"${'q'.repeat(200000)}"\n`, format: 'csv' } })).findings[0].id, 'file-unreadable');
});

test('names such as __proto__, constructor and toString are only names', () => {
  const cfgText = text(config()).replace('"token": {', '"__proto__": {"polluted": 1}, "hasOwnProperty": 2, "token": {').replace('"US": 5', '"US": 5, "__proto__": 2, "constructor": 3');
  const { value } = timed(() => checkTexts(texts({ cfg: cfgText })));
  assert.ok(value.findings.some((f) => f.id === 'field-unknown' && /"__proto__"/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'field-unknown' && /"hasOwnProperty"/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'country-unknown' && /"__proto__"/.test(f.message)));
  assert.ok(value.findings.some((f) => f.id === 'country-unknown' && /"constructor"/.test(f.message)));
  assert.equal({}.polluted, undefined);
  const csv = checkTexts(texts({ holders: { text: csvText([{ ...holder(), __proto__x: 1 }]).replace('__proto__x', '__proto__'), format: 'csv' } }));
  assert.ok(csv.findings.some((f) => f.id === 'field-unknown' && /"__proto__"/.test(f.message)));
  const cls = checkTexts(texts({ holders: [holder({ investorClass: 'toString' })] }));
  assert.ok(cls.findings.some((f) => f.id === 'field-invalid' && /"toString", which is not a class/.test(f.message)));
});

test('a run leaves the folder as it was: the tool writes nothing', async () => {
  await withFiles(GOOD, async (dir) => {
    const before = (await readdir(dir, { recursive: true })).sort();
    await cli([...ARGS, '--format', 'sarif'], dir);
    await cli([...ARGS, '--json', '--explain'], dir);
    assert.deepEqual((await readdir(dir, { recursive: true })).sort(), before);
  });
  assert.equal((await run(GOOD, ARGS)).code, 0);
});
