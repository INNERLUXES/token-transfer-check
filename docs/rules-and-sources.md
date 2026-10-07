# Rules and sources

Every check of the tool, with what it looks at, the points of the public pages and lists it rests on, what it cannot see, and what to change. The points are in this project's own words and are the ones the reports show with `--explain`; each page was fetched and read before it was listed, and a copy of its text is kept under [research/sources](../research/sources) so that a point can be checked against the page it came from. [../research/sources.md](../research/sources.md) has a note on each page.

The tool is an input to a review before the transfers reach the chain: not legal advice, not a compliance review and not a guarantee that a transfer will settle. A check that is a best practice of this tool says so in its message; it is not a rule in the pages it cites. Rule 144 is an example of where a lock-up can come from, cited to show what a number of days in the configuration can stand for; it is not legal advice, and the lock-up the tool applies is always the one of the configuration.

## The pages

- ERC-3643: T-REX - Token for Regulated EXchanges: https://eips.ethereum.org/EIPS/eip-3643 (copy: `research/sources/eip-3643-t-rex.txt`)
- ERC-20: Token Standard: https://eips.ethereum.org/EIPS/eip-20 (copy: `research/sources/eip-20-token-standard.txt`)
- eCFR: 17 CFR 230.144 (Rule 144), paragraph (d), Holding period for restricted securities: https://www.ecfr.gov/current/title-17/section-230.144 (copy: `research/sources/ecfr-17-cfr-230-144-d.txt`)
- United Nations Statistics Division: Standard country or area codes for statistical use (M49): https://unstats.un.org/unsd/methodology/m49/overview/ (copy: `research/sources/un-m49-country-codes.txt`)
- Swift: IBAN Registry (TXT): https://www.swift.com/swift-resource/11971/download (copy: `research/sources/swift-iban-registry.txt`)
- ethereum.org: Ethereum accounts: https://ethereum.org/en/developers/docs/accounts/ (copy: `research/sources/ethereum-org-accounts.txt`)

## file-unreadable

- Level: error
- Kind: a problem with one of the files itself; it has no setting to lower
- Looks at: a file is not JSON or CSV the readers can follow, or its top level is not an object, so nothing in it was read.
- Cannot see: It stops at the first place that is not strict JSON or a strict CSV table, or at a top level that is not an object, so nothing in that file is checked; a configuration written as CSV is not read.
- What to change: Write the configuration as one JSON object, and the register and the transfers as JSON or as a CSV table with a header row (docs/inputs.md); fix the line named.
- Points of the pages: none; this check is about one of the files itself.

## field-missing

- Level: error
- Kind: a problem with one of the files itself; it has no setting to lower
- Looks at: a field the checks need is not in a file: a part of the configuration or one of its fields, the holders or one of their addresses, countries or balances, or the id, addresses, amount or day of a transfer.
- Cannot see: It names the field and the part or the row that lacks it; it does not guess the value, and the checks that need the field do not run for that part or row.
- What to change: Add the field named; docs/inputs.md lists what each file needs.
- Points of the pages: none; this check is about one of the files itself.

## field-unknown

- Level: warning
- Kind: a problem with one of the files itself; it has no setting to lower
- Looks at: a key or column the tool does not read, often a misspelt one; its value was left out of every check.
- Cannot see: It cannot tell what a misspelt key was meant to say; it names a known key when one differs only in case or separators or starts the same, and the value is left out of every check. In a CSV file an unknown column is reported once, at the header.
- What to change: Correct the spelling to a field of docs/inputs.md, or remove it.
- Points of the pages: none; this check is about one of the files itself.

## field-invalid

- Level: error
- Kind: a problem with one of the files itself; it has no setting to lower
- Looks at: a value of the wrong type or form: text where a number belongs, a cap that is not an amount or a percent, an investor class the configuration does not list, frozen tokens that are not a decimal, or a country or class named twice.
- Cannot see: It names the value and the form it needs; the value is left out of the checks that need it.
- What to change: Write the value as docs/inputs.md shows: text for names, codes and addresses, whole numbers for decimals, days and limits, plain decimal numbers for amounts, true or false for the controls.
- Points of the pages: none; this check is about one of the files itself.

