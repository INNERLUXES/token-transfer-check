// The checks on what was read: the configuration on its own (its agents, its controls, its standard, its countries and
// its amounts); the register against the rules of the configuration (claims, countries, the cap, the number of holders
// and the total supply); and the transfers one after the other, in the order of their day, against the state the
// register and the transfers before them leave (frozen wallets, free balance, claims, countries, the number of holders,
// the cap and the lock-up). A transfer with a finding is taken as not made, as the chain would refuse it. Each finding
// names the file and the line of the field it is about.

import { addressKey, addressProblem } from './addresses.js';
import { isKnownStandard } from './config.js';
import { countryHint, isCountry } from './countries.js';
import { ZERO, addDecimal, compareDecimal, formatDecimal, mulDecimal, percentOf, placesOf, subDecimal } from './decimal.js';
import { BEST } from './rules.js';
import { grouped, listText, plural } from './size.js';

const BP = `This is ${BEST}.`;
const at = (e) => ({ line: e.line, column: e.column });
const shown = (text, max = 60) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);
const places = (n) => `${n} decimal ${n === 1 ? 'place' : 'places'}`;

// The cap on the holding of one investor as an amount: the amount itself, or the percent of the total supply.
export function capAmount(cap, supply) {
  if (!cap) return null;
  if (cap.kind === 'amount') return cap.value;
  return supply ? mulDecimal(supply, percentOf(cap.value)) : null;
}

// The order the transfers are checked in: by their day, and in the order of the file on one day. A transfer with no day
// that could be read comes last.
export function transferOrder(transfers) {
  return transfers.map((t, i) => ({ t, i })).sort((a, b) => (a.t.day ?? Infinity) - (b.t.day ?? Infinity) || a.i - b.i).map((x) => x.t);
}

