import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEST, RULES, analyze, atOrAbove, capAmount, checkTexts, decide, parseDecimal, ruleById } from '../src/index.js';
import { HOLDERS, addr, config, holder, idsOf, lineOf, ofCheck, ofTransfer, text, texts, transfer } from './helpers.js';

const cfgOnly = (over) => checkTexts(texts({ cfg: config(over), holders: null })).findings;
const ids = (findings) => findings.map((f) => f.id);
const withHolder = (h, at = HOLDERS.length) => [...HOLDERS.slice(0, at), h, ...HOLDERS.slice(at + 1)];

test('the rules: unique ids, a level and a kind each, a fix, and the best practice checks say so', () => {
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  assert.equal(RULES.length, 27);
  for (const r of RULES) {
    assert.ok(['error', 'warning', 'info'].includes(r.severity), r.id);
    assert.ok(['documented', 'best practice', 'input'].includes(r.kind), r.id);
    assert.ok(r.fix.length > 20 && r.summary.length > 20, r.id);
    if (r.kind === 'best practice') assert.ok(r.own.includes(BEST), r.id);
  }
  assert.equal(ruleById('transfer-in-lockup').severity, 'error');
  assert.equal(ruleById('nope'), undefined);
});

test('decide and atOrAbove: the result of a run from the counts by level', () => {
  assert.ok(atOrAbove('error', 'warning'));
  assert.ok(!atOrAbove('info', 'warning'));
  assert.deepEqual(decide({ error: 0, warning: 2, info: 0 }, 'error'), { pass: true, failOn: 'error', text: 'PASS - no finding at or above error (2 warning)' });
  assert.equal(decide({ error: 1, warning: 2, info: 0 }, 'warning').text, 'FAIL - 3 findings at or above warning (1 error, 2 warning)');
  assert.equal(decide({}, 'info').text, 'PASS - no finding at or above info');
});

test('agent-missing: an empty list of agents, or none at all, at its line; one agent is enough', () => {
  const cfg = config({ roles: { agents: [] } });
  const f = checkTexts(texts({ cfg, holders: null })).findings;
  assert.deepEqual(ids(f), ['agent-missing']);
  assert.equal(f[0].line, lineOf(text(cfg), '"agents"'));
  assert.match(f[0].message, /^The roles name no agent, so no one can add an investor to the identity registry/);
  assert.deepEqual(ids(cfgOnly({ roles: { agents: undefined } })), ['agent-missing']);
  assert.deepEqual(cfgOnly({ roles: { agents: [addr('b')], multisig: true } }), []);
});

test('agent-single-key: one agent that is not a multisig with forced transfers or recovery; more than one, a multisig, or neither power, passes', () => {
  const f = cfgOnly({ roles: { multisig: false } });
  assert.deepEqual(ids(f), ['agent-single-key']);
  assert.match(f[0].message, /^One agent holds forced transfers and recovery, and the roles do not say it is a multisig wallet \(multisig is false\)/);
  assert.match(f[0].message, /a best practice of this tool/);
  assert.match(cfgOnly({ roles: { multisig: undefined }, controls: { recovery: false } }).find((x) => x.id === 'agent-single-key').message, /One agent holds forced transfers, .*multisig is not given/);
  assert.deepEqual(cfgOnly({ roles: { multisig: false, agents: [addr('b'), addr('c')] } }), []);
  assert.deepEqual(ids(cfgOnly({ roles: { multisig: false }, controls: { forcedTransfer: false, recovery: false } })), ['forced-transfer-missing', 'recovery-missing']);
});

test('pause-missing, forced-transfer-missing and recovery-missing: a control that is false, at its line; true passes', () => {
  const cfg = config({ controls: { pausable: false } });
  const f = checkTexts(texts({ cfg, holders: null })).findings;
  assert.deepEqual(ids(f), ['pause-missing']);
  assert.equal(f[0].line, lineOf(text(cfg), '"pausable"'));
  assert.match(f[0].message, /^The token is not pausable \(pausable is false\)\. ERC-3643 asks that a token can be paused/);
  assert.deepEqual(ids(cfgOnly({ controls: { forcedTransfer: false } })), ['forced-transfer-missing']);
  assert.deepEqual(ids(cfgOnly({ controls: { recovery: false } })), ['recovery-missing']);
  assert.equal(ruleById('pause-missing').severity, 'error');
  assert.equal(ruleById('recovery-missing').severity, 'warning');
});

