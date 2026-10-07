# Inputs

The tool takes the path of the configuration of a token, and optionally the paths of its holder register and of a list
of proposed transfers. There is no configuration file of the tool itself, no environment variable and no standard input;
the options are on the command line. The tool never asks for a private key, a seed, an API key or the address of a node,
and needs none. Its result is an input to a review: not legal advice, not a compliance review and not a guarantee that a
transfer will settle.

```
token-transfer-check <config.json> [--register <file>] [--transfers <file>] [--format text|markdown|json|sarif]
                     [--json] [--min-severity <level>] [--fail-on <level>] [--explain] [--list-checks]
```

| Option | Meaning |
| --- | --- |
| `--register <file>` | the holder register, JSON or CSV |
| `--transfers <file>` | the proposed transfers, JSON or CSV; needs `--register`, because the investors a transfer goes to and the balances it comes from are read from the register |
| `--format <name>` | `text` (default), `markdown`, `json` or `sarif` |
| `--json` | the same as `--format json` |
| `--min-severity <level>` | the lowest level shown: `info` (default), `warning` or `error` |
| `--fail-on <level>` | the lowest level that fails the run: `info`, `warning` or `error` (default) |
| `--explain` | add the points of the pages behind each finding to the text, markdown and JSON reports |
| `--list-checks` | list the checks with their level and kind, in text, markdown or JSON, and exit |
| `--help`, `--version` | the usage, the version |

Every option that takes a value takes it once. A value may not start with `--`. `-` (standard input) and an address such
as `https://...` are refused. A folder is refused: name the file. Two configurations are a usage error.

## The format of the files

The configuration is always read as JSON. A register or a list of transfers whose name ends in `.csv` is read as CSV,
and one whose name ends in `.json` as JSON, in any case; a file with another name is read as JSON when its first
character that is not a space is `{` or `[`, and as CSV otherwise. Each file is UTF-8, with or without a byte order
mark, or UTF-16 with a byte order mark, with LF, CRLF or CR line ends.

A CSV file has a header row with the names of the columns, in any order, with spaces around a name left out; each row
after it is one holder or one transfer. Fields are separated by commas (RFC 4180); a field that holds a comma, a quote or
a line end is put in double quotes, with a quote inside it written twice. Every row has as many fields as the header. An
empty field is a field that is not given. Empty lines at the end of the file are allowed, and an empty line inside the
table is not. A column whose name the tool does not read is `field-unknown`, reported once at the header; a column named
twice is `field-duplicate`, and the second is left out; a column with no name is `field-invalid`.

## Amounts and days

An amount (a supply, a cap, a balance, frozen tokens, the amount of a transfer) is a plain decimal number written as a
JSON number or as text, such as `100000`, `"2500.50"` or `2500.5`: no sign, no exponent, no thousands separator, at most
40 digits on each side of the point. It is read from its characters, never through a floating point number.

A day is a whole number of days on one scale the files choose, such as days since the token was issued: `acquiredDay`
in the register and `day` in the transfers. A lock-up is `lockupDays` after the `acquiredDay` of a holder. The tool reads
no clock and no date; give every day on the same scale. In JSON a day may be a number or a text of digits.

## The configuration

```json
{
  "token": { "name": "Harbor Example Tower Token", "symbol": "HXT", "standard": "ERC-3643", "decimals": 0, "totalSupply": "100000" },
  "compliance": {
    "allowedCountries": ["US", "GB", "DE"],
    "requiredClaims": ["KYC", "ACCREDITATION"],
    "maxHolders": 99,
    "maxHoldersPerCountry": { "US": 35 },
    "maxHolding": "20%",
    "investorClasses": [{ "name": "reg-d", "lockupDays": 365 }, { "name": "reg-s", "lockupDays": 40 }]
  },
  "roles": { "owner": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "agents": ["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"], "multisig": true },
  "controls": { "pausable": true, "forcedTransfer": true, "recovery": true }
}
```