## field-duplicate

- Level: error
- Kind: a problem with one of the files itself; it has no setting to lower
- Looks at: a column is named twice in the header of a CSV file, so two readers of the file could take different values; the second column was left out.
- Cannot see: It compares the names of the header as written; two names that differ in case are two columns, and the second is then reported as unknown or read as its own field.
- What to change: Keep one column of each name. In a JSON file a key written twice stops the reader (file-unreadable).
- Points of the pages: none; this check is about one of the files itself.

## secret-in-file

- Level: error
- Kind: a problem with one of the files itself; it has no setting to lower
- Looks at: a file holds a private key, a seed or a mnemonic, under a key or column named for one or as a value shaped like one; the tool never reads it and never shows it.
- Cannot see: It knows keys and seeds by the name of their key or column and by their shape; a secret split over fields, encoded another way or written under another name is not caught. The search is kept unchanged from the sibling tools, and this check is about the file and rests on no point of a page.
- What to change: Remove the value from the file and from wherever the file was copied, treat it as exposed and move what it controls to a new key. The files of this tool name wallets by their public address only.
- Points of the pages: none; this check is about one of the files itself.

## agent-missing

- Level: error
- Kind: documented
- Looks at: the configuration names no agent, so no one can add investors to the identity registry, freeze a wallet, pause the token, force a transfer or recover lost tokens.
- Cannot see: It reads the agents the configuration names; whether those wallets are the agents of the deployed token, and who holds their keys, is not known.
- What to change: Name the agent wallets in roles.agents, appointed by the owner.
- Points of the pages:
  - An ERC-3643 token has to define an Owner role, the issuer, and an Agent role; the owner appoints and removes the agents, and only agents add or remove the identities of investors in the identity registry. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)

## agent-single-key

- Level: warning
- Kind: best practice
- Looks at: forced transfers or recovery are on, and one agent that is not a multisig wallet holds them, so one key can move any investor's tokens.
- Cannot see: It reads the number of agents and the multisig flag of the configuration; it cannot see how many signers a multisig wallet needs, or whether two agents are held by one person.
- What to change: Make the agent a multisig wallet that needs more than one signer (and set roles.multisig to true), or name more than one agent under a policy of the team.
- Points of the pages:
  - The standard asks that an agent wallet be able to force a transfer, which needs only a verified receiver and passes over the compliance rules. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)
  - The standard asks for a way to recover the tokens of an investor who has lost access to the private key of a wallet, and keeps a record of each recovery on the chain. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)
- The tool's own choice: asking for more than one key behind the power to move an investor's tokens is a best practice of this tool, not a rule in the pages it cites; the standard defines the agent role and leaves how the agent wallet is held to the issuer.

## pause-missing

- Level: error
- Kind: documented
- Looks at: the token is not pausable, though ERC-3643 asks that it can be paused.
- Cannot see: It reads the pausable flag of the configuration; whether the deployed token has the functions, and who may call them, is not looked up on a chain.
- What to change: Deploy the token with the pause and unpause functions of ERC-3643 and set controls.pausable to true.
- Points of the pages:
  - The standard asks that the token can be paused, and a transfer of a paused token fails. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)

## forced-transfer-missing

- Level: warning
- Kind: documented
- Looks at: forced transfers are off, though ERC-3643 asks that an agent wallet can force one.
- Cannot see: It reads the forcedTransfer flag of the configuration; whether the deployed token has the function is not looked up.
- What to change: Turn forced transfers on for the agent, and keep that power behind more than one key.
- Points of the pages:
  - The standard asks that an agent wallet be able to force a transfer, which needs only a verified receiver and passes over the compliance rules. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)

## recovery-missing