test('standard-unknown: a standard other than ERC-3643, in any of its names', () => {
  const f = cfgOnly({ token: { standard: 'ERC-20' } });
  assert.deepEqual(ids(f), ['standard-unknown']);
  assert.match(f[0].message, /^The standard of the token is "ERC-20", not ERC-3643/);
  for (const s of ['erc-3643', 'EIP-3643', 'T-REX']) assert.deepEqual(cfgOnly({ token: { standard: s } }), [], s);
});

test('country-unknown: in the allowed countries, the limits by country and the register, with hints', () => {
  const f = cfgOnly({ compliance: { allowedCountries: ['US', 'UK', 'de'], maxHoldersPerCountry: { US: 5, XX: 2 } } });
  assert.deepEqual(ids(f), ['country-unknown', 'country-unknown', 'country-unknown']);
  assert.match(f[0].message, /"UK".*The code of the United Kingdom is GB\./);
  assert.match(f[1].message, /"de".*Write the code in capitals\./);
  assert.match(f[2].message, /^The maxHoldersPerCountry give a limit for "XX"/);
  const tw = ofCheck({ holders: withHolder(holder({ address: addr('5'), country: 'TW', balance: '0' })) }, 'country-unknown');
  assert.equal(tw.length, 1);
  assert.match(tw[0].message, /lists no code for Taiwan; check the code by hand/);
  assert.equal(tw[0].file, 'register');
  assert.deepEqual(cfgOnly({ compliance: { allowedCountries: ['US', 'XK', 'JE'] } }), [], 'XK and the codes of the UN table pass');
});

test('address-malformed: the owner, an agent, a holder and both sides of a transfer; mixed case passes', () => {
  assert.deepEqual(ids(cfgOnly({ roles: { owner: '0xabc', agents: [`0x${'z'.repeat(40)}`] } })), ['address-malformed', 'address-malformed']);
  const h = ofCheck({ holders: withHolder(holder({ address: addr('0'), balance: '0' })) }, 'address-malformed');
  assert.match(h[0].message, /is the zero address/);
  const t = ofTransfer(transfer({ from: '0x12', to: ` ${addr('2')}` }), 'address-malformed');
  assert.deepEqual(t.map((x) => x.message.slice(0, 33)), ['The from address of transfer T-1,', 'The to address of transfer T-1, "']);
  assert.match(t[1].message, /has spaces around it/);
  assert.deepEqual(ofTransfer(transfer({ to: `0x${'2'.repeat(39)}A` }), 'address-malformed'), []);
});

test('amount-decimals: the supply, an amount cap, a balance, frozen tokens and a transfer, against the decimals; trailing zeros pass', () => {
  const f = cfgOnly({ token: { decimals: 2, totalSupply: '1000.005' }, compliance: { maxHolding: '500.125' } });
  assert.deepEqual(ids(f), ['amount-decimals', 'amount-decimals']);
  assert.match(f[0].message, /^The totalSupply of the token is 1000\.005, with 3 decimal places, but the token has 2 decimals/);
  assert.deepEqual(ofCheck({ cfg: config({ token: { decimals: 2, totalSupply: '1000.000' } }) }, 'amount-decimals'), []);
  const h = ofCheck({ holders: [holder({ balance: '399.5', frozenTokens: '0.5' }), ...HOLDERS.slice(1)] }, 'amount-decimals');
  assert.equal(h.length, 2);
  const t = ofTransfer(transfer({ amount: '1.5' }), 'amount-decimals');
  assert.match(t[0].message, /^The amount of transfer T-1 is 1\.5, with 1 decimal place, but the token has 0 decimals/);
  assert.deepEqual(ofTransfer(transfer({ amount: '100.00' }), 'amount-decimals'), []);
});

