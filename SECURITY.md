# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "token-transfer-check security", or use private vulnerability
reporting on this repository. Please do not open a public issue for a vulnerability.

Include small made-up files that show the problem, the command you ran, what you expected and what happened. Use
made-up names and made-up addresses, never the configuration of a real token, the register of real investors or the
wallet of a real person, and never a real private key, seed or mnemonic, even an old one or one from a test network.

## Scope

The tool is an input to a review: not legal advice, not a compliance review and not a guarantee that a transfer will
settle. In scope:

- an input that makes the tool show a private key, a seed or a mnemonic, or any part of one, in a report or an error
  message, in any format
- a key or a seed in one of the shapes docs/limits.md names that the tool does not report
- an input that makes the tool read a file other than the ones it was given, or follow a symbolic link
- an input that makes the tool open a network connection, fetch a URL, contact a chain, a node, a registry or an API,
  run any other program, or evaluate anything it reads
- an input that makes the tool write a file
- an input that makes the tool hang, take very long, exhaust the stack or use unbounded memory, such as very large files,
  a hundred thousand holders or transfers, arrays and objects nested deep, very long fields, numbers with thousands of
  digits or a quoted CSV field that is never closed
- binary or invalid input that the tool reads as if it were a configuration, a register or a list of transfers
- a CSV row whose values the tool reads in the wrong columns, a key written twice or a column named twice whose second
  value is taken without a finding, a field the tool did not read that a check reports as fine, or a misspelt key that is
  not reported
- a transfer that docs/method.md says is reported (to an investor without a claim or from a country that is not allowed,
  over a limit of holders, above the cap, inside a lock-up by its own day, from or to a frozen wallet, of more than the
  free balance) that the tool does not report
- an amount, a balance, a supply or a cap that the tool adds, multiplies or compares in a way the decimal text of the file
  does not say, so that a check passes or fails because of it
- a run that passes at a `--fail-on` level although the input holds a finding at that level that docs/method.md says is
  reported
- text from a file or a file name that rewrites the terminal through control or direction characters, is shown unescaped
  in the output, or puts markup into the markdown report
- a name such as `__proto__` that changes how objects behave inside the tool

Out of scope: the forms docs/limits.md says the tool does not see, whether the rules of the configuration are the right
rules for the asset (a clean result is not legal advice and not a compliance review), whether the files match the
deployed token or the chain, whether a claim is valid, entries added to the country table after the saved copy, secrets
in shapes the search does not claim to know, who may change or upload the files, and where your pipeline keeps the
output.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
