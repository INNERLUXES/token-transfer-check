# Sources

The public pages and lists the documented checks of this tool are based on, each with a short note in this project's
own words on what the page says and which checks lean on it. Nothing here is a copy of a page: read the page itself for
its exact wording. A plain text copy of each page, taken when it was read, is kept in [research/sources](sources) so
that a point can be checked against the page it came from, and the copies are the pages' own words, not this project's.
src/data.js holds the pages and the points the reports show, and test/data.test.js checks that every page in src/data.js
is listed here and has its copy, that no point quotes its page at length, that the pages say what the documented checks
rest on, and that the country codes of src/countries.js are the ones of the saved copy of the UN table.

The tool reads the configuration of a token, its register and a list of transfers, and runs nothing; its result is an
input to a review before the transfers reach the chain: not legal advice, not a compliance review and not a guarantee
that a transfer will settle. These notes say what the pages say so a reader can follow a finding back to its source.
The pages were chosen with web addresses that hold no number that reads like a year, and each was read with a plain
HTTP client in a form its site serves as text where there was one: the markdown source of the two ERC pages in the
repository from which eips.ethereum.org builds them, the eCFR text of Rule 144 from the content API of the eCFR, and the
English table of the UN page from its HTML. The copies of the UN table, the IBAN registry of Swift and the page of
ethereum.org on accounts are the ones the sibling tool payout-batch-check saved and checks, copied byte for byte.

Where a check rests on a statement the pages do not make, it is a best practice of this tool, its message says so, and
the note for the check in [docs/rules-and-sources.md](../docs/rules-and-sources.md) names the choice. No page gives a
rule that an agent behind forced transfers needs more than one key, that a token on another standard is read by the
rules of ERC-3643, that a supply or a transfer of 0 is a mistake (ERC-20 says the opposite of a transfer of 0, and the
note of `amount-invalid` says so), that a register holds one row for each wallet, that the balances of a register add up
to the supply of the configuration, or that the ids of a list of transfers are unique; those checks are best practices of
this tool.

## How the facts were checked, and what could not be read

- ERC-3643 is checked against its final text. It asks the token to define an Agent role and an Owner role, to be able to
  force transfers from an agent wallet, to have a recovery system, to freeze tokens partially or totally, and to be
  pausable; it lists the conditions of a transfer (enough free balance, a verified receiver, neither wallet frozen, the
  token not paused, the rules of compliance respected); and it names, as rules of compliance, the countries a token may
  circulate in, a largest number of holders overall or by country, a largest amount for one investor and lock-ups. The
  tool reads these rules from the configuration of the asset; the numbers are the asset's own.
- ERC-3643 does not set any number of days for a lock-up. Rule 144 (d) of the SEC is cited as one example of a holding
  period, six months or one year from the acquisition from the issuer, to show what a number of days in the
  configuration can stand for. It is an example and not legal advice: the tool does not apply Rule 144, and the lock-up
  it applies is always the one of the configuration.
- The eCFR page of Rule 144 refuses clients that are not a browser and sends them to a page that asks to be let in; the
  text was read from the content API of the eCFR on the same site instead, which serves the same section.
- ISO keeps ISO 3166-1 on its Online Browsing Platform, which shows the codes only after its terms of use are accepted.
  The tool takes the two-letter codes from the table of the UN Statistics Division instead, whose column "ISO-alpha2
  Code" gives the code of each country or area it lists, as the sibling tool payout-batch-check does. The UN table lists
  248 of them and no code for Taiwan (TW), which ISO 3166-1 assigns; docs/limits.md says so, and a country written TW is
  reported for a look by hand. Kosovo (XK) is not in the UN table either; the IBAN registry of Swift, which writes its
  prefixes as ISO 3166 codes, lists it, and the tool accepts it, as payout-batch-check does.

## What the copies leave out

Each copy is the text of the page as it was read, with a two-line header that names its address and how it was read,
and with these lines left out, so that no copy holds a date, a number that reads like a year, a word this project keeps
out of every file or personal contact details, and every copy is plain ASCII (decision 1 in docs/decisions):

- ERC-3643: the line `author:` of the front matter, which names the authors with their handles, and the line `created:`,
  which holds the day the page was created.
- ERC-20: the line `author:` of the front matter, which names the authors with their email addresses, and the line
  `created:`, which holds the day the page was created.
- eCFR, Rule 144: the copy keeps the heading of the section and its paragraph (d), Holding period for restricted
  securities, whole. It leaves out the preliminary note, which names the Securities Act with the year it was passed,
  paragraphs (a) to (c) and (e) to (k), the history line with its citation of the Federal Register and its date, and the
  editorial note. The section sign is written as "Sec.", and runs of spaces as one space.