test('amount-invalid: a supply of 0, a negative balance, a transfer of 0 and amounts in another notation', () => {
  assert.match(cfgOnly({ token: { totalSupply: '0' } })[0].message, /^The totalSupply of the token is 0; a token that represents an asset has a supply above 0/);
  assert.match(cfgOnly({ token: { totalSupply: '1,000' } })[0].message, /"1,000", which is not a plain decimal number/);
  assert.match(cfgOnly({ token: { totalSupply: '-5' } })[0].message, /negative \(-5\)/);
  assert.match(ofCheck({ holders: withHolder(holder({ balance: '-1' }), 0) }, 'amount-invalid')[0].message, /^The balance of holder 0x1{40} is negative \(-1\)/);
  assert.match(ofCheck({ holders: withHolder(holder({ balance: '1e3' }), 0) }, 'amount-invalid')[0].message, /"1e3", which is not a plain decimal number/);
  assert.deepEqual(ofCheck({ holders: HOLDERS }, 'amount-invalid'), [], 'a balance of 0 is a registered investor');
  assert.match(ofTransfer(transfer({ amount: '0' }), 'amount-invalid')[0].message, /^The amount of transfer T-1 is 0, a transfer of nothing/);
  assert.match(ofTransfer(transfer({ amount: '-100' }), 'amount-invalid')[0].message, /negative \(-100\)/);
  assert.match(ofTransfer(transfer({ amount: 'ten' }), 'amount-invalid')[0].message, /"ten"/);
});

test('holder-duplicate: two rows of one address, compared without case; the second is left out of the counts and sums', () => {
  const r = checkTexts(texts({ holders: [...HOLDERS, holder({ address: `0x${'AB'.repeat(20)}`, balance: '0' }), holder({ address: `0x${'ab'.repeat(20)}`, balance: '0' })] }));
  const f = r.findings.filter((x) => x.id === 'holder-duplicate');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /is also the address of the holder at line \d+; the register holds one row for each wallet/);
  assert.deepEqual(r.findings.filter((x) => x.id !== 'holder-duplicate'), []);
  assert.deepEqual(ids(checkTexts(texts({ holders: [...HOLDERS, holder({ balance: '10' })] })).findings), ['holder-duplicate'], 'its balance is not added to the sum');
});

test('investor-claims-missing: a holder of tokens or a receiver who lacks a claim, and a receiver not in the register; a holder of nothing is not reported', () => {
  const cfg = config({ compliance: { requiredClaims: ['KYC', 'ACCREDITATION'] } });
  const all = checkTexts(texts({ cfg, holders: [holder({ claims: ['KYC', 'ACCREDITATION'] }), holder({ address: addr('2'), country: 'GB', balance: '350', claims: ['KYC', 'ACCREDITATION'] }), holder({ address: addr('3'), country: 'DE', balance: '250', claims: ['kyc'] }), holder({ address: addr('4'), balance: '0', claims: [] })] })).findings;
  assert.deepEqual(all.map((f) => [f.id, f.file]), [['investor-claims-missing', 'register']]);
  assert.match(all[0].message, /^Holder 0x3{40} holds 250 tokens, but its identity lacks the required claim ACCREDITATION, so the identity registry does not verify it/);
  const t = ofTransfer(transfer({ to: addr('4') }), 'investor-claims-missing', { holders: withHolder(holder({ address: addr('4'), balance: '0', claims: [] }), 3) });
  assert.match(t[0].message, /^Transfer T-1 is sent to 0x4{40}, whose identity lacks the required claim KYC/);
  const none = ofTransfer(transfer({ to: addr('9') }), 'investor-claims-missing');
  assert.match(none[0].message, /^Transfer T-1 is sent to 0x9{40}, which is not in the register, so the identity registry does not verify it and the transfer is refused\.$/);
  assert.deepEqual(ofTransfer(transfer({ to: addr('4') }), 'investor-claims-missing'), []);
  assert.deepEqual(ofTransfer(transfer({ to: addr('4') }), 'investor-claims-missing', { cfg: config({ compliance: { requiredClaims: ['kyc'] } }) }), [], 'claims are compared in capitals');
});