| Field | Read as |
| --- | --- |
| `token.name`, `token.symbol` | text; needed |
| `token.standard` | text; needed. `ERC-3643` (also written `ERC3643`, `EIP-3643` or `T-REX`) is the standard the checks follow; another is `standard-unknown` |
| `token.decimals` | a whole number from 0 to 36, written as a number; needed |
| `token.totalSupply` | an amount above 0; needed |
| `compliance.allowedCountries` | a list of country codes of two capital letters; needed |
| `compliance.requiredClaims` | a list of the names of the claims an investor needs, such as `KYC` and `ACCREDITATION`, compared in capitals; needed, and may be empty |
| `compliance.maxHolders` | a whole number of 1 or more: the most wallets with a balance above 0; optional |
| `compliance.maxHoldersPerCountry` | an object with a whole number of 1 or more for each country code; optional |
| `compliance.maxHolding` | the most one wallet may hold: an amount such as `"5000"`, or a percent of the total supply above 0 and up to 100 such as `"20%"`; optional |
| `compliance.investorClasses` | a list of classes, each with a `name` and `lockupDays`, a whole number of days from 0 to 100,000; optional. Names are compared without case. Without classes, no lock-up is checked and a note says so |
| `roles.owner` | an address; needed |
| `roles.agents` | a list of addresses; an empty list or none at all is `agent-missing` |
| `roles.multisig` | `true` when the agents are multisig wallets that need more than one signer; optional, and taken as not when it is not given |
| `controls.pausable`, `controls.forcedTransfer`, `controls.recovery` | `true` or `false`; needed |

Every part and every object may also hold `notes`, which the tool does not read.

## The register

As JSON, an object with a list of holders:

```json
{
  "holders": [
    { "address": "0x1111111111111111111111111111111111111111", "country": "US", "investorClass": "reg-d", "claims": ["KYC", "ACCREDITATION"], "balance": "20000", "acquiredDay": 10 },
    { "address": "0x9999999999999999999999999999999999999999", "country": "US", "investorClass": "reg-d", "claims": ["KYC", "ACCREDITATION"], "balance": "0" }
  ]
}
```

As CSV, the same fields as columns, with the claims of one holder separated by `;`:

```
address,country,investorClass,claims,balance,acquiredDay,frozen,frozenTokens,notes
0x1111111111111111111111111111111111111111,US,reg-d,KYC;ACCREDITATION,20000,10,false,,
```

| Field | Read as |
| --- | --- |
| `address` | the address of the wallet; needed |
| `country` | the country code of the investor, as the identity registry holds it; needed |
| `investorClass` | the class of the investor, one of `investorClasses`; needed when the configuration gives classes |
| `claims` | the names of the claims the identity holds; a JSON list, or a CSV cell with the names separated by `;`; none when it is not given |
| `balance` | an amount of 0 or more; needed. A holder with a balance of 0 is registered and holds nothing, and can receive |
| `acquiredDay` | the day the holder acquired its tokens; needed for a holder of tokens whose class has a lock-up |
| `frozen` | `true` when the wallet is frozen; `true` or `false`, in any case in a CSV cell; optional |
| `frozenTokens` | the amount of the balance that is frozen; optional |
| `notes` | not read |

## The transfers

As JSON, an object with a list of transfers; as CSV, the same fields as columns:

```json
{ "transfers": [ { "id": "T-01", "from": "0x1111111111111111111111111111111111111111", "to": "0x9999999999999999999999999999999999999999", "amount": "500", "day": 410 } ] }
```

| Field | Read as |
| --- | --- |
| `id` | the id of the transfer, text or a number; needed |
| `from`, `to` | the addresses of the sender and the receiver; needed |
| `amount` | an amount above 0; needed |
| `day` | the day the transfer is to be made; needed |
| `notes` | not read |

## The tables

The country codes are the ISO alpha-2 codes of the M49 table of the UN Statistics Division, copied from the saved copy
of the table, and XK for Kosovo from the IBAN registry of Swift; the table lists no code for Taiwan (TW)
(docs/limits.md). An address is 0x and 40 hex digits, not the zero address, as the page of ethereum.org on accounts
describes it. The tool keeps no table of claims, classes, countries an asset may sell to or lock-ups: those are the
asset's own and come from its configuration.