- UN Statistics Division, M49: the copy of payout-batch-check, unchanged. It keeps the English table only, with its
  columns Country or Area, M49 Code, ISO-alpha2 Code and ISO-alpha3 Code; the columns of regions, sub-regions and the
  groups of countries, the tables in the other languages, the menus of the site and its footer, which holds a year, are
  left out, and the name Cote d'Ivoire is written without its accent.
- Swift, IBAN Registry (TXT): the copy of payout-batch-check, unchanged. It keeps one line for each country with the
  data elements its first line names, and leaves out the effective date of each format, the data elements on the bank
  and branch identifiers, the examples other than the electronic one and the contact details of the national bodies.
  This tool reads only its line for Kosovo.
- ethereum.org, Ethereum accounts: the copy of payout-batch-check, unchanged; it leaves out the two lines of log output of
  an example, which hold a date.
- Every copy: curly quotes and dashes are written as ASCII quotes and hyphens.

## Permissioned tokens

### ERC-3643: T-REX - Token for Regulated EXchanges

https://eips.ethereum.org/EIPS/eip-3643

Copy: research/sources/eip-3643-t-rex.txt

The final standard for permissioned security tokens on an EVM chain: a token compatible with ERC-20 that is used with an
onchain identity system, an identity registry that ties each wallet to an identity and a country code of ISO 3166, a
registry of the claim topics an investor needs and of the issuers trusted to sign them, and a compliance contract that
checks every transfer against the rules of the offering. It lists what the token must do (an Agent and an Owner role,
forced transfers, recovery, freezing all or part of a wallet, pausing) and the conditions of a transfer (free balance,
a verified receiver, no frozen wallet, no pause, the compliance rules). `agent-missing`, `agent-single-key`,
`pause-missing`, `forced-transfer-missing`, `recovery-missing`, `country-unknown`, `investor-claims-missing`,
`investor-country-not-allowed`, `holder-limit`, `country-holder-limit`, `holding-above-cap`, `address-frozen`,
`balance-insufficient` and `transfer-in-lockup` lean on it.

### ERC-20: Token Standard

https://eips.ethereum.org/EIPS/eip-20

Copy: research/sources/eip-20-token-standard.txt

The token interface ERC-3643 builds on: the decimals by which an amount on the chain, a whole number, is divided for
people to read it, the total supply, the balance of each account, and a transfer that is expected to throw when the
caller does not hold enough tokens. It also says that a transfer of 0 is a normal transfer. `amount-decimals`,
`supply-mismatch` and `balance-insufficient` lean on it, and the note of `amount-invalid` names its rule on transfers of
0.

## Lock-ups

### eCFR: 17 CFR 230.144 (Rule 144), paragraph (d), Holding period for restricted securities

https://www.ecfr.gov/current/title-17/section-230.144

Copy: research/sources/ecfr-17-cfr-230-144-d.txt

The paragraph of Rule 144 of the SEC on the holding period of restricted securities: six months between the acquisition
from the issuer or an affiliate and a resale under the rule where the issuer has been reporting for at least 90 days,
one year where it has not, a period that begins only when the full price is paid, and how the period is counted for
dividends, conversions, gifts, trusts, estates and other cases. It is cited as an example of where a lock-up of a class
of investors can come from, not as a rule the tool applies, and it is not legal advice. `transfer-in-lockup` names it.

## Country codes

### United Nations Statistics Division: Standard country or area codes for statistical use (M49)

https://unstats.un.org/unsd/methodology/m49/overview/

Copy: research/sources/un-m49-country-codes.txt

The table of countries and areas with their M49 code and their ISO codes of two and three letters. The country codes
of src/countries.js are copied from it. `country-unknown` leans on it.

### Swift: IBAN Registry (TXT)

https://www.swift.com/swift-resource/11971/download

Copy: research/sources/swift-iban-registry.txt

The registry of IBAN formats, which writes the prefix of each country as an ISO 3166 code. This tool reads it for one
code: XK, which it lists for Kosovo and the UN table does not. `country-unknown` uses it for that code.

## Addresses

### ethereum.org: Ethereum accounts

https://ethereum.org/en/developers/docs/accounts/

Copy: research/sources/ethereum-org-accounts.txt

How an address on Ethereum is made and written: the last 20 bytes of a hash of the public key, written as 0x and 40 hex
digits, the same form for a contract. `address-malformed` leans on it.