test('investor-country-not-allowed: a holder of tokens or a receiver from a country out of the list; an allowed one passes', () => {
  const holders = withHolder(holder({ address: addr('5'), country: 'FR', balance: '0' }));
  assert.deepEqual(ofCheck({ holders }, 'investor-country-not-allowed'), [], 'a holder of nothing is not reported');
  const t = ofTransfer(transfer({ to: addr('5') }), 'investor-country-not-allowed', { holders });
  assert.match(t[0].message, /^Transfer T-1 is sent to 0x5{40}, whose country FR is not in the allowedCountries of the configuration \(US, GB and DE\)\.$/);
  const h = ofCheck({ holders: withHolder(holder({ address: addr('3'), country: 'FR', balance: '250', acquiredDay: 10 }), 2) }, 'investor-country-not-allowed');
  assert.match(h[0].message, /^Holder 0x3{40} holds 250 tokens and its country is FR/);
  assert.deepEqual(ofTransfer(transfer({ to: addr('3') }), 'investor-country-not-allowed'), []);
});

test('holder-limit: the register above maxHolders, and a transfer to a new holder above it; one at the limit passes, and a sender who leaves frees a place', () => {
  const r = ofCheck({ cfg: config({ compliance: { maxHolders: 2 } }) }, 'holder-limit');
  assert.equal(r.length, 1);
  assert.equal(r[0].file, 'config');
  assert.match(r[0].message, /^The register has 3 holders with a balance above 0, more than the maxHolders of 2\.$/);
  const cfg = config({ compliance: { maxHolders: 3 } });
  const t = ofTransfer(transfer({ to: addr('4') }), 'holder-limit', { cfg });
  assert.match(t[0].message, /^Transfer T-1 makes 0x4{40} a new holder, which brings the holders to 4, above the maxHolders of 3\.$/);
  assert.deepEqual(ofTransfer(transfer({ to: addr('4'), amount: '400' }), 'holder-limit', { cfg }), [], 'the sender leaves, so the count stays at 3');
  assert.deepEqual(ofTransfer(transfer({ to: addr('2') }), 'holder-limit', { cfg }), [], 'a holder who already holds is not new');
});

test('country-holder-limit: the register above the limit of a country, and a transfer to a new holder there', () => {
  const r = ofCheck({ cfg: config({ compliance: { maxHoldersPerCountry: { GB: 0 } } }) }, 'field-invalid');
  assert.equal(r.length, 1, 'a limit of 0 is not a limit');
  const over = ofCheck({ cfg: config({ compliance: { maxHoldersPerCountry: { US: 1 } } }), holders: withHolder(holder({ address: addr('4'), balance: '0' })) }, 'country-holder-limit');
  assert.deepEqual(over, []);
  const cfg = config({ compliance: { maxHoldersPerCountry: { US: 1 } } });
  const t = ofTransfer(transfer({ from: addr('3'), to: addr('4'), amount: '50' }), 'country-holder-limit', { cfg });
  assert.match(t[0].message, /^Transfer T-1 makes 0x4{40} a new holder in US, which brings the holders there to 2, above the limit of 1 for US\.$/);
  assert.deepEqual(ofTransfer(transfer({ to: addr('4'), amount: '400' }), 'country-holder-limit', { cfg }), [], 'a holder of the same country leaves');
  const reg = ofCheck({ cfg: config({ compliance: { maxHoldersPerCountry: { US: 1 } } }), holders: withHolder(holder({ address: addr('5'), balance: '10' })) }, 'country-holder-limit');
  assert.match(reg[0].message, /^The register has 2 holders in US with a balance above 0, more than the limit of 1/);
});

