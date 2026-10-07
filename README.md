# token-transfer-check

Token transfer check. Give it the compliance configuration of a tokenized asset as JSON: the token with its decimals
and total supply, its standard such as ERC-3643, the allowed investor countries, the required investor claims such as
KYC and accreditation, the largest number of holders overall and by country, the largest holding of one investor, the
lock-up of each investor class in days, the owner and the agents, and whether the token is pausable and has forced
transfers and recovery. Give it as well, when you have them, the holder register and a list of proposed transfers, as
JSON or CSV. It reads the files and lists what would break the asset's own rules before it reaches the chain: a transfer
to an investor without the required claims or in a country that is not allowed, a transfer that would take the holders
over the limit overall or in a country, a holding above the cap, a transfer of tokens still in their lock-up by the
transfer's own day, an amount with more decimals than the token, holdings that do not add up to the total supply, a
transfer from or to a frozen wallet or of more than the free balance, a configuration with no agent or with one key
behind forced transfers, a token that cannot be paused, unknown countries, holders or transfer ids written twice and
malformed addresses. Every finding has its id, level, message and file and line, and the run exits with a code a
pipeline can act on.

**It is an input to a review before the transfers reach the chain: not legal advice, not a compliance review and not a
guarantee that a transfer will settle.** It is not legal advice and not a lawyer. It reads files only: it contacts no
chain, node, registry or API, fetches nothing, runs nothing, needs no key and reads no clock, so it does not know whether
the files match the deployed token, whether a claim is valid or whether the rules are the right ones for the asset; the
checks are a heuristic. A clean run means only that none of the problems of its checks were found in the files, and the
team still has to have counsel review the rules of the offering, export the register from the chain and approve the
transfers.

A permissioned token carries the rules of its offering in its contracts. ERC-3643 asks such a token to verify the
identity and claims of every receiver, to hold transfers to the countries, the number of holders and the amounts the
offering allows, to let agents freeze wallets, pause the token, force a transfer and recover the tokens of a lost
wallet, and its compliance contract can enforce lock-ups; ERC-20 gives the decimals, the supply and the balances it
builds on; and a securities law such as Rule 144 is one example of where a holding period of a class of investors comes
from. A country written UK for GB, a cap set as 20 instead of 20%, a register that left out a holder, a batch of
transfers that sends tokens bought last month or pushes a country over its limit is easy to miss in a review and costly
once it is on the chain. This tool reads the files on every change and points at the line.

- **One check per problem.** Twenty-seven checks, each with what it looks at, what it cannot see, the public pages it
  rests on and what to change. Each check is either documented (in ERC-3643, ERC-20, Rule 144 in the eCFR as an
  example of a lock-up, the UN M49 table, the IBAN registry of Swift or the page of ethereum.org on accounts) or a best
  practice of this tool, and its message says which.
- **The asset's own rules.** The countries, claims, limits, cap and lock-ups come from the configuration of the token.
  The tool keeps no list of countries an asset may sell to and no lock-up of its own.
- **No clock.** A lock-up is checked with the day each transfer carries against the day the sender acquired its tokens,
  both whole numbers of the files, so a list of transfers is checked for the days it is meant for.
- **Transfers in order.** The transfers are taken in the order of their day against the balances, holders and lock-ups
  the register and the transfers before them leave; a transfer with a finding is taken as not made, as the chain would
  refuse it.
- **Never a secret.** The tool needs no private key, no seed and no API key. A key or column named for a private key or
  a seed, and a value shaped like a mnemonic, an extended private key, a private key in hex or a key in WIF, is an error,
  and the value is never shown in any report.
- **Amounts as written.** Amounts, balances, supplies and caps are read, added, multiplied and compared from the
  characters of the file, never through a floating point number, so a cap of 20% of 100000 is 20000 exactly.
- **Strict readers of its own.** The CSV and JSON readers keep the line and column of every value, so a finding points at
  the row of the holder or the transfer; a CSV row with a field too many, which would shift every value after it, stops
  the reader instead. What the files do not say is listed as a finding, never taken for a value that is fine.
- Reports as text, markdown, JSON and SARIF, with an exit code for a pipeline: `0` no finding at or above the
  `--fail-on` level, `1` a finding at or above it, `2` usage or input error.
- Plain JavaScript, no dependencies, no clock and no network.

```
npm test
```

```
tests 147
pass 145
fail 0
skipped 2
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a
symbolic link or a device (a link to a configuration, and `/dev/null` named as a file); they are guarded with
`process.platform`, run on Linux and macOS, and none of them asserts a line. `npm run test:coverage` runs the same tests
with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/token-transfer-check.git
cd token-transfer-check
node bin/token-transfer-check.js examples/bad/config.json --register examples/bad/register.csv --transfers examples/bad/transfers.json
```

