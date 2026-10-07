import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOLDER_KEYS, REGISTER_LIMITS, TRANSFER_KEYS, TRANSFER_LIMITS, checkTexts, readJson, readRegister, readTransfers, transferOrder } from '../src/index.js';
import { HOLDERS, addr, holder, lineOf, text, texts, transfer } from './helpers.js';

const reg = (holders) => checkTexts(texts({ holders })).findings;
const regOf = (obj) => checkTexts(texts({ holders: { text: text(obj), format: 'json' } })).findings;
const tr = (transfers) => checkTexts(texts({ transfers })).findings;
const trOf = (obj) => checkTexts(texts({ transfers: { text: text(obj), format: 'json' } })).findings;

test('readRegister: every field of a holder, with the line of each and the claims in capitals', () => {
  const t = text({ holders: [holder({ claims: ['kyc', 'Accreditation'], frozen: true, frozenTokens: '25', notes: 'made up' }), holder({ address: addr('2'), balance: 0 })] });
  const r = readRegister({ format: 'json', root: readJson(t) });
  assert.deepEqual(r.findings, []);
  const [a, b] = r.holders;
  assert.deepEqual([a.address, a.country, a.investorClass, a.claims, a.balance.text, a.acquiredDay, a.frozen, a.frozenTokens], [addr('1'), 'US', 'reg-d', ['KYC', 'ACCREDITATION'], '400', 0, true, { int: 25n, scale: 0 }]);
  assert.equal(a.addressEntry.line, lineOf(t, '"address"'));
  assert.deepEqual([b.balance.state, b.frozen, b.claims], ['zero', false, ['KYC']]);
  assert.deepEqual(HOLDER_KEYS, ['address', 'country', 'investorClass', 'claims', 'balance', 'acquiredDay', 'frozen', 'frozenTokens', 'notes']);
  assert.equal(REGISTER_LIMITS.maxHolders, 100000);
});

test('readRegister: a register with no holders, holders that are not a list, and a top level that is not an object', () => {
  assert.deepEqual(regOf({ notes: 'x' }).map((f) => [f.id, f.message]), [['field-missing', 'The register has no holders.']]);
  assert.deepEqual(regOf({ holders: {} }).map((f) => [f.id, f.message]), [['field-invalid', 'The holders of the register are an object; they must be a list of objects, one for each holder.']]);
  assert.deepEqual(regOf({ holders: [] }).map((f) => [f.id, f.message]), [['field-missing', 'The register holds no holder.']]);
  const top = checkTexts(texts({ holders: { text: '[]', format: 'json' } }));
  assert.deepEqual(top.findings.map((f) => [f.id, f.file]), [['file-unreadable', 'register']]);
  assert.ok(top.notes.includes('the register was not checked, because it holds no object at its top level'));
  assert.deepEqual(regOf({ holders: HOLDERS, extra: 1 }).map((f) => f.id), ['field-unknown']);
});

test('readRegister: a holder that is not an object, and the fields a holder needs', () => {
  assert.deepEqual(reg([...HOLDERS, 'x']).map((f) => [f.id, f.message]), [['field-invalid', 'Holder 5 of the register is a value; it must be an object.']]);
  const missing = reg([...HOLDERS, { investorClass: 'reg-d' }]);
  assert.deepEqual(missing.map((f) => f.message), ['Holder 5 of the register has no address.', 'Holder 5 has no country.', 'Holder 5 has no balance; write 0 for an investor who is registered and holds nothing.']);
  assert.ok(missing.every((f) => f.file === 'register' && f.id === 'field-missing'));
});

test('readRegister: values of the wrong type or form', () => {
  const cases = [
    [{ address: 7 }, /^The address of holder 1 is the number 7; it must be text\.$/],
    [{ claims: 'KYC' }, /^The claims of holder 0x1{40} is text; it must be a list of texts\.$/],
    [{ balance: [] }, /^The balance of holder 0x1{40} is a list; it must be a decimal number/],
    [{ acquiredDay: -1 }, /^The acquiredDay of holder 0x1{40} is the number -1; it must be a whole number of days from 0 to 10000000\.$/],
    [{ acquiredDay: 2.5 }, /the number 2\.5/],
    [{ frozen: 'no' }, /^The frozen of holder 0x1{40} is "no"; it must be true or false\.$/],
    [{ frozenTokens: '-5' }, /^The frozenTokens of holder 0x1{40} is "-5"; it must be a plain decimal number of 0 or more\.$/],
    [{ frozenTokens: '500' }, /^The frozenTokens of holder 0x1{40}, 500, are more than its balance of 400\.$/],
    [{ investorClass: 'reg-x' }, /^The investorClass of holder 0x1{40} is "reg-x", which is not a class of the configuration \(reg-d\)\.$/]
  ];
  for (const [over, pattern] of cases) {
    const f = reg([holder(over), ...HOLDERS.slice(1)]).filter((x) => x.id === 'field-invalid');
    assert.equal(f.length, 1, JSON.stringify(over));
    assert.match(f[0].message, pattern, JSON.stringify(over));
  }
  assert.deepEqual(reg([holder({ acquiredDay: '0' }), ...HOLDERS.slice(1)]), [], 'a day may be written as text');
  assert.deepEqual(reg([holder({ investorClass: 'REG-D' }), ...HOLDERS.slice(1)]), [], 'a class is compared without case');
});