test('holding-above-cap: a percent or an amount; a holder at the cap passes and one token more does not', () => {
  assert.deepEqual(ofCheck({ cfg: config({ compliance: { maxHolding: '40%' } }) }, 'holding-above-cap'), []);
  const r = ofCheck({ cfg: config({ compliance: { maxHolding: '39.9%' } }) }, 'holding-above-cap');
  assert.match(r[0].message, /^Holder 0x1{40} holds 400 tokens, above the maxHolding of 39\.9%, which is 399 of the total supply\.$/);
  const t = ofTransfer(transfer({ amount: '151' }), 'holding-above-cap', { cfg: config({ compliance: { maxHolding: 500 } }) });
  assert.match(t[0].message, /^Transfer T-1 brings 0x2{40} to 501 tokens, above the maxHolding of 500\.$/);
  assert.deepEqual(ofTransfer(transfer({ amount: '150' }), 'holding-above-cap', { cfg: config({ compliance: { maxHolding: '500' } }) }), []);
  assert.deepEqual(capAmount({ kind: 'percent', value: parseDecimal('50') }, null), null);
  const noSupply = checkTexts(texts({ cfg: config({ token: { totalSupply: 'x' } }) }));
  assert.ok(noSupply.notes.some((n) => /the maxHolding of 50% is a percent of a total supply that could not be read/.test(n)));
});

test('supply-mismatch: balances that do not add up to the supply, either way; a supply written with zeros passes', () => {
  const less = ofCheck({ cfg: config({ token: { totalSupply: '1000.5', decimals: 1 } }) }, 'supply-mismatch');
  assert.match(less[0].message, /^The balances of the register add up to 1000, but the totalSupply of the token is 1000\.5, 0\.5 more\./);
  const more = ofCheck({ cfg: config({ token: { totalSupply: '900' } }) }, 'supply-mismatch');
  assert.match(more[0].message, /100 less/);
  assert.deepEqual(ofCheck({ cfg: config({ token: { totalSupply: '1000.0', decimals: 1 } }) }, 'supply-mismatch'), []);
  const unread = checkTexts(texts({ holders: withHolder(holder({ balance: 'x' }), 0) }));
  assert.ok(unread.notes.includes('the balances were not compared with the total supply, because one balance could not be read'));
  assert.ok(!unread.findings.some((f) => f.id === 'supply-mismatch'));
});

test('transfer-id-duplicate: two transfers of one id, compared without case; the second is reported', () => {
  const f = ofCheck({ transfers: [transfer(), transfer({ id: 't-1 ', amount: '1' })] }, 'transfer-id-duplicate');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /^The id t-1 is also the id of the transfer at line \d+/);
  assert.deepEqual(ofCheck({ transfers: [transfer(), transfer({ id: 'T-2', amount: '1' })] }, 'transfer-id-duplicate'), []);
});

test('address-frozen: a frozen sender, a frozen receiver and an amount above the free balance; the free balance itself passes', () => {
  const holders = [holder({ frozenTokens: '300' }), holder({ address: addr('2'), country: 'GB', balance: '350', frozen: true }), ...HOLDERS.slice(2)];
  const f = ofTransfer(transfer({ amount: '101' }), 'address-frozen', { holders });
  assert.equal(f.length, 2);
  assert.match(f[0].message, /^Transfer T-1 is sent to 0x2{40}, a frozen wallet/);
  assert.match(f[1].message, /^Transfer T-1 sends 101 tokens, but 300 of the 400 the sender holds are frozen, which leaves a free balance of 100\.$/);
  const free = [holder({ frozenTokens: '300' }), ...HOLDERS.slice(1)];
  assert.deepEqual(ofTransfer(transfer({ amount: '100' }), 'address-frozen', { holders: free }), []);
  const sender = ofTransfer(transfer(), 'address-frozen', { holders: [holder({ frozen: true }), ...HOLDERS.slice(1)] });
  assert.match(sender[0].message, /is sent from 0x1{40}, a frozen wallet/);
});

