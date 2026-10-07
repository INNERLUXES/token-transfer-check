// The public pages and lists the checks rest on, and the points of each that the reports show, written in this project's
// own words. A page is named by its address; a copy of its text, read before it was listed, is kept under
// research/sources. research/sources.md lists every page with a note, docs/rules-and-sources.md lists every rule with its
// points, and test/data.test.js checks the three against each other.

export const LEVELS = ['info', 'warning', 'error'];

export const NOT_A = 'not legal advice, not a compliance review and not a guarantee that a transfer will settle';

export const NOTICE = `This report is an input to a review before the transfers reach the chain: ${NOT_A}.`;

export const SOURCES = [
  { id: 'eip-3643', title: 'ERC-3643: T-REX - Token for Regulated EXchanges', url: 'https://eips.ethereum.org/EIPS/eip-3643', file: 'research/sources/eip-3643-t-rex.txt' },
  { id: 'eip-20', title: 'ERC-20: Token Standard', url: 'https://eips.ethereum.org/EIPS/eip-20', file: 'research/sources/eip-20-token-standard.txt' },
  { id: 'ecfr-144', title: 'eCFR: 17 CFR 230.144 (Rule 144), paragraph (d), Holding period for restricted securities', url: 'https://www.ecfr.gov/current/title-17/section-230.144', file: 'research/sources/ecfr-17-cfr-230-144-d.txt' },
  { id: 'un-m49', title: 'United Nations Statistics Division: Standard country or area codes for statistical use (M49)', url: 'https://unstats.un.org/unsd/methodology/m49/overview/', file: 'research/sources/un-m49-country-codes.txt' },
  { id: 'swift-iban-registry', title: 'Swift: IBAN Registry (TXT)', url: 'https://www.swift.com/swift-resource/11971/download', file: 'research/sources/swift-iban-registry.txt' },
  { id: 'ethereum-accounts', title: 'ethereum.org: Ethereum accounts', url: 'https://ethereum.org/en/developers/docs/accounts/', file: 'research/sources/ethereum-org-accounts.txt' }
];

// Points: id -> { source, text }.
export const POINTS = {
  'erc3643-agent-role': { source: 'eip-3643', text: 'An ERC-3643 token has to define an Owner role, the issuer, and an Agent role; the owner appoints and removes the agents, and only agents add or remove the identities of investors in the identity registry.' },
  'erc3643-forced-transfer': { source: 'eip-3643', text: 'The standard asks that an agent wallet be able to force a transfer, which needs only a verified receiver and passes over the compliance rules.' },
  'erc3643-recovery': { source: 'eip-3643', text: 'The standard asks for a way to recover the tokens of an investor who has lost access to the private key of a wallet, and keeps a record of each recovery on the chain.' },
  'erc3643-pause': { source: 'eip-3643', text: 'The standard asks that the token can be paused, and a transfer of a paused token fails.' },
  'erc3643-verified': { source: 'eip-3643', text: 'A transfer goes through only when the receiver is in the identity registry of the token and is verified: its identity holds the claims of the topics the token requires, signed by a trusted issuer.' },
  'erc3643-country': { source: 'eip-3643', text: 'The identity registry ties each wallet to the country of residence of its investor as an ISO 3166 code, and the compliance contract can set the countries in which the token may circulate.' },
  'erc3643-holder-limits': { source: 'eip-3643', text: 'The compliance check of each transfer can hold the token to a fixed largest number of holders, overall or for each country, and refuses a transfer that breaks such a rule.' },
  'erc3643-holding-cap': { source: 'eip-3643', text: 'The compliance check can also hold each investor to a largest amount of tokens, and the rationale of the standard names a cap on the percent any one investor holds.' },
  'erc3643-lockups': { source: 'eip-3643', text: 'The functions of an ERC-3643 token let the owner and the agents manage the supply, the rules of transfer and lock-ups, and the compliance contract enforces the rules of the offering on every transfer.' },
  'erc3643-frozen': { source: 'eip-3643', text: 'An agent can freeze a wallet or a part of its tokens; a transfer fails when the wallet that sends or the one that receives is frozen.' },
  'erc3643-free-balance': { source: 'eip-3643', text: 'The sender of a transfer has to hold enough free balance, which is its balance less the tokens frozen on its wallet.' },
  'erc20-decimals': { source: 'eip-20', text: 'ERC-20 gives a token a number of decimals by which an amount on the chain, a whole number, is divided for people to read it; 8 decimals means a division by 100000000.' },
  'erc20-supply': { source: 'eip-20', text: 'ERC-20 gives a token a function for its total supply and one for the balance of each account.' },
  'erc20-balance': { source: 'eip-20', text: 'Under ERC-20 a transfer is expected to throw when the caller does not hold enough tokens for it.' },
  'rule144-holding-period': { source: 'ecfr-144', text: 'As one example of a lock-up, Rule 144 (d) sets a holding period for restricted securities between their acquisition from the issuer and a resale under the rule: six months where the issuer has reported for at least 90 days, and one year where it has not.' },
  'm49-alpha2': { source: 'un-m49', text: 'The M49 table of the UN Statistics Division gives each country or area it lists a number of three digits and its ISO codes of two and of three letters.' },
  'registry-kosovo': { source: 'swift-iban-registry', text: 'The IBAN registry of Swift writes the prefix of each country as an ISO 3166 code, and lists XK for Kosovo, which the UN table leaves out.' },
  'evm-address': { source: 'ethereum-accounts', text: 'An Ethereum address is made from the last 20 bytes of a Keccak-256 hash of the public key with 0x in front, 42 characters with 40 hex digits, and a contract account has an address of the same form.' }
};

export const source = (id) => SOURCES.find((s) => s.id === id);
export const pointPage = (id) => source(POINTS[id].source);
