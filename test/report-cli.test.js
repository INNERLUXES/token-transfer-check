import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INPUTS, INPUT_NAMES, RULES, USAGE, VERSION, buildReport, checkTexts, listChecksJson, listChecksMarkdown, listChecksText, parseArgs, toJson, toMarkdown, toSarif, toText } from '../src/index.js';
import { ARGS, BAD, GOOD, HOLDERS, addr, cli, config, csvText, holder, run, text, texts, transfer } from './helpers.js';

const ch = (...codes) => String.fromCharCode(...codes);
// A set with an error and a warning: a transfer inside its lock-up, and recovery switched off.
const MIXED = { ...BAD, 'token.json': text(config({ controls: { recovery: false } })) };
const files = { config: { file: 'mem.json', bytes: 1, lines: 1 }, register: { file: 'reg.json', bytes: 1, lines: 1 }, transfers: { file: 'tr.json', bytes: 1, lines: 1 } };

test('exit codes: 0 for a pass, 1 for a finding at or above the fail-on level, 2 for a usage or input error', async () => {
  assert.equal((await run(GOOD, ARGS)).code, 0);
  assert.equal((await run(BAD, ARGS)).code, 1);
  assert.equal((await run(GOOD, ['token.json'])).code, 0);
  assert.equal((await run(GOOD, ['token.json', '--register', 'register.json'])).code, 0);
  assert.equal((await run(GOOD, ['nothing.json'])).code, 2);
  assert.equal((await run(GOOD, [])).code, 2);
  assert.equal((await run(GOOD, ['token.json', 'register.json'])).code, 2);
  assert.equal((await run(GOOD, ['token.json', '--bogus'])).code, 2);
  const both = await run({}, ['a.json', '--register', 'b.json']);
  assert.equal(both.code, 2);
  assert.match(both.err, /the input has problems:\n {2}a\.json: does not exist\n {2}b\.json: does not exist\n/);
});

test('--transfers needs --register, and every path is local', () => {
  assert.throws(() => parseArgs(['t.json', '--transfers', 'x.json']), /--transfers needs --register/);
  assert.throws(() => parseArgs(['t.json', '--register', 'https://example.com/r.csv']), /never fetches a URL/);
  assert.throws(() => parseArgs(['t.json', '--register', 'a', '--register', 'b']), /given twice/);
  assert.deepEqual(parseArgs(['t.json', '--register', 'r.csv', '--transfers', 'x.csv']).register, 'r.csv');
});

test('--fail-on and --min-severity: a warning fails the run at warning, and a hidden finding still counts for the result', async () => {
  const w = { 'w.json': text(config({ controls: { recovery: false } })) };
  assert.equal((await run(w, ['w.json'])).code, 0);
  assert.equal((await run(w, ['w.json', '--fail-on', 'warning'])).code, 1);
  assert.equal((await run(w, ['w.json', '--fail-on', 'info'])).code, 1);
  const r = await run(MIXED, [...ARGS, '--min-severity', 'error']);
  assert.match(r.out, /findings: 1 \(1 error\); 1 below error not shown\n/);
  const hidden = await run(w, ['w.json', '--min-severity', 'error', '--fail-on', 'warning']);
  assert.match(hidden.out, /findings: 0; 1 below error not shown/);
  assert.equal(hidden.code, 1);
});

test('the text report names the files, the token, the register, the transfers, the checks, each finding with its file, line and fix, the countries, and ends with the notice and the result', async () => {
  const r = await run(BAD, ARGS);
  assert.match(r.out, /^token-transfer-check: token\.json\n/);
  assert.match(r.out, /\nfiles: config token\.json \(JSON, \d+ lines, [\d,]+ bytes\); register register\.json \(JSON, \d+ lines, [\d,]+ bytes\); transfers transfers\.json \(JSON, \d+ lines, [\d,]+ bytes\)\n/);
  assert.match(r.out, /\ntoken: Harbor Example Tower Token \(HXT\); ERC-3643; 0 decimals; total supply 1000\n/);
  assert.match(r.out, /\nregister: 4 holders, 3 with a balance above 0; balances add up to 1000\n/);
  assert.match(r.out, /\ntransfers: 1 transfer, 0 taken as made; 3 holders after them\n/);
  assert.match(r.out, /\nfindings: 1 \(1 error\)\n/);
  assert.match(r.out, /ERROR {4}transfer-in-lockup {12}transfers\.json:\d+\n/);
  assert.match(r.out, /fix: Move the transfer to the day the lock-up ends or later/);
  assert.match(r.out, /\nChecks \(27\)\n/);
  assert.ok(r.out.includes(['Holders by country (3)', '', '  country  allowed  limit  holders  after transfers', '  DE       yes      -      1        1'].join('\n')));
  assert.match(r.out, /will settle\.\n\nRESULT: FAIL - 1 finding at or above error/);
  assert.ok(r.out.endsWith('\n'));
  const good = await run(GOOD, ['token.json']);
  assert.match(good.out, /Findings \(0\)\n\n {2}none\n/);
  assert.match(good.out, /\nregister: not given\ntransfers: not given\n/);
  assert.match(good.out, / {2}US {7}yes {6}5 {6}- {8}-\n/);
});