test('balance-insufficient: more than the sender holds, a sender not in the register, and the balance after the transfers before', () => {
  assert.match(ofTransfer(transfer({ amount: '401' }), 'balance-insufficient')[0].message, /^Transfer T-1 sends 401 tokens on day 200, but the sender holds 400 after the transfers before it\.$/);
  assert.deepEqual(ofTransfer(transfer({ amount: '400' }), 'balance-insufficient'), []);
  assert.match(ofTransfer(transfer({ from: addr('9') }), 'balance-insufficient')[0].message, /which is not in the register, so it holds no tokens the register knows of/);
  const two = ofCheck({ transfers: [transfer({ amount: '300', to: addr('4') }), transfer({ id: 'T-2', amount: '150', day: 201 })] }, 'balance-insufficient');
  assert.match(two[0].message, /^Transfer T-2 sends 150 tokens on day 201, but the sender holds 100 after the transfers before it\.$/);
  const order = ofCheck({ transfers: [transfer({ id: 'T-2', amount: '150', day: 201 }), transfer({ amount: '300', to: addr('4') })] }, 'balance-insufficient');
  assert.match(order[0].message, /^Transfer T-2 /, 'the transfers are taken in the order of their day');
  const refused = ofCheck({ transfers: [transfer({ amount: '300', to: addr('9') }), transfer({ id: 'T-2', amount: '150', day: 201 })] }, 'balance-insufficient');
  assert.deepEqual(refused, [], 'a transfer with a finding is not made, so the balance stays');
});

test('transfer-in-lockup: by the day of the transfer against the day of acquisition; the day the lock-up ends passes', () => {
  const f = ofTransfer(transfer({ from: addr('3'), day: 109 }), 'transfer-in-lockup');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, lineOf(text({ transfers: [transfer({ from: addr('3'), day: 109 })] }), '"day"'));
  assert.match(f[0].message, /^Transfer T-1 is made on day 109, but the sender, of the class reg-d, acquired its tokens on day 10 and the class holds them for 100 days: the lock-up ends on day 110, 1 day later\.$/);
  assert.deepEqual(ofTransfer(transfer({ from: addr('3'), day: 110 }), 'transfer-in-lockup'), []);
  const chain = ofCheck({ transfers: [transfer(), transfer({ id: 'T-2', from: addr('2'), to: addr('3'), day: 250 })] }, 'transfer-in-lockup');
  assert.match(chain[0].message, /acquired its tokens on day 200 and the class holds them for 100 days: the lock-up ends on day 300/, 'a receiver acquires on the day of the transfer');
  const noClasses = checkTexts(texts({ cfg: config({ compliance: { investorClasses: undefined } }), holders: HOLDERS.map((h) => ({ ...h, investorClass: undefined })), transfers: [transfer({ day: 1 })] }));
  assert.deepEqual(noClasses.findings, []);
  assert.ok(noClasses.notes.includes('the configuration gives no investor classes, so no lock-up was checked'));
});

test('the notes: transfers taken as not made, transfers that could not be checked, and no claims required', () => {
  const r = checkTexts(texts({ cfg: config({ compliance: { requiredClaims: [] } }), transfers: [transfer({ day: 1 }), transfer({ id: 'T-2', amount: 'x' })] }));
  assert.ok(r.notes.includes('one transfer with a finding was taken as not made, as the chain would refuse it, so the transfers after it were checked against the balances without it'));
  assert.ok(r.notes.includes('one transfer could not be checked against the register, because an address, the amount or the day could not be read'));
  assert.ok(r.notes.includes('the configuration requires no claims, so investor-claims-missing looked only for addresses that are not in the register'));
  const alone = analyze({ transfers: [{ id: 'T-1', title: 'T-1', from: addr('1'), to: addr('2'), amount: { state: 'ok', value: parseDecimal('1'), text: '1' }, day: 1 }] });
  assert.ok(alone.notes.includes('no register was given, so the transfers were checked for their form only'));
  assert.equal(alone.summary.made, null);
});

test('the summary: holders, the sum of balances, transfers made and the table of countries', () => {
  const r = checkTexts(texts({ transfers: [transfer({ to: addr('4') }), transfer({ id: 'T-2', day: 1 })] }));
  const s = r.analysis.summary;
  assert.deepEqual([s.holders, s.holding, s.sum, s.transfers, s.made, s.holdingAfter], [4, 3, '1000', 2, 1, 4]);
  assert.deepEqual(s.countries, [
    { country: 'DE', allowed: true, limit: null, register: 1, after: 1 },
    { country: 'GB', allowed: true, limit: null, register: 1, after: 1 },
    { country: 'US', allowed: true, limit: 5, register: 1, after: 2 }
  ]);
});