Or without a clone, in your own project:

```
npx --yes github:INNERLUXES/token-transfer-check token.json --register register.csv --transfers transfers.csv
```

`examples/` holds two made-up real estate tokens. Every name in them is made up, every address is one character written
many times, every day is a day number of the made-up token, and none holds a real key or seed. The bad token, in
`examples/bad`, holds a finding of nearly every check: the standard ERC-1400, the country UK in the allowed countries, a
seed phrase next to the agent, one agent that is not a multisig behind forced transfers, a token that cannot be paused
and no recovery in its configuration; a column named twice, a holder above the cap of 20%, a holder without the
accreditation claim, a holder in France, a wallet written twice, a holder in TW, an address cut short, a class the
configuration does not list, a holder of 12.5 tokens of a token with no decimals and no day of acquisition, and
balances that add up to 2987.5 less than the supply in its register; and in its transfers, a sale on day 400 of tokens
bought on day 300 by a class with a lock-up of 365 days, a new holder that takes the United States over its limit of 3
and the token over its 10 holders, transfers from a frozen wallet and of frozen tokens, from an address not in the
register, above the cap, to an address not in the register, to an investor without a claim, to a country that is not
allowed, of 2.5 and of 0 tokens, an id written twice, an address cut short, a misspelt notes key and a transfer with no
day. The good token, in `examples/good`, passes at error, warning and info level: an ERC-3643 token with 2 decimals,
five allowed countries, limits by country, a cap of 25%, an agent that is a multisig, a register that adds up to its
supply and four transfers made after the lock-ups end, one of them of part of a wallet whose other tokens are frozen.

## Usage

```
token-transfer-check <config.json> [--register <file>] [--transfers <file>] [options]
```

```
--register <file>        the holder register, JSON or CSV
--transfers <file>       the proposed transfers, JSON or CSV; needs --register
--format <name>          text, markdown, json or sarif (default: text)
--json                   the same as --format json
--min-severity <level>   the lowest level of a finding that is shown: info, warning, error (default: info)
--fail-on <level>        the lowest level of a finding that fails the run: info, warning, error (default: error)
--explain                show the points of the pages behind each finding (text, markdown and JSON)
--list-checks            list the checks with their level and kind, and exit
--help                   show the usage
--version                show the version
```

Name the configuration, and the register and the transfers after their options. [docs/inputs.md](docs/inputs.md) lists
every field. The path in the report is relative to the folder you run the command in, with forward slashes on every
system, followed by the line.

A short configuration looks like this:

```json
{
  "token": { "name": "Harbor Example Tower Token", "symbol": "HXT", "standard": "ERC-3643", "decimals": 0, "totalSupply": "100000" },
  "compliance": {
    "allowedCountries": ["US", "GB", "DE"],
    "requiredClaims": ["KYC", "ACCREDITATION"],
    "maxHolders": 99,
    "maxHoldersPerCountry": { "US": 35 },
    "maxHolding": "20%",
    "investorClasses": [{ "name": "reg-d", "lockupDays": 365 }]
  },
  "roles": { "owner": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "agents": ["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"], "multisig": true },
  "controls": { "pausable": true, "forcedTransfer": true, "recovery": true }
}
```

a register like this as CSV, with the claims of a holder separated by `;` and days as day numbers:

```
address,country,investorClass,claims,balance,acquiredDay,frozen,frozenTokens
0x1111111111111111111111111111111111111111,US,reg-d,KYC;ACCREDITATION,20000,10,false,
```

and the transfers like this:

```
id,from,to,amount,day
T-01,0x1111111111111111111111111111111111111111,0x9999999999999999999999999999999999999999,500,410
```

The report of the bad example starts with what was read, the findings in one line, and the checks with the number of
findings of each; then the findings, errors first, each with what to change:

