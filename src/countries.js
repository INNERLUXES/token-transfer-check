// The two-letter country codes the checks know. ISO keeps ISO 3166-1 on its Online Browsing Platform, which can only be
// read after its terms of use are accepted, so the tool takes the codes from the table of the United Nations Statistics
// Division, Standard country or area codes for statistical use (M49), whose column "ISO-alpha2 Code" gives the code of
// each country or area it lists (research/sources/un-m49-country-codes.txt). The codes are kept as one string of pairs in
// the order of the alphabet. test/data.test.js checks the string against the saved copy of the table. The copy and this
// handling are the ones of the sibling tool payout-batch-check.
//
// The UN table lists no code for Taiwan (TW), which ISO 3166-1 assigns; a country written TW is reported as
// country-unknown and needs a look by hand (docs/limits.md). Kosovo (XK) is not in the UN table either, but the IBAN
// registry of Swift, which writes its prefixes as ISO 3166 codes, lists it (research/sources/swift-iban-registry.txt), so
// it is accepted, as payout-batch-check accepts it.

const PAIRS =
  'ADAEAFAGAIALAMAOAQARASATAUAWAXAZBABBBDBEBFBGBHBIBJBLBMBNBOBQBRBSBTBVBWBYBZCACCCDCFCGCHCICKCLCMCNCOCRCUCVCWCXCYCZ' +
  'DEDJDKDMDODZECEEEGEHERESETFIFJFKFMFOFRGAGBGDGEGFGGGHGIGLGMGNGPGQGRGSGTGUGWGYHKHMHNHRHTHUIDIEILIMINIOIQIRISITJEJM' +
  'JOJPKEKGKHKIKMKNKPKRKWKYKZLALBLCLILKLRLSLTLULVLYMAMCMDMEMFMGMHMKMLMMMNMOMPMQMRMSMTMUMVMWMXMYMZNANCNENFNGNINLNONP' +
  'NRNUNZOMPAPEPFPGPHPKPLPMPNPRPSPTPWPYQARERORSRURWSASBSCSDSESGSHSISJSKSLSMSNSOSRSSSTSVSXSYSZTCTDTFTGTHTJTKTLTMTNTO' +
  'TRTTTVTZUAUGUMUSUYUZVAVCVEVGVIVNVUWFWSYEYTZAZMZW';

// The codes of the UN table, in order.
export const UN_CODES = PAIRS.match(/[A-Z]{2}/g);

// The codes the IBAN registry of Swift lists that the UN table does not: Kosovo.
export const REGISTRY_CODES = ['XK'];

// The codes the checks accept.
export const COUNTRY_CODES = [...UN_CODES, ...REGISTRY_CODES].sort();

const KNOWN = new Set(COUNTRY_CODES);

// Whether a text is a country code the checks know, as written: two capital letters.
export const isCountry = (code) => KNOWN.has(code);

// A hint for a code that is not known: GB for UK, capitals for small letters, and Taiwan, which the table leaves out.
export function countryHint(code) {
  if (code === 'UK') return ' The code of the United Kingdom is GB.';
  if (isCountry(code.toUpperCase())) return ' Write the code in capitals.';
  if (code === 'TW') return ' The UN table the tool reads lists no code for Taiwan; check the code by hand.';
  return '';
}
