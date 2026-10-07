import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SECRET_KEYS, checkTexts, findSecrets, isSecretKey, readJson, secretShape } from '../src/index.js';
import { ARGS, GOOD, HOLDERS, addr, config, csvText, findingsOf, lineOf, run, text, texts, transfer } from './helpers.js';

// Shapes built from repeated characters, so that no file of the repository holds anything that could be a real seed or
// key.
const MNEMONIC = Array.from({ length: 12 }, () => 'lantern').join(' ');
const MNEMONIC_24 = Array.from({ length: 24 }, (_, i) => (i % 2 ? 'harbor' : 'lantern')).join(' ');
const XPRV = `x${'prv'}${'9'.repeat(107)}`;
const HEX = `0x${'ab'.repeat(32)}`;
const WIF = `5${'H'.repeat(50)}`;

test('secretShape: a mnemonic of 12 to 24 words, an extended private key, a key in hex and a key in WIF', () => {
  assert.equal(secretShape(MNEMONIC), 'a mnemonic');
  assert.equal(secretShape(MNEMONIC_24), 'a mnemonic');
  assert.equal(secretShape(`  ${MNEMONIC}  `), 'a mnemonic');
  assert.equal(secretShape(XPRV), 'an extended private key');
  assert.equal(secretShape(HEX), 'a private key in hex');
  assert.equal(secretShape(HEX.slice(2)), 'a private key in hex');
  assert.equal(secretShape(WIF), 'a private key in WIF');
  assert.equal(secretShape(`K${'z'.repeat(51)}`), 'a private key in WIF');
});

test('secretShape: addresses, names, claims and other near misses are not secrets', () => {
  for (const ok of [addr(), addr('ab'), 'Harbor Example Tower Token', 'harbor example tower token', `0x${'ab'.repeat(31)}`, Array.from({ length: 11 }, () => 'lantern').join(' '), `x${'pub'}${'9'.repeat(107)}`, 'KYC', 'ERC-3643', '']) assert.equal(secretShape(ok), null, ok);
});

test('isSecretKey: names of keys and seeds in any case and with any separator, and near misses', () => {
  for (const k of ['privateKey', 'private_key', 'PRIVATE-KEY', 'mnemonic', 'seedPhrase', 'seed phrase', 'xprv', 'wif', 'secret', 'passphrase', 'password']) assert.ok(isSecretKey(k), k);
  for (const k of ['address', 'agents', 'owner', 'claims', 'publicKey', 'token', 'frozenTokens']) assert.ok(!isSecretKey(k), k);
  assert.ok(SECRET_KEYS.includes('privatekey'));
});

test('secret-in-file: a key named for a seed in the roles, at its line, reported once and never shown in any format', async () => {
  const cfg = config({ roles: { seedPhrase: MNEMONIC } });
  const f = findingsOf({ cfg }).filter((x) => x.id === 'secret-in-file');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /^The file holds the key "seedPhrase", which names a seed, a mnemonic or a private key\. The tool never reads one, and the value is not shown\.$/);
  assert.equal(f[0].line, lineOf(text(cfg), '"seedPhrase"'));
  assert.equal(f[0].file, 'config');
  assert.deepEqual(findingsOf({ cfg }).filter((x) => x.id === 'field-unknown'), [], 'the key is reported once, as a secret');
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const r = await run({ ...GOOD, 'token.json': text(cfg) }, [...ARGS, '--format', format]);
    assert.equal(r.code, 1, format);
    assert.ok(!r.out.includes('lantern'), format);
  }
  assert.ok(!findSecrets(readJson(text(config()))).length, 'a clean configuration has none');
});

test('secret-in-file: a value shaped like a key under any field, the field left out of the checks and never echoed', async () => {
  for (const [shape, value] of [['a mnemonic', MNEMONIC], ['an extended private key', XPRV], ['a private key in hex', HEX], ['a private key in WIF', WIF]]) {
    const holders = [{ ...HOLDERS[0], address: value, notes: value }, ...HOLDERS.slice(1)];
    const r = checkTexts(texts({ holders }));
    const secrets = r.findings.filter((f) => f.id === 'secret-in-file');
    assert.equal(secrets.length, 2, shape);
    assert.match(secrets[0].message, new RegExp(`^The value of "address" is shaped like ${shape}\\. The tool never reads a seed or a key, and the value is not shown\\.$`));
    assert.ok(!r.findings.some((f) => f.message.includes(value)), shape);
    assert.ok(!r.findings.some((f) => f.id === 'address-malformed'), `${shape}: the field is there, but not read`);
    assert.ok(!r.findings.some((f) => f.id === 'field-missing'), `${shape}: the field is there, so it is not missing either`);
    const out = await run({ ...GOOD, 'register.json': text({ holders }) }, [...ARGS, '--json', '--explain']);
    assert.ok(!out.out.includes(value), shape);
  }
});

test('secret-in-file: a key shaped like a mnemonic is not shown, and a secret in a list or under a secret key is reported once', () => {
  const r = checkTexts(texts({ cfg: { ...config(), [MNEMONIC]: 1, extra: [HEX], privateKey: { nested: XPRV } } }));
  const secrets = r.findings.filter((f) => f.id === 'secret-in-file');
  assert.equal(secrets.length, 3);
  assert.ok(secrets.some((f) => /a key shaped like a mnemonic/.test(f.message)));
  assert.ok(secrets.some((f) => /^The value of "extra" is shaped like a private key in hex/.test(f.message)));
  assert.ok(secrets.some((f) => /the key "privateKey"/.test(f.message)));
  assert.ok(!r.findings.some((f) => f.message.includes('lantern') || f.message.includes(HEX) || f.message.includes(XPRV)));
  assert.ok(r.findings.some((f) => f.id === 'field-unknown' && /"extra"/.test(f.message)), 'a list under an unknown key is still an unknown key');
});

test('secret-in-file: a secret value where an amount or the transfers belong is not described', () => {
  assert.deepEqual(checkTexts(texts({ transfers: [transfer({ amount: HEX })] })).findings.map((f) => f.id), ['secret-in-file']);
  assert.deepEqual(checkTexts(texts({ transfers: { text: text({ transfers: WIF }), format: 'json' } })).findings.map((f) => f.id), ['secret-in-file']);
});

test('secret-in-file: a CSV column named for a seed is reported once at the header, and a secret cell at its cell', async () => {
  const rows = HOLDERS.map((h, i) => ({ ...h, mnemonic: MNEMONIC, notes: i === 2 ? HEX : '' }));
  const csv = csvText(rows);
  const f = checkTexts(texts({ holders: { text: csv, format: 'csv' } })).findings;
  assert.deepEqual(f.map((x) => [x.id, x.file, x.line]), [['secret-in-file', 'register', 1], ['secret-in-file', 'register', 4]]);
  assert.match(f[0].message, /^The file holds the key "mnemonic"/);
  assert.match(f[1].message, /^The value of "notes" is shaped like a private key in hex/);
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const r = await run({ ...GOOD, 'register.csv': csv }, ['token.json', '--register', 'register.csv', '--format', format]);
    assert.ok(!r.out.includes('lantern') && !r.out.includes(HEX), format);
  }
});
