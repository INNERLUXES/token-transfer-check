# Method

This document says how the tool reads the files of a token and what each check looks at. The tool is an input to a
review before the transfers reach the chain: not legal advice, not a compliance review and not a guarantee that a
transfer will settle. A clean run means only that none of the problems below were found in the files.

## Why the files

A permissioned token of a real asset, such as a building or a fund, carries the rules of its offering in its contracts:
who may hold it, from which countries, how many holders there may be, how much one investor may hold, and when tokens
bought by an investor may be sold again. ERC-3643 asks the token to refuse a transfer that breaks those rules, and to
have agents who can freeze, pause, force a transfer and recover the tokens of a lost wallet. A rule written wrong, a
register that does not add up, or a batch of transfers prepared against the wrong rules shows up only when the
transactions fail on the chain, or worse, when a transfer that should have been refused goes through because the rule
was never set.

Most of this is visible in the files before anything is sent: the configuration the token is deployed or changed with,
the register exported from its identity registry and balances, and the list of transfers to be signed. The tool reads
those files as they are, so the same check runs on every change, in a pipeline or by hand, and every finding points at a
line.

## Reading the files

1. Each path is resolved against the folder the command runs in. A link, a folder, a device or a pipe is refused; a file
   over 16 MB is refused before it is read; a file with a null byte, or bytes that are not UTF-8 (or UTF-16 with a byte
   order mark), is refused with exit code `2` and no report.
2. The configuration is read as JSON. The register and the transfers are read as CSV or JSON by the name of the file
   (`.csv` or `.json`), or else by its first character.
3. A CSV file goes to the strict CSV reader of the sibling tool payout-batch-check (`src/csv.js`), which keeps the line
   and column of every field: a quote in the wrong place, a quoted field that is not closed, a row with more or fewer
   fields than the header or an empty line inside the table is a `file-unreadable` finding with the line. A column named
   twice is `field-duplicate`, and the second is left out. A JSON file goes to the JSON reader of the sibling tools
   (`src/json.js`), which keeps the line and column of every value and the characters every number was written with:
   a comment, a trailing comma, a key written twice in one object or text after the value is `file-unreadable`.
4. Every key, column and value of each file is looked at for a key or a seed (`src/secrets.js`, kept unchanged from the
   sibling tools). A key or column named for a private key, a seed or a mnemonic, and a value shaped like a mnemonic, an
   extended private key, a private key in hex or a key in WIF, is `secret-in-file`. A column named for one is reported
   once, at the header. The value is marked and left out of everything that follows, and no report shows it.
5. The fields are read (`src/config.js`, `src/register.js`, `src/transfers.js`) as docs/inputs.md lists them. A missing
   field is `field-missing`, a key the tool does not read is `field-unknown`, and a value of the wrong type or form is
   `field-invalid`. The value is then left out of every check that needs it. Amounts are read by `src/decimal.js` into a
   whole number and a scale, from the characters of the file.

## The checks of the configuration

Each is checked on its own (`src/analyze.js`).

- The roles: no agent (`agent-missing`); one agent that is not a multisig wallet while forced transfers or recovery are
  on (`agent-single-key`); an owner or an agent that is not an address (`address-malformed`).
- The controls: a token that is not pausable (`pause-missing`), forced transfers switched off
  (`forced-transfer-missing`) and recovery switched off (`recovery-missing`).
- The token: a standard other than ERC-3643 (`standard-unknown`); a total supply of 0, below 0 or not a plain decimal
  (`amount-invalid`); a total supply or a cap written as an amount with more decimal places than the token
  (`amount-decimals`).
- The compliance: an allowed country or a country of `maxHoldersPerCountry` that is not a code of the table
  (`country-unknown`).

## The checks of the register

Each holder is checked against the rules of the configuration, then the holders together.

- A holder: an address not in the form of one (`address-malformed`); an address written twice, compared without case
  (`holder-duplicate`, and the second row is left out of the counts and the sums); a country that is not a code of the
  table (`country-unknown`); a balance below 0 or not a plain decimal (`amount-invalid`); a balance or frozen tokens with
  more decimal places than the token (`amount-decimals`).
- A holder of tokens (a balance above 0): an identity that lacks a required claim (`investor-claims-missing`); a country
  that is not allowed (`investor-country-not-allowed`); a balance above the cap (`holding-above-cap`).
- The holders together: more wallets with a balance above 0 than `maxHolders` (`holder-limit`), or than the limit of a
  country (`country-holder-limit`); balances that do not add up to the total supply (`supply-mismatch`).

## The checks of the transfers

The transfers are taken in the order of their day, and in the order of the file on one day. The state starts as the
register and changes with each transfer that has no finding: the balances of both sides, the number of holders, and the
day the receiver acquired, which becomes the day of the transfer. A transfer with a finding is taken as not made, as the
chain would refuse it.

- The file: two transfers with one id, compared without case and outer spaces (`transfer-id-duplicate`).
- The form: an address of either side that is not one (`address-malformed`); an amount of 0, below 0 or not a plain
  decimal (`amount-invalid`); an amount with more decimal places than the token (`amount-decimals`).
- The sender: a frozen wallet, or an amount above the free balance, the balance less the frozen tokens
  (`address-frozen`); an amount above the balance after the transfers before it, or a sender that is not in the register
  (`balance-insufficient`); a transfer on a day before the lock-up of the class of the sender ends, counted from its
  `acquiredDay` (`transfer-in-lockup`).
- The receiver: a frozen wallet (`address-frozen`); a receiver not in the register, or one whose identity lacks a
  required claim (`investor-claims-missing`); a country that is not allowed (`investor-country-not-allowed`); a new
  holder above `maxHolders` (`holder-limit`) or above the limit of its country (`country-holder-limit`), with a sender who
  sends all its tokens leaving its place; a balance after the transfer above the cap (`holding-above-cap`).

## Levels

- **error**: the token or the offering breaks its own rules as written, the chain would refuse a transfer, or a file
  cannot be read as it should be: no agent, no pause, a wrong country or address, an amount the token cannot hold, a
  holder or receiver without a claim or in a country that is not allowed, holders over a limit, a holding above the cap,
  a register that does not add up, a frozen wallet, a balance that is too low, a lock-up that has not ended, a holder or
  a transfer id written twice, and a key or seed in a file.
- **warning**: something that is often a mistake but can be a choice of the issuer: one key behind forced transfers or
  recovery, forced transfers or recovery switched off, a standard the tool does not know, and a key the tool does not
  read.
- **info**: no check is a note today; `--fail-on info` and `--min-severity info` are there for the levels of a later
  version.

## Notes

A note is not a finding. A run notes the transfers taken as not made, the transfers that could not be checked because an
address, the amount or the day could not be read, balances that were not compared with the supply because one could not
be read, a cap in percent with a supply that could not be read, a configuration with no investor classes (no lock-up is
checked) or with no required claims, a configuration that could not be read, and a file with more rows than the tool
reads.

## What a documented check rests on

A documented check rests on a page or list kept under research/sources: ERC-3643 for the agent and owner roles, the
controls, the identity registry and its countries, the limits of holders, the cap, frozen wallets and the free balance,
and lock-ups; ERC-20 for decimals, the supply and the balance a transfer needs; Rule 144 (d) in the eCFR as an example of
a holding period; the M49 table of the UN Statistics Division and the IBAN registry of Swift for the country codes; and
the page of ethereum.org on accounts for the form of an address. A best practice check is this tool's own choice, and
its message and docs/rules-and-sources.md say so and why.
