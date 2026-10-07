# Secure defaults

The default run is the safe run. Nothing in the first section needs a flag, and none of it can be switched off. The rest
of the document is about what the tool cannot do for you: which files you give it, where the output goes, and who may
change the files it reads. A clean result is not legal advice, not a compliance review and not a guarantee that a
transfer will settle; it is a set of files with none of the problems the checks look for, not a finding that the
transfers in it are allowed.

## How the tool behaves by default

- **Never a secret.** The tool needs no private key, no seed, no API key and no address of a node, and has no option to
  take one. A key or column named for a key or a seed, and a value shaped like one, anywhere in a file, is a
  `secret-in-file` error that fails the run; the value is left out of every check and never written to a report or an
  error message, in any format.
- **Reads, never sends.** The tool reads the files it is given. It follows no symbolic link, fetches no URL, refuses an
  argument that looks like an address, contacts no chain, node, registry or API, evaluates nothing and writes nothing to
  disk. It cannot send a transaction.
- **Every check on from the first run.** A configuration with no agent or that cannot be paused, an unknown country, a
  malformed address, an amount with more decimals than the token, an amount of 0 or below, a holder written twice, a
  holder or receiver without the required claims or in a country that is not allowed, holders over a limit, a holding
  above the cap, balances that do not add up to the supply, a transfer id written twice, a frozen wallet, a transfer of
  more than the sender holds and a transfer inside its lock-up are errors; one key behind forced transfers or recovery,
  forced transfers or recovery switched off and a standard other than ERC-3643 are warnings. There is no configuration
  file of the tool that could set a check off.
- **The rules are the asset's own.** The countries, claims, limits, cap and lock-ups come from the configuration of the
  token, not from the tool. The tool has no list of countries an asset may sell to and no lock-up of its own; Rule 144 is
  cited as an example of where a lock-up can come from, not as a rule the tool applies.
- **No clock.** A lock-up is checked with the day the transfer carries against the day the holder acquired its tokens,
  both whole numbers of the files. A transfer with no day is a finding, never checked against today.
- **Fail closed on what it cannot read.** A file that is not strict JSON or a strict CSV table is an error finding that
  fails the run at the default `--fail-on` of `error`. A row with a field too many or too few stops the reader instead
  of shifting the values. A missing field and a value of the wrong type are findings of their own, so a part of a file
  that was not read is never taken for one that is fine. A misspelt key is a warning that names the key it is probably
  meant to be. A file that is not text, is too large or is a link stops the run with exit code `2` and no report.
- **A refused transfer is not made.** A transfer with a finding is taken as not made, as the chain would refuse it, so
  the transfers after it are checked against the balances without it, and a note says how many were refused.
- **Amounts as written.** An amount, a balance, a supply or a cap is read and worked out from the characters of the
  file, never through a floating point number, and a number with an exponent or a separator is refused, so a supply of
  0.3 matches balances of 0.1 and 0.2 and a cap of 20% of 100000 is 20000 exactly.
- **Unknown arguments are errors.** An option the tool does not know, a value that looks like an option and an option
  given twice stop the run, so a typo such as `--fail-no` cannot leave a default in place. `--transfers` without
  `--register` is refused, because the investors a transfer goes to are read from the register.
- **No pattern from the input.** No regular expression is built from a file or from an argument.
- **Bounded work.** The readers have limits of size, rows, columns, fields, nesting, values and string length, the JSON
  reader works with a stack of its own, and a register and a list of transfers have at most 100,000 rows each
  (docs/limits.md), so a large or deep file cannot exhaust the stack, the memory or the time.
- **No prototype tricks.** Keys and columns from a file are kept in lists and compared with the names the tool reads,
  never set as properties of an object, so `__proto__` is only a name.
- **Clean output.** Text from the input, file names, token names, addresses, classes and transfer ids included, has
  control characters, line separators and direction controls replaced and its length capped before it reaches a report
  or an error message; the markdown report also escapes what markdown gives a meaning to.
- **The same input gives the same output.** No clock, no zone, no locale and no random number
  ([decision 1](decisions/0001-read-no-clock-and-keep-dates-out-of-the-repository.md)).
- **No dependencies.** Node 22 or newer and nothing else.

## Settings that make the check stricter

- **`--fail-on warning`.** One key behind forced transfers or recovery, forced transfers or recovery switched off, a
  standard other than ERC-3643 and misspelt keys fail the run too. Use it on a configuration that is about to be
  deployed or changed, and record in the review each warning the team keeps on purpose.
- **A register and the transfers.** Give `--register` on every run, so that the claims, countries, limits, cap and supply
  are checked against the holders, and `--transfers` for every batch of transfers before it is signed.
- **Limits in the configuration.** Give `maxHolders`, `maxHoldersPerCountry`, `maxHolding` and the investor classes with
  their `lockupDays` as the legal review of the offering sets them; a limit the configuration does not give is a check
  that does not run.

## Running it in a pipeline

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  - name: Token transfer check
    run: npx --yes github:INNERLUXES/token-transfer-check token/config.json --register token/register.csv --transfers token/transfers.csv --format markdown >> "$GITHUB_STEP_SUMMARY"
```

- Give the job read access to the contents and nothing more. The tool needs no secret, no API key and no access to a
  node; never give it one.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because
  `npx` runs what it downloads.
- Export the register from the chain at one block, just before the run, and run the tool on the exact list of transfers
  that is signed. A register exported last week, or a list edited after the check, is not what was checked.
- Keep registers of real investors out of public repositories: they hold wallets, countries and balances of real people.
  Run the tool where the files already are, and keep its reports with the same care, because a finding quotes
  addresses, countries and balances.
- Do not hide the exit code with a trailing `|| true`. To keep the report without failing, keep `--fail-on` at `error`
  and keep the SARIF or JSON report as an artifact of the job.
- Treat a report built from a file you do not trust as untrusted data.
- If the tool ever reports `secret-in-file`, treat the key or seed as exposed: remove it from the file and from every
  place the file was copied to, and move what it controls to a new key. The tool does not show the value, but the file
  itself was readable to everyone with access to it.

## Protecting the token

A permissioned token moves ownership of an asset as soon as a transfer is mined, and its agents can freeze, force and
recover. Keep the configuration of the token in code, review a change to it like code, keep the agent behind more than
one key, and have counsel review the rules of the offering. Check every change of the configuration and every batch of
transfers with this tool in that process: it reads the rules as the files write them, not whether they are the right
rules for the asset.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with
`ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
