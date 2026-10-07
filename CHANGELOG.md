# Changes

## 1.0.0

First release.

- Reads the compliance configuration of a tokenized asset as JSON and, when they are given, its holder register and a
  list of proposed transfers as JSON or CSV, and lists with file and line what would break the asset's own rules before
  it reaches the chain, as an input to a review: not legal advice, not a compliance review and not a guarantee that a
  transfer will settle. It reads the files, contacts no chain, node, registry or API, fetches nothing, runs nothing,
  needs no key, follows no symbolic link and reads no clock.
- Reads the token with its name, symbol, standard, decimals and total supply; the compliance rules with the allowed
  investor countries, the required claims, the largest number of holders overall and by country, the largest holding
  of one investor as an amount or a percent of the supply, and the investor classes with their lock-up in days; the
  owner, the agents and whether they are multisig wallets; and whether the token is pausable and has forced transfers
  and recovery. Reads each holder of the register with its address, country, class, claims, balance, the day it
  acquired its tokens and whether the wallet or a part of its tokens is frozen, and each transfer with its id, its
  addresses, its amount and its own day.
- Days are whole numbers on one scale the files choose: the lock-up of a class, the day a holder acquired and the day of
  a transfer. The tool compares them and never reads the clock or turns a day into a date.
- The strict CSV reader of payout-batch-check and the strict JSON reader of the sibling tools, with no dependency and no
  recursion, with the line and column of every value, a key written twice and a column named twice as findings, and
  limits of size, rows, columns, fields, nesting, values and string length. Amounts, balances, supplies and caps are
  read, added, taken away, multiplied and compared from the characters of the file with BigInt, never through a
  floating point number.
- The transfers are taken in the order of their day against the state the register and the transfers before them
  leave, and a transfer with a finding is taken as not made, as the chain would refuse it.
- The ISO alpha-2 country codes of the M49 table of the UN Statistics Division, copied from the saved copy that
  payout-batch-check keeps, with XK for Kosovo from the IBAN registry of Swift and no code for Taiwan, as
  payout-batch-check handles them; the form of an address from ethereum.org.
- A search for keys and seeds in every file before anything else is read, kept unchanged from the sibling tools: each
  one found is an error whose value is left out of every check and never shown, and a CSV column named for one is
  reported once.
- Twenty-seven checks in two levels, each documented or a best practice of the tool and saying which: a configuration
  with no agent (`agent-missing`) or with one key behind forced transfers or recovery (`agent-single-key`); a token that
  is not pausable (`pause-missing`), without forced transfers (`forced-transfer-missing`) or without recovery
  (`recovery-missing`); a standard other than ERC-3643 (`standard-unknown`); a country that is not a code of ISO 3166-1
  (`country-unknown`); an address that is not 0x and 40 hex digits (`address-malformed`); an amount with more decimals
  than the token (`amount-decimals`) or of 0, below 0 or not a number (`amount-invalid`); a holder written twice
  (`holder-duplicate`); a holder or receiver without the required claims (`investor-claims-missing`) or in a country
  that is not allowed (`investor-country-not-allowed`); holders over the limit (`holder-limit`) or over the limit of a
  country (`country-holder-limit`); a holding above the cap (`holding-above-cap`); balances that do not add up to the
  total supply (`supply-mismatch`); a transfer id written twice (`transfer-id-duplicate`); a transfer from or to a frozen
  wallet or of frozen tokens (`address-frozen`); a transfer of more than the sender holds (`balance-insufficient`); a
  transfer inside the lock-up of the sender by its own day (`transfer-in-lockup`); and six checks about the input
  (`file-unreadable`, `field-missing`, `field-unknown`, `field-invalid`, `field-duplicate`, `secret-in-file`).
- A table of the holders by country, with the allowed countries, the limits, the holders of the register and the holders
  after the transfers, in every format but SARIF.
- Reports as text, markdown, JSON and SARIF 2.1.0; every finding has its id, severity, message, file, line, column and
  subject; `--register`, `--transfers`, `--min-severity`, `--fail-on`, `--explain` with the points of the pages behind
  each finding, and `--list-checks`. Exit code `0` when no finding is at or above the fail-on level, `1` when one is,
  `2` for a usage or input error, with no result.
- Plain text copies of the public pages the documented checks rest on, under research/sources, with a note on each:
  ERC-3643, ERC-20, Rule 144 (d) in the eCFR as an example of a lock-up, the UN M49 table, the IBAN registry of Swift and
  the page of ethereum.org on accounts.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate
  of the repository.