```
token-transfer-check: examples/bad/config.json
files: config examples/bad/config.json (JSON, 32 lines, 1,119 bytes); register examples/bad/register.csv (CSV, 14 lines, 1,337 bytes); transfers examples/bad/transfers.json (JSON, 20 lines, 2,512 bytes)
token: Harbor Example Tower Token (HXT); ERC-1400; 0 decimals; total supply 100000
register: 13 holders, 10 with a balance above 0; balances add up to 97012.5
transfers: 15 transfers, 2 taken as made; 10 holders after them
findings: 33 (29 error, 4 warning)

Checks (27)

  check                         level    kind           findings
  file-unreadable               error    input          0
  field-missing                 error    input          2
  field-unknown                 warning  input          1
  field-invalid                 error    input          1
  field-duplicate               error    input          1
  secret-in-file                error    input          1
  agent-missing                 error    documented     0
  agent-single-key              warning  best practice  1
  pause-missing                 error    documented     1
  forced-transfer-missing       warning  documented     0
  recovery-missing              warning  documented     1
  standard-unknown              warning  best practice  1
  country-unknown               error    documented     2
  address-malformed             error    documented     2
  amount-decimals               error    documented     2
  amount-invalid                error    best practice  1
  holder-duplicate              error    best practice  1
  investor-claims-missing       error    documented     3
  investor-country-not-allowed  error    documented     2
  holder-limit                  error    documented     1
  country-holder-limit          error    documented     1
  holding-above-cap             error    documented     2
  supply-mismatch               error    best practice  1
  transfer-id-duplicate         error    best practice  1
  address-frozen                error    documented     2
  balance-insufficient          error    documented     1
  transfer-in-lockup            error    documented     1

```

A finding names its check, its level, the file and the line of the field and what to change. With `--explain` it also
gives the points of the pages behind it and, for a best practice check, the tool's own choice:

```
  ERROR    transfer-in-lockup            examples/bad/transfers.json:4
           Transfer T-01 is made on day 400, but the sender, of the class reg-d, acquired its tokens on day 300 and the class holds them for 365 days: the lock-up ends on day 665, 265 days later.
           fix: Move the transfer to the day the lock-up ends or later, as the message says.
           basis: The functions of an ERC-3643 token let the owner and the agents manage the supply, the rules of transfer and lock-ups, and the compliance contract enforces the rules of the offering on every transfer. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)
           basis: As one example of a lock-up, Rule 144 (d) sets a holding period for restricted securities between their acquisition from the issuer and a resale under the rule: six months where the issuer has reported for at least 90 days, and one year where it has not. (eCFR: 17 CFR 230.144 (Rule 144), paragraph (d), Holding period for restricted securities, https://www.ecfr.gov/current/title-17/section-230.144)
```

After the findings come the holders by country: whether the country is allowed, its limit, its holders in the register
and after the transfers that were made:

```
Holders by country (5)

  country  allowed  limit  holders  after transfers
  CH       yes      -      1        1
  DE       yes      -      3        3
  FR       no       -      1        1
  GB       yes      -      1        1
  US       yes      3      3        3
```

The end of the report holds the notes, the notice and the result:

```

note: 10 transfers with a finding were taken as not made, as the chain would refuse them, so the transfers after them were checked against the balances without them
note: 3 transfers could not be checked against the register, because an address, the amount or the day could not be read

This report is an input to a review before the transfers reach the chain: not legal advice, not a compliance review and not a guarantee that a transfer will settle.

RESULT: FAIL - 29 findings at or above error (29 error, 4 warning)
```

The good example passes:

```
  none

Holders by country (5)

  country  allowed  limit  holders  after transfers
  CH       yes      -      1        1
  DE       yes      -      1        1
  GB       yes      10     1        2
  SG       yes      -      1        1
  US       yes      35     2        3

This report is an input to a review before the transfers reach the chain: not legal advice, not a compliance review and not a guarantee that a transfer will settle.

RESULT: PASS - no finding at or above error
```

## How the files are read

1. Each path is resolved against the folder you run the command in. A link, a folder, a device or a file over 16 MB is
   refused, and so is a file that is not UTF-8 (or UTF-16 with a byte order mark) or holds a null byte, with exit code
   `2` and no report.
2. The configuration is read as JSON. A register or a list of transfers whose name ends in `.csv` is read as CSV and one
   that ends in `.json` as JSON; another is read by its first character. The readers keep the line and column of every
   value. The CSV reader reads quoted fields with commas, quotes and line ends, and refuses a row with the wrong number
   of fields; the JSON reader reads strict JSON and refuses a key written twice in one object.
3. Every key, column and value of each file is looked at for a private key or a seed. One that is found is an error at
   its line, and its value is left out of everything that follows and never shown.
4. The fields of the configuration, of each holder and of each transfer are read with their lines. A key or column the
   tool does not read is a `field-unknown` finding; a missing field and a value of the wrong type are findings of their
   own, and that value is left out of the checks that need it.
5. The configuration is checked on its own; the register against the rules of the configuration; then the transfers one
   after the other, in the order of their day, against the state the register and the transfers before them leave.

