// Runs the README examples, checks that they report what the README shows, and writes the reports of the two made-up
// tokens to examples/output. CI runs it and then fails if those files changed, so the example output in the repository
// is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the examples; every path is relative to the root of the repository.
export const BAD = ['examples/bad/config.json', '--register', 'examples/bad/register.csv', '--transfers', 'examples/bad/transfers.json'];
export const GOOD = ['examples/good/config.json', '--register', 'examples/good/register.csv', '--transfers', 'examples/good/transfers.csv'];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
export async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

// What the README says of the bad token: the counts, a finding of nearly every check, and the result.
export const EXPECTED = [
  'token: Harbor Example Tower Token (HXT); ERC-1400; 0 decimals; total supply 100000',
  'register: 13 holders, 10 with a balance above 0; balances add up to 97012.5',
  'transfers: 15 transfers, 2 taken as made; 10 holders after them',
  'findings: 33 (29 error, 4 warning)',
  'The balances of the register add up to 97012.5, but the totalSupply of the token is 100000, 2987.5 more.',
  'The allowedCountries name "UK", which is not a two-letter code of the country table the tool reads',
  'The code of the United Kingdom is GB.',
  'The file holds the key "seedPhrase", which names a seed, a mnemonic or a private key.',
  'The token is not pausable (pausable is false).',
  'The column "notes" is named twice in the header of the register',
  'Holder 0x4444444444444444444444444444444444444444 holds 25000 tokens, above the maxHolding of 20%, which is 20000 of the total supply.',
  'Holder 0x5555555555555555555555555555555555555555 holds 8000 tokens, but its identity lacks the required claim ACCREDITATION',
  'Holder 0x6666666666666666666666666666666666666666 holds 6000 tokens and its country is FR, which is not in the allowedCountries',
  'The address 0x1111111111111111111111111111111111111111 is also the address of the holder at line 2',
  'The UN table the tool reads lists no code for Taiwan; check the code by hand.',
  'The address of holder 0x1234 has 4 characters after 0x, not 40',
  'The investorClass of holder 0x1234 is "founders", which is not a class of the configuration (reg-d and reg-s).',
  'Holder 0xdddddddddddddddddddddddddddddddddddddddd has no acquiredDay, but its class reg-s has a lock-up of 40 days',
  'The balance of holder 0xdddddddddddddddddddddddddddddddddddddddd is 12.5, with 1 decimal place, but the token has 0 decimals',
  'Transfer T-01 is made on day 400, but the sender, of the class reg-d, acquired its tokens on day 300 and the class holds them for 365 days: the lock-up ends on day 665, 265 days later.',
  'Transfer T-02 makes 0x9999999999999999999999999999999999999999 a new holder in US, which brings the holders there to 4, above the limit of 3 for US.',
  'Transfer T-02 makes 0x9999999999999999999999999999999999999999 a new holder, which brings the holders to 11, above the maxHolders of 10.',
  'Transfer T-03 is sent from 0x7777777777777777777777777777777777777777, a frozen wallet',
  'Transfer T-04 sends 1500 tokens, but 3000 of the 4000 the sender holds are frozen, which leaves a free balance of 1000.',
  'Transfer T-05 is sent from 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee, which is not in the register',
  'Transfer T-06 brings 0x3333333333333333333333333333333333333333 to 22000 tokens, above the maxHolding of 20%',
  'Transfer T-07 is sent to 0xffffffffffffffffffffffffffffffffffffffff, which is not in the register, so the identity registry does not verify it',
  'Transfer T-08 is sent to 0x5555555555555555555555555555555555555555, whose identity lacks the required claim ACCREDITATION',
  'Transfer T-09 is sent to 0x6666666666666666666666666666666666666666, whose country FR is not in the allowedCountries',
  'The amount of transfer T-10 is 2.5, with 1 decimal place, but the token has 0 decimals',
  'The amount of transfer T-11 is 0, a transfer of nothing',
  'The id T-03 is also the id of the transfer at line 6',
  'The to address of transfer T-13, "0x12345", has 5 characters after 0x, not 40',
  'Transfer T-15 has no day; the lock-up is worked out from the day of the transfer, and the tool reads no clock.',
  'The standard of the token is "ERC-1400", not ERC-3643',
  'One agent holds forced transfers, and the roles do not say it is a multisig wallet (multisig is false)',
  'Recovery is off (recovery is false).',
  'The key "note" of transfer T-14 is not one the tool reads, so its value was left out of every check. Did you mean "notes"?',
  'note: 10 transfers with a finding were taken as not made, as the chain would refuse them',
  'not legal advice, not a compliance review and not a guarantee that a transfer will settle',
  'RESULT: FAIL - 29 findings at or above error (29 error, 4 warning)'
];
// What must not be reported: the checks the bad token does not hold, the seed, and a pass.
export const UNWANTED = ['ERROR    file-unreadable', 'ERROR    agent-missing', 'WARNING  forced-transfer-missing', 'lantern', 'RESULT: PASS'];

