# token-transfer-check: examples/good/config.json

- Files: config examples/good/config.json \(JSON, 31 lines, 1,146 bytes\); register examples/good/register.csv \(CSV, 9 lines, 1,001 bytes\); transfers examples/good/transfers.csv \(CSV, 5 lines, 587 bytes\)
- Token: Meadow Example Lofts Token \(MLT\); ERC-3643; 2 decimals; total supply 50000
- Register: 8 holders, 6 with a balance above 0; balances add up to 50000
- Transfers: 4 transfers, 4 taken as made; 8 holders after them
- Findings: 0
- Result: **PASS - no finding at or above error**

## Findings

None.

## Holders by country (5)

| Country | Allowed | Limit | Holders | After transfers |
| --- | --- | ---: | ---: | ---: |
| CH | yes | - | 1 | 1 |
| DE | yes | - | 1 | 1 |
| GB | yes | 10 | 1 | 2 |
| SG | yes | - | 1 | 1 |
| US | yes | 35 | 2 | 3 |

This report is an input to a review before the transfers reach the chain: not legal advice, not a compliance review and not a guarantee that a transfer will settle.