[docs/method.md](docs/method.md) says what each check reads, and [docs/inputs.md](docs/inputs.md) lists the fields and
the scale of days.

## What it checks

| Check | Level | Kind | What it reports |
| --- | --- | --- | --- |
| `agent-missing` | error | documented | a configuration with no agent |
| `agent-single-key` | warning | best practice | one agent that is not a multisig behind forced transfers or recovery |
| `pause-missing` | error | documented | a token that is not pausable |
| `forced-transfer-missing` | warning | documented | forced transfers switched off |
| `recovery-missing` | warning | documented | recovery switched off |
| `standard-unknown` | warning | best practice | a standard other than ERC-3643 |
| `country-unknown` | error | documented | a country that is not a code of ISO 3166-1 |
| `address-malformed` | error | documented | an address that is not 0x and 40 hex digits |
| `amount-decimals` | error | documented | an amount with more decimal places than the token |
| `amount-invalid` | error | best practice | a supply or transfer of 0, a negative amount, or one that is not a plain decimal |
| `holder-duplicate` | error | best practice | two rows of the register for one wallet |
| `investor-claims-missing` | error | documented | a holder or receiver without a required claim, or a receiver not in the register |
| `investor-country-not-allowed` | error | documented | a holder or receiver in a country that is not allowed |
| `holder-limit` | error | documented | more holders than `maxHolders` |
| `country-holder-limit` | error | documented | more holders in a country than its limit |
| `holding-above-cap` | error | documented | a holding above `maxHolding` |
| `supply-mismatch` | error | best practice | balances that do not add up to the total supply |
| `transfer-id-duplicate` | error | best practice | two transfers of one id |
| `address-frozen` | error | documented | a transfer from or to a frozen wallet, or of frozen tokens |
| `balance-insufficient` | error | documented | a transfer of more than the sender holds |
| `transfer-in-lockup` | error | documented | a transfer before the lock-up of the sender ends, by its own day |
| `secret-in-file` | error | input | a key or a seed; its value is never shown |
| `field-duplicate` | error | input | a CSV column named twice |
| `field-invalid` | error | input | a value of the wrong type or form |
| `field-unknown` | warning | input | a key or column the tool does not read, often a misspelt one |
| `field-missing` | error | input | a field the checks need |
| `file-unreadable` | error | input | a file that is not strict JSON or CSV, or holds no object |

A documented check rests on ERC-3643, ERC-20, Rule 144 in the eCFR as an example of a lock-up, the UN M49 table, the
IBAN registry of Swift or the page of ethereum.org on accounts. A best practice check is this tool's own choice, and its
message says "a best practice of this tool, not a rule in the pages it cites". `--list-checks` shows the kind of each
check. Some of the levels are worth a word:

- `agent-single-key` is a warning: the standard defines the agent role and leaves how its wallet is held to the issuer.
- `forced-transfer-missing` and `recovery-missing` are warnings: ERC-3643 asks for both, and an issuer may still choose to
  run without one; `pause-missing` is an error, because a token that cannot be paused cannot be stopped.
- `amount-invalid` reports a transfer of 0, though ERC-20 treats one as a normal transfer: in a list to review it is more
  often a row that lost its amount.
- `transfer-in-lockup` counts from the `acquiredDay` of the sender, and a receiver acquires on the day of the transfer;
  Rule 144 is cited as an example of where a lock-up comes from, and the days are always those of the configuration.
- `holder-limit`, `country-holder-limit` and `holding-above-cap` count wallets: one investor with two wallets is two
  holders to the tool.
- `country-unknown` reads the codes of the UN M49 table, which lists no code for Taiwan (TW), and accepts XK for Kosovo
  from the IBAN registry of Swift (docs/limits.md).

## What is not checked

[docs/limits.md](docs/limits.md) lists what the tool cannot see. Among them: the law, and whether the rules of the
configuration are the right ones for the asset (ask counsel); whether the files match the deployed token and the chain;
whether a claim is valid, signed by a trusted issuer or current; investors who hold through several wallets; how a
holding period is counted beyond the `acquiredDay` of a wallet; transfers, mints and burns outside the list; the checksum
of an address; entries added to the country table after the saved copy; and secrets in a shape the search does not know.

## Formats