test('--explain adds the points of the pages to text, markdown and JSON, and the tool\'s own choice to a best practice check', async () => {
  const set = { ...MIXED, 'token.json': text(config({ roles: { multisig: false } })) };
  const r = await run(set, [...ARGS, '--explain']);
  assert.match(r.out, /basis: As one example of a lock-up, Rule 144 \(d\) sets a holding period.*\(eCFR: 17 CFR 230\.144 \(Rule 144\), paragraph \(d\), Holding period for restricted securities, https:\/\/www\.ecfr\.gov\/current\/title-17\/section-230\.144\)/);
  assert.match(r.out, /the tool's own choice: asking for more than one key behind the power to move an investor's tokens is a best practice of this tool/);
  const md = (await run(set, [...ARGS, '--format', 'markdown', '--explain'])).out;
  assert.match(md, /## Basis\n\n### transfer-in-lockup\n\n- The functions of an ERC-3643 token/);
  const json = JSON.parse((await run(set, [...ARGS, '--json', '--explain'])).out);
  assert.equal(json.findings[0].basis[0].url, 'https://eips.ethereum.org/EIPS/eip-3643');
  const plain = JSON.parse((await run(set, [...ARGS, '--json'])).out);
  assert.equal(plain.findings[0].basis, undefined);
  assert.equal((await run(set, [...ARGS, '--format', 'sarif', '--explain'])).code, 2);
});

test('the JSON report: the tool, the inputs, the token, the summary, totals by level, the rules, the findings, the countries and the result', async () => {
  const set = { 'token.json': text(config()), 'register.csv': csvText(HOLDERS), 'transfers.csv': csvText([transfer({ amount: '401', to: addr('4') })]) };
  const r = JSON.parse((await run(set, ['token.json', '--register', 'register.csv', '--transfers', 'transfers.csv', '--json'])).out);
  assert.equal(r.tool, 'token-transfer-check');
  assert.equal(r.version, VERSION);
  assert.deepEqual(Object.keys(r.inputs), ['config', 'register', 'transfers']);
  assert.equal(r.inputs.register.format, 'csv');
  assert.deepEqual(r.token, { name: 'Harbor Example Tower Token', symbol: 'HXT', standard: 'ERC-3643', decimals: 0, totalSupply: '1000' });
  assert.deepEqual(r.summary, { holders: 4, holding: 3, sumOfBalances: '1000', transfers: 1, made: 0, holdingAfter: 3 });
  assert.deepEqual(r.totals, { findings: 1, byLevel: { error: 1, warning: 0, info: 0 }, hidden: 0 });
  assert.equal(r.rules.length, RULES.length);
  const f = r.findings[0];
  assert.deepEqual(Object.keys(f), ['id', 'severity', 'message', 'file', 'input', 'line', 'column', 'at', 'subject', 'fix', 'kind']);
  assert.deepEqual([f.id, f.file, f.input, f.line, f.at, f.subject], ['balance-insufficient', 'transfers.csv', 'transfers', 2, 'transfers.csv:2', 'T-1']);
  assert.deepEqual(r.result, { pass: false, failOn: 'error', text: 'FAIL - 1 finding at or above error (1 error)' });
  assert.equal(r.countries.length, 3);
});

test('the SARIF report: version 2.1.0, every check as a rule, the files as artifacts and a result with its file, line and column', async () => {
  const s = JSON.parse((await run(MIXED, [...ARGS, '--format', 'sarif'])).out);
  assert.equal(s.version, '2.1.0');
  const runOf = s.runs[0];
  assert.equal(runOf.tool.driver.name, 'token-transfer-check');
  assert.equal(runOf.tool.driver.rules.length, RULES.length);
  assert.deepEqual(runOf.artifacts.map((a) => a.location.uri), ['token.json', 'register.json', 'transfers.json']);
  assert.deepEqual(runOf.results.map((x) => [x.ruleId, x.level, x.locations[0].physicalLocation.artifactLocation.uri, x.locations[0].physicalLocation.artifactLocation.index]), [['transfer-in-lockup', 'error', 'transfers.json', 2], ['recovery-missing', 'warning', 'token.json', 0]]);
  assert.ok(runOf.results[0].locations[0].physicalLocation.region.startLine > 1);
  assert.equal(runOf.results[0].ruleIndex, RULES.findIndex((x) => x.id === 'transfer-in-lockup'));
  assert.equal(runOf.properties.sources.length, 6);
});

test('the markdown report escapes what markdown gives a meaning to, and every format replaces control and direction characters', async () => {
  const name = `Example [link](https://x.example) | ${ch(0x1b)}[31m red ${ch(0x202e)}rtl ${ch(7)}`;
  const set = { ...GOOD, 'token.json': text(config({ token: { name, symbol: `X${ch(0x2028)}T` } })), 'transfers.json': text({ transfers: [transfer({ id: `P|${ch(0x1b)}9`, amount: '0' })] }) };
  for (const format of ['text', 'markdown', 'json', 'sarif']) {
    const out = (await run(set, [...ARGS, '--format', format])).out;
    assert.ok(![...out].some((c) => [0x1b, 0x202e, 0x2028, 7].includes(c.charCodeAt(0))), format);
  }
  const md = (await run(set, [...ARGS, '--format', 'markdown'])).out;
  assert.match(md, /transfer P\\\| 9/);
  assert.doesNotMatch(md, /\]\(https/);
});

test('--list-checks in text, markdown and JSON, and no SARIF form', async () => {
  assert.match((await cli(['--list-checks'], process.cwd())).out, /^token-transfer-check checks\n\n {2}file-unreadable/);
  assert.equal(listChecksText().split('\n').filter((l) => /^ {2}[a-z]/.test(l)).length, RULES.length);
  assert.match(listChecksText(), /None of it is legal advice\./);
  assert.match(listChecksMarkdown(), /\| transfer-in-lockup \| error \| documented \|/);
  assert.equal(JSON.parse(listChecksJson()).length, RULES.length);
  assert.equal((await cli(['--list-checks', '--format', 'markdown'], process.cwd())).code, 0);
  assert.equal((await cli(['--list-checks', '--format', 'sarif'], process.cwd())).code, 2);
});

test('--help, --version and usage errors: the usage names every check and option, and a value that looks like an option is refused', async () => {
  const help = await cli(['--help'], process.cwd());
  assert.equal(help.code, 0);
  for (const r of RULES) assert.ok(help.out.includes(r.id), r.id);
  for (const o of ['--register', '--transfers', '--format', '--json', '--min-severity', '--fail-on', '--explain', '--list-checks', '--help', '--version']) assert.ok(USAGE.includes(o), o);
  assert.match(USAGE, /is not legal\nadvice|is not legal advice/);
  assert.equal((await cli(['--version'], process.cwd())).out, `${VERSION}\n`);
  assert.throws(() => parseArgs(['a', '--fail-on', '--json']), /--fail-on needs a value/);
  assert.throws(() => parseArgs(['a', '--fail-on', 'fatal']), /unknown level fatal/);
  assert.throws(() => parseArgs(['a', '--format', 'xml']), /unknown format xml/);
  assert.throws(() => parseArgs(['a', '--json', '--format', 'text']), /ask for two formats/);
  assert.throws(() => parseArgs(['-']), /standard input is not supported/);
  assert.throws(() => parseArgs(['a', '--register', '-']), /standard input is not supported/);
  assert.throws(() => parseArgs(['https://example.com/token.json']), /never fetches a URL/);
  assert.throws(() => parseArgs(['a', '--fail-on', 'error', '--fail-on', 'warning']), /given twice/);
  const err = await cli(['--bogus'], process.cwd());
  assert.match(err.err, /^token-transfer-check: unknown argument --bogus\n\nUsage:/);
});

test('buildReport and the formats can be used without the file system, with any of the files left out', () => {
  const checked = checkTexts(texts({ transfers: [transfer()] }));
  const report = buildReport({ files, checked, version: '0' });
  assert.match(toText(report), /^token-transfer-check: mem\.json/);
  assert.match(toMarkdown(report), /^# token-transfer-check: mem\.json/);
  assert.equal(JSON.parse(toJson(report)).inputs.config.file, 'mem.json');
  assert.equal(JSON.parse(toSarif(report)).runs[0].results.length, 0);
  const none = buildReport({ files: { config: files.config }, checked: checkTexts({ config: { text: '[' } }), version: '0' });
  assert.match(toText(none), /token: no configuration was read/);
  assert.equal(none.countries, null);
  assert.deepEqual(INPUTS, ['config', 'register', 'transfers']);
  assert.equal(INPUT_NAMES.transfers, 'transfers file');
  const empty = buildReport({ files: { config: files.config, register: files.register }, checked: checkTexts({ config: { text: text(config()) }, register: { text: '{}', format: 'json' } }), version: '0' });
  assert.match(toText(empty), /register: no holder was read/);
  const unread = checkTexts(texts({ holders: [holder({ address: addr('9'), balance: 'x' }), ...HOLDERS.slice(1)] }));
  assert.match(toText(buildReport({ files: { config: files.config, register: files.register }, checked: unread, version: '0' })), /balances add up to a sum that could not be read/);
});
