// Reading the proposed transfers, as a CSV table with a header row or as JSON with a list of transfers: for each its id,
// the address it is sent from and to, the amount and the day it is to be made. The day is a whole number on the same
// scale as the acquiredDay of the register, such as days since the token was issued; the tool reads no clock and
// compares the day of the transfer with the day the tokens were acquired.

import { Reader, cut, readAmount, rowsOf, where } from './fields.js';
import { isObject } from './json.js';

export const TRANSFER_LIMITS = { maxTransfers: 100000, maxDay: 10000000 };

export const TRANSFER_KEYS = ['id', 'from', 'to', 'amount', 'day', 'notes'];

// Reads the transfers: { transfers, findings, notes }, with transfers null when the file holds no list of transfers.
export function readTransfers(source, limits = TRANSFER_LIMITS) {
  const reader = new Reader('transfers');
  const csv = source.format === 'csv';
  const { rows, notes } = rowsOf(reader, source, { listKey: 'transfers', rowKeys: TRANSFER_KEYS, what: 'transfer', label: 'transfers file', limit: limits.maxTransfers });
  if (rows === null) return { transfers: null, findings: reader.findings, notes };
  const transfers = [];
  for (const [index, node] of rows.entries()) {
    const n = index + 1;
    if (!isObject(node)) {
      if (!node.secret) reader.add('field-invalid', where(node), `Transfer ${n} is a ${node.kind === 'array' ? 'list' : 'value'}; it must be an object.`);
      continue;
    }
    const map = reader.fields(node, TRANSFER_KEYS, `transfer ${n}`, false);
    const id = reader.text(map, 'id', `transfer ${n}`, true);
    const title = id.value === null ? `${n}` : cut(id.value, 60);
    const of = `transfer ${title}`;
    if (!csv) reader.fields(node, TRANSFER_KEYS, of);
    const Of = `Transfer ${title}`;
    const t = { index: n, line: node.line, column: node.column, title, id: id.value, idEntry: id.entry };
    if (id.value === null && !id.invalid) reader.add('field-missing', where(node), `Transfer ${n} has no id, so it cannot be told apart from the other transfers.`, title);
    for (const key of ['from', 'to']) {
      const r = reader.text(map, key, of);
      t[key] = r.value;
      t[`${key}Raw`] = r.raw ?? null;
      t[`${key}Entry`] = r.entry;
      if (r.value === null && !r.invalid) reader.add('field-missing', where(node), `${Of} has no ${key} address.`, title);
    }
    const amt = reader.amount(map, 'amount', of);
    t.amountEntry = amt.entry;
    t.amount = amt.value === null ? null : readAmount(amt.value);
    if (amt.value === null && !amt.invalid) reader.add('field-missing', amt.entry ? where(amt.entry) : where(node), `${Of} has no amount.`, title);
    const day = reader.whole(map, 'day', of, { max: limits.maxDay, what: 'days', text: true });
    t.day = day.value;
    t.dayEntry = day.entry;
    if (!day.entry && !day.invalid) reader.add('field-missing', where(node), `${Of} has no day; the lock-up is worked out from the day of the transfer, and the tool reads no clock.`, title);
    else if (day.value === null && !day.invalid) reader.add('field-missing', where(day.entry), `${Of} has no day; the lock-up is worked out from the day of the transfer, and the tool reads no clock.`, title);
    transfers.push(t);
  }
  return { transfers, findings: reader.findings, notes };
}
