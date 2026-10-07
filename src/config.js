// Reading the compliance configuration of a token from the nodes of the JSON reader: the token, its compliance rules,
// its roles and its controls. Every field is read with the line and column of its key. A field that is missing, of the
// wrong type or unknown is a finding of its own, and the value is left out of the checks that need it; nothing that was
// not read is taken for a value that is fine. The agents are the one exception: a configuration with no agent is the
// finding agent-missing of src/analyze.js, not field-missing.

import { isObject } from './json.js';
import { compareDecimal, parseDecimal } from './decimal.js';
import { Reader, cut, describe, readAmount, where } from './fields.js';

export const CONFIG_LIMITS = { maxDecimals: 36, maxDays: 100000, maxHolders: 1000000000, maxItems: 1000 };

export const TOP_KEYS = ['token', 'compliance', 'roles', 'controls', 'notes'];
export const TOKEN_KEYS = ['name', 'symbol', 'standard', 'decimals', 'totalSupply', 'notes'];
export const COMPLIANCE_KEYS = ['allowedCountries', 'requiredClaims', 'maxHolders', 'maxHoldersPerCountry', 'maxHolding', 'investorClasses', 'notes'];
export const CLASS_KEYS = ['name', 'lockupDays', 'notes'];
export const ROLE_KEYS = ['owner', 'agents', 'multisig', 'notes'];
export const CONTROL_KEYS = ['pausable', 'forcedTransfer', 'recovery', 'notes'];

// The names a configuration may give ERC-3643 by, compared in small letters with spaces left out.
export const STANDARD_NAMES = ['erc-3643', 'erc3643', 'eip-3643', 'eip3643', 't-rex', 'trex'];
export const isKnownStandard = (text) => STANDARD_NAMES.includes(text.toLowerCase().replace(/\s+/g, ''));

const HUNDRED = parseDecimal('100');

// Reads a cap on the holding of one investor: an amount such as "5000", or a percent of the total supply such as "10%".
// Returns { kind, value, text } or null with a finding.
function readCap(reader, e) {
  const node = e.value;
  const text = node.kind === 'number' ? node.raw : node.value.trim();
  const percent = text.endsWith('%');
  const d = parseDecimal(percent ? text.slice(0, -1).trim() : text);
  if (d && d.int !== 0n && (!percent || compareDecimal(d, HUNDRED) <= 0)) return { kind: percent ? 'percent' : 'amount', value: d, text };
  reader.add('field-invalid', where(e), `The maxHolding of the compliance is "${cut(text, 60)}"; it must be an amount above 0 such as 5000, or a percent of the total supply above 0 and up to 100 such as 10%, with no sign, exponent or separator.`);
  return null;
}