- Level: warning
- Kind: documented
- Looks at: recovery is off, though ERC-3643 asks for a way to recover the tokens of an investor who has lost the key to a wallet.
- Cannot see: It reads the recovery flag of the configuration; whether the deployed token has the function, and how a lost wallet is proven, is not known.
- What to change: Turn recovery on for the agent, and keep that power behind more than one key.
- Points of the pages:
  - The standard asks for a way to recover the tokens of an investor who has lost access to the private key of a wallet, and keeps a record of each recovery on the chain. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)

## standard-unknown

- Level: warning
- Kind: best practice
- Looks at: the standard of the token is not ERC-3643, so the rules of the checks may not be the ones the token enforces.
- Cannot see: It compares the name of the standard with the names of ERC-3643 it knows; a token on another standard can still enforce rules of its own, which the tool does not know.
- What to change: Write ERC-3643 when the token follows it; for another standard, check each rule of this report against what the token itself enforces.
- Points of the pages: none.
- The tool's own choice: reading every token by the rules of ERC-3643 is a best practice of this tool, not a rule in the pages it cites; the tool knows one standard, and a token on another may enforce its rules in another way.

## country-unknown

- Level: error
- Kind: documented
- Looks at: a country, in the allowed countries, the limits by country or the register, that is not a two-letter code of ISO 3166-1 as the UN M49 table lists them (or XK), written in capitals, such as UK for GB.
- Cannot see: The UN table lists no code for Taiwan (TW), which ISO 3166-1 assigns, so a country written TW is reported and needs a look by hand; XK, which the IBAN registry of Swift lists for Kosovo, is accepted. Whether the country is the right one for an investor is not known, and the numeric codes the identity registry stores on a chain are not read.
- What to change: Write the two capital letters of the country, such as GB for the United Kingdom.
- Points of the pages:
  - The identity registry ties each wallet to the country of residence of its investor as an ISO 3166 code, and the compliance contract can set the countries in which the token may circulate. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)
  - The M49 table of the UN Statistics Division gives each country or area it lists a number of three digits and its ISO codes of two and of three letters. (United Nations Statistics Division: Standard country or area codes for statistical use (M49), https://unstats.un.org/unsd/methodology/m49/overview/)
  - The IBAN registry of Swift writes the prefix of each country as an ISO 3166 code, and lists XK for Kosovo, which the UN table leaves out. (Swift: IBAN Registry (TXT), https://www.swift.com/swift-resource/11971/download)

## address-malformed

- Level: error
- Kind: documented
- Looks at: an address of the owner, an agent, a holder or a transfer that is not 0x and 40 hex digits, or is the zero address.
- Cannot see: It checks the form of an address only: no checksum of EIP-55 and no look-up on a chain, so a well-formed address that no one holds, or that belongs to someone else, passes.
- What to change: Copy the address again from the wallet, as 0x and 40 hex digits.
- Points of the pages:
  - An Ethereum address is made from the last 20 bytes of a Keccak-256 hash of the public key with 0x in front, 42 characters with 40 hex digits, and a contract account has an address of the same form. (ethereum.org: Ethereum accounts, https://ethereum.org/en/developers/docs/accounts/)

## amount-decimals

- Level: error
- Kind: documented
- Looks at: a supply, cap, balance, frozen amount or transfer amount with more decimal places than the decimals of the token, which the chain cannot hold.
- Cannot see: It compares the places an amount needs, with trailing zeros left out, with the decimals of the configuration; whether those are the decimals of the deployed token is not looked up.
- What to change: Round the amount to the decimals of the token, or check the decimals of the configuration against the deployed token.
- Points of the pages:
  - ERC-20 gives a token a number of decimals by which an amount on the chain, a whole number, is divided for people to read it; 8 decimals means a division by 100000000. (ERC-20: Token Standard, https://eips.ethereum.org/EIPS/eip-20)

## amount-invalid

- Level: error
- Kind: best practice
- Looks at: a total supply or a transfer amount that is 0, a balance or amount that is negative, or one that is not a plain decimal number (a sign, an exponent or a thousands separator).
- Cannot see: It reads the amount from the characters of the file; it cannot tell whether a positive amount is the one that was agreed.
- What to change: Write the amount as a plain decimal number such as 2500, above 0 for a supply and a transfer.
- Points of the pages: none.
- The tool's own choice: refusing a supply or a transfer of 0, a negative amount and an amount in another notation is a best practice of this tool, not a rule in the pages it cites; ERC-20 treats a transfer of 0 as a normal transfer, and a transfer of 0 in a list to review is more often a row that lost its amount.

## holder-duplicate

- Level: error
- Kind: best practice
- Looks at: two rows of the register name the same address (compared without case), so its balance, country or class is counted twice or read from the wrong row.
- Cannot see: It compares the addresses of one register, in small letters; one investor with two wallets is two holders to the tool, as to the identity registry when it lists two wallets.
- What to change: Keep one row for each wallet, with its whole balance.
- Points of the pages: none.
- The tool's own choice: asking for one row of the register for each wallet is a best practice of this tool, not a rule in the pages it cites; the identity registry holds one identity for a wallet, and two rows of one wallet are a mistake of the export.

## investor-claims-missing

- Level: error
- Kind: documented
- Looks at: a transfer to an address that is not in the register, or to an investor whose identity lacks a required claim, or a holder of tokens who lacks one.
- Cannot see: It compares the claims the register lists for an investor with the required claims, by their names; whether a claim is valid, signed by a trusted issuer or still current is not known, and the claim topics of the chain, which are numbers, are not read.
- What to change: Register the investor and have a trusted issuer add the missing claims before the transfer, or leave the transfer out; review a holder who lacks a claim with the issuer.
- Points of the pages:
  - A transfer goes through only when the receiver is in the identity registry of the token and is verified: its identity holds the claims of the topics the token requires, signed by a trusted issuer. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)

## investor-country-not-allowed

- Level: error
- Kind: documented
- Looks at: a transfer to an investor, or a holder of tokens, whose country is not in the allowed countries of the configuration.
- Cannot see: It compares the country of the register with the allowed countries of the configuration; whether an investor may hold the token under the law of a country is a question for counsel, not for the tool.
- What to change: Leave the transfer out, and review a holder of the register in a country that is not allowed with the issuer; change the allowed countries only after the legal review of the offering says so.
- Points of the pages:
  - The identity registry ties each wallet to the country of residence of its investor as an ISO 3166 code, and the compliance contract can set the countries in which the token may circulate. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)

## holder-limit

- Level: error
- Kind: documented
- Looks at: the number of holders of the register, or after a transfer to a new holder, is above maxHolders.
- Cannot see: It counts the wallets of the register with a balance above 0, and the holders after each transfer that passes; one investor with two wallets counts twice, and a limit that counts investors rather than wallets needs a look by hand.
- What to change: Leave the transfer out, or wait for a holder to leave; raise maxHolders only after the legal review of the offering says so.
- Points of the pages:
  - The compliance check of each transfer can hold the token to a fixed largest number of holders, overall or for each country, and refuses a transfer that breaks such a rule. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)

## country-holder-limit

- Level: error
- Kind: documented
- Looks at: the number of holders in a country, in the register or after a transfer to a new holder, is above the limit maxHoldersPerCountry sets for it.
- Cannot see: It counts the wallets with a balance above 0 by the country of the register; a holder whose country could not be read is not counted for a country.
- What to change: Leave the transfer out, or wait for a holder of that country to leave; raise the limit only after the legal review of the offering says so.
- Points of the pages:
  - The compliance check of each transfer can hold the token to a fixed largest number of holders, overall or for each country, and refuses a transfer that breaks such a rule. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)