// The checks: { findings, notes, summary }. Any of config, holders and transfers may be null: a file that was not given,
// or one that could not be read, and the checks that need it do not run.
export function analyze({ config = null, holders = null, transfers = null } = {}) {
  const findings = [];
  const notes = [];
  const add = (file, id, where, message, subject = null) => findings.push({ id, file, line: where.line, column: where.column, message, subject });

  // The rules of the configuration, as far as they could be read.
  let decimals = null;
  let supply = null;
  let allowed = null;
  let claims = null;
  let maxHolders = null;
  let maxHoldersEntry = null;
  const perCountry = new Map();
  let cap = null;
  let capText = null;
  let classes = null;
  let supplyEntry = null;

  // An amount against the decimals of the token.
  const decimalsCheck = (file, entry, value, text, what, subject = null) => {
    if (decimals === null || !value) return;
    const p = placesOf(value);
    if (p > decimals) add(file, 'amount-decimals', at(entry), `${what} is ${shown(text, 50)}, with ${places(p)}, but the token has ${decimals} decimals, so the chain cannot hold the amount: it is a whole number of the smallest unit.`, subject);
  };

  if (config) {
    const { token, compliance, roles, controls } = config;
    if (token.standard !== null && !isKnownStandard(token.standard)) add('config', 'standard-unknown', at(token.standardEntry), `The standard of the token is "${shown(token.standard)}", not ERC-3643, so the rules this report applies, which are those of ERC-3643, may not be the ones the token enforces. ${BP}`);
    decimals = token.decimals;
    supplyEntry = token.supplyEntry;
    if (token.supply) {
      const s = token.supply;
      if (s.state === 'nan') add('config', 'amount-invalid', at(token.supplyEntry), `The totalSupply of the token is "${shown(s.text)}", which is not a plain decimal number such as 100000: no sign, exponent or thousands separator. ${BP}`);
      else if (s.state === 'negative' || s.state === 'zero') add('config', 'amount-invalid', at(token.supplyEntry), `The totalSupply of the token is ${s.state === 'zero' ? '0' : `negative (${shown(s.text)})`}; a token that represents an asset has a supply above 0. ${BP}`);
      else {
        supply = s.value;
        decimalsCheck('config', token.supplyEntry, s.value, s.text, 'The totalSupply of the token');
      }
    }
    if (compliance.countries) {
      allowed = new Set();
      for (const item of compliance.countries) {
        if (isCountry(item.value)) allowed.add(item.value);
        else add('config', 'country-unknown', at(item.node), `The allowedCountries name "${shown(item.value, 20)}", which is not a two-letter code of the country table the tool reads (the ISO alpha-2 codes of the UN M49 table, and XK).${countryHint(item.value)}`);
      }
    }
    for (const p of compliance.perCountry) {
      if (!isCountry(p.code)) add('config', 'country-unknown', at(p.entry), `The maxHoldersPerCountry give a limit for "${shown(p.code, 20)}", which is not a two-letter code of the country table the tool reads.${countryHint(p.code)}`);
      else perCountry.set(p.code, p);
    }
    maxHolders = compliance.maxHolders;
    maxHoldersEntry = compliance.maxHoldersEntry;
    claims = compliance.claims;
    if (compliance.cap) {
      capText = compliance.cap.text;
      if (compliance.cap.kind === 'amount') decimalsCheck('config', compliance.capEntry, compliance.cap.value, compliance.cap.text, 'The maxHolding of the compliance');
      cap = capAmount(compliance.cap, supply);
      if (cap === null) notes.push(`the maxHolding of ${shown(capText, 20)} is a percent of a total supply that could not be read, so holding-above-cap did not run`);
    }
    if (compliance.classes) classes = new Map(compliance.classes.map((c) => [c.key, c]));

    if (roles.owner !== null) {
      const problem = addressProblem(roles.ownerRaw ?? roles.owner);
      if (problem) add('config', 'address-malformed', at(roles.ownerEntry), `The owner of the roles, "${shown(roles.owner)}", ${problem}; an address is 0x followed by 40 hex digits.`);
    }
    if (roles.entry && roles.agents !== null) {
      if (roles.agents.length === 0) add('config', 'agent-missing', at(roles.agentsEntry ?? roles.entry), `The roles name no agent, so no one can add an investor to the identity registry, freeze a wallet, pause the token, force a transfer or recover the tokens of a lost wallet. ERC-3643 asks the owner to appoint agents for this.`);
      for (const a of roles.agents) {
        const problem = addressProblem(a.node.value);
        if (problem) add('config', 'address-malformed', at(a.node), `The agent "${shown(a.value)}" ${problem}; an address is 0x followed by 40 hex digits.`);
      }
      const powers = [controls.forcedTransfer === true ? 'forced transfers' : null, controls.recovery === true ? 'recovery' : null].filter(Boolean);
      if (roles.agents.length === 1 && roles.multisig !== true && powers.length) add('config', 'agent-single-key', at(roles.agentsEntry), `One agent holds ${listText(powers)}, and the roles do not say it is a multisig wallet (multisig is ${roles.multisig === false ? 'false' : 'not given'}), so one key can move the tokens of any investor. ${BP}`);
    }
    if (controls.pausable === false) add('config', 'pause-missing', at(controls.pausableEntry), 'The token is not pausable (pausable is false). ERC-3643 asks that a token can be paused, so that its transfers can be stopped while a problem is found and fixed.');
    if (controls.forcedTransfer === false) add('config', 'forced-transfer-missing', at(controls.forcedTransferEntry), 'Forced transfers are off (forcedTransfer is false). ERC-3643 asks that an agent wallet can force a transfer.');
    if (controls.recovery === false) add('config', 'recovery-missing', at(controls.recoveryEntry), 'Recovery is off (recovery is false). ERC-3643 asks for a way to recover the tokens of an investor who has lost the key to a wallet; without it those tokens stay where they are.');
  }

  // The state of each wallet: the register first, then each transfer that is made.
  const state = new Map();
  const counts = { all: 0, byCountry: new Map() };
  const held = (s) => s.balance !== null && s.balance.int > 0n;
  const count = (s, d) => {
    counts.all += d;
    if (s.country !== null) counts.byCountry.set(s.country, (counts.byCountry.get(s.country) ?? 0) + d);
  };
  const classOf = (s) => (classes && s.investorClass !== null ? classes.get(s.investorClass.toLowerCase()) ?? null : null);
  const lacking = (s) => (claims && s.claims ? claims.filter((c) => !s.claims.includes(c)) : []);
  let registerRows = 0;
  let unreadBalances = 0;
  let sum = ZERO;

  if (holders) {
    registerRows = holders.length;
    for (const h of holders) {
      const of = `holder ${h.title}`;
      const Of = `Holder ${h.title}`;
      let key = null;
      if (h.address !== null) {
        const problem = addressProblem(h.addressRaw ?? h.address);
        if (problem) add('register', 'address-malformed', at(h.addressEntry), `The address of holder ${shown(h.title, 50)} ${problem}; an address is 0x followed by 40 hex digits.`, h.title);
        else key = addressKey(h.address);
      }
      if (key !== null && state.has(key)) {
        add('register', 'holder-duplicate', at(h.addressEntry), `The address ${shown(h.address, 50)} is also the address of the holder at line ${state.get(key).line}; the register holds one row for each wallet, and this one was left out of the counts and the sums. ${BP}`, h.title);
        continue;
      }
      const countryOk = h.country !== null && isCountry(h.country);
      if (h.country !== null && !countryOk) add('register', 'country-unknown', at(h.countryEntry), `The country of ${of} is "${shown(h.country, 20)}", which is not a two-letter code of the country table the tool reads.${countryHint(h.country)}`, h.title);
      if (classes && h.investorClass !== null && !classes.has(h.investorClass.toLowerCase())) add('register', 'field-invalid', at(h.classEntry), `The investorClass of ${of} is "${shown(h.investorClass, 40)}", which is not a class of the configuration (${listText([...classes.values()].map((c) => c.name), 8)}).`, h.title);
      if (classes && h.investorClass === null && !h.classInvalid) add('register', 'field-missing', at(h), `${Of} has no investorClass, but the configuration gives investor classes with their lock-ups.`, h.title);
      let balance = null;
      if (h.balance) {
        const b = h.balance;
        if (b.state === 'nan') add('register', 'amount-invalid', at(h.balanceEntry), `The balance of ${of} is "${shown(b.text)}", which is not a plain decimal number such as 2500: no sign, exponent or thousands separator. ${BP}`, h.title);
        else if (b.state === 'negative') add('register', 'amount-invalid', at(h.balanceEntry), `The balance of ${of} is negative (${shown(b.text)}); a balance on the chain is 0 or more. ${BP}`, h.title);
        else {
          balance = b.value;
          decimalsCheck('register', h.balanceEntry, b.value, b.text, `The balance of ${of}`, h.title);
        }
      }
      if (h.frozenTokens) {
        decimalsCheck('register', h.frozenTokensEntry, h.frozenTokens, formatDecimal(h.frozenTokens), `The frozenTokens of ${of}`, h.title);
        if (balance && compareDecimal(h.frozenTokens, balance) > 0) add('register', 'field-invalid', at(h.frozenTokensEntry), `The frozenTokens of ${of}, ${formatDecimal(h.frozenTokens)}, are more than its balance of ${formatDecimal(balance)}.`, h.title);
      }
      const s = { line: h.line, title: h.title, address: h.address, country: countryOk ? h.country : null, rawCountry: h.country, investorClass: h.investorClass, claims: h.claims, balance, acquiredDay: h.acquiredDay, frozen: h.frozen, frozenTokens: h.frozenTokens, holder: h };
      if (balance === null) unreadBalances += 1;
      else sum = addDecimal(sum, balance);
      const cls = classOf(s);
      if (held(s) && cls && cls.lockupDays > 0 && h.acquiredDay === null && !h.acquiredInvalid) add('register', 'field-missing', at(h), `${Of} has no acquiredDay, but its class ${shown(cls.name, 40)} has a lock-up of ${plural(cls.lockupDays, 'day')}, so a transfer from it cannot be checked.`, h.title);
      if (held(s)) {
        const lack = lacking(s);
        if (lack.length) add('register', 'investor-claims-missing', at(h.claimsEntry ?? h), `${Of} holds ${formatDecimal(balance)} tokens, but its identity lacks the required ${lack.length === 1 ? 'claim' : 'claims'} ${listText(lack, 8)}, so the identity registry does not verify it and it cannot receive more.`, h.title);
        if (allowed && s.country !== null && !allowed.has(s.country)) add('register', 'investor-country-not-allowed', at(h.countryEntry), `${Of} holds ${formatDecimal(balance)} tokens and its country is ${s.country}, which is not in the allowedCountries of the configuration (${listText([...allowed], 8)}).`, h.title);
        if (cap && compareDecimal(balance, cap) > 0) add('register', 'holding-above-cap', at(h.balanceEntry), `${Of} holds ${formatDecimal(balance)} tokens, above the maxHolding of ${shown(capText, 20)}${capText.endsWith('%') ? `, which is ${formatDecimal(cap)} of the total supply` : ''}.`, h.title);
      }
      if (key !== null) {
        state.set(key, s);
        if (held(s)) count(s, 1);
      }
    }
    if (maxHolders !== null && counts.all > maxHolders) add('config', 'holder-limit', at(maxHoldersEntry), `The register has ${plural(counts.all, 'holder')} with a balance above 0, more than the maxHolders of ${grouped(maxHolders)}.`);
    for (const [code, p] of perCountry) {
      const n = counts.byCountry.get(code) ?? 0;
      if (n > p.limit) add('config', 'country-holder-limit', at(p.entry), `The register has ${plural(n, 'holder')} in ${code} with a balance above 0, more than the limit of ${grouped(p.limit)} the maxHoldersPerCountry set for ${code}.`);
    }
    if (supply && holders.length) {
      if (unreadBalances) notes.push(`the balances were not compared with the total supply, because ${unreadBalances === 1 ? 'one balance' : `${grouped(unreadBalances)} balances`} could not be read`);
      else if (compareDecimal(sum, supply) !== 0) add('config', 'supply-mismatch', at(supplyEntry), `The balances of the register add up to ${formatDecimal(sum)}, but the totalSupply of the token is ${formatDecimal(supply)}, ${compareDecimal(sum, supply) < 0 ? `${formatDecimal(subDecimal(supply, sum))} more` : `${formatDecimal(subDecimal(sum, supply))} less`}. ${BP}`);
    }
  }
  const before = { holders: counts.all, byCountry: new Map(counts.byCountry) };

  let made = 0;
  let refused = 0;
  let unread = 0;
  if (transfers) {
    // Ids written twice.
    const ids = new Map();
    for (const t of transfers) {
      if (t.id === null) continue;
      const k = t.id.toLowerCase();
      if (ids.has(k)) add('transfers', 'transfer-id-duplicate', at(t.idEntry), `The id ${shown(t.id)} is also the id of the transfer at line ${ids.get(k).line}; the second is refused, or made twice where the id is not checked. ${BP}`, t.title);
      else ids.set(k, t);
    }
    for (const t of transferOrder(transfers)) {
      const start = findings.length;
      const of = `transfer ${t.title}`;
      const Of = `Transfer ${t.title}`;
      const keys = {};
      for (const side of ['from', 'to']) {
        if (t[side] === null) continue;
        const problem = addressProblem(t[`${side}Raw`] ?? t[side]);
        if (problem) add('transfers', 'address-malformed', at(t[`${side}Entry`]), `The ${side} address of ${of}, "${shown(t[side])}", ${problem}; an address is 0x followed by 40 hex digits.`, t.title);
        else keys[side] = addressKey(t[side]);
      }
      let amount = null;
      if (t.amount) {
        const a = t.amount;
        if (a.state === 'nan') add('transfers', 'amount-invalid', at(t.amountEntry), `The amount of ${of} is "${shown(a.text)}", which is not a plain decimal number such as 250: no sign, exponent or thousands separator. ${BP}`, t.title);
        else if (a.state === 'negative' || a.state === 'zero') add('transfers', 'amount-invalid', at(t.amountEntry), `The amount of ${of} is ${a.state === 'zero' ? '0, a transfer of nothing, which is more often a row that lost its amount' : `negative (${shown(a.text)})`}. ${BP}`, t.title);
        else {
          amount = a.value;
          decimalsCheck('transfers', t.amountEntry, a.value, a.text, `The amount of ${of}`, t.title);
        }
      }
      if (!holders || keys.from === undefined || keys.to === undefined || amount === null || t.day === null) {
        unread += 1;
        continue;
      }
      const sender = state.get(keys.from) ?? null;
      const receiver = state.get(keys.to) ?? null;
      const self = keys.from === keys.to;
      const day = `day ${grouped(t.day)}`;
      if (sender?.frozen) add('transfers', 'address-frozen', at(t.fromEntry), `${Of} is sent from ${shown(t.from, 50)}, a frozen wallet; ERC-3643 refuses a transfer from a frozen wallet.`, t.title);
      if (receiver?.frozen) add('transfers', 'address-frozen', at(t.toEntry), `${Of} is sent to ${shown(t.to, 50)}, a frozen wallet; ERC-3643 refuses a transfer to a frozen wallet.`, t.title);
      if (!sender) add('transfers', 'balance-insufficient', at(t.fromEntry), `${Of} is sent from ${shown(t.from, 50)}, which is not in the register, so it holds no tokens the register knows of.`, t.title);
      else if (sender.balance !== null) {
        if (compareDecimal(amount, sender.balance) > 0) add('transfers', 'balance-insufficient', at(t.amountEntry), `${Of} sends ${formatDecimal(amount)} tokens on ${day}, but the sender holds ${formatDecimal(sender.balance)} after the transfers before it.`, t.title);
        else if (sender.frozenTokens && compareDecimal(amount, subDecimal(sender.balance, sender.frozenTokens)) > 0) add('transfers', 'address-frozen', at(t.amountEntry), `${Of} sends ${formatDecimal(amount)} tokens, but ${formatDecimal(sender.frozenTokens)} of the ${formatDecimal(sender.balance)} the sender holds are frozen, which leaves a free balance of ${formatDecimal(subDecimal(sender.balance, sender.frozenTokens))}.`, t.title);
      }
      if (!receiver) add('transfers', 'investor-claims-missing', at(t.toEntry), `${Of} is sent to ${shown(t.to, 50)}, which is not in the register, so the identity registry does not verify it and the transfer is refused.`, t.title);
      else {
        const lack = lacking(receiver);
        if (lack.length) add('transfers', 'investor-claims-missing', at(t.toEntry), `${Of} is sent to ${shown(receiver.title, 50)}, whose identity lacks the required ${lack.length === 1 ? 'claim' : 'claims'} ${listText(lack, 8)}, so the identity registry does not verify it.`, t.title);
        if (allowed && receiver.country !== null && !allowed.has(receiver.country)) add('transfers', 'investor-country-not-allowed', at(t.toEntry), `${Of} is sent to ${shown(receiver.title, 50)}, whose country ${receiver.country} is not in the allowedCountries of the configuration (${listText([...allowed], 8)}).`, t.title);
      }
      if (receiver && sender && !self && receiver.balance !== null && sender.balance !== null) {
        const fresh = !held(receiver);
        const leaves = compareDecimal(amount, sender.balance) === 0;
        if (fresh && maxHolders !== null && counts.all + 1 - (leaves ? 1 : 0) > maxHolders) add('transfers', 'holder-limit', at(t.toEntry), `${Of} makes ${shown(receiver.title, 50)} a new holder, which brings the holders to ${grouped(counts.all + 1 - (leaves ? 1 : 0))}, above the maxHolders of ${grouped(maxHolders)}.`, t.title);
        const c = receiver.country;
        if (fresh && c !== null && perCountry.has(c)) {
          const after = (counts.byCountry.get(c) ?? 0) + 1 - (leaves && sender.country === c ? 1 : 0);
          if (after > perCountry.get(c).limit) add('transfers', 'country-holder-limit', at(t.toEntry), `${Of} makes ${shown(receiver.title, 50)} a new holder in ${c}, which brings the holders there to ${grouped(after)}, above the limit of ${grouped(perCountry.get(c).limit)} for ${c}.`, t.title);
        }
        const total = addDecimal(receiver.balance, amount);
        if (cap && compareDecimal(total, cap) > 0) add('transfers', 'holding-above-cap', at(t.amountEntry), `${Of} brings ${shown(receiver.title, 50)} to ${formatDecimal(total)} tokens, above the maxHolding of ${shown(capText, 20)}${capText.endsWith('%') ? `, which is ${formatDecimal(cap)} of the total supply` : ''}.`, t.title);
      }
      const cls = sender ? classOf(sender) : null;
      if (cls && cls.lockupDays !== null && sender.acquiredDay !== null) {
        const ends = sender.acquiredDay + cls.lockupDays;
        if (t.day < ends) add('transfers', 'transfer-in-lockup', at(t.dayEntry), `${Of} is made on ${day}, but the sender, of the class ${shown(cls.name, 40)}, acquired its tokens on day ${grouped(sender.acquiredDay)} and the class holds them for ${plural(cls.lockupDays, 'day')}: the lock-up ends on day ${grouped(ends)}, ${plural(ends - t.day, 'day')} later.`, t.title);
      }
      if (findings.length > start || !sender || !receiver || sender.balance === null || receiver.balance === null) {
        refused += 1;
        continue;
      }
      // The transfer is made.
      made += 1;
      if (self) continue;
      const wasHeld = held(receiver);
      sender.balance = subDecimal(sender.balance, amount);
      if (!held(sender)) count(sender, -1);
      receiver.balance = addDecimal(receiver.balance, amount);
      receiver.acquiredDay = t.day;
      if (!wasHeld) count(receiver, 1);
    }
    if (!holders) notes.push('no register was given, so the transfers were checked for their form only');
    if (refused) notes.push(`${refused === 1 ? 'one transfer with a finding was' : `${grouped(refused)} transfers with a finding were`} taken as not made, as the chain would refuse ${refused === 1 ? 'it' : 'them'}, so the transfers after ${refused === 1 ? 'it' : 'them'} were checked against the balances without ${refused === 1 ? 'it' : 'them'}`);
    if (unread && holders) notes.push(`${unread === 1 ? 'one transfer' : `${grouped(unread)} transfers`} could not be checked against the register, because an address, the amount or the day could not be read`);
  }
  if (config && classes === null && holders) notes.push('the configuration gives no investor classes, so no lock-up was checked');
  if (config && claims !== null && claims.length === 0) notes.push('the configuration requires no claims, so investor-claims-missing looked only for addresses that are not in the register');

  // The table of holders by country: the allowed countries, the countries with a limit and the countries of holders.
  const codes = new Set([...(allowed ?? []), ...perCountry.keys(), ...before.byCountry.keys(), ...counts.byCountry.keys()]);
  const countries = [...codes].sort().map((code) => ({ country: code, allowed: allowed === null ? null : allowed.has(code), limit: perCountry.get(code)?.limit ?? null, register: holders ? before.byCountry.get(code) ?? 0 : null, after: transfers && holders ? counts.byCountry.get(code) ?? 0 : null }));
  const summary = {
    holders: holders ? registerRows : null,
    holding: holders ? before.holders : null,
    holdingAfter: transfers && holders ? counts.all : null,
    sum: holders && !unreadBalances ? formatDecimal(sum) : null,
    transfers: transfers ? transfers.length : null,
    made: transfers && holders ? made : null,
    countries: holders || allowed ? countries : null
  };
  return { findings, notes, summary };
}