`--format text` (the default) is for a terminal. `--format markdown` is a report for a job summary or a pull request,
with a table of findings and the table of holders by country. `--format json` writes every finding with its `id`,
`severity`, `message`, `file`, `input`, `line`, `column`, `subject` and `fix`, the token, the summary of the register
and the transfers, the table of holders by country, and with `--explain` the points of the pages. `--format sarif`
writes SARIF 2.1.0, with the checks as rules, the files as the artifacts and a result for each finding with its file,
line and column, for code scanning; the table of holders by country has no place in it. The saved output of the examples
is in [examples/output](examples/output).

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | no finding at or above the `--fail-on` level (default `error`) |
| `1` | a finding at or above it |
| `2` | a usage error, such as `--transfers` without `--register`, or an input error such as a path that does not exist, a link or a folder, or a file that is not text or is too large; there is no report |

Findings below `--min-severity` are not shown, and still count for the result.

## Limits

The tool reads the files it is given; it contacts no chain, node or registry and connects to nothing. A run reports the
problems of docs/method.md that the files hold. [docs/limits.md](docs/limits.md) lists what it cannot see, with the size
limits: 16 MB for each file, 100,000 holders and 100,000 transfers, CSV fields of up to 100,000 characters, JSON nested
up to 1,000 deep, amounts of up to 40 digits on each side of the point, and days up to 10,000,000.
[docs/threat-model.md](docs/threat-model.md) lists the risks of reading files from a pull request or an upload and their
controls, and [docs/secure-defaults.md](docs/secure-defaults.md) the defaults and how to run the tool in a pipeline.

## Architecture

Plain ES modules in `src/`, with no dependencies.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads each file as JSON or CSV, looks for keys and seeds, reads the fields, runs the checks and builds the report of the run |
| `src/files.js` | the bounded reading of a file by its byte order mark, with no link followed |
| `src/csv.js` | the CSV reader of payout-batch-check: a header row, quoted fields, lines and columns, limits, one loop |
| `src/json.js` | the JSON reader of the sibling tools: lines and columns, keys written twice, limits, a stack of its own |
| `src/secrets.js` | the search for keys and seeds by the name of a key and the shape of a value, kept from the sibling tools |
| `src/fields.js` | reading text, amounts, whole numbers, flags and lists with their lines, and the rows of a register or a list of transfers |
| `src/config.js` | the fields of the configuration: the token, the compliance rules, the roles and the controls |
| `src/register.js` | the fields of each holder of the register |
| `src/transfers.js` | the fields of each transfer |
| `src/decimal.js` | amounts read from the characters of a file, added, taken away, multiplied and compared with BigInt |
| `src/countries.js` | the two-letter country codes |
| `src/addresses.js` | the form of an address |
| `src/analyze.js` | the checks on the configuration, on the register and on the transfers in the order of their day |
| `src/rules.js` | the checks, their levels and kinds, and the result |
| `src/report.js`, `src/text.js`, `src/size.js` | the text, markdown, JSON and SARIF output, the cleaning of text from the input and number formats |
| `src/data.js` | the public pages and the points the checks rest on, in this project's own words |
| `research/sources/` | text copies of the pages and lists, as they were read |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the examples with their real output |

## Where the facts come from

The documented checks rest on six public pages and lists, nothing else. Each was read before it was listed, a text copy
of it is kept in [research/sources](research/sources), and [research/sources.md](research/sources.md) has a note on each
and lists the lines the copies leave out. [docs/rules-and-sources.md](docs/rules-and-sources.md) lists every check with
the points of the pages it rests on, what it cannot see and what to change. Where a check is a best practice and not a
rule in the pages, it says so. Rule 144 is cited as an example of where a lock-up can come from, not as legal advice.

- ERC-3643, T-REX - Token for Regulated EXchanges: https://eips.ethereum.org/EIPS/eip-3643
- ERC-20, Token Standard: https://eips.ethereum.org/EIPS/eip-20
- eCFR, 17 CFR 230.144 (Rule 144), paragraph (d): https://www.ecfr.gov/current/title-17/section-230.144
- United Nations Statistics Division, Standard country or area codes for statistical use (M49): https://unstats.un.org/unsd/methodology/m49/overview/
- Swift, IBAN Registry (TXT): https://www.swift.com/swift-resource/11971/download
- ethereum.org, Ethereum accounts: https://ethereum.org/en/developers/docs/accounts/

## Background

The configuration, the register and the transfers of a tokenized asset are reviewed by the people who issue and run it,
and every transfer on the chain moves ownership of the asset. They are read line by line when a building, a fund or a
loan is brought onto a chain, when an offering opens to investors of a new country, when a register is moved from a
transfer agent to a token, or when engineers are brought in to build the token, its compliance modules and the tools
around them. How such work is staffed and carried out is described on the page
[Asset Tokenization Services](https://innerluxes.dev/blockchain/asset-tokenization).

## License

MIT