## holding-above-cap

- Level: error
- Kind: documented
- Looks at: a holder of the register, or the receiver after a transfer, holds more than maxHolding, an amount or a percent of the total supply.
- Cannot see: It compares the balance of each wallet with the cap, a percent of the total supply of the configuration or an amount; tokens one investor holds in two wallets are not added together.
- What to change: Lower the amount of a transfer that takes the receiver above the cap, and review a holder of the register who is already above it with the issuer.
- Points of the pages:
  - The compliance check can also hold each investor to a largest amount of tokens, and the rationale of the standard names a cap on the percent any one investor holds. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)

## supply-mismatch

- Level: error
- Kind: best practice
- Looks at: the balances of the register do not add up to the total supply of the configuration.
- Cannot see: It adds the balances of the rows of the register it could read; when a balance could not be read, the sum is not compared and a note says so. Tokens minted or burned after the export are not seen.
- What to change: Export the register and the supply again from the same block, and find the holder that is missing or counted twice.
- Points of the pages:
  - ERC-20 gives a token a function for its total supply and one for the balance of each account. (ERC-20: Token Standard, https://eips.ethereum.org/EIPS/eip-20)
- The tool's own choice: comparing the sum of the balances with the total supply is a best practice of this tool, not a rule in the pages it cites; ERC-20 gives both, and a register that does not add up is an export that left out a holder or counted one twice.

## transfer-id-duplicate

- Level: error
- Kind: best practice
- Looks at: two transfers share an id (compared without case and outer spaces), so the second is refused or made twice.
- Cannot see: It compares the ids of one file; an id used in an earlier list is not seen.
- What to change: Give every transfer an id of its own and keep it when the list is sent again.
- Points of the pages: none.
- The tool's own choice: asking for an id of its own for each transfer is a best practice of this tool, not a rule in the pages it cites; no cited page sets a rule for the ids of a list of transfers.

## address-frozen

- Level: error
- Kind: documented
- Looks at: a transfer from or to a frozen wallet, or one that needs tokens frozen on the wallet of the sender.
- Cannot see: It reads the frozen flag and the frozen tokens of the register; a wallet frozen or unfrozen after the export is not seen.
- What to change: Leave the transfer out until an agent has unfrozen the wallet or the tokens, and find out why they were frozen.
- Points of the pages:
  - An agent can freeze a wallet or a part of its tokens; a transfer fails when the wallet that sends or the one that receives is frozen. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)
  - The sender of a transfer has to hold enough free balance, which is its balance less the tokens frozen on its wallet. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)