test('readRegister: a holder with no class when the configuration gives classes, and with no acquiredDay when its class has a lock-up', () => {
  const noClass = reg([holder({ investorClass: undefined }), ...HOLDERS.slice(1)]);
  assert.deepEqual(noClass.map((f) => [f.id, f.message]), [['field-missing', `Holder ${addr('1')} has no investorClass, but the configuration gives investor classes with their lock-ups.`]]);
  const noDay = reg([holder({ acquiredDay: undefined }), ...HOLDERS.slice(1)]);
  assert.deepEqual(noDay.map((f) => [f.id, f.message]), [['field-missing', `Holder ${addr('1')} has no acquiredDay, but its class reg-d has a lock-up of 100 days, so a transfer from it cannot be checked.`]]);
  assert.deepEqual(reg(HOLDERS).filter((f) => f.id === 'field-missing'), [], 'a holder of nothing needs no acquiredDay');
});

test('readTransfers: every field of a transfer, with the line of each; an id may be a number and a day may be text', () => {
  const t = text({ transfers: [transfer(), transfer({ id: 7, day: '210' })] });
  const r = readTransfers({ format: 'json', root: readJson(t) });
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.transfers.map((x) => [x.id, x.from, x.to, x.amount.text, x.day]), [['T-1', addr('1'), addr('2'), '100', 200], ['7', addr('1'), addr('2'), '100', 210]]);
  assert.equal(r.transfers[0].dayEntry.line, lineOf(t, '"day"'));
  assert.deepEqual(TRANSFER_KEYS, ['id', 'from', 'to', 'amount', 'day', 'notes']);
  assert.equal(TRANSFER_LIMITS.maxTransfers, 100000);
});

test('readTransfers: the fields a transfer needs, a transfer that is not an object, and the keys of the file', () => {
  const f = tr([{ notes: 'x' }]);
  assert.deepEqual(f.map((x) => x.message), ['Transfer 1 has no id, so it cannot be told apart from the other transfers.', 'Transfer 1 has no from address.', 'Transfer 1 has no to address.', 'Transfer 1 has no amount.', 'Transfer 1 has no day; the lock-up is worked out from the day of the transfer, and the tool reads no clock.']);
  assert.ok(f.every((x) => x.id === 'field-missing' && x.file === 'transfers'));
  assert.deepEqual(tr([transfer({ day: '' })]).map((x) => x.message), ['Transfer T-1 has no day; the lock-up is worked out from the day of the transfer, and the tool reads no clock.']);
  assert.deepEqual(tr([[1]]).map((x) => x.message), ['Transfer 1 is a list; it must be an object.']);
  assert.deepEqual(trOf({ transfers: [] }).map((x) => x.message), ['The transfers file holds no transfer.']);
  assert.deepEqual(trOf({ moves: [] }).map((x) => x.id), ['field-unknown', 'field-missing']);
  assert.deepEqual(tr([transfer({ day: 'tomorrow' })]).map((x) => x.id), ['field-invalid']);
  assert.deepEqual(tr([transfer({ memo: 'x' })]).map((x) => x.message), ['The key "memo" of transfer T-1 is not one the tool reads, so its value was left out of every check. The keys of transfer T-1 are id, from, to, amount, day, notes.']);
});

test('transferOrder: by day, in the order of the file on one day, with a transfer of no day last', () => {
  const list = [{ day: 30, n: 1 }, { day: null, n: 2 }, { day: 10, n: 3 }, { day: 30, n: 4 }, { day: 10, n: 5 }];
  assert.deepEqual(transferOrder(list).map((t) => t.n), [3, 5, 1, 4, 2]);
});

test('the limits of holders and transfers: the rest are not read, and a note says so', () => {
  const holders = Array.from({ length: 5 }, (_, i) => holder({ address: addr(String(i + 1)), balance: '1' }));
  const r = readRegister({ format: 'json', root: readJson(text({ holders })) }, { ...REGISTER_LIMITS, maxHolders: 3 });
  assert.equal(r.holders.length, 3);
  assert.deepEqual(r.notes, ['the register holds 5 rows; the tool read the first 3 and left the rest out']);
  const t = readTransfers({ format: 'json', root: readJson(text({ transfers: [transfer(), transfer(), transfer()] })) }, { ...TRANSFER_LIMITS, maxTransfers: 2 });
  assert.equal(t.transfers.length, 2);
  assert.deepEqual(t.notes, ['the transfers file holds 3 rows; the tool read the first 2 and left the rest out']);
});
