import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLASS_KEYS, COMPLIANCE_KEYS, CONFIG_LIMITS, CONTROL_KEYS, ROLE_KEYS, STANDARD_NAMES, TOKEN_KEYS, TOP_KEYS, checkTexts, describe, isKnownStandard, readConfig, readJson, suggestKey } from '../src/index.js';
import { config, findingsOf, idsOf, lineOf, text, texts } from './helpers.js';

const readOf = (cfg) => readConfig(readJson(text(cfg)));
const only = (cfg) => checkTexts(texts({ cfg, holders: null })).findings;

test('readConfig: every part and field of a clean configuration, with the line of each', () => {
  const cfg = config();
  const r = readOf(cfg);
  assert.deepEqual(r.findings, []);
  const c = r.config;
  assert.deepEqual([c.token.name, c.token.symbol, c.token.standard, c.token.decimals, c.token.supply.text], ['Harbor Example Tower Token', 'HXT', 'ERC-3643', 0, '1000']);
  assert.deepEqual(c.compliance.countries.map((x) => x.value), ['US', 'GB', 'DE']);
  assert.deepEqual(c.compliance.claims, ['KYC']);
  assert.equal(c.compliance.maxHolders, 10);
  assert.deepEqual(c.compliance.perCountry.map((p) => [p.code, p.limit]), [['US', 5]]);
  assert.deepEqual(c.compliance.cap, { kind: 'percent', value: { int: 50n, scale: 0 }, text: '50%' });
  assert.deepEqual(c.compliance.classes.map((x) => [x.name, x.key, x.lockupDays]), [['reg-d', 'reg-d', 100]]);
  assert.equal(c.roles.agents.length, 1);
  assert.equal(c.roles.multisig, true);
  assert.deepEqual([c.controls.pausable, c.controls.forcedTransfer, c.controls.recovery], [true, true, true]);
  assert.equal(c.token.supplyEntry.line, lineOf(text(cfg), '"totalSupply"'));
  assert.deepEqual(only(cfg), []);
});

test('readConfig: a top level that is not an object, and a part that is not an object, are findings', () => {
  const r = readConfig(readJson('[1]'));
  assert.equal(r.config, null);
  assert.deepEqual(r.findings.map((f) => f.id), ['file-unreadable']);
  assert.match(r.findings[0].message, /^The top level of the configuration is a list, not an object/);
  const part = only({ ...config(), roles: 'agents' });
  assert.deepEqual(part.map((f) => f.id), ['field-invalid']);
  assert.match(part[0].message, /^The roles of the configuration is text; it must be an object with the owner, the agents/);
});

test('field-missing: each part and each field the checks need, with the part or the field named', () => {
  assert.deepEqual(only(config({ token: undefined })).map((f) => f.message), ['The configuration has no token.']);
  assert.deepEqual(only(config({ compliance: undefined })).map((f) => f.message), ['The configuration has no compliance.']);
  assert.deepEqual(only(config({ controls: undefined })).map((f) => f.message), ['The configuration has no controls.']);
  for (const key of ['name', 'symbol', 'standard', 'decimals', 'totalSupply']) assert.deepEqual(only(config({ token: { [key]: undefined } })).map((f) => [f.id, f.message]), [['field-missing', `The token has no ${key}.`]], key);
  for (const key of ['allowedCountries', 'requiredClaims']) assert.deepEqual(only(config({ compliance: { [key]: undefined } })).map((f) => [f.id, f.message]), [['field-missing', `The compliance has no ${key}.`]], key);
  for (const key of ['pausable', 'forcedTransfer', 'recovery']) assert.deepEqual(only(config({ controls: { [key]: undefined } })).map((f) => [f.id, f.message]), [['field-missing', `The controls has no ${key}.`]], key);
  assert.deepEqual(only(config({ roles: { owner: undefined } })).map((f) => f.message), ['The roles has no owner.']);
  const noRoles = only(config({ roles: undefined }));
  assert.deepEqual(noRoles.map((f) => f.id), ['field-missing'], 'with no roles there is no agent-missing either');
  assert.deepEqual(only(config({ compliance: { maxHolders: undefined, maxHoldersPerCountry: undefined, maxHolding: undefined } })), [], 'the limits are optional');
});

test('field-missing: an investor class with no name or no lockupDays', () => {
  const f = only(config({ compliance: { investorClasses: [{ lockupDays: 10 }, { name: 'reg-s' }] } }));
  assert.deepEqual(f.map((x) => x.message), ['An investor class has no name.', 'The investor class reg-s has no lockupDays.']);
});