## balance-insufficient

- Level: error
- Kind: documented
- Looks at: a transfer of more than the sender holds after the transfers before it, or from an address that is not in the register.
- Cannot see: It works out the balance of the sender from the register and the transfers before it in the order of their day; a transfer with a finding is taken as not made, and transfers made outside the list are not seen.
- What to change: Lower the amount, or put the transfer after the one that gives the sender the tokens.
- Points of the pages:
  - The sender of a transfer has to hold enough free balance, which is its balance less the tokens frozen on its wallet. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)
  - Under ERC-20 a transfer is expected to throw when the caller does not hold enough tokens for it. (ERC-20: Token Standard, https://eips.ethereum.org/EIPS/eip-20)

## transfer-in-lockup

- Level: error
- Kind: documented
- Looks at: a transfer made, by its own day, fewer days after the sender acquired the tokens than the lockupDays of its investor class.
- Cannot see: It compares the day of the transfer with the acquiredDay of the sender and the lockupDays of its class, all whole numbers of the files; it reads no clock and turns no day into a date. A receiver acquires on the day of the transfer, the safe side; a rule such as Rule 144, under which a later holder may in some cases count from an earlier acquisition, needs counsel, and Rule 144 is an example of where a lock-up can come from, not legal advice.
- What to change: Move the transfer to the day the lock-up ends or later, as the message says.
- Points of the pages:
  - The functions of an ERC-3643 token let the owner and the agents manage the supply, the rules of transfer and lock-ups, and the compliance contract enforces the rules of the offering on every transfer. (ERC-3643: T-REX - Token for Regulated EXchanges, https://eips.ethereum.org/EIPS/eip-3643)
  - As one example of a lock-up, Rule 144 (d) sets a holding period for restricted securities between their acquisition from the issuer and a resale under the rule: six months where the issuer has reported for at least 90 days, and one year where it has not. (eCFR: 17 CFR 230.144 (Rule 144), paragraph (d), Holding period for restricted securities, https://www.ecfr.gov/current/title-17/section-230.144)