// What the README says of the good token: no finding.
export const GOOD_EXPECTED = [
  'token: Meadow Example Lofts Token (MLT); ERC-3643; 2 decimals; total supply 50000',
  'register: 8 holders, 6 with a balance above 0; balances add up to 50000',
  'transfers: 4 transfers, 4 taken as made; 8 holders after them',
  'findings: 0',
  'RESULT: PASS - no finding at or above error'
];

const problems = [];
function expect(name, result, code, expected, unwanted, stream = 'out') {
  const text = result[stream];
  const missing = expected.filter((e) => !text.includes(e));
  const wrong = unwanted.filter((e) => text.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})${result.err ? `\n${result.err}` : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = await run(BAD);
  process.stdout.write(bad.out);
  expect('bad token', bad, 1, EXPECTED, UNWANTED);

  const good = await run(GOOD);
  expect('good token', good, 0, GOOD_EXPECTED, ['ERROR    ', 'WARNING  ', 'RESULT: FAIL']);
  // The good token also passes when warnings and notes fail the run.
  expect('good, fail on warning', await run([...GOOD, '--fail-on', 'warning']), 0, ['RESULT: PASS - no finding at or above warning'], []);
  expect('good, fail on info', await run([...GOOD, '--fail-on', 'info']), 0, ['RESULT: PASS - no finding at or above info'], []);
  // The configuration alone, with no register and no transfers, passes too.
  expect('good configuration alone', await run(['examples/good/config.json']), 0, ['register: not given', 'transfers: not given', 'RESULT: PASS'], []);
  // The bad token with only the errors shown still counts the rest.
  expect('bad, errors only', await run([...BAD, '--min-severity', 'error']), 1, ['findings: 29 (29 error); 4 below error not shown'], ['WARNING  ']);
  // Transfers with no register are a usage error, and a file that is not there stops the run with no report.
  expect('transfers with no register', await run(['examples/good/config.json', '--transfers', 'examples/good/transfers.csv']), 2, ['--transfers needs --register'], [], 'err');
  expect('missing file', await run(['examples/none/config.json']), 2, ['examples/none/config.json: does not exist'], [], 'err');

  // The README shows the head of the report of the bad token with its table of checks, one finding, the table of holders
  // by country and the end of the report, and the end of the report of the good token.
  const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
  const lines = bad.out.split('\n');
  const head = lines.slice(0, lines.findIndex((l) => l.startsWith('Findings ('))).join('\n');
  if (!readme.includes(head)) problems.push('README: the head of the sample output of the bad token differs from a real run');
  const explained = (await run([...BAD, '--explain'])).out.split('\n');
  const at = explained.findIndex((l) => l.includes('transfer-in-lockup') && l.includes('examples/bad/transfers.json:'));
  const sample = explained.slice(at, at + 5).join('\n');
  if (at < 0 || !readme.includes(sample)) problems.push('README: the sample finding of the lock-up check differs from a real run');
  const t = lines.findIndex((l) => l.startsWith('Holders by country ('));
  const table = lines.slice(t, t + 8).join('\n');
  if (t < 0 || !readme.includes(table)) problems.push('README: the table of holders by country of the bad token differs from a real run');
  const tail = lines.slice(-7).join('\n');
  if (!readme.includes(tail)) problems.push('README: the tail of the sample output of the bad token differs from a real run');
  const goodTail = good.out.split('\n').slice(-14).join('\n');
  if (!readme.includes(goodTail)) problems.push('README: the tail of the sample output of the good token differs from a real run');

  await mkdir(resolve(root, 'examples/output'), { recursive: true });
  await writeFile(resolve(root, 'examples/output/bad.txt'), bad.out);
  await writeFile(resolve(root, 'examples/output/good.txt'), good.out);
  const outputs = [
    ['bad-explain.txt', [...BAD, '--explain'], 1],
    ['bad.md', [...BAD, '--format', 'markdown'], 1],
    ['bad-explain.md', [...BAD, '--format', 'markdown', '--explain'], 1],
    ['bad.json', [...BAD, '--json', '--explain'], 1],
    ['bad.sarif', [...BAD, '--format', 'sarif'], 1],
    ['good.md', [...GOOD, '--format', 'markdown'], 0],
    ['good.json', [...GOOD, '--json'], 0],
    ['good.sarif', [...GOOD, '--format', 'sarif'], 0],
    ['checks.txt', ['--list-checks'], 0],
    ['checks.json', ['--list-checks', '--format', 'json'], 0]
  ];
  for (const [name, args, code] of outputs) {
    const r = await run(args);
    if (r.code !== code) problems.push(`${name}: exit code ${r.code}, expected ${code}`);
    await writeFile(resolve(root, 'examples/output', name), r.out);
  }

  if (problems.length) {
    for (const p of problems) console.error(`example: ${p}`);
    process.exit(1);
  }
}
