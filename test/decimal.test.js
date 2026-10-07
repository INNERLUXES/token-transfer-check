import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADDRESS_FORM, COUNTRY_CODES, DECIMAL_LIMITS, REGISTRY_CODES, UN_CODES, ZERO, addDecimal, addressKey, addressProblem, compareDecimal, countryHint, formatDecimal, isCountry, isZero, mulDecimal, parseDecimal, percentOf, placesOf, subDecimal } from '../src/index.js';
import { addr } from './helpers.js';

const d = (raw) => parseDecimal(raw);

test('parseDecimal: plain decimals into a whole number and a scale', () => {
  assert.deepEqual(d('0'), { int: 0n, scale: 0 });
  assert.deepEqual(d('2500'), { int: 2500n, scale: 0 });
  assert.deepEqual(d('0.5'), { int: 5n, scale: 1 });
  assert.deepEqual(d('1.050'), { int: 1050n, scale: 3 });
  assert.deepEqual(d(`${'9'.repeat(40)}.${'1'.repeat(40)}`).scale, 40);
});

test('parseDecimal: a sign, an exponent, a leading zero, a lone point, a separator and too many digits are refused', () => {
  for (const raw of ['-1', '+1', '1e3', '1E-2', '01', '00.5', '.5', '5.', '', ' 1', '1,000', '1 000', '1.000,50', `1${'0'.repeat(40)}`, `0.${'1'.repeat(41)}`, '0x10', 'NaN', 'Infinity', '10%']) assert.equal(parseDecimal(raw), null, raw);
  assert.equal(DECIMAL_LIMITS.maxDigits, 40);
});

test('compareDecimal: compares as written, across scales, with no floating point', () => {
  assert.equal(compareDecimal(d('1000'), d('1000.000')), 0);
  assert.equal(compareDecimal(d('999.99'), d('1000')), -1);
  assert.equal(compareDecimal(d('1000.000000000000000001'), d('1000')), 1, 'a difference a double would lose');
  assert.equal(compareDecimal(d('30'), d('5')), 1);
});

test('addDecimal and subDecimal: exact sums and differences across scales, where a floating point number would not be', () => {
  assert.equal(formatDecimal(addDecimal(d('0.1'), d('0.2'))), '0.3');
  assert.equal(0.1 + 0.2 === 0.3, false, 'the reason the sums are made with BigInt');
  assert.equal(formatDecimal(addDecimal(d('1500.00'), d('820.005'))), '2320.005');
  assert.equal(compareDecimal(addDecimal(ZERO, d('5')), d('5.0')), 0);
  assert.equal(formatDecimal(subDecimal(d('4000'), d('3000.5'))), '999.5');
  assert.equal(formatDecimal(subDecimal(d('0.3'), d('0.1'))), '0.2');
  assert.ok(isZero(subDecimal(d('12.50'), d('12.5'))));
});

test('mulDecimal and percentOf: a cap of a percent of the supply, exact', () => {
  assert.equal(formatDecimal(mulDecimal(d('100000'), percentOf(d('20')))), '20000');
  assert.equal(formatDecimal(mulDecimal(d('50000.00'), percentOf(d('4.99')))), '2495');
  assert.equal(formatDecimal(mulDecimal(d('1000'), percentOf(d('0.001')))), '0.01');
  assert.equal(formatDecimal(percentOf(d('100'))), '1');
});

test('placesOf, formatDecimal and isZero: the places a value needs and its shortest form', () => {
  assert.equal(placesOf(d('1500.50')), 1);
  assert.equal(placesOf(d('1500.00')), 0);
  assert.equal(placesOf(d('250.125')), 3);
  assert.equal(placesOf(d('0.0001')), 4);
  assert.equal(placesOf(d('7')), 0);
  assert.equal(formatDecimal(d('1.050')), '1.05');
  assert.equal(formatDecimal(d('1.000')), '1');
  assert.equal(formatDecimal(d('0.01')), '0.01');
  assert.equal(formatDecimal(d('0.000')), '0');
  assert.ok(isZero(d('0.00')));
  assert.ok(!isZero(d('0.01')));
});

test('addressProblem: 0x and 40 hex digits, not the zero address, with near misses', () => {
  assert.equal(addressProblem(addr('a')), null);
  assert.equal(addressProblem(`0x${'Ab'.repeat(20)}`), null, 'mixed case is a form, the checksum is not checked');
  assert.match(addressProblem('1x'.padEnd(42, '1')), /does not start with 0x/);
  assert.match(addressProblem('0x1234'), /has 4 characters after 0x, not 40/);
  assert.match(addressProblem(addr().slice(0, 41)), /39 characters/);
  assert.match(addressProblem(`${addr()}1`), /41 characters/);
  assert.match(addressProblem(`0x${'g'.repeat(40)}`), /not a hex digit/);
  assert.match(addressProblem(addr('0')), /zero address/);
  assert.match(addressProblem(` ${addr()}`), /spaces around it/);
  assert.equal(addressKey(` 0x${'AB'.repeat(20)} `), `0x${'ab'.repeat(20)}`);
  assert.match(ADDRESS_FORM, /40 hex digits/);
});

test('isCountry and countryHint: the codes of the UN table and XK, in capitals; UK, small letters and TW get a hint', () => {
  for (const c of ['US', 'GB', 'DE', 'CH', 'SG', 'XK', 'AX', 'JE']) assert.ok(isCountry(c), c);
  for (const c of ['UK', 'us', 'TW', 'XX', 'EU', 'USA', '']) assert.ok(!isCountry(c), c);
  assert.equal(countryHint('UK'), ' The code of the United Kingdom is GB.');
  assert.equal(countryHint('de'), ' Write the code in capitals.');
  assert.match(countryHint('TW'), /lists no code for Taiwan/);
  assert.equal(countryHint('XX'), '');
  assert.deepEqual(REGISTRY_CODES, ['XK']);
  assert.ok(!UN_CODES.includes('XK') && !UN_CODES.includes('TW'));
  assert.equal(COUNTRY_CODES.length, UN_CODES.length + 1);
  assert.deepEqual(COUNTRY_CODES, [...COUNTRY_CODES].sort());
});
