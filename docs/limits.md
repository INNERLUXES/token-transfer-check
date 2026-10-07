# Limits

The tool is not legal advice and not a lawyer. It reads the configuration of a token and, when they are given, its
register and a list of transfers, and its result is an input to a review before the transfers reach the chain: not
legal advice, not a compliance review and not a guarantee that a transfer will settle. A clean run means only that none
of the problems in [method.md](method.md) were found in the files.

## What it cannot see

- **The law.** The countries, claims, limits, cap and lock-ups are the ones the configuration gives. Whether they are
  the right rules for the asset, the offering and the investors is a question for counsel. Rule 144 is cited as an
  example of where a lock-up can come from; the tool does not apply it, does not know whether a security is restricted,
  and does not know the other conditions of the rule.
- **The chain.** It contacts no chain, so it cannot tell whether the configuration matches the deployed token, whether
  the register is the current state of the identity registry and the balances, whether the token is paused now, or
  which compliance modules are bound. A register is only as current as its export.
- **Claims.** The claims of an investor are names the register lists, compared with the names of the configuration. On
  a chain a claim topic is a number, signed by a trusted issuer, and can expire or be revoked; none of that is seen.
- **Investors behind wallets.** Every count and every cap is by wallet. One investor with two wallets counts as two
  holders and holds two separate amounts, which can hide a holding above the cap or count a holder twice.
- **How a lock-up is counted.** The tool counts a lock-up from the `acquiredDay` of the sender, a single day for each
  wallet. A receiver acquires on the day of the transfer, the safe side, even when the sender held its tokens longer; a
  rule under which a later holder may count from an earlier acquisition, as Rule 144 allows in some cases, needs a look by
  hand. A holder who bought on several days should be given the day of the latest purchase, or a lock-up may end too
  early.
- **One scale of days.** The days of the configuration, the register and the transfers are whole numbers on one scale the
  files choose. A register that counts from one day and transfers that count from another give wrong results, and the
  tool cannot tell.
- **Transfers outside the list.** The balances after each transfer are worked out from the register and the transfers
  before it in the list, in the order of their day. A transfer made outside the list, a mint, a burn, a forced transfer
  or a recovery is not seen, and a transfer with a finding is taken as not made.
- **Countries the UN table leaves out.** The country codes come from the UN M49 table, which lists no code for Taiwan
  (TW); a country written TW is `country-unknown` and needs a look by hand. Kosovo (XK) is accepted because the IBAN
  registry of Swift lists it. ISO 3166-1 itself could not be read without accepting the terms of use of the ISO platform
  (research/sources.md). The identity registry of ERC-3643 stores a numeric code; the tool reads the codes of two
  letters the files write.
- **Addresses.** An address is checked for its form only, with no checksum of EIP-55, and no address is looked up.
- **What a misspelt key meant.** A key or column the tool does not read is reported and left out. A misspelt `balance`
  makes the holder look as if it had none; read the `field-unknown` findings first.
- **Every secret.** The search for keys and seeds knows them by the name of their key or column and by their shape: a
  mnemonic of 12 to 24 lowercase English words, an extended private key, 64 hex digits or a key in WIF. A secret split
  over fields, encoded another way or written under another name is not caught. API keys and passwords are not looked
  for by their shape. A clean run does not say that the files hold no secret.

## What the readers do not read

[inputs.md](inputs.md) lists the fields. A file that is not strict JSON or a strict CSV table is one `file-unreadable`
finding, and nothing else in it is checked. A value that is missing, of the wrong type or a secret is a finding, and the
checks that need it leave it out: a clean run says nothing about that part. A configuration written as CSV, spreadsheets,
CSV with another separator than a comma, amounts with a thousands separator or a decimal comma, numbers with an exponent
and dates are not read.

## Size limits

| Limit | Value |
| --- | --- |
| file size | 16 MB for each file |
| holders of a register | 100,000; the rest are not read, and a note says so |
| transfers | 100,000; the rest are not read, and a note says so |
| CSV rows | 100,000 after the header |
| CSV columns | 200 |
| a CSV field | 100,000 characters |
| JSON nesting of objects and arrays | 1,000 levels |
| JSON values (nodes) in a file | 2,000,000 |
| a JSON string | 1,000,000 characters |
| an amount, a balance, a supply or a cap | 40 digits on each side of the point |
| decimals of a token | 0 to 36 |
| a day, an acquiredDay | 0 to 10,000,000 |
| lockupDays | 0 to 100,000 |
| allowed countries, classes, agents and limits by country | 1,000 of each; the rest are not read |
| a text the search for keys looks at | 4,000 characters |

Input past a limit is a `file-unreadable` or `field-invalid` finding, a note, or, for the file size, an input error with
exit code `2`. The tool never passes a run because something could not be read.

## What a run does not do

It never reads or asks for a private key, a seed or an API key, contacts no chain, node, registry or API, fetches
nothing and connects to nothing, runs no program, evaluates nothing it reads, reads no clock and no locale, follows no
symbolic link and writes nothing to disk. [threat-model.md](threat-model.md) lists the risks of reading files from a pull
request or an upload and their controls.