// Reads the configuration from the root node: { config, findings, notes }. config is null when the top level is not an
// object.
export function readConfig(root, limits = CONFIG_LIMITS) {
  const reader = new Reader('config');
  const notes = [];
  if (!isObject(root)) {
    reader.add('file-unreadable', where(root), `The top level of the configuration is ${describe(root)}, not an object with the token, its compliance, roles and controls, so nothing was checked.`);
    return { config: null, findings: reader.findings, notes: ['the configuration was not checked, because it holds no object at its top level'] };
  }
  const top = reader.fields(root, TOP_KEYS, 'the configuration');
  const missing = (at, Label, key) => reader.add('field-missing', at, `${Label} has no ${key}.`);
  const part = (key, what) => {
    const o = reader.object(top, key, 'the configuration', what);
    if (!o.entry) missing(where(root), 'The configuration', key);
    return o;
  };

  // The token.
  const token = { entry: null, name: null, symbol: null, standard: null, standardEntry: null, decimals: null, decimalsEntry: null, supply: null, supplyEntry: null };
  const t = part('token', 'its name, symbol, standard, decimals and totalSupply');
  token.entry = t.entry;
  if (t.value) {
    const m = reader.fields(t.value, TOKEN_KEYS, 'the token');
    for (const key of ['name', 'symbol', 'standard']) {
      const r = reader.text(m, key, 'the token');
      token[key] = r.value;
      if (key === 'standard') token.standardEntry = r.entry;
      if (r.value === null && !r.invalid) missing(where(t.entry), 'The token', key);
    }
    const dec = reader.whole(m, 'decimals', 'the token', { max: limits.maxDecimals, what: 'decimal places' });
    token.decimals = dec.value;
    token.decimalsEntry = dec.entry;
    if (!dec.entry) missing(where(t.entry), 'The token', 'decimals');
    const s = reader.amount(m, 'totalSupply', 'the token');
    token.supplyEntry = s.entry;
    token.supply = s.value === null ? null : readAmount(s.value);
    if (s.value === null && !s.invalid) missing(where(s.entry ?? t.entry), 'The token', 'totalSupply');
  }

  // The compliance rules.
  const compliance = { entry: null, countries: null, countriesEntry: null, claims: null, claimsEntry: null, maxHolders: null, maxHoldersEntry: null, perCountry: [], perCountryEntry: null, cap: null, capEntry: null, classes: null, classesEntry: null };
  const c = part('compliance', 'the allowed countries, the required claims and the limits');
  compliance.entry = c.entry;
  if (c.value) {
    const m = reader.fields(c.value, COMPLIANCE_KEYS, 'the compliance');
    const countries = reader.list(m, 'allowedCountries', 'the compliance');
    compliance.countriesEntry = countries.entry;
    if (countries.value) {
      const seen = new Set();
      compliance.countries = [];
      for (const item of countries.value.slice(0, limits.maxItems)) {
        if (seen.has(item.value)) reader.add('field-invalid', where(item.node), `The allowedCountries name ${cut(item.value, 20)} twice; the second was left out.`);
        else {
          seen.add(item.value);
          compliance.countries.push(item);
        }
      }
    } else if (!countries.entry) missing(where(c.entry), 'The compliance', 'allowedCountries');
    const claims = reader.list(m, 'requiredClaims', 'the compliance');
    compliance.claimsEntry = claims.entry;
    if (claims.value) compliance.claims = [...new Set(claims.value.map((i) => i.value.toUpperCase()))];
    else if (!claims.entry) missing(where(c.entry), 'The compliance', 'requiredClaims');
    const max = reader.whole(m, 'maxHolders', 'the compliance', { min: 1, max: limits.maxHolders, what: 'holders' });
    compliance.maxHolders = max.value;
    compliance.maxHoldersEntry = max.entry;
    const per = reader.object(m, 'maxHoldersPerCountry', 'the compliance', 'a limit of holders for each country code, such as {"US": 35}');
    compliance.perCountryEntry = per.entry;
    if (per.value) {
      for (const e of per.value.entries.slice(0, limits.maxItems)) {
        if (e.secret || e.value.secret) continue;
        const one = reader.whole(new Map([[e.key, e]]), e.key, 'the maxHoldersPerCountry', { min: 1, max: limits.maxHolders, what: 'holders' });
        if (one.value !== null) compliance.perCountry.push({ code: e.key, limit: one.value, entry: e });
      }
    }
    const cap = m.get('maxHolding');
    compliance.capEntry = cap ?? null;
    if (cap && !cap.value.secret) {
      if (cap.value.kind !== 'number' && cap.value.kind !== 'string') reader.add('field-invalid', where(cap), `The maxHolding of the compliance is ${describe(cap.value)}; it must be an amount such as 5000 or a percent such as 10%.`);
      else compliance.cap = readCap(reader, cap);
    }
    const ce = m.get('investorClasses');
    compliance.classesEntry = ce ?? null;
    if (ce && !ce.value.secret) {
      if (ce.value.kind !== 'array') reader.add('field-invalid', where(ce), `The investorClasses of the compliance are ${describe(ce.value)}; they must be a list of objects with a name and lockupDays.`);
      else {
        compliance.classes = [];
        for (const node of ce.value.items.slice(0, limits.maxItems)) {
          if (node.secret) continue;
          if (!isObject(node)) {
            reader.add('field-invalid', where(node), `An investor class is ${describe(node)}; it must be an object with a name and lockupDays.`);
            continue;
          }
          const cm = reader.fields(node, CLASS_KEYS, 'an investor class');
          const name = reader.text(cm, 'name', 'an investor class');
          const days = reader.whole(cm, 'lockupDays', `the investor class ${name.value === null ? '' : cut(name.value, 40)}`.trimEnd(), { max: limits.maxDays, what: 'days' });
          if (name.value === null) {
            if (!name.invalid) missing(where(node), 'An investor class', 'name');
            continue;
          }
          if (!days.entry) missing(where(node), `The investor class ${cut(name.value, 40)}`, 'lockupDays');
          const key = name.value.toLowerCase();
          if (compliance.classes.some((x) => x.key === key)) {
            reader.add('field-invalid', where(name.entry), `The investor class ${cut(name.value, 40)} is named twice; the second was left out.`);
            continue;
          }
          compliance.classes.push({ name: name.value, key, lockupDays: days.value, entry: name.entry, node });
        }
      }
    }
  }

  // The roles.
  const roles = { entry: null, owner: null, ownerEntry: null, agents: null, agentsEntry: null, multisig: null, multisigEntry: null };
  const r = part('roles', 'the owner, the agents and whether the agents are multisig wallets');
  roles.entry = r.entry;
  if (r.value) {
    const m = reader.fields(r.value, ROLE_KEYS, 'the roles');
    const owner = reader.text(m, 'owner', 'the roles');
    roles.owner = owner.value;
    roles.ownerRaw = owner.raw ?? null;
    roles.ownerEntry = owner.entry;
    if (owner.value === null && !owner.invalid) missing(where(r.entry), 'The roles', 'owner');
    const agents = reader.list(m, 'agents', 'the roles');
    roles.agentsEntry = agents.entry;
    roles.agents = agents.value === null ? (agents.invalid ? null : []) : agents.value.slice(0, limits.maxItems);
    const ms = reader.flag(m, 'multisig', 'the roles');
    roles.multisig = ms.value;
    roles.multisigEntry = ms.entry;
  }

  // The controls.
  const controls = { entry: null };
  const k = part('controls', 'pausable, forcedTransfer and recovery, each true or false');
  controls.entry = k.entry;
  if (k.value) {
    const m = reader.fields(k.value, CONTROL_KEYS, 'the controls');
    for (const key of ['pausable', 'forcedTransfer', 'recovery']) {
      const f = reader.flag(m, key, 'the controls');
      controls[key] = f.value;
      controls[`${key}Entry`] = f.entry;
      if (!f.entry) missing(where(k.entry), 'The controls', key);
    }
  }
  return { config: { root, token, compliance, roles, controls }, findings: reader.findings, notes };
}
