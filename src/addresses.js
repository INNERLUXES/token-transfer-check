// The form of an address on an EVM chain, where an ERC-3643 token lives: 0x and 40 hex digits, as the page of
// ethereum.org on accounts describes it (research/sources/ethereum-org-accounts.txt). The checksum of mixed case
// (EIP-55) is not checked, and nothing is looked up on a chain. Two addresses are the same holder when they differ only in
// case, because case does not change an address.

const EVM = /^0x[0-9a-fA-F]{40}$/;
const EVM_ZERO = /^0x0{40}$/;

export const ADDRESS_FORM = '0x followed by 40 hex digits, not the zero address';

// What is wrong with an address, or null when its form is right.
export function addressProblem(text) {
  const v = text.trim();
  if (v !== text) return 'has spaces around it';
  if (!v.startsWith('0x')) return 'does not start with 0x';
  if (v.length !== 42) return `has ${v.length - 2} characters after 0x, not 40`;
  if (!EVM.test(v)) return 'holds a character that is not a hex digit';
  if (EVM_ZERO.test(v)) return 'is the zero address, which no one holds';
  return null;
}

// The key two addresses are compared by: the address in small letters.
export const addressKey = (text) => text.trim().toLowerCase();
