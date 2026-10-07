# 3. Check the files on disk, and contact no chain

## Status

Accepted

## Context

Most facts about a token live on a chain: the balances, the identity registry with its countries and claims, the
compliance modules with their limits, the frozen wallets, whether the token is paused, who the agents are. A check could
call a node on every run, read the contracts, simulate each transfer with `canTransfer` and fetch the newest rules of the
compliance contract. That would need the network, a node and often a key, would make the result depend on the state of a
chain at the moment of the run, would send the addresses of investors to a third party, and would let a file in a pull
request make the pipeline reach any address it names.

What a team needs first, before a change of the rules or a batch of transfers goes out, is a list of what is wrong in
the files and where: a configuration that has no agent or cannot be paused, a register that does not add up, a holder
in a country that is not allowed, a transfer that the token would refuse or that the rules of the offering do not allow.
The configuration, the register and the transfers can be exported as files, reviewed like code and checked the same way
on every run.

## Decision

1. The tool reads the files it is given, and nothing else. It contacts no chain, node, registry or API, fetches nothing,
   needs no key, runs no program and sends no data anywhere. It cannot send a transaction.
2. The register stands for the identity registry and the balances of the token, and the configuration for its compliance
   rules, roles and controls. The tool works out what each transfer would do to the balances and the number of holders
   from these files, in the order of the days of the transfers, and never asks a chain.
3. The country codes are a table in the code, copied from the saved copy of the M49 table of the UN Statistics
   Division, and a test checks the table against its copy. It is updated in a release, with the copy, never fetched while
   the tool runs.
4. The rules the checks apply are listed in docs/method.md, and the public pages each documented check rests on are
   named in src/data.js and research/sources.md, each fetched and read before it was listed, with a copy of its text
   under research/sources. Rule 144 is cited as an example of where a lock-up can come from; the lock-up the tool applies
   is always the number of days of the configuration.
5. The tool lists what to look at and what to change; it changes nothing and sends nothing.

## Consequences

- The result depends only on the files, and a run needs no network access, no secret and no node, and sends the data of
  no investor anywhere.
- A register exported from a chain is only as current as its export; a balance, a claim or a frozen wallet that changed
  after the export is not seen, and docs/secure-defaults.md says to export the files from one block, just before the run.
- A compliance module of the deployed token that the configuration does not describe is not checked, and a configuration
  that does not match the deployed token gives a report about the configuration, not about the token.