test('field-invalid: values of the wrong type or form, each at its line', () => {
  const cases = [
    [{ token: { decimals: '6' } }, /^The decimals of the token is "6"; it must be a whole number of decimal places from 0 to 36, written as a number\.$/],
    [{ token: { decimals: 37 } }, /from 0 to 36/],
    [{ token: { decimals: 1.5 } }, /the number 1\.5; it must be a whole number/],
    [{ token: { name: 7 } }, /^The name of the token is the number 7; it must be text\.$/],
    [{ token: { totalSupply: true } }, /^The totalSupply of the token is true; it must be a decimal number/],
    [{ compliance: { allowedCountries: 'US' } }, /^The allowedCountries of the compliance is text; it must be a list of texts\.$/],
    [{ compliance: { allowedCountries: ['US', 7] } }, /An item of the allowedCountries of the compliance is the number 7/],
    [{ compliance: { allowedCountries: ['US', 'US'] } }, /^The allowedCountries name US twice; the second was left out\.$/],
    [{ compliance: { maxHolders: 0 } }, /maxHolders of the compliance is the number 0; it must be a whole number of holders from 1 to 1000000000/],
    [{ compliance: { maxHoldersPerCountry: { US: -1 } } }, /The US of the maxHoldersPerCountry is the number -1/],
    [{ compliance: { maxHoldersPerCountry: ['US'] } }, /maxHoldersPerCountry of the compliance is a list; it must be an object/],
    [{ compliance: { maxHolding: '0%' } }, /^The maxHolding of the compliance is "0%"; it must be an amount above 0/],
    [{ compliance: { maxHolding: '101%' } }, /"101%"/],
    [{ compliance: { maxHolding: '1e3' } }, /"1e3"/],
    [{ compliance: { maxHolding: [] } }, /maxHolding of the compliance is a list; it must be an amount such as 5000 or a percent/],
    [{ compliance: { investorClasses: {} } }, /investorClasses of the compliance are an object; they must be a list of objects/],
    [{ compliance: { investorClasses: ['reg-d'] } }, /^An investor class is text; it must be an object/],
    [{ compliance: { investorClasses: [{ name: 'reg-d', lockupDays: 10 }, { name: 'REG-D', lockupDays: 20 }] } }, /^The investor class REG-D is named twice; the second was left out\.$/],
    [{ compliance: { investorClasses: [{ name: 'reg-d', lockupDays: '365' }] } }, /lockupDays of the investor class reg-d is "365"; it must be a whole number of days from 0 to 100000/],
    [{ roles: { multisig: 'yes' } }, /^The multisig of the roles is "yes"; it must be true or false\.$/],
    [{ roles: { agents: 'b' } }, /^The agents of the roles is text; it must be a list of texts\.$/],
    [{ controls: { pausable: 1 } }, /^The pausable of the controls is the number 1; it must be true or false\.$/]
  ];
  for (const [over, pattern] of cases) {
    const f = only(config(over)).filter((x) => x.id === 'field-invalid');
    assert.equal(f.length, 1, JSON.stringify(over));
    assert.match(f[0].message, pattern, JSON.stringify(over));
  }
  const percent = readOf(config({ compliance: { maxHolding: '4.99%' } })).config.compliance.cap;
  assert.deepEqual([percent.kind, percent.text], ['percent', '4.99%']);
  assert.equal(readOf(config({ compliance: { maxHolding: '100%' } })).config.compliance.cap.kind, 'percent');
  assert.equal(readOf(config({ compliance: { maxHolding: 2500 } })).config.compliance.cap.kind, 'amount');
});

test('field-unknown: a misspelt key at every level, with the key it is probably meant to be', () => {
  const f = only({ ...config({ token: { decimal: 0 }, compliance: { maxHolder: 5 }, roles: { agent: [] }, controls: { Pausable: true } }), extra: 1 });
  const unknown = f.filter((x) => x.id === 'field-unknown').map((x) => x.message);
  assert.equal(unknown.length, 5);
  assert.ok(unknown.some((m) => /^The key "decimal" of the token is not one the tool reads, so its value was left out of every check\. Did you mean "decimals"\?/.test(m)));
  assert.ok(unknown.some((m) => /"maxHolder" of the compliance .* Did you mean "maxHolders"\?/.test(m)));
  assert.ok(unknown.some((m) => /"agent" of the roles .* Did you mean "agents"\?/.test(m)));
  assert.ok(unknown.some((m) => /"Pausable" of the controls .* Did you mean "pausable"\?/.test(m)));
  assert.ok(unknown.some((m) => /^The key "extra" of the configuration is not one the tool reads/.test(m)));
  assert.equal(suggestKey('xy', TOP_KEYS), null, 'a key of fewer than three letters gets no suggestion');
  assert.equal(suggestKey('MAX_HOLDERS', COMPLIANCE_KEYS), 'maxHolders');
});

test('the lists of keys, the standard names and the limits', () => {
  assert.deepEqual(TOP_KEYS, ['token', 'compliance', 'roles', 'controls', 'notes']);
  for (const list of [TOKEN_KEYS, COMPLIANCE_KEYS, CLASS_KEYS, ROLE_KEYS, CONTROL_KEYS]) assert.ok(list.includes('notes'));
  for (const s of ['ERC-3643', 'erc3643', 'EIP-3643', 'T-REX', 'ERC 3643']) assert.ok(isKnownStandard(s), s);
  for (const s of ['ERC-1400', 'ERC-20', 'ERC-3643x', '']) assert.ok(!isKnownStandard(s), s);
  assert.ok(STANDARD_NAMES.includes('erc-3643'));
  assert.equal(CONFIG_LIMITS.maxDecimals, 36);
  assert.equal(describe({ kind: 'null' }), 'null');
  assert.equal(describe({ kind: 'string', secret: true }), 'a value that is not shown');
});

test('a configuration that is not JSON is one file-unreadable finding, and the register is then checked for its form only', () => {
  const r = checkTexts(texts({ cfg: '{"token": {,}}' }));
  assert.deepEqual(r.findings.map((f) => [f.id, f.file]), [['file-unreadable', 'config']]);
  assert.match(r.findings[0].message, /^The configuration is not JSON the reader can follow: expected a key in double quotes and found "," at line 1, column 12\. Nothing in the file was checked\.$/);
  assert.ok(r.notes.includes('the rules of the token could not be read, so the register and the transfers were checked for their form and against each other only'));
  assert.deepEqual(idsOf({ cfg: '[]', holders: [{ address: '0x12', country: 'US', balance: '1' }] }), ['file-unreadable', 'address-malformed']);
  assert.deepEqual(findingsOf({ cfg: '{"token": 1, "token": 2}' }).map((f) => f.id), ['file-unreadable']);
});
