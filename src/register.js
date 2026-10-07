// Reading the holder register, as a CSV table with a header row or as JSON with a list of holders. The register is what
// the identity registry of the token and its balances say: for each investor the address of the wallet, the country,
// the investor class, the claims the identity holds, the balance, the day the tokens were acquired, and whether the
// wallet or a part of its tokens is frozen. An investor with a balance of 0 is registered and holds nothing. Days are
// whole numbers the file chooses, such as days since the token was issued; the tool reads no clock.

import { Reader, cut, readAmount, rowsOf, where } from './fields.js';
import { isObject } from './json.js';

export const REGISTER_LIMITS = { maxHolders: 100000, maxDay: 10000000 };

export const HOLDER_KEYS = ['address', 'country', 'investorClass', 'claims', 'balance', 'acquiredDay', 'frozen', 'frozenTokens', 'notes'];

// Reads the register: { holders, findings, notes }, with holders null when the file holds no list of holders.
export function readRegister(source, limits = REGISTER_LIMITS) {
  const reader = new Reader('register');
  const csv = source.format === 'csv';
  const { rows, notes } = rowsOf(reader, source, { listKey: 'holders', rowKeys: HOLDER_KEYS, what: 'holder', label: 'register', limit: limits.maxHolders });
  if (rows === null) return { holders: null, findings: reader.findings, notes };
  const holders = [];
  for (const [index, node] of rows.entries()) {
    const n = index + 1;
    if (!isObject(node)) {
      if (!node.secret) reader.add('field-invalid', where(node), `Holder ${n} of the register is a ${node.kind === 'array' ? 'list' : 'value'}; it must be an object.`);
      continue;
    }
    const map = reader.fields(node, HOLDER_KEYS, `holder ${n}`, false);
    const address = reader.text(map, 'address', `holder ${n}`);
    const title = address.value === null ? `${n}` : cut(address.value, 60);
    const of = `holder ${title}`;
    if (!csv) reader.fields(node, HOLDER_KEYS, of);
    const Of = `Holder ${title}`;
    const h = { index: n, line: node.line, column: node.column, title, address: address.value, addressRaw: address.raw ?? null, addressEntry: address.entry };
    if (address.value === null && !address.invalid) reader.add('field-missing', where(node), `Holder ${n} of the register has no address.`, title);
    const country = reader.text(map, 'country', of);
    h.country = country.value;
    h.countryEntry = country.entry;
    if (country.value === null && !country.invalid) reader.add('field-missing', where(node), `${Of} has no country.`, title);
    const cls = reader.text(map, 'investorClass', of);
    h.investorClass = cls.value;
    h.classEntry = cls.entry;
    h.classInvalid = Boolean(cls.invalid);
    const claims = reader.list(map, 'claims', of, csv);
    h.claims = claims.value === null ? (claims.invalid ? null : []) : claims.value.map((i) => i.value.toUpperCase());
    h.claimsEntry = claims.entry;
    const bal = reader.amount(map, 'balance', of);
    h.balanceEntry = bal.entry;
    h.balance = bal.value === null ? null : readAmount(bal.value);
    if (bal.value === null && !bal.invalid) reader.add('field-missing', bal.entry ? where(bal.entry) : where(node), `${Of} has no balance; write 0 for an investor who is registered and holds nothing.`, title);
    const day = reader.whole(map, 'acquiredDay', of, { max: limits.maxDay, what: 'days', text: true });
    h.acquiredDay = day.value;
    h.acquiredEntry = day.entry;
    h.acquiredInvalid = Boolean(day.invalid);
    const frozen = reader.flag(map, 'frozen', of, csv);
    h.frozen = frozen.value === true;
    h.frozenEntry = frozen.entry;
    const ft = reader.amount(map, 'frozenTokens', of);
    h.frozenTokensEntry = ft.entry;
    h.frozenTokens = null;
    if (ft.value !== null) {
      const a = readAmount(ft.value);
      if (a.state === 'ok' || a.state === 'zero') h.frozenTokens = a.value;
      else reader.add('field-invalid', where(ft.entry), `The frozenTokens of ${of} is "${cut(ft.value, 60)}"; it must be a plain decimal number of 0 or more.`, title);
    }
    holders.push(h);
  }
  return { holders, findings: reader.findings, notes };
}
