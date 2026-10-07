# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

The rules of a tokenized asset are full of time: a lock-up of an investor class, a holding period of a securities law, the
day an investor bought, the day a transfer is to be made. The obvious way to check a lock-up is to read the clock: take
today, look at when the investor bought, and say whether the tokens are free. That would make the same files give a
different report on a different day, so the saved output of the examples could never be compared with a new run, two
people reading the same commit could see two reports, and a list of transfers prepared for next week would be checked
against today instead of against the day it is meant for. A date in a file also brings its own trouble: a time zone, a
format, a calendar.

The checks do not need the clock. A lock-up is a number of days after an acquisition; whether a transfer is inside it
depends only on the day of the acquisition and the day of the transfer, and both can be in the files.

## Decision

1. The tool reads no clock, no time zone and no locale. It never prints the current time and never says when a page, a
   list or a release was published. The same files give the same output on every machine and on every day.
2. Days are whole numbers the files choose, on one scale of their own, such as days since the token was issued: the
   lock-up of an investor class in the configuration (`lockupDays`), the day each holder of the register acquired its
   tokens (`acquiredDay`), and the day of each transfer (`day`). The tool compares those numbers and never turns one into
   a date. A transfer with no day is a finding, never checked against the day of the run.
3. No document, example or test of this repository holds a date or a number that reads like a year: not the licence,
   not the changelog, not the documents, not the comments of the code, not the examples. `npm run check` and a test fail
   on any word of four digits that starts with 19 or 20. The saved copies of the public pages under research/sources are
   the pages' own words and are the one place the check does not read for prose; even so, the lines that carry a date or
   a number that reads like a year (the day an ERC page was created, the preliminary note and the history of Rule 144)
   were left out of the copies, so the test that reads every file for a year passes over them too. research/sources.md
   lists every line that was left out.
4. A version, an amount, a day number or the number of a standard is not a year and is not caught: 1.0.0, Node 22, a
   supply of 100000, day 665, ERC-3643, ERC-20, 17 CFR 230.144, SARIF 2.1.0 and NIST SP 800-218 hold no year. The
   examples use amounts and day numbers that do not read like a year, and a test of test/repo.test.js runs the pattern
   over such values and checks that none of them is caught, and that a year in the same place still is.
5. The sources are chosen with addresses that hold no year, and the notes on them name no publication date.

## Consequences

- The output of a run can be saved in the repository (`examples/output`) and compared on every change, because it does
  not move with the calendar.
- A list of transfers can be checked for the days it is meant for, before those days come.
- The files have to agree on one scale of days; the tool cannot see a register that counts from one day and transfers
  that count from another, and docs/inputs.md says so.
- The report holds no date and no deadline; the day a lock-up ends is a day number of the files.
