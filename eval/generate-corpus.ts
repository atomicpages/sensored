import { faker } from "@faker-js/faker";
import { EVAL_RULES } from "./evaluator";
import { createRedactor } from "../src/index.ts";

interface Tuple {
  ruleId: string;
  start: number;
  end: number;
}

interface Case {
  id: string;
  text: string;
  kind: "supported" | "negative" | "deferred";
  expected: Tuple[];
}

const RULES = [...EVAL_RULES];

const POSITIVES_PER_DETECTOR = 220;
const NEGATIVE_COUNT = 1050;
const DEFERRED_COUNT = 50;
const MIXED_COUNT = 50;

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    const d = digits.charCodeAt(i) - 48;

    if (double) {
      const dd = d * 2;
      sum += dd > 9 ? dd - 9 : dd;
    } else {
      sum += d;
    }

    double = !double;
  }

  return sum % 10 === 0;
}

function luhnCheckDigit(digits: string): number {
  let sum = 0;
  let double = true;

  for (let i = digits.length - 1; i >= 0; i--) {
    const d = digits.charCodeAt(i) - 48;

    if (double) {
      const dd = d * 2;
      sum += dd > 9 ? dd - 9 : dd;
    } else {
      sum += d;
    }

    double = !double;
  }

  return (10 - (sum % 10)) % 10;
}

function allSameDigit(digits: string): boolean {
  const first = digits.charCodeAt(0);

  for (let i = 1; i < digits.length; i++) {
    if (digits.charCodeAt(i) !== first) {
      return false;
    }
  }

  return true;
}

function numericNotLuhn(len: number, prefix = ""): string {
  while (true) {
    const digits = faker.string.numeric(len);
    if (!luhnValid(prefix + digits)) {
      return digits;
    }
  }
}

function generateSSN(): { formatted: string; compact: string } {
  while (true) {
    let first: number;

    do {
      first = faker.number.int({ min: 1, max: 899 });
    } while (first === 666);

    const middle = faker.number.int({ min: 1, max: 99 });
    const last = faker.number.int({ min: 1, max: 9999 });

    const f = String(first).padStart(3, "0");
    const m = String(middle).padStart(2, "0");
    const l = String(last).padStart(4, "0");
    const compact = `${f}${m}${l}`;

    if (luhnValid(compact)) {
      continue;
    }

    let mod11 = 0;

    for (let i = 0; i < 9; i++) {
      mod11 += (compact.charCodeAt(i) - 48) * TFN_WEIGHTS[i]!;
    }

    if (mod11 % 11 === 0) {
      continue;
    }

    return {
      formatted: `${f}-${m}-${l}`,
      compact,
    };
  }
}

const INVALID_FIRST_NINO = new Set(["D", "F", "I", "Q", "U", "V"]);
const VALID_SUFFIX_NINO = new Set([
  "A", "B", "C", "D", "F", "J", "H", "M", "N", "P", "R", "S", "T", "W", "X", "Y", "Z",
]);

const NINO_NAME_PREFIXES = new Set(["JR", "ED", "LY", "MS", "LT", "AL", "BO", "CY", "DI", "EF", "GI", "HO", "IV", "JO", "KY", "LU", "MY", "NO", "PA", "RE", "SU", "TY", "VA", "WO", "WU"]);

function generateNino(): string {
  let first: string;
  let second: string;
  let prefix: string;

  do {
    first = faker.helpers.arrayElement("ABCDEFGHJKLMNOPRSTWXYZ".split(""));
  } while (INVALID_FIRST_NINO.has(first));

  do {
    second = faker.helpers.arrayElement("ABCDEFGHIJKLMNPQRSTUVWXYZ".split(""));
  } while (second === "O");

  prefix = first + second;
  if (NINO_NAME_PREFIXES.has(prefix)) {
    return generateNino();
  }

  const digits = String(faker.number.int({ min: 0, max: 999999 })).padStart(6, "0");
  const suffix = faker.helpers.arrayElement([...VALID_SUFFIX_NINO]);

  return `${first}${second}${digits}${suffix}`;
}

function generateSin(): { formatted: string; compact: string } {
  while (true) {
    const first8 = faker.string.numeric({ exclude: "0" }) + faker.string.numeric(7);
    const check = luhnCheckDigit(first8);
    const digits = first8 + String(check);

    let mod11 = 0;

    for (let i = 0; i < 9; i++) {
      mod11 += (digits.charCodeAt(i) - 48) * TFN_WEIGHTS[i]!;
    }

    if (mod11 % 11 !== 0) {
      return {
        formatted: `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`,
        compact: digits,
      };
    }
  }
}

const TFN_WEIGHTS = [1, 4, 3, 7, 5, 8, 6, 9, 10];

function tfnMod11Valid(digits: string): boolean {
  if (digits.length < 8 || digits.length > 9) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < digits.length; i++) {
    sum += (digits.charCodeAt(i) - 48) * TFN_WEIGHTS[i]!;
  }

  return sum % 11 === 0;
}

function generateTfn(): { spaced: string; compact: string } {
  while (true) {
    const len = faker.number.int({ min: 8, max: 9 });
    let digits = "";

    for (let i = 0; i < len; i++) {
      digits += String(faker.number.int({ min: 0, max: 9 }));
    }

    let sum = 0;

    for (let i = 0; i < digits.length; i++) {
      sum += (digits.charCodeAt(i) - 48) * TFN_WEIGHTS[i]!;
    }

    if (sum % 11 === 0 && !allSameDigit(digits) && !luhnValid(digits)) {
      return {
        spaced: `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`,
        compact: digits,
      };
    }
  }
}

const MY_NUMBER_WEIGHTS = [6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

function myNumberValid(digits: string): boolean {
  if (digits.length !== 12) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 11; i++) {
    sum += (digits.charCodeAt(i) - 48) * MY_NUMBER_WEIGHTS[i]!;
  }

  const remainder = sum % 11;
  const checkDigit = remainder <= 1 ? 0 : 11 - remainder;

  return digits.charCodeAt(11) - 48 === checkDigit;
}

function generateMyNumber(): { spaced: string; compact: string } {
  const first11 = faker.string.numeric(11);
  let sum = 0;

  for (let i = 0; i < 11; i++) {
    sum += (first11.charCodeAt(i) - 48) * MY_NUMBER_WEIGHTS[i]!;
  }

  const remainder = sum % 11;
  const checkDigit = remainder <= 1 ? 0 : 11 - remainder;
  const digits = first11 + String(checkDigit);

  return {
    spaced: `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`,
    compact: digits,
  };
}

const ES_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const NL_WEIGHTS = [9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

function generateVat(): string {
  const country = faker.helpers.arrayElement(["DE", "FR", "IT", "ES", "NL"]);

  if (country === "DE") {
    const digits = faker.string.numeric(9);
    return `DE${digits}`;
  }

  if (country === "FR") {
    const letters = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 2).join("");
    const first10 = faker.string.numeric({ exclude: "0" }) + faker.string.numeric(9);
    const check = luhnCheckDigit(first10);
    return `FR${letters}${first10}${check}`;
  }

  if (country === "IT") {
    const first10 = faker.string.numeric({ exclude: "0" }) + faker.string.numeric(9);
    const check = luhnCheckDigit(first10);
    return `IT${first10}${check}`;
  }

  if (country === "ES") {
    const digits = String(faker.number.int({ min: 0, max: 99999999 })).padStart(8, "0");
    const index = parseInt(digits, 10) % 23;
    const letter = ES_LETTERS[index];
    return `ES${digits}${letter}`;
  }

  const first9 = faker.string.numeric(9);
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += (first9.charCodeAt(i) - 48) * NL_WEIGHTS[i]!;
  }

  const check = sum % 11;
  return `NL${first9}B${String(check).padStart(2, "0")}`;
}

const SEPA_COUNTRY_LENGTHS: Record<string, number> = {
  AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18,
  EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GR: 27, HR: 21, HU: 28,
  IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27,
  MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24,
};

function generateIban(): { spaced: string; compact: string } {
  const countries = Object.keys(SEPA_COUNTRY_LENGTHS);
  const country = faker.helpers.arrayElement(countries);
  const totalLength = SEPA_COUNTRY_LENGTHS[country]!;
  const bbanLength = totalLength - 4;

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let bban = "";

  for (let i = 0; i < bbanLength; i++) {
    bban += faker.helpers.arrayElement(chars.split(""));
  }

  const tempIban = `${country}00${bban}`;
  const rearranged = tempIban.slice(4) + tempIban.slice(0, 4);
  let numeric = "";

  for (let i = 0; i < rearranged.length; i++) {
    const ch = rearranged[i]!;

    if (ch >= "0" && ch <= "9") {
      numeric += ch;
    } else {
      numeric += (ch.charCodeAt(0) - 55).toString();
    }
  }

  const remainder = BigInt(numeric) % 97n;
  const checkDigits = String(98n - remainder).padStart(2, "0");
  const compact = `${country}${checkDigits}${bban}`;

  const spaced = compact.match(/.{1,4}/g)?.join(" ") ?? compact;

  return { spaced, compact };
}

function generatePassport(): string {
  const type = faker.helpers.arrayElement(["us", "ca", "au"]);

  if (type === "us") {
    while (true) {
      const digits = faker.string.numeric(9);
      if (!luhnValid(digits) && !tfnMod11Valid(digits)) {
        return digits;
      }
    }
  }

  if (type === "ca") {
    const letters = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 2).join("");
    const digits = faker.string.numeric(6);
    return `${letters}${digits}`;
  }

  const letters = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 2).join("");
  const digits = faker.string.numeric(7);
  return `${letters}${digits}`;
}

function generateDriversLicense(): string {
  const len = faker.number.int({ min: 6, max: 16 });
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";

  for (let i = 0; i < len; i++) {
    result += faker.helpers.arrayElement(chars.split(""));
  }

  if (!/\d/.test(result)) {
    const pos = faker.number.int({ min: 0, max: len - 1 });
    result = result.slice(0, pos) + String(faker.number.int({ min: 0, max: 9 })) + result.slice(pos + 1);
  }

  return result;
}

const COMMON_FIRST_NAMES = [
  "John", "Jane", "Michael", "Sarah", "David", "Emily", "Robert", "Lisa",
  "William", "Mary", "James", "Jennifer", "Thomas", "Patricia", "Christopher",
  "Linda", "Daniel", "Elizabeth", "Matthew", "Barbara", "Andrew", "Susan",
  "Joseph", "Jessica", "Ryan", "Margaret", "Brian", "Dorothy", "Kevin", "Sandra",
];

const COMMON_LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
];

function generatePersonName(): string {
  const first = faker.helpers.arrayElement(COMMON_FIRST_NAMES);
  const last = faker.helpers.arrayElement(COMMON_LAST_NAMES);
  return `${first} ${last}`;
}

function spanFor(text: string, value: string, ruleId: string): Tuple {
  const start = text.indexOf(value);

  if (start === -1) {
    throw new Error(`Value "${value}" not found in text`);
  }

  return { ruleId, start, end: start + value.length };
}

function generateEmailPositive(): Case {
  const local = faker.string.alphanumeric(8).toLowerCase();
  const domain = faker.helpers.arrayElement(["example.com", "test.org", "demo.net", "sample.io"]);
  const email = `${local}@${domain}`;
  const id = `email-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((e: string) => string)[] = [
    (e) => `Email: ${e}`,
    (e) => `Contact ${e} for details.`,
    (e) => e,
    (e) => `<${e}>`,
    (e) => `Reply to ${e}.`,
    (e) => `Send mail to ${e} today.`,
    (e) => `From: ${e}\nSubject: Hello`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(email);
  const span = spanFor(text, email, "email");

  return { id, text, kind: "supported", expected: [span] };
}

function generatePaymentCardPositive(): Case {
  const rawDigits = faker.finance.creditCardNumber().replace(/[^0-9]/g, "");
  const id = `card-pos-${faker.string.alphanumeric(8)}`;

  const formats: ((d: string) => string)[] = [
    (d) => {
      const hyphenated = d.match(/.{1,4}/g)?.join("-") ?? d;
      return `Card: ${hyphenated}`;
    },
    (d) => {
      const hyphenated = d.match(/.{1,4}/g)?.join("-") ?? d;
      return hyphenated;
    },
    (d) => {
      const hyphenated = d.match(/.{1,4}/g)?.join("-") ?? d;
      return `Payment: ${hyphenated}`;
    },
    (d) => {
      const hyphenated = d.match(/.{1,4}/g)?.join("-") ?? d;
      return `CC: ${hyphenated}`;
    },
    (d) => {
      const hyphenated = d.match(/.{1,4}/g)?.join("-") ?? d;
      return `Amount: $99.99 Card ${hyphenated} exp 12/25`;
    },
    (d) => {
      const grouped = d.match(/.{1,6}/g)?.join(" ") ?? d;
      return grouped;
    },
  ];

  const fmt = faker.helpers.arrayElement(formats);
  const text = fmt(rawDigits);

  let valueInText: string;

  if (text.includes(rawDigits)) {
    valueInText = rawDigits;
  } else {
    const match = text.match(/[\d][\d -]+[\d]/);
    valueInText = match ? match[0] : rawDigits;
  }

  const span = spanFor(text, valueInText, "payment_card");

  return { id, text, kind: "supported", expected: [span] };
}

function generateSSNPositive(): Case {
  const ssn = generateSSN();
  const useFormatted = faker.datatype.boolean();
  const value = useFormatted ? ssn.formatted : ssn.compact;
  const id = `ssn-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((s: string) => string)[] = [
    (s) => `SSN: ${s}`,
    (s) => `Social Security Number: ${s}`,
    (s) => `Social Security No.: ${s}`,
    (s) => `${s} (SSN)`,
    (s) => `${s} (Social Security Number)`,
    (s) => `SSN #${s}`,
    (s) => `SSN:\t${s}`,
    (s) => `Record ${s} (SSN) verified`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(value);
  const span = spanFor(text, value, "us_ssn");

  return { id, text, kind: "supported", expected: [span] };
}

function generatePhonePositive(): Case {
  const id = `phone-pos-${faker.string.alphanumeric(8)}`;

  const formats: (() => string)[] = [
    () => `+1${faker.string.numeric(10)}`,
    () => `+44${numericNotLuhn(11, "44")}`,
    () => `+61${faker.string.numeric(9)}`,
    () => `+81${faker.string.numeric(9)}`,
    () => numericNotLuhn(10, "80840"),
    () => `0${faker.string.numeric(10)}`,
    () => {
      const d = numericNotLuhn(10, "80840");
      return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    },
    () => {
      const d = numericNotLuhn(11, "44");
      return `+44 ${d.slice(0, 4)} ${d.slice(4)}`;
    },
    () => {
      const d = numericNotLuhn(10, "80840");
      return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    },
  ];

  const value = faker.helpers.arrayElement(formats)();

  const contexts: ((p: string) => string)[] = [
    (p) => `Phone: ${p}`,
    (p) => `Call ${p}`,
    (p) => p,
    (p) => `Tel: ${p}`,
    (p) => `Contact: ${p}`,
    (p) => `Reach us at ${p}.`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(value);
  const span = spanFor(text, value, "phone");

  return { id, text, kind: "supported", expected: [span] };
}

function generateNinoPositive(): Case {
  const nino = generateNino();
  const useSpaced = faker.datatype.boolean();
  const value = useSpaced
    ? `${nino.slice(0, 2)} ${nino.slice(2, 4)} ${nino.slice(4, 6)} ${nino.slice(6, 8)} ${nino.slice(8)}`
    : nino;
  const id = `nino-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((n: string) => string)[] = [
    (n) => `NINO: ${n}`,
    (n) => `National Insurance: ${n}`,
    (n) => n,
    (n) => `NI ${n}`,
    (n) => `Insurance No: ${n}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(value);
  const span = spanFor(text, value, "uk_nino");

  return { id, text, kind: "supported", expected: [span] };
}

function generateSinPositive(): Case {
  const sin = generateSin();
  const useFormatted = faker.datatype.boolean();
  const value = useFormatted ? sin.formatted : sin.compact;
  const id = `sin-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((s: string) => string)[] = [
    (s) => `SIN: ${s}`,
    (s) => `Social Insurance Number: ${s}`,
    (s) => s,
    (s) => `SIN #${s}`,
    (s) => `Record: ${s}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(value);
  const span = spanFor(text, value, "ca_sin");

  return { id, text, kind: "supported", expected: [span] };
}

function generateTfnPositive(): Case {
  const tfn = generateTfn();
  const useSpaced = faker.datatype.boolean();
  const value = useSpaced ? tfn.spaced : tfn.compact;
  const id = `tfn-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => `TFN: ${t}`,
    (t) => `Tax File Number: ${t}`,
    (t) => t,
    (t) => `TFN #${t}`,
    (t) => `Australian TFN: ${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(value);
  const span = spanFor(text, value, "au_tfn");

  return { id, text, kind: "supported", expected: [span] };
}

function generateMyNumberPositive(): Case {
  const mn = generateMyNumber();
  const useSpaced = faker.datatype.boolean();
  const value = useSpaced ? mn.spaced : mn.compact;
  const id = `mynum-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((m: string) => string)[] = [
    (m) => `My Number: ${m}`,
    (m) => `Individual Number: ${m}`,
    (m) => m,
    (m) => `My Number #${m}`,
    (m) => `JP ID: ${m}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(value);
  const span = spanFor(text, value, "jp_my_number");

  return { id, text, kind: "supported", expected: [span] };
}

function generateVatPositive(): Case {
  const vat = generateVat();
  const id = `vat-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((v: string) => string)[] = [
    (v) => `VAT: ${v}`,
    (v) => `VAT ID: ${v}`,
    (v) => v,
    (v) => `Tax ID: ${v}`,
    (v) => `EU VAT: ${v}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(vat);
  const span = spanFor(text, vat, "eu_vat");

  return { id, text, kind: "supported", expected: [span] };
}

function generateIbanPositive(): Case {
  const iban = generateIban();
  const useSpaced = faker.datatype.boolean();
  const value = useSpaced ? iban.spaced : iban.compact;
  const id = `iban-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((i: string) => string)[] = [
    (i) => `IBAN: ${i}`,
    (i) => `Account: ${i}`,
    (i) => i,
    (i) => `Bank: ${i}`,
    (i) => `Transfer to ${i}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(value);
  const span = spanFor(text, value, "iban");

  return { id, text, kind: "supported", expected: [span] };
}

function generatePassportPositive(): Case {
  const passport = generatePassport();
  const id = `passport-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((p: string) => string)[] = [
    (p) => `Passport: ${p}`,
    (p) => `Passport No.: ${p}`,
    (p) => `Passport Number: ${p}`,
    (p) => `Passport No. ${p}`,
    (p) => `Passport #${p}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(passport);
  const span = spanFor(text, passport, "passport");

  return { id, text, kind: "supported", expected: [span] };
}

function generateDriversLicensePositive(): Case {
  const dl = generateDriversLicense();
  const id = `dl-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((d: string) => string)[] = [
    (d) => `Driver's License: ${d}`,
    (d) => `DL: ${d}`,
    (d) => `License No.: ${d}`,
    (d) => `Driving Licence: ${d}`,
    (d) => `DL #${d}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(dl);
  const span = spanFor(text, dl, "drivers_license");

  return { id, text, kind: "supported", expected: [span] };
}

function generatePersonNamePositive(): Case {
  const name = generatePersonName();
  const id = `name-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((n: string) => string)[] = [
    (n) => `Name: ${n}`,
    (n) => `Contact: ${n}`,
    (n) => `Patient: ${n}`,
    (n) => `Employee: ${n}`,
    (n) => `Dear: ${n}`,
    (n) => `Regards, ${n}`,
    (n) => `From: ${n}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(name);
  const span = spanFor(text, name, "person_name_lite");

  return { id, text, kind: "supported", expected: [span] };
}

// ---------------------------------------------------------------------------
// Extended detector generators
// ---------------------------------------------------------------------------

function generateIPv4Positive(): Case {
  const octet = () => faker.number.int({ min: 1, max: 254 });
  let first = octet();
  while (first === 10 || first === 127) {
    first = octet();
  }
  let second = octet();
  if (first === 172) {
    while (second >= 16 && second <= 31) {
      second = octet();
    }
  }
  if (first === 192) {
    while (second === 168) {
      second = octet();
    }
  }
  const ip = `${first}.${second}.${octet()}.${octet()}`;
  const id = `ipv4-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((i: string) => string)[] = [
    (i) => `IP: ${i}`,
    (i) => `Server ${i}`,
    (i) => i,
    (i) => `Connect to ${i}:443`,
    (i) => `Remote: ${i}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(ip);
  const span = spanFor(text, ip, "ipv4");

  return { id, text, kind: "supported", expected: [span] };
}

function generateIPv6Positive(): Case {
  const group = () => faker.string.hexadecimal({ length: 1, casing: "lower" }).replace("0x", "").padStart(1, "0").slice(0, 4) || "1";
  const groups: string[] = [];

  for (let i = 0; i < 8; i++) {
    let g = "";

    for (let j = 0; j < faker.number.int({ min: 1, max: 4 }); j++) {
      g += faker.helpers.arrayElement("0123456789abcdef".split(""));
    }

    groups.push(g);
  }

  const ip = groups.join(":");
  const id = `ipv6-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((i: string) => string)[] = [
    (i) => `IPv6: ${i}`,
    (i) => `Address ${i}`,
    (i) => i,
    (i) => `Connect to [${i}]:443`,
    (i) => `Host: ${i}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(ip);
  const span = spanFor(text, ip, "ipv6");

  return { id, text, kind: "supported", expected: [span] };
}

function generateMacAddressPositive(): Case {
  const byte = () => faker.helpers.arrayElement("0123456789ABCDEF".split("")) + faker.helpers.arrayElement("0123456789ABCDEF".split(""));
  const sep = faker.helpers.arrayElement([":", "-"]);
  const mac = [byte(), byte(), byte(), byte(), byte(), byte()].join(sep);
  const id = `mac-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((m: string) => string)[] = [
    (m) => `MAC: ${m}`,
    (m) => `MAC Address: ${m}`,
    (m) => m,
    (m) => `Hardware: ${m}`,
    (m) => `Device: ${m}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(mac);
  const span = spanFor(text, mac, "mac_address");

  return { id, text, kind: "supported", expected: [span] };
}

function generateUrlWithAuthPositive(): Case {
  const user = faker.string.alphanumeric(8).toLowerCase();
  const pass = faker.string.alphanumeric(12);
  const proto = faker.helpers.arrayElement(["https", "http", "ftp"]);
  const host = faker.helpers.arrayElement(["example.com", "api.test.org", "service.demo.net"]);
  const url = `${proto}://${user}:${pass}@${host}/path`;
  const id = `urlauth-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((u: string) => string)[] = [
    (u) => u,
    (u) => `Endpoint: ${u}`,
    (u) => `Connect: ${u}`,
    (u) => `URL: ${u}`,
    (u) => `Service: ${u}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(url);
  const span = spanFor(text, url, "url_with_auth");

  return { id, text, kind: "supported", expected: [span] };
}

function generateAwsAccessKeyPositive(): Case {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let body = "";

  for (let i = 0; i < 16; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const key = `AKIA${body}`;
  const id = `aws-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => `AWS_KEY: ${k}`,
    (k) => k,
    (k) => `Access key: ${k}`,
    (k) => `Credentials: ${k}`,
    (k) => `export AWS_ACCESS_KEY_ID=${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "aws_access_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateGoogleApiKeyPositive(): Case {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  let body = "";

  for (let i = 0; i < 35; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const key = `AIza${body}`;
  const id = `gkey-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => `Google: ${k}`,
    (k) => k,
    (k) => `Google API: ${k}`,
    (k) => `GCP: ${k}`,
    (k) => `gcloud key: ${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "google_api_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateStripeApiKeyPositive(): Case {
  const prefix = faker.helpers.arrayElement(["sk_live_", "pk_live_", "sk_test_", "pk_test_"]);
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const len = faker.number.int({ min: 24, max: 40 });
  let body = "";

  for (let i = 0; i < len; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const key = `${prefix}${body}`;
  const id = `stripe-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => k,
    (k) => `Stripe key: ${k}`,
    (k) => `SECRET: ${k}`,
    (k) => `Payment: ${k}`,
    (k) => `Stripe: ${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "stripe_api_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateSlackTokenPositive(): Case {
  const prefix = faker.helpers.arrayElement(["xoxb-", "xoxa-", "xoxp-", "xoxr-", "xoxs-"]);
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-";
  const len = faker.number.int({ min: 10, max: 30 });
  let body = "";

  for (let i = 0; i < len; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const token = `${prefix}${body}`;
  const id = `slack-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => t,
    (t) => `Slack: ${t}`,
    (t) => `Token: ${t}`,
    (t) => `BOT_TOKEN: ${t}`,
    (t) => `export SLACK_TOKEN=${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "slack_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateGithubTokenPositive(): Case {
  const prefix = faker.helpers.arrayElement(["ghp_", "gho_", "ghu_", "ghs_", "ghr_"]);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let body = "";

  for (let i = 0; i < 36; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const token = `${prefix}${body}`;
  const id = `ghpos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => `export GITHUB_TOKEN=${t}`,
    (t) => `credential: ${t}`,
    (t) => `secret: ${t}`,
    (t) => `auth_token=${t}`,
    (t) => `token=${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "github_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateJwtTokenPositive(): Case {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })).replace(/=/g, "");
  const payload = btoa(JSON.stringify({ sub: faker.string.uuid(), iat: faker.number.int({ min: 1000000000, max: 9999999999 }) })).replace(/=/g, "");
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const sigLen = faker.number.int({ min: 20, max: 43 });
  let sig = "";

  for (let i = 0; i < sigLen; i++) {
    sig += faker.helpers.arrayElement(chars.split(""));
  }

  // Ensure signature doesn't end with underscore (JWT detector trims trailing underscores)
  if (sig.endsWith("_")) {
    sig = sig.slice(0, -1) + faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-".split(""));
  }

  const token = `${header}.${payload}.${sig}`;
  const id = `jwt-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => t,
    (t) => `Authorization: Bearer ${t}`,
    (t) => `Token: ${t}`,
    (t) => `JWT: ${t}`,
    (t) => `auth=${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "jwt_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generatePrivateKeyPositive(): Case {
  const keyType = faker.helpers.arrayElement(["", "RSA ", "EC ", "DSA ", "OPENSSH "]);
  const begin = `-----BEGIN ${keyType}PRIVATE KEY-----`;
  const end = `-----END ${keyType}PRIVATE KEY-----`;
  const bodyLen = faker.number.int({ min: 30, max: 200 });
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n";
  let body = "";

  for (let i = 0; i < bodyLen; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const key = `${begin}\n${body}\n${end}`;
  const id = `pkey-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => k,
    (k) => `Private key:\n${k}`,
    (k) => `SSH key:\n${k}`,
    (k) => `Key:\n${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "private_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateGenericApiKeyPositive(): Case {
  const label = faker.helpers.arrayElement(["api_key", "apikey", "api key", "API_KEY", "api token", "API_KEY"]);
  const sep = faker.helpers.arrayElement([": ", "=", ": ", " = "]);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const len = faker.number.int({ min: 20, max: 40 });
  let value = "";

  while (true) {
    value = "";
    for (let i = 0; i < len; i++) {
      value += faker.helpers.arrayElement(chars.split(""));
    }
    if (!/example|sample|test|fake|demo|placeholder|xxx/i.test(value)) {
      break;
    }
  }

  const entry = `${label}${sep}${value}`;
  const id = `genkey-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((e: string) => string)[] = [
    (e) => e,
    (e) => `Config: ${e}`,
    (e) => `Settings: ${e}`,
    (e) => `Credentials: ${e}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(entry);
  const span = spanFor(text, value, "generic_api_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateSwiftBicPositive(): Case {
  const bank = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 4).join("");
  const country = faker.helpers.arrayElement(["DE", "GB", "FR", "US", "CH", "JP", "NL"]);
  const loc = faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")) + faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split(""));
  const hasBranch = faker.datatype.boolean();
  const branch = hasBranch ? faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split(""), 3).join("") : "";
  const bic = `${bank}${country}${loc}${branch}`;
  const id = `swift-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((b: string) => string)[] = [
    (b) => `BIC: ${b}`,
    (b) => `SWIFT: ${b}`,
    (b) => `Bank code: ${b}`,
    (b) => `BIC: ${b}`,
    (b) => `SWIFT: ${b}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(bic);
  const span = spanFor(text, bic, "swift_bic");

  return { id, text, kind: "supported", expected: [span] };
}

function generateUkSortCodePositive(): Case {
  const sc = `${String(faker.number.int({ min: 0, max: 99 })).padStart(2, "0")}-${String(faker.number.int({ min: 0, max: 99 })).padStart(2, "0")}-${String(faker.number.int({ min: 0, max: 99 })).padStart(2, "0")}`;
  const id = `sort-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((s: string) => string)[] = [
    (s) => `Sort code: ${s}`,
    (s) => `sort code: ${s}`,
    (s) => `Branch code: ${s}`,
    (s) => `Bank code: ${s}`,
    (s) => `Sort: ${s}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(sc);
  const span = spanFor(text, sc, "uk_sort_code");

  return { id, text, kind: "supported", expected: [span] };
}

const ROUTING_WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7, 1] as const;

function routingValid(digits: string): boolean {
  if (digits.length !== 9) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += (digits.charCodeAt(i) - 48) * ROUTING_WEIGHTS[i]!;
  }

  return sum % 10 === 0;
}

function generateRoutingPositive(): Case {
  while (true) {
    const first8 = faker.string.numeric(8);
    let sum = 0;

    for (let i = 0; i < 8; i++) {
      sum += (first8.charCodeAt(i) - 48) * ROUTING_WEIGHTS[i]!;
    }

    const check = (10 - (sum % 10)) % 10;
    const digits = first8 + String(check);

    if (routingValid(digits) && !luhnValid(digits) && !tfnMod11Valid(digits)) {
      const id = `routing-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((d: string) => string)[] = [
    (d) => `Routing: ${d}`,
    (d) => `ABA: ${d}`,
    (d) => `RTN: ${d}`,
    (d) => `Routing number: ${d}`,
    (d) => `Routing No: ${d}`,
  ];

      const ctx = faker.helpers.arrayElement(contexts);
      const text = ctx(digits);
      const span = spanFor(text, digits, "us_routing");

      return { id, text, kind: "supported", expected: [span] };
    }
  }
}

function generateUkBankAccountPositive(): Case {
  while (true) {
    const acct = faker.string.numeric(8);

    // Avoid TFN-valid 8-digit numbers (triggers au_tfn false positives)
    if (tfnMod11Valid(acct)) {
      continue;
    }

    const id = `ukacct-pos-${faker.string.alphanumeric(8)}`;

    const contexts: ((a: string) => string)[] = [
      (a) => `Account number: ${a}`,
      (a) => `account no: ${a}`,
      (a) => `Acct No: ${a}`,
      (a) => `Bank account: ${a}`,
      (a) => `Account No: ${a}`,
    ];

    const ctx = faker.helpers.arrayElement(contexts);
    const text = ctx(acct);
    const span = spanFor(text, acct, "uk_bank_account");

    return { id, text, kind: "supported", expected: [span] };
  }
}

const NHS_WEIGHTS = [10, 9, 8, 7, 6, 5, 4, 3, 2] as const;

function nhsValid(digits: string): boolean {
  if (digits.length !== 9) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += (digits.charCodeAt(i) - 48) * NHS_WEIGHTS[i]!;
  }

  return sum % 11 === 0;
}

function generateNhsPositive(): Case {
  while (true) {
    const first8 = faker.string.numeric(8);
    let sum = 0;

    for (let i = 0; i < 8; i++) {
      sum += (first8.charCodeAt(i) - 48) * NHS_WEIGHTS[i]!;
    }

    const check = (11 - (sum % 11)) % 11;
    if (check === 10) {
      continue;
    }

    const digits = first8 + String(check);

    if (nhsValid(digits) && !luhnValid(digits) && !tfnMod11Valid(digits)) {
      const useFormatted = faker.datatype.boolean();
      const value = useFormatted
        ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
        : digits;
      const id = `nhs-pos-${faker.string.alphanumeric(8)}`;

      const contexts: ((n: string) => string)[] = [
        (n) => `NHS: ${n}`,
        (n) => `NHS Number: ${n}`,
        (n) => `NHS No: ${n}`,
        (n) => `Patient: ${n}`,
        (n) => `NHS #${n}`,
      ];

      const ctx = faker.helpers.arrayElement(contexts);
      const text = ctx(value);
      const span = spanFor(text, value, "uk_nhs");

      return { id, text, kind: "supported", expected: [span] };
    }
  }
}

function generateItinPositive(): Case {
  const first = "9";
  const second = faker.helpers.arrayElement("0123456789".split(""));
  const third = faker.helpers.arrayElement("0123456789".split(""));
  const middleFirst = faker.helpers.arrayElement("78".split(""));
  const middleSecond = faker.helpers.arrayElement("012345678".split(""));
  const last4 = faker.string.numeric(4);
  const useFormatted = faker.datatype.boolean();
  const value = useFormatted
    ? `${first}${second}${third}-${middleFirst}${middleSecond}-${last4}`
    : `${first}${second}${third}${middleFirst}${middleSecond}${last4}`;
  const bareDigits = `${first}${second}${third}${middleFirst}${middleSecond}${last4}`;

  // ITINs should not pass Luhn validation (avoids ca_sin false positives)
  // or TFN mod-11 validation (avoids au_tfn false positives)
  if (luhnValid(bareDigits) || tfnMod11Valid(bareDigits)) {
    return generateItinPositive();
  }

  const id = `itin-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((i: string) => string)[] = [
    (i) => `ITIN: ${i}`,
    (i) => `ITIN #${i}`,
    (i) => `Individual Taxpayer ID: ${i}`,
    (i) => `ITIN: ${i}`,
    (i) => `ITIN #${i}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(value);
  const span = spanFor(text, value, "us_itin");

  return { id, text, kind: "supported", expected: [span] };
}

function generateEinPositive(): Case {
  while (true) {
    const first = faker.string.numeric(2);
    const rest = faker.string.numeric(7);
    const bareDigits = first + rest;

    // EINs should not pass Luhn validation (avoids ca_sin false positives)
    // or TFN mod-11 validation (avoids au_tfn false positives)
    if (luhnValid(bareDigits) || tfnMod11Valid(bareDigits)) {
      continue;
    }

    const useFormatted = faker.datatype.boolean();
    const value = useFormatted ? `${first}-${rest}` : `${first}${rest}`;
    const id = `ein-pos-${faker.string.alphanumeric(8)}`;

    const contexts: ((e: string) => string)[] = [
      (e) => `EIN: ${e}`,
      (e) => `Employer ID: ${e}`,
      (e) => `Tax ID: ${e}`,
      (e) => `EIN #${e}`,
      (e) => `Employer Identification Number: ${e}`,
    ];

    const ctx = faker.helpers.arrayElement(contexts);
    const text = ctx(value);
    const span = spanFor(text, value, "us_ein");

    return { id, text, kind: "supported", expected: [span] };
  }
}

const IRD_WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2] as const;

function irdValid(digits: string): boolean {
  let padded = digits;

  if (padded.length === 8) {
    padded = "0" + padded;
  }

  if (padded.length !== 9) {
    return false;
  }

  let sum = 0;

  for (let i = 0; i < 8; i++) {
    sum += (padded.charCodeAt(i) - 48) * IRD_WEIGHTS[i]!;
  }

  const remainder = sum % 11;

  if (remainder === 0) {
    return false;
  }

  const check = 11 - remainder;

  return padded.charCodeAt(8) - 48 === check;
}

function generateIrdPositive(): Case {
  while (true) {
    const len = faker.number.int({ min: 8, max: 9 });
    const first8 = faker.string.numeric(len === 8 ? 7 : 8);
    let padded = first8;

    if (len === 8) {
      padded = "0" + first8;
    }

    let sum = 0;

    for (let i = 0; i < 8; i++) {
      sum += (padded.charCodeAt(i) - 48) * IRD_WEIGHTS[i]!;
    }

    const remainder = sum % 11;

    if (remainder === 0) {
      continue;
    }

    const check = 11 - remainder;
    const digits = (len === 8 ? first8 : first8) + String(check);

    if (irdValid(digits) && !luhnValid(digits) && !tfnMod11Valid(digits)) {
      const useFormatted = faker.datatype.boolean();
      const value = useFormatted
        ? `${digits.slice(0, -3)}-${digits.slice(-3, -1)}${digits.slice(-1)}`
        : digits;
      const id = `ird-pos-${faker.string.alphanumeric(8)}`;

      const contexts: ((r: string) => string)[] = [
        (r) => `IRD: ${r}`,
        (r) => `Tax: ${r}`,
        (r) => `NZ IRD: ${r}`,
        (r) => `IRD #${r}`,
        (r) => `IRD Number: ${r}`,
      ];

      const ctx = faker.helpers.arrayElement(contexts);
      const text = ctx(value);
      const span = spanFor(text, value, "nz_ird");

      return { id, text, kind: "supported", expected: [span] };
    }
  }
}

function generateNpiPositive(): Case {
  while (true) {
    const first9 = faker.string.numeric(9);
    const withPrefix = "80840" + first9;
    const check = luhnCheckDigit(withPrefix);
    const digits = first9 + String(check);

    if (luhnValid("80840" + digits) && !nhsValid(digits) && !routingValid(digits)) {
      const id = `npi-pos-${faker.string.alphanumeric(8)}`;

      const contexts: ((n: string) => string)[] = [
        (n) => `NPI: ${n}`,
        (n) => `National Provider: ${n}`,
        (n) => n,
        (n) => `Provider ID: ${n}`,
        (n) => `NPI #${n}`,
      ];

      const ctx = faker.helpers.arrayElement(contexts);
      const text = ctx(digits);
      const span = spanFor(text, digits, "us_npi");

      return { id, text, kind: "supported", expected: [span] };
    }
  }
}

function generateDeaPositive(): Case {
  const firstLetters = "ABCDFGHJKLMMPR".split("");
  const first = faker.helpers.arrayElement(firstLetters);
  const second = faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
  const first6 = faker.string.numeric(6);

  let sum = 0;

  for (let i = 0; i < 6; i++) {
    sum += first6.charCodeAt(i) - 48;
  }

  const check = sum % 10;
  const dea = `${first}${second}${first6}${String(check)}`;
  const id = `dea-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((d: string) => string)[] = [
    (d) => `DEA: ${d}`,
    (d) => `DEA Number: ${d}`,
    (d) => `Prescriber: ${d}`,
    (d) => `DEA #${d}`,
    (d) => `DEA No: ${d}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(dea);
  const span = spanFor(text, dea, "us_dea");

  return { id, text, kind: "supported", expected: [span] };
}

function generateMrnPositive(): Case {
  const hasPrefix = faker.datatype.boolean();
  const prefix = hasPrefix ? faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")) + faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")) : "";
  let digitsLen = faker.number.int({ min: 4, max: 16 });

  // Avoid 10-digit bare numeric MRNs (triggers phone detector false positives)
  if (!hasPrefix && digitsLen === 10) {
    digitsLen = faker.number.int({ min: 4, max: 9 });
  }

  const digits = faker.string.numeric(digitsLen);
  const mrn = `${prefix}${digits}`;
  const bareDigits = mrn.replace(/\D/g, "");

  // Avoid Luhn-valid digit sequences of 13-19 digits (triggers payment_card),
  // Luhn-valid 9-digit sequences (triggers ca_sin),
  // and TFN mod-11 valid 8-9 digit sequences (triggers au_tfn)
  if (bareDigits.length >= 13 && bareDigits.length <= 19 && luhnValid(bareDigits)) {
    return generateMrnPositive();
  }
  if (bareDigits.length === 9 && luhnValid(bareDigits)) {
    return generateMrnPositive();
  }
  if ((bareDigits.length === 8 || bareDigits.length === 9) && tfnMod11Valid(bareDigits)) {
    return generateMrnPositive();
  }

  const id = `mrn-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((m: string) => string)[] = [
    (m) => `MRN: ${m}`,
    (m) => `Medical Record Number: ${m}`,
    (m) => `Medical Record No.: ${m}`,
    (m) => `Record No.: ${m}`,
    (m) => `Patient ID: ${m}`,
    (m) => `Chart No.: ${m}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(mrn);
  const span = spanFor(text, mrn, "medical_record_number");

  return { id, text, kind: "supported", expected: [span] };
}

function hasCrossFP(bareDigits: string): boolean {
  if (bareDigits.length >= 13 && bareDigits.length <= 19 && luhnValid(bareDigits)) {
    return true;
  }

  if (bareDigits.length === 9 && luhnValid(bareDigits)) {
    return true;
  }

  if ((bareDigits.length === 8 || bareDigits.length === 9) && tfnMod11Valid(bareDigits)) {
    return true;
  }

  if (bareDigits.length === 10 && luhnValid("80840" + bareDigits)) {
    return true;
  }

  if (bareDigits.length === 11 && bareDigits[0] === "0") {
    return true;
  }

  if (bareDigits.length === 12 && myNumberValid(bareDigits)) {
    return true;
  }

  return false;
}

function postalCodeSpans(text: string): Tuple[] {
  const spans: Tuple[] = [];
  const pattern = /\d{5}(?:-\d{4})?|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|[A-Z]\d[A-Z] ?\d[A-Z]\d|\d{4}/gi;

  for (const match of text.matchAll(pattern)) {
    const start = match.index!;
    const end = start + match[0].length;

    if (start > 0 && /[\p{L}\p{M}\p{N}_]/u.test(text[start - 1]!)) {
      continue;
    }

    if (end < text.length && /[\p{L}\p{M}\p{N}_]/u.test(text[end]!)) {
      continue;
    }

    spans.push({ ruleId: "postal_code", start, end });
  }

  return spans;
}

function safeNumeric(len: number, prefix = ""): string {
  while (true) {
    const digits = faker.string.numeric(len);

    if (!hasCrossFP(prefix + digits) && !allSameDigit(prefix + digits)) {
      return digits;
    }
  }
}

function safeAlphanumeric(len: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  while (true) {
    let result = "";

    for (let i = 0; i < len; i++) {
      result += faker.helpers.arrayElement(chars.split(""));
    }

    if (!/[A-Z]/.test(result)) {
      continue;
    }

    return result;
  }
}

function ctxWrap(value: string, labels: string[], ruleId: string, idPrefix: string): Case {
  const id = `${idPrefix}-${faker.string.alphanumeric(8)}`;
  const label = faker.helpers.arrayElement(labels);

  const formats: ((v: string, l: string) => string)[] = [
    (v, l) => `${l}: ${v}`,
    (v, l) => `${l} ${v}`,
    (v, l) => `${l} #${v}`,
    (v, l) => `${v} (${l})`,
    (v, l) => `${v} ${l}`,
  ];

  const fmtIndex = faker.number.int({ min: 0, max: formats.length - 1 });
  const fmt = formats[fmtIndex]!;

  let text: string;
  if (fmtIndex === 3 || fmtIndex === 4) {
    const shortLabel = [...labels].sort((a, b) => a.length - b.length)[0] ?? label;
    text = fmt(value, shortLabel);
  } else {
    text = fmt(value, label);
  }
  const span = spanFor(text, value, ruleId);

  const expected: Tuple[] = [span];

  const bareDigits = value.replace(/\D/g, "");

  if (bareDigits.length === 10 && bareDigits === value && !hasCrossFP(bareDigits)) {
    expected.push({ ...span, ruleId: "phone" });
  }

  if (bareDigits.length === 11 && bareDigits.startsWith("0") && !hasCrossFP(bareDigits)) {
    expected.push({ ...span, ruleId: "phone" });
  }

  for (const pc of postalCodeSpans(text)) {
    if (pc.start === span.start && pc.end === span.end) {
      continue;
    }
    expected.push(pc);
  }

  return { id, text, kind: "supported", expected };
}

function ctxWrapGeneric(value: string, labels: string[], ruleId: string, idPrefix: string): Case {
  const id = `${idPrefix}-${faker.string.alphanumeric(8)}`;
  const label = faker.helpers.arrayElement(labels);

  const formats: ((v: string, l: string) => string)[] = [
    (v, l) => `${l}: ${v}`,
    (v, l) => `${l} ${v}`,
    (v, l) => `${l} #${v}`,
    (v, l) => `${v} (${l})`,
  ];

  const fmtIndex = faker.number.int({ min: 0, max: formats.length - 1 });
  const fmt = formats[fmtIndex]!;

  let text: string;
  if (fmtIndex === 3) {
    const shortLabel = [...labels].sort((a, b) => a.length - b.length)[0] ?? label;
    text = fmt(value, shortLabel);
  } else {
    text = fmt(value, label);
  }
  const span = spanFor(text, value, ruleId);

  const expected: Tuple[] = [span];

  for (const pc of postalCodeSpans(text)) {
    if (pc.start === span.start && pc.end === span.end) {
      continue;
    }
    expected.push(pc);
  }

  return { id, text, kind: "supported", expected };
}

function genEmbedded(matchValue: string, labels: string[], ruleId: string, idPrefix: string): Case {
  const id = `${idPrefix}-${faker.string.alphanumeric(8)}`;
  const label = faker.helpers.arrayElement(labels);

  const formats: ((v: string, l: string) => string)[] = [
    (v, l) => `${l}: ${v}`,
    (v, l) => `${l} ${v}`,
    (v, l) => `${l} #${v}`,
    (v, l) => `${v} (${l})`,
  ];

  const fmtIndex = faker.number.int({ min: 0, max: formats.length - 1 });
  const fmt = formats[fmtIndex]!;

  let text: string;
  if (fmtIndex === 3) {
    const shortLabel = [...labels].sort((a, b) => a.length - b.length)[0] ?? label;
    text = fmt(matchValue, shortLabel);
  } else {
    text = fmt(matchValue, label);
  }
  const span = spanFor(text, matchValue, ruleId);

  const expected: Tuple[] = [span];

  for (const pc of postalCodeSpans(text)) {
    if (pc.start === span.start && pc.end === span.end) {
      continue;
    }
    expected.push(pc);
  }

  return { id, text, kind: "supported", expected };
}

function rutCheckDigit(digits: string): string {
  let sum = 0;
  let multiplier = 2;

  for (let i = digits.length - 1; i >= 0; i--) {
    sum += (digits.charCodeAt(i) - 48) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const rem = sum % 11;

  if (rem === 0) {
    return "0";
  }

  if (rem === 1) {
    return "K";
  }

  return String(11 - rem);
}

function dniCheckLetter(digits: string): string {
  const num = parseInt(digits, 10);
  return ES_LETTERS[num % 23]!;
}

function inseeCheckDigits(digits13: string): string {
  const num = BigInt(digits13);
  const check = 97n - (num % 97n);

  return check.toString().padStart(2, "0");
}

const CF_ODD_VALUES: Record<string, number> = {
  "0": 1, "1": 0, "2": 5, "3": 7, "4": 9, "5": 13, "6": 15, "7": 17, "8": 19, "9": 21,
  "A": 1, "B": 0, "C": 5, "D": 7, "E": 9, "F": 13, "G": 15, "H": 17, "I": 19, "J": 21,
  "K": 2, "L": 4, "M": 18, "N": 20, "O": 11, "P": 3, "Q": 6, "R": 8, "S": 10, "T": 12,
  "U": 14, "V": 16, "W": 22, "X": 25, "Y": 24, "Z": 23,
};

const CF_EVEN_VALUES: Record<string, number> = {
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "A": 0, "B": 1, "C": 2, "D": 3, "E": 4, "F": 5, "G": 6, "H": 7, "I": 8, "J": 9,
  "K": 10, "L": 11, "M": 12, "N": 13, "O": 14, "P": 15, "Q": 16, "R": 17, "S": 18, "T": 19,
  "U": 20, "V": 21, "W": 22, "X": 23, "Y": 24, "Z": 25,
};

function codiceFiscaleCheckChar(s15: string): string {
  let sum = 0;

  for (let i = 0; i < 15; i++) {
    const ch = s15[i]!;

    if (i % 2 === 0) {
      sum += CF_ODD_VALUES[ch] ?? 0;
    } else {
      sum += CF_EVEN_VALUES[ch] ?? 0;
    }
  }

  return String.fromCharCode(65 + (sum % 26));
}

function bsnCheckDigit(digits8: string): number {
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    sum += (9 - i) * (digits8.charCodeAt(i) - 48);
  }

  const check = sum % 11;

  return check > 9 ? -1 : check;
}

const PESEL_WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3] as const;

function peselCheckDigit(digits10: string): number {
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    sum += PESEL_WEIGHTS[i]! * (digits10.charCodeAt(i) - 48);
  }

  return (10 - (sum % 10)) % 10;
}

function thIdCheckDigit(digits12: string): number {
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum += (digits12.charCodeAt(i) - 48) * (13 - i);
  }

  return (11 - (sum % 11)) % 10;
}

function generateClRutPositive(): Case {
  const body = safeNumeric(faker.number.int({ min: 7, max: 8 }));
  const check = rutCheckDigit(body);
  const formatted = `${body.slice(0, -6)}.${body.slice(-6, -3)}.${body.slice(-3)}-${check}`;

  return ctxWrap(
    formatted,
    ["Chile", "Chilean", "RUT", "Rol Único", "Tributario", "Cédula"],
    "cl_rut",
    "cl-rut-pos",
  );
}

function generateEsDniPositive(): Case {
  const digits = faker.string.numeric(8);
  const letter = dniCheckLetter(digits);
  const value = `${digits}${letter}`;

  return ctxWrap(
    value,
    ["DNI", "Documento Nacional de Identidad", "Spanish ID"],
    "es_dni",
    "es-dni-pos",
  );
}

function generateFrInseePositive(): Case {
  const digits13 = faker.string.numeric(13);
  const check = inseeCheckDigits(digits13);
  const value = `${digits13} ${check}`;

  return ctxWrap(
    value,
    ["INSEE", "NIR", "Numéro de Sécurité Sociale", "Social Security Number", "Numéro INSEE"],
    "fr_insee",
    "fr-insee-pos",
  );
}

function generateItCodiceFiscalePositive(): Case {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let s15 = "";

  for (let i = 0; i < 6; i++) {
    s15 += faker.helpers.arrayElement(letters.split(""));
  }

  s15 += faker.string.numeric(2);
  s15 += faker.helpers.arrayElement(letters.split(""));
  s15 += faker.string.numeric(2);
  s15 += faker.helpers.arrayElement(letters.split(""));
  s15 += faker.string.numeric(3);

  const check = codiceFiscaleCheckChar(s15);
  const value = `${s15}${check}`;

  return ctxWrap(
    value,
    ["Codice Fiscale", "Fiscal Code", "Tax Code", "Italian ID"],
    "it_codice_fiscale",
    "it-cf-pos",
  );
}

function generateNlBsnPositive(): Case {
  while (true) {
    const digits8 = faker.string.numeric(8);
    const check = bsnCheckDigit(digits8);

    if (check < 0) {
      continue;
    }

    const value = `${digits8}${check}`;

    if (!hasCrossFP(value) && !allSameDigit(value)) {
      return ctxWrap(
        value,
        ["BSN", "Burgerservicenummer", "Dutch ID", "Citizen Service Number"],
        "nl_bsn",
        "nl-bsn-pos",
      );
    }
  }
}

function generatePlPeselPositive(): Case {
  const digits10 = faker.string.numeric(10);
  const check = peselCheckDigit(digits10);
  const value = `${digits10}${check}`;

  return ctxWrap(
    value,
    ["PESEL", "Polish ID", "Identity Number"],
    "pl_pesel",
    "pl-pesel-pos",
  );
}

function generateThIdPositive(): Case {
  const digits12 = safeNumeric(12);
  const check = thIdCheckDigit(digits12);
  const value = `${digits12}${check}`;

  return ctxWrap(
    value,
    ["Thailand", "Thai", "บัตร", "ประชาชน"],
    "th_id",
    "th-id-pos",
  );
}

function generateBgEgnPositive(): Case {
  const yy = String(faker.number.int({ min: 0, max: 99 })).padStart(2, "0");
  const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
  const dd = String(faker.number.int({ min: 1, max: 31 })).padStart(2, "0");
  const xxxx = faker.string.numeric(4);
  const value = `${yy}${mm}${dd}${xxxx}`;

  return ctxWrap(
    value,
    ["Bulgaria", "Bulgarian", "EGN", "Personal Number", "Единен"],
    "bg_egn",
    "bg-egn-pos",
  );
}

function generateBhCprPositive(): Case {
  const xx = faker.string.numeric(2);
  const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
  const dd = String(faker.number.int({ min: 1, max: 31 })).padStart(2, "0");
  const xxx = faker.string.numeric(3);
  const value = `${xx}${mm}${dd}${xxx}`;

  return ctxWrap(
    value,
    ["Bahrain", "CPR", "Central Population"],
    "bh_cpr",
    "bh-cpr-pos",
  );
}

function generateCzIdPositive(): Case {
  const yy = String(faker.number.int({ min: 0, max: 99 })).padStart(2, "0");
  const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
  const dd = String(faker.number.int({ min: 1, max: 31 })).padStart(2, "0");
  const xxxx = faker.string.numeric(4);
  const value = `${yy}${mm}${dd}/${xxxx}`;

  return ctxWrap(
    value,
    ["Czech", "Czechia", "Republic", "Rodné", "Číslo"],
    "cz_id",
    "cz-id-pos",
  );
}

function generateDeIdPositive(): Case {
  const useLong = faker.datatype.boolean();
  let value: string;

  if (useLong) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let prefix = "";

    for (let i = 0; i < 4; i++) {
      prefix += faker.helpers.arrayElement(chars.split(""));
    }

    value = `${prefix}${faker.string.numeric(7)}`;
  } else {
    value = safeNumeric(10);
  }

  return ctxWrap(
    value,
    ["Personalausweis", "German ID", "Identity Card", "Ausweis"],
    "de_id",
    "de-id-pos",
  );
}

function generateEcCedulaPositive(): Case {
  const province = String(faker.number.int({ min: 1, max: 24 })).padStart(2, "0");
  const thirdDigit = faker.helpers.arrayElement(["0", "1", "2", "3", "4", "5", "6", "9"]);
  const rest = faker.string.numeric(7);
  const value = `${province}${thirdDigit}${rest}`;

  return ctxWrap(
    value,
    ["Ecuador", "Ecuadorian", "Cédula", "Cedula", "Identidad"],
    "ec_cedula",
    "ec-cedula-pos",
  );
}

function generateEgIdPositive(): Case {
  const century = faker.helpers.arrayElement(["1", "2"]);
  const yyyy = String(faker.number.int({ min: 1800, max: 2099 }));
  const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
  const dd = String(faker.number.int({ min: 1, max: 31 })).padStart(2, "0");
  const xxxxx = faker.string.numeric(5);
  const value = `${century}${yyyy}${mm}${dd}${xxxxx}`;

  return ctxWrap(
    value,
    ["Egypt", "Egyptian"],
    "eg_id",
    "eg-id-pos",
  );
}

function generateKwIdPositive(): Case {
  const xx = faker.string.numeric(2);
  const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
  const dd = String(faker.number.int({ min: 1, max: 31 })).padStart(2, "0");
  const xxxxxx = faker.string.numeric(6);
  const value = `${xx}${mm}${dd}${xxxxxx}`;

  return ctxWrap(
    value,
    ["Kuwait", "Civil ID"],
    "kw_id",
    "kw-id-pos",
  );
}

function generateKzIinPositive(): Case {
  const xx = faker.string.numeric(2);
  const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
  const dd = String(faker.number.int({ min: 1, max: 31 })).padStart(2, "0");
  const xxxxxx = faker.string.numeric(6);
  const value = `${xx}${mm}${dd}${xxxxxx}`;

  return ctxWrap(
    value,
    ["Kazakhstan", "Kazakh", "IIN", "Individual Identification", "ЖСН"],
    "kz_iin",
    "kz-iin-pos",
  );
}

function generateMyIcPositive(): Case {
  const yy = String(faker.number.int({ min: 0, max: 99 })).padStart(2, "0");
  const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
  const dd = String(faker.number.int({ min: 1, max: 31 })).padStart(2, "0");
  const xxxxxx = faker.string.numeric(6);
  const sep = faker.helpers.arrayElement(["-", " ", ""]);
  const value = `${yy}${mm}${dd}${sep}${xxxxxx.slice(0, 2)}${sep === "" ? "" : sep}${xxxxxx.slice(2)}`;

  return ctxWrap(
    value,
    ["Malaysia", "Malaysian", "MyKad", "IC Number", "Kad Pengenalan"],
    "my_ic",
    "my-ic-pos",
  );
}

function generatePeRucPositive(): Case {
  const prefix = faker.helpers.arrayElement(["10", "15", "17", "20"]);
  const rest = faker.string.numeric(9);
  const value = `${prefix}${rest}`;

  return ctxWrap(
    value,
    ["Peru", "Perú", "RUC", "Tax", "SUNAT", "Tributario"],
    "pe_ruc",
    "pe-ruc-pos",
  );
}

function generateRoCnpPositive(): Case {
  const s = String(faker.number.int({ min: 1, max: 9 }));
  const yy = String(faker.number.int({ min: 0, max: 99 })).padStart(2, "0");
  const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
  const dd = String(faker.number.int({ min: 1, max: 31 })).padStart(2, "0");
  const xxxxxx = faker.string.numeric(6);
  const value = `${s}${yy}${mm}${dd}${xxxxxx}`;

  return ctxWrap(
    value,
    ["Romania", "Romanian", "CNP", "Cod Numeric", "Personal"],
    "ro_cnp",
    "ro-cnp-pos",
  );
}

function generateRsJmbgPositive(): Case {
  const dd = String(faker.number.int({ min: 1, max: 31 })).padStart(2, "0");
  const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
  const yyy = String(faker.number.int({ min: 0, max: 999 })).padStart(3, "0");
  const xxxxxx = faker.string.numeric(6);
  const value = `${dd}${mm}${yyy}${xxxxxx}`;

  return ctxWrap(
    value,
    ["Serbian", "Serbia", "JMBG", "Jedinstveni", "Matični", "Personal"],
    "rs_jmbg",
    "rs-jmbg-pos",
  );
}

function generateZaIdPositive(): Case {
  const yy = String(faker.number.int({ min: 0, max: 99 })).padStart(2, "0");
  const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
  const dd = String(faker.number.int({ min: 1, max: 31 })).padStart(2, "0");
  const xxxxxxx = faker.string.numeric(7);
  const value = `${yy}${mm}${dd}${xxxxxxx}`;

  return ctxWrap(
    value,
    ["South Africa", "RSA", "ZA", "ID Number"],
    "za_id",
    "za-id-pos",
  );
}

function generateArCuitPositive(): Case {
  const p1 = faker.string.numeric(2);
  const p2 = faker.string.numeric(8);
  const p3 = faker.string.numeric(1);
  const value = `${p1}-${p2}-${p3}`;

  return ctxWrap(
    value,
    ["Argentina", "CUIT", "CUIL", "Tax", "Impuesto", "Tributario"],
    "ar_cuit",
    "ar-cuit-pos",
  );
}

function generateArDniPositive(): Case {
  const value = safeNumeric(faker.number.int({ min: 7, max: 8 }));

  return ctxWrap(
    value,
    ["Argentina", "Argentin", "DNI", "Documento Nacional", "Identidad"],
    "ar_dni",
    "ar-dni-pos",
  );
}

function generateCoCedulaPositive(): Case {
  const value = safeNumeric(faker.number.int({ min: 6, max: 10 }));

  return ctxWrap(
    value,
    ["Colombia", "Colombian", "Cédula", "Cedula", "Ciudadanía", "CC"],
    "co_cedula",
    "co-cedula-pos",
  );
}

function generateCoNitPositive(): Case {
  const p1 = faker.string.numeric(9);
  const p2 = faker.string.numeric(1);
  const value = `${p1}-${p2}`;

  return ctxWrap(
    value,
    ["Colombia", "NIT", "Tax", "Impuesto", "Tributario", "Empresa"],
    "co_nit",
    "co-nit-pos",
  );
}

function generateFjIdPositive(): Case {
  const value = safeAlphanumeric(faker.number.int({ min: 8, max: 10 }));

  return ctxWrap(
    value,
    ["Fiji", "Fijian"],
    "fj_id",
    "fj-id-pos",
  );
}

function generateGhCardPositive(): Case {
  const value = `GHA-${faker.string.numeric(9)}-${faker.string.numeric(1)}`;

  return ctxWrap(
    value,
    ["Ghana", "Ghanaian", "Ghana Card"],
    "gh_card",
    "gh-card-pos",
  );
}

function generateHuIdPositive(): Case {
  const digits = faker.string.numeric(6);
  const letters = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 2).join("");
  const value = `${digits}${letters}`;

  return ctxWrap(
    value,
    ["Hungarian", "Magyar", "Személyi", "Igazolvány", "Personal ID"],
    "hu_id",
    "hu-id-pos",
  );
}

function generateHuTaxIdPositive(): Case {
  const value = safeNumeric(10);

  return ctxWrap(
    value,
    ["Hungarian", "Magyar", "Adó", "Tax", "Adóazonosító"],
    "hu_tax_id",
    "hu-tax-id-pos",
  );
}

function generateIdNikPositive(): Case {
  const value = safeNumeric(16);

  return ctxWrap(
    value,
    ["Indonesia", "Indonesian", "NIK", "Nomor Induk", "KTP"],
    "id_nik",
    "id-nik-pos",
  );
}

function generateIdNpwpPositive(): Case {
  const a = faker.string.numeric(2);
  const b = faker.string.numeric(3);
  const c = faker.string.numeric(3);
  const d = faker.string.numeric(1);
  const e = faker.string.numeric(3);
  const f = faker.string.numeric(3);
  const sep1 = faker.helpers.arrayElement([".", ""]);
  const sep2 = faker.helpers.arrayElement([".", "-", ""]);
  const value = `${a}${sep1}${b}${sep1}${c}${sep1}${d}${sep2}${e}${sep1}${f}`;

  return ctxWrap(
    value,
    ["Indonesia", "NPWP", "Tax", "Pajak", "Wajib Pajak"],
    "id_npwp",
    "id-npwp-pos",
  );
}

function generateIlIdPositive(): Case {
  const value = safeNumeric(9);

  return ctxWrap(
    value,
    ["Israel", "Teudat", "Zehut", "Israeli"],
    "il_id",
    "il-id-pos",
  );
}

function generateJoIdPositive(): Case {
  const value = safeNumeric(10);

  return ctxWrap(
    value,
    ["Jordan", "Amman", "Jordanian"],
    "jo_id",
    "jo-id-pos",
  );
}

function generateKeIdPositive(): Case {
  const value = safeNumeric(faker.number.int({ min: 7, max: 8 }));

  return ctxWrap(
    value,
    ["Kenya", "Kenyan"],
    "ke_id",
    "ke-id-pos",
  );
}

function generateKeKraPinPositive(): Case {
  const digits = faker.string.numeric(9);
  const letter = faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
  const value = `A${digits}${letter}`;

  return ctxWrap(
    value,
    ["KRA", "Kenya", "Revenue", "Authority", "Tax", "PIN", "Taxpayer"],
    "ke_kra_pin",
    "ke-kra-pin-pos",
  );
}

function generateKgPinPositive(): Case {
  const value = safeNumeric(14);

  return ctxWrap(
    value,
    ["Kyrgyz", "Kyrgyzstan", "PIN", "Personal ID", "Личный", "Номер"],
    "kg_pin",
    "kg-pin-pos",
  );
}

function generateLbIdPositive(): Case {
  const value = safeNumeric(faker.number.int({ min: 7, max: 8 }));

  return ctxWrap(
    value,
    ["Lebanon", "Lebanese", "Beirut"],
    "lb_id",
    "lb-id-pos",
  );
}

function generateMaIdPositive(): Case {
  const useLetters = faker.datatype.boolean();
  let value: string;

  if (useLetters) {
    const letterCount = faker.number.int({ min: 1, max: 2 });
    const letters = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), letterCount).join("");
    const digits = faker.string.numeric(faker.number.int({ min: 6, max: 8 }));
    value = `${letters}${digits}`;
  } else {
    value = faker.string.numeric(8);
  }

  return ctxWrap(
    value,
    ["Morocco", "Moroccan", "CNIE"],
    "ma_id",
    "ma-id-pos",
  );
}

function generateMmNrcPositive(): Case {
  const num = String(faker.number.int({ min: 1, max: 14 }));
  const township = faker.helpers.arrayElement(["Yangon", "Mandalay", "Bago", "Magway", "Sagaing"]);
  const type = faker.helpers.arrayElement(["N", "C"]);
  const digits = faker.string.numeric(6);
  const value = `${num}/${township}(${type})${digits}`;

  return ctxWrap(
    value,
    ["Myanmar", "Burmese", "NRC", "National Registration"],
    "mm_nrc",
    "mm-nrc-pos",
  );
}

function generateNgBvnPositive(): Case {
  const value = safeNumeric(11);

  return ctxWrap(
    value,
    ["BVN", "Bank Verification", "Nigeria", "Nigerian", "Banking"],
    "ng_bvn",
    "ng-bvn-pos",
  );
}

function generateNgNinPositive(): Case {
  const value = safeNumeric(11);

  return ctxWrap(
    value,
    ["Nigeria", "NIN", "Nigerian"],
    "ng_nin",
    "ng-nin-pos",
  );
}

function generateNzDriverLicensePositive(): Case {
  const letters = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 2).join("");
  const digits = faker.string.numeric(6);
  const value = `${letters}${digits}`;

  return ctxWrap(
    value,
    ["New Zealand", "NZ", "Kiwi", "Driver License", "Driver Licence", "Driver", "License", "Licence"],
    "nz_driver_license",
    "nz-dl-pos",
  );
}

function generateNzIrdExtraPositive(): Case {
  const value = safeNumeric(faker.number.int({ min: 8, max: 9 }));

  return ctxWrap(
    value,
    ["New Zealand", "NZ", "IRD", "Tax", "Inland Revenue"],
    "nz_ird_extra",
    "nz-ird-extra-pos",
  );
}

function generateNzPassportPositive(): Case {
  const letters = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 2).join("");
  const digits = faker.string.numeric(6);
  const value = `${letters}${digits}`;

  return ctxWrap(
    value,
    ["New Zealand", "NZ", "Passport", "Travel Document"],
    "nz_passport",
    "nz-passport-pos",
  );
}

function generateOmIdPositive(): Case {
  const value = safeNumeric(8);

  return ctxWrap(
    value,
    ["Oman", "Muscat", "Civil ID"],
    "om_id",
    "om-id-pos",
  );
}

function generatePeDniPositive(): Case {
  const value = safeNumeric(8);

  return ctxWrap(
    value,
    ["Peru", "Peruvian", "Perú", "Peruano", "DNI", "Documento Nacional", "Identidad", "RENIEC"],
    "pe_dni",
    "pe-dni-pos",
  );
}

function generatePhUmidPositive(): Case {
  const a = faker.string.numeric(4);
  const b = faker.string.numeric(7);
  const c = faker.string.numeric(1);
  const sep = faker.helpers.arrayElement(["-", " ", ""]);
  const value = `${a}${sep}${b}${sep}${c}`;

  return ctxWrap(
    value,
    ["Philippines", "Filipino", "UMID", "Unified", "Multipurpose"],
    "ph_umid",
    "ph-umid-pos",
  );
}

function generatePngIdPositive(): Case {
  const value = safeAlphanumeric(faker.number.int({ min: 8, max: 12 }));

  return ctxWrap(
    value,
    ["Papua", "New Guinea", "National ID"],
    "png_id",
    "png-id-pos",
  );
}

function generateQaIdPositive(): Case {
  const value = safeNumeric(11);

  return ctxWrap(
    value,
    ["Qatar", "QID", "Doha", "Resident Permit"],
    "qa_id",
    "qa-id-pos",
  );
}

function generateRuPassportPositive(): Case {
  const a = faker.string.numeric(4);
  const b = faker.string.numeric(6);
  const sep = faker.helpers.arrayElement([" ", ""]);
  const value = `${a}${sep}${b}`;

  return ctxWrap(
    value,
    ["Russia", "Russian", "Passport", "Паспорт", "Российский"],
    "ru_passport",
    "ru-passport-pos",
  );
}

function generateRuSnilsPositive(): Case {
  const a = faker.string.numeric(3);
  const b = faker.string.numeric(3);
  const c = faker.string.numeric(3);
  const d = faker.string.numeric(2);
  const value = `${a}-${b}-${c} ${d}`;

  return ctxWrap(
    value,
    ["Russia", "Russian", "SNILS", "СНИЛС", "Pension", "Пенсионный"],
    "ru_snils",
    "ru-snils-pos",
  );
}

function generateSaIdPositive(): Case {
  const first = faker.helpers.arrayElement(["1", "2"]);
  const rest = safeNumeric(9, first);
  const value = `${first}${rest}`;

  return ctxWrap(
    value,
    ["Saudi", "KSA", "Kingdom", "Iqama", "Muqeem"],
    "sa_id",
    "sa-id-pos",
  );
}

function generateTjIdPositive(): Case {
  const value = safeNumeric(faker.number.int({ min: 9, max: 10 }));

  return ctxWrap(
    value,
    ["Tajik", "Tajikistan"],
    "tj_id",
    "tj-id-pos",
  );
}

function generateTmPassportPositive(): Case {
  const letter = faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
  const digits = faker.string.numeric(7);
  const value = `${letter}${digits}`;

  return ctxWrap(
    value,
    ["Turkmen", "Turkmenistan", "Passport", "Pasport"],
    "tm_passport",
    "tm-passport-pos",
  );
}

function generateToIdPositive(): Case {
  const value = safeAlphanumeric(faker.number.int({ min: 8, max: 10 }));

  return ctxWrap(
    value,
    ["Tonga", "Tongan"],
    "to_id",
    "to-id-pos",
  );
}

function generateTrIdPositive(): Case {
  const first = String(faker.number.int({ min: 1, max: 9 }));
  const rest = faker.string.numeric(10);
  const value = `${first}${rest}`;

  return ctxWrap(
    value,
    ["Turkey", "Turkish", "TC", "Kimlik"],
    "tr_id",
    "tr-id-pos",
  );
}

function generateUaInnPositive(): Case {
  const value = safeNumeric(10);

  return ctxWrap(
    value,
    ["Ukrainian", "INN", "Tax", "Податковий", "ІНН"],
    "ua_inn",
    "ua-inn-pos",
  );
}

function generateUaPassportPositive(): Case {
  const letters = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 2).join("");
  const digits = faker.string.numeric(6);
  const value = `${letters}${digits}`;

  return ctxWrap(
    value,
    ["Ukrainian", "Passport", "Паспорт", "Український"],
    "ua_passport",
    "ua-passport-pos",
  );
}

function generateUaeIdPositive(): Case {
  const useSep = faker.datatype.boolean();
  let value: string;

  if (useSep) {
    value = `784-${faker.string.numeric(4)}-${faker.string.numeric(7)}-${faker.string.numeric(1)}`;
  } else {
    value = `784${faker.string.numeric(12)}`;
  }

  return ctxWrap(
    value,
    ["UAE", "Emirates", "Dubai", "Abu Dhabi", "Emirates ID"],
    "uae_id",
    "uae-id-pos",
  );
}

function generateUyCedulaPositive(): Case {
  const a = faker.string.numeric(1);
  const b = faker.string.numeric(3);
  const c = faker.string.numeric(3);
  const d = faker.string.numeric(1);
  const value = `${a}.${b}.${c}-${d}`;

  return ctxWrap(
    value,
    ["Uruguay", "Uruguayan", "Cédula", "Cedula", "Identidad"],
    "uy_cedula",
    "uy-cedula-pos",
  );
}

function generateUzPassportPositive(): Case {
  const letters = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 2).join("");
  const digits = faker.string.numeric(7);
  const value = `${letters}${digits}`;

  return ctxWrap(
    value,
    ["Uzbek", "Uzbekistan", "Passport", "Pasport"],
    "uz_passport",
    "uz-passport-pos",
  );
}

function generateUzStirPositive(): Case {
  const value = safeNumeric(9);

  return ctxWrap(
    value,
    ["Uzbek", "Uzbekistan", "STIR", "Tax", "INN", "Soliq"],
    "uz_stir",
    "uz-stir-pos",
  );
}

function generateVeCedulaPositive(): Case {
  const prefix = faker.helpers.arrayElement(["V", "E"]);
  const digits = faker.string.numeric(faker.number.int({ min: 1, max: 8 }));
  const value = `${prefix}-${digits}`;

  return ctxWrap(
    value,
    ["Venezuela", "Venezuelan", "Cédula", "Cedula", "Identidad", "CI"],
    "ve_cedula",
    "ve-cedula-pos",
  );
}

function generateVeRifPositive(): Case {
  const prefix = faker.helpers.arrayElement(["V", "E", "J", "G"]);
  const digits = faker.string.numeric(faker.number.int({ min: 8, max: 9 }));
  const check = faker.string.numeric(1);
  const value = `${prefix}-${digits}-${check}`;

  return ctxWrap(
    value,
    ["Venezuela", "RIF", "Tax", "SENIAT", "Tributario"],
    "ve_rif",
    "ve-rif-pos",
  );
}

function generateVnCccdPositive(): Case {
  const value = safeNumeric(12);

  return ctxWrap(
    value,
    ["Vietnam", "Vietnamese", "CCCD", "Citizen Identity", "CMND"],
    "vn_cccd",
    "vn-cccd-pos",
  );
}

function generateWsIdPositive(): Case {
  const value = safeNumeric(faker.number.int({ min: 8, max: 10 }));

  return ctxWrap(
    value,
    ["Samoa", "Samoan"],
    "ws_id",
    "ws-id-pos",
  );
}

function generateAddressPositive(): Case {
  const num = faker.number.int({ min: 1, max: 9999 });
  const streetName = faker.helpers.arrayElement([
    "Main", "Oak", "Maple", "Cedar", "Pine", "Elm", "Washington", "Lincoln",
    "Park", "Lake", "Hill", "River", "Spring", "Highland", "Forest",
  ]);
  const suffix = faker.helpers.arrayElement([
    "St", "Street", "Ave", "Avenue", "Rd", "Road", "Blvd", "Boulevard",
    "Lane", "Ln", "Dr", "Drive", "Ct", "Court", "Pl", "Place",
  ]);
  const value = `${num} ${streetName} ${suffix}`;

  return ctxWrap(
    value,
    ["Address", "Home Address", "Mailing Address", "Residence", "Postal Address"],
    "address",
    "address-pos",
  );
}

function generatePostalCodePositive(): Case {
  const type = faker.number.int({ min: 0, max: 3 });
  let value: string;

  if (type === 0) {
    value = faker.string.numeric(5);
  } else if (type === 1) {
    value = `${faker.string.numeric(5)}-${faker.string.numeric(4)}`;
  } else if (type === 2) {
    const a = faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
    const b = faker.string.numeric(1);
    const c = faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
    const d = faker.string.numeric(1);
    const e = faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
    const f = faker.string.numeric(1);
    value = `${a}${b}${c} ${d}${e}${f}`;
  } else {
    value = faker.string.numeric(4);
  }

  const id = `postal-code-pos-${faker.string.alphanumeric(8)}`;
  const text = value;
  const span = spanFor(text, value, "postal_code");

  return { id, text, kind: "supported", expected: [span] };
}

function generateCryptoAddressPositive(): Case {
  const type = faker.number.int({ min: 0, max: 5 });
  let value: string;
  const base58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  if (type === 0) {
    let addr = "1";
    const len = faker.number.int({ min: 25, max: 34 });
    for (let i = 0; i < len; i++) {
      addr += faker.helpers.arrayElement(base58.split(""));
    }
    value = addr;
  } else if (type === 1) {
    value = `0x${faker.string.hexadecimal({ length: 40, prefix: "" })}`;
  } else if (type === 2) {
    value = `bc1${faker.string.alphanumeric({ length: 42, casing: "lower" })}`;
  } else if (type === 3) {
    let addr = "3";
    const len = faker.number.int({ min: 25, max: 34 });
    for (let i = 0; i < len; i++) {
      addr += faker.helpers.arrayElement(base58.split(""));
    }
    value = addr;
  } else if (type === 4) {
    value = `ltc1${faker.string.alphanumeric({ length: 42, casing: "lower" })}`;
  } else {
    let addr = "L";
    const len = faker.number.int({ min: 25, max: 34 });
    for (let i = 0; i < len; i++) {
      addr += faker.helpers.arrayElement(base58.split(""));
    }
    value = addr;
  }

  const id = `crypto-addr-pos-${faker.string.alphanumeric(8)}`;
  const text = value;
  const span = spanFor(text, value, "crypto_address");

  return { id, text, kind: "supported", expected: [span] };
}

function generateCryptoTxHashPositive(): Case {
  const value = faker.string.hexadecimal({ length: 64, prefix: "" }).toLowerCase();

  return ctxWrap(
    value,
    ["Transaction", "Tx Hash", "Transaction ID", "Transaction Hash", "Blockchain Transaction", "TXID"],
    "crypto_tx_hash",
    "crypto-tx-pos",
  );
}

function generateCardDataPositive(): Case {
  const type = faker.number.int({ min: 0, max: 3 });
  let value: string;

  if (type === 0) {
    const card = faker.finance.creditCardNumber().replace(/[^0-9]/g, "");
    const name = faker.person.fullName().toUpperCase().replace(/[^A-Z ]/g, "");
    const exp = `${String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0")}${String(faker.number.int({ min: 25, max: 30 }))}`;
    const svc = faker.string.numeric(3);
    const extra = faker.string.alphanumeric(5).toUpperCase();
    value = `%B${card}^${name}^${exp}${svc}${extra}?`;
  } else if (type === 1) {
    const card = faker.finance.creditCardNumber().replace(/[^0-9]/g, "");
    const exp = `${String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0")}${String(faker.number.int({ min: 25, max: 30 }))}`;
    const svc = faker.string.numeric(3);
    const extra = faker.string.alphanumeric(5).toUpperCase();
    value = `;${card}=${exp}${svc}${extra}?`;
  } else if (type === 2) {
    const cvv = faker.string.numeric(3);
    const label = faker.helpers.arrayElement(["CVV", "CVC", "CVV2", "CID", "CSC"]);
    value = `${label}: ${cvv}`;
  } else {
    const mm = String(faker.number.int({ min: 1, max: 12 })).padStart(2, "0");
    const yy = String(faker.number.int({ min: 25, max: 30 }));
    const label = faker.helpers.arrayElement(["EXP", "EXPIRY", "EXPIRATION", "VALID THRU"]);
    value = `${label}: ${mm}/${yy}`;
  }

  return genEmbedded(
    value,
    ["Card", "Payment", "Credit", "Debit", "Visa", "Mastercard", "Amex", "Track", "Magnetic", "Stripe"],
    "card_data",
    "card-data-pos",
  );
}

function generateFinancialReferencePositive(): Case {
  const type = faker.number.int({ min: 0, max: 3 });
  let value: string;

  if (type === 0) {
    const label = faker.helpers.arrayElement(["TXN", "TX", "TRANS", "TRANSACTION"]);
    const sub = faker.helpers.arrayElement(["ID", "NO", "NUM", "NUMBER", "REF", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", "", ": ", "# "]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 8, max: 20 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  } else if (type === 1) {
    const label = faker.helpers.arrayElement(["WIRE", "TRANSFER", "REMITTANCE"]);
    const sub = faker.helpers.arrayElement(["REF", "REFERENCE", "NO", "NUM", "NUMBER", "ID", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 8, max: 20 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  } else if (type === 2) {
    const label = faker.helpers.arrayElement(["STATEMENT", "STMT"]);
    const sub = faker.helpers.arrayElement(["REF", "REFERENCE", "NO", "NUM", "NUMBER", "ID", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 6, max: 15 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  } else {
    const label = faker.helpers.arrayElement(["PAYMENT", "PAY"]);
    const sub = faker.helpers.arrayElement(["REF", "REFERENCE", "NO", "NUM", "NUMBER", "ID", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 8, max: 20 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  }

  return genEmbedded(
    value,
    ["Financial", "Banking"],
    "financial_reference",
    "fin-ref-pos",
  );
}

function generateInvestmentAccountPositive(): Case {
  const type = faker.number.int({ min: 0, max: 2 });
  let value: string;

  if (type === 0) {
    const label = faker.helpers.arrayElement(["ISA", "SIPP", "INV", "INVESTMENT", "PENSION", "401K", "IRA"]);
    const sub = faker.helpers.arrayElement(["ACCOUNT", "ACCT", "A/C", "NO", "NUMBER", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ". ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 7, max: 20 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  } else if (type === 1) {
    const label = faker.helpers.arrayElement(["TRADING", "BROKERAGE", "STOCK"]);
    const sub = faker.helpers.arrayElement(["ACCOUNT", "ACCT", "A/C", "NO", "NUMBER", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 6, max: 14 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  } else {
    const label = faker.helpers.arrayElement(["LOAN", "MORTGAGE", "CREDIT"]);
    const sub = faker.helpers.arrayElement(["ACCOUNT", "ACCT", "A/C", "NO", "NUMBER", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 6, max: 16 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  }

  return genEmbedded(
    value,
    ["Account", "Fund"],
    "investment_account",
    "inv-acct-pos",
  );
}

function generatePaymentGatewayIdPositive(): Case {
  const type = faker.number.int({ min: 0, max: 4 });
  let value: string;

  if (type === 0) {
    const prefix = faker.helpers.arrayElement(["tok", "card", "pm", "src"]);
    const id = faker.string.alphanumeric(24);
    value = `${prefix}_${id}`;
  } else if (type === 1) {
    value = `cus_${faker.string.alphanumeric(14)}`;
  } else if (type === 2) {
    value = `sub_${faker.string.alphanumeric(14)}`;
  } else if (type === 3) {
    const label = faker.helpers.arrayElement(["MERCHANT", "MID"]);
    const sub = faker.helpers.arrayElement(["ID", "NO", "NUM", "NUMBER", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 8, max: 20 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  } else {
    const label = faker.helpers.arrayElement(["TERMINAL", "TID", "POS"]);
    const sub = faker.helpers.arrayElement(["ID", "NO", "NUM", "NUMBER", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 6, max: 16 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  }

  return genEmbedded(
    value,
    ["Stripe", "Payment", "Gateway", "Token", "Customer", "Subscription"],
    "payment_gateway_id",
    "pay-gw-pos",
  );
}

function generateClinicalTrialIdPositive(): Case {
  const type = faker.number.int({ min: 0, max: 1 });
  let value: string;

  if (type === 0) {
    const label = faker.helpers.arrayElement(["PARTICIPANT", "SUBJECT", "TRIAL"]);
    const sub = faker.helpers.arrayElement(["ID", "NO", "NUM", "NUMBER", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const letters = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), faker.number.int({ min: 1, max: 2 })).join("");
    const digits = faker.string.numeric(faker.number.int({ min: 4, max: 6 }));
    value = `${label}${sub ? "-" + sub : ""}${sep}${letters}-${digits}`;
  } else {
    const label = faker.helpers.arrayElement(["PROTOCOL", "STUDY"]);
    const sub = faker.helpers.arrayElement(["NO", "NUM", "NUMBER", "ID", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 6, max: 15 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  }

  return genEmbedded(
    value,
    ["Research", "Clinical"],
    "clinical_trial_id",
    "clinical-trial-pos",
  );
}

function generateGeneticInfoPositive(): Case {
  const type = faker.datatype.boolean();
  let value: string;

  if (type) {
    value = `rs${faker.string.numeric(faker.number.int({ min: 6, max: 10 }))}`;
  } else {
    const chars = "ATCG";
    const len = faker.number.int({ min: 20, max: 50 });
    value = "";

    for (let i = 0; i < len; i++) {
      value += faker.helpers.arrayElement(chars.split(""));
    }
  }

  return ctxWrap(
    value,
    ["Genetic", "Gene", "SNP", "Marker", "Genome", "DNA", "Variant", "Allele", "Sequence", "Nucleotide"],
    "genetic_info",
    "genetic-info-pos",
  );
}

function generateHealthInsuranceIdPositive(): Case {
  const type = faker.number.int({ min: 0, max: 1 });
  let value: string;

  if (type === 0) {
    const label = faker.helpers.arrayElement(["CLAIM", "CLM"]);
    const sub = faker.helpers.arrayElement(["NO", "NUM", "NUMBER", "REF", "ID", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 8, max: 16 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  } else {
    const label = faker.helpers.arrayElement(["HEALTH PLAN", "BENEFICIARY", "MEMBER"]);
    const sub = faker.helpers.arrayElement(["NO", "NUM", "NUMBER", "ID", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 8, max: 15 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  }

  return genEmbedded(
    value,
    ["Insurance", "Medical", "Health", "Policy", "Plan"],
    "health_insurance_id",
    "health-ins-pos",
  );
}

function generateMedicalCodePositive(): Case {
  const type = faker.datatype.boolean();
  let value: string;

  if (type) {
    const letter = faker.helpers.arrayElement("ABCDEFGHJKLMNSTVWXYZ".split(""));
    const d1 = faker.number.int({ min: 0, max: 9 });
    const d2 = faker.number.int({ min: 0, max: 9 });
    value = `${letter}${d1}${d2}`;

    if (faker.datatype.boolean()) {
      const sub = faker.number.int({ min: 0, max: 99 });
      value += `.${String(sub).padStart(faker.datatype.boolean() ? 2 : 1, "0")}`;
    }
  } else {
    let num: number;

    do {
      num = faker.number.int({ min: 100, max: 99499 });
    } while (num > 99499);

    value = String(num).padStart(5, "0");
  }

  return ctxWrap(
    value,
    ["Diagnosis", "Condition", "Disease", "Disorder", "ICD", "Code", "Procedure", "CPT", "Billing", "Treatment", "Service"],
    "medical_code",
    "medical-code-pos",
  );
}

function generateMedicalDeviceIdPositive(): Case {
  const label = faker.helpers.arrayElement(["DEVICE", "IMPLANT", "PACEMAKER", "DEFIBRILLATOR"]);
  const sub = faker.helpers.arrayElement(["SERIAL", "SN", "S/N"]);
  const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
  const id = faker.string.alphanumeric(faker.number.int({ min: 8, max: 20 })).toUpperCase();
  const value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;

  return genEmbedded(
    value,
    ["Serial", "Medical"],
    "medical_device_id",
    "medical-device-pos",
  );
}

function generateMedicalReferencePositive(): Case {
  const type = faker.number.int({ min: 0, max: 2 });
  let value: string;

  if (type === 0) {
    const label = faker.helpers.arrayElement(["LAB", "TEST", "SAMPLE"]);
    const sub = faker.helpers.arrayElement(["ID", "NUM", "NUMBER", "REF", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 6, max: 12 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  } else if (type === 1) {
    const label = faker.helpers.arrayElement(["RX", "PRESC", "PRESCRIPTION", "SCRIPT"]);
    const sub = faker.helpers.arrayElement(["NO", "NUM", "NUMBER", "REF", "ID", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 6, max: 12 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  } else {
    const label = faker.helpers.arrayElement(["VACCINE", "VACCINATION", "IMMUNIZATION"]);
    const sub = faker.helpers.arrayElement(["ID", "RECORD", "NO", ""]);
    const sep = faker.helpers.arrayElement(["-", " ", ": ", "# ", ""]);
    const id = faker.string.alphanumeric(faker.number.int({ min: 6, max: 15 })).toUpperCase();
    value = `${label}${sub ? "-" + sub : ""}${sep}${id}`;
  }

  return genEmbedded(
    value,
    ["Specimen", "Pathology"],
    "medical_reference",
    "medical-ref-pos",
  );
}

function generateHrCompensationPositive(): Case {
  const type = faker.datatype.boolean();
  let value: string;

  if (type) {
    const currency = faker.helpers.arrayElement(["$", "£", "€", "¥"]);
    const amount = faker.number.int({ min: 10000, max: 500000 });
    const formatted = amount.toLocaleString("en-US");
    value = `${currency}${formatted}`;
  } else {
    value = faker.string.alphanumeric(faker.number.int({ min: 6, max: 16 })).toUpperCase();
    if (!/\d/.test(value)) {
      value += String(faker.number.int({ min: 0, max: 9 }));
    }
  }

  return ctxWrap(
    value,
    ["Salary", "Compensation", "Pay", "Wage", "Earning", "Benefits Plan No", "Insurance Plan ID", "Health-Plan No", "401K Account No", "403B No", "IRA No", "Retirement Account No", "Pension No"],
    "hr_compensation",
    "hr-comp-pos",
  );
}

function generateHrIdentifierPositive(): Case {
  const letterCount = faker.number.int({ min: 0, max: 3 });
  const letters = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), letterCount).join("");
  const digits = faker.string.numeric(faker.number.int({ min: 4, max: 10 }));
  const value = `${letters}${digits}`;

  return ctxWrap(
    value,
    ["Employee ID", "EMP-ID", "Staff No", "Personnel ID", "Worker ID", "Payroll No", "PAY ID", "Timesheet No", "Timecard ID", "Time-Entry No"],
    "hr_identifier",
    "hr-id-pos",
  );
}

function generateHrRecruitmentPositive(): Case {
  let value = faker.string.alphanumeric(faker.number.int({ min: 7, max: 13 })).toUpperCase();

  if (!/\d/.test(value)) {
    value += String(faker.number.int({ min: 0, max: 9 }));
  }

  return ctxWrap(
    value,
    ["Application ID", "Candidate ID", "Applicant No", "Application Ref", "Resume ID", "CV No", "Curriculum Vitae No", "Performance ID", "Review ID", "Appraisal No", "Evaluation ID", "Training ID", "Certification ID", "Cert No", "Recruiter Ref", "Agency ID", "Application", "Candidate", "Applicant", "Resume", "CV", "Curriculum Vitae", "Performance", "Review", "Appraisal", "Evaluation", "Training", "Certification", "Cert", "Recruiter", "Agency"],
    "hr_recruitment",
    "hr-recruit-pos",
  );
}

function generateHrScreeningPositive(): Case {
  let value = faker.string.alphanumeric(faker.number.int({ min: 7, max: 13 })).toUpperCase();

  if (!/\d/.test(value)) {
    value += String(faker.number.int({ min: 0, max: 9 }));
  }

  return ctxWrap(
    value,
    ["Background Check ID", "BGC ID", "Screening ID", "Drug Test ID", "Urinalysis ID", "Disciplinary Action No", "Incident No", "Warning No", "Violation No", "Background Check", "BGC", "Screening", "Drug Test", "Urinalysis", "Disciplinary", "Incident", "Warning", "Violation"],
    "hr_screening",
    "hr-screen-pos",
  );
}

function generateDigitalIdentityPositive(): Case {
  const type = faker.number.int({ min: 0, max: 3 });
  let value: string;

  if (type === 0) {
    value = `STEAM_${faker.number.int({ min: 0, max: 9 })}:${faker.number.int({ min: 0, max: 9 })}:${faker.string.numeric(faker.number.int({ min: 1, max: 20 }))}`;
  } else if (type === 1) {
    const handle = faker.string.alphanumeric(faker.number.int({ min: 2, max: 30 })).toLowerCase();
    value = `@${handle}`;
  } else if (type === 2) {
    value = faker.string.numeric(faker.number.int({ min: 17, max: 19 }));
  } else {
    const blocklist = new Set(["the", "and", "for", "admin", "but", "not", "are", "was", "has", "had", "this", "that", "with", "from", "your", "have", "more", "will", "can", "all", "any", "get", "set", "new", "old", "one", "two", "out", "how", "who", "why", "yes", "you", "its", "our", "now"]);

    while (true) {
      const w = faker.string.alphanumeric(faker.number.int({ min: 3, max: 30 }));
      const lower = w.toLowerCase();

      if (!blocklist.has(lower) && !/^\d+$/.test(w)) {
        value = w;
        break;
      }
    }
  }

  if (type === 3) {
    return ctxWrapGeneric(
      value,
      ["Username", "User ID", "Handle", "Screen Name", "Gamertag", "Discord ID", "Steam ID", "PSN ID", "Xbox Gamertag"],
      "digital_identity",
      "digital-id-pos",
    );
  }

  return ctxWrap(
    value,
    ["Username", "User ID", "Handle", "Screen Name", "Gamertag", "Discord ID", "Steam ID", "PSN ID", "Xbox Gamertag"],
    "digital_identity",
    "digital-id-pos",
  );
}

function generateLicensePlatePositive(): Case {
  const type = faker.number.int({ min: 0, max: 4 });
  let value: string;

  if (type === 0) {
    const a = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 2).join("");
    const b = faker.string.numeric(2);
    const c = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 3).join("");
    value = `${a}${b}${c}`;
  } else if (type === 1) {
    const b = faker.string.numeric(2);
    const c = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 3).join("");
    value = `${b}${c}`;
  } else if (type === 2) {
    const a = faker.helpers.arrayElements("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), 3).join("");
    const b = faker.string.numeric(4);
    value = `${a}${b}`;
  } else if (type === 3) {
    const a = faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
    const b = faker.string.numeric(1);
    const c = faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
    const d = faker.string.numeric(1);
    const e = faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
    const f = faker.string.numeric(1);
    value = `${a}${b}${c}-${d}${e}${f}`;
  } else {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const len = faker.number.int({ min: 2, max: 8 });
    value = faker.helpers.arrayElement("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));

    for (let i = 1; i < len; i++) {
      value += faker.helpers.arrayElement(chars.split(""));
    }

    if (!/\d/.test(value)) {
      value += String(faker.number.int({ min: 0, max: 9 }));
    }
  }

  return ctxWrap(
    value,
    ["License Plate", "Plate Number", "Registration", "Vehicle Registration", "License Plate Number", "Tag Number", "License Plate No.", "Plate No."],
    "license_plate",
    "license-plate-pos",
  );
}

function generateLegalCasePositive(): Case {
  let value = faker.string.alphanumeric(faker.number.int({ min: 6, max: 15 })).toUpperCase();

  if (!/\d/.test(value)) {
    value += String(faker.number.int({ min: 0, max: 9 }));
  }

  return ctxWrap(
    value,
    ["Case", "Docket", "Court", "Subpoena", "Summons", "Judgment", "Order", "Decree", "Bankruptcy", "BK", "Probate", "Estate", "Legal", "Lawsuit"],
    "legal_case",
    "legal-case-pos",
  );
}

function generateLegalLicensePositive(): Case {
  let value = faker.string.alphanumeric(faker.number.int({ min: 5, max: 11 })).toUpperCase();

  if (!/\d/.test(value)) {
    value += String(faker.number.int({ min: 0, max: 9 }));
  }

  return ctxWrap(
    value,
    ["Bar", "Attorney", "Lawyer", "Notary", "Notarial", "Court Reporter", "CSR", "RPR", "License", "Commission", "Legal", "Law Firm"],
    "legal_license",
    "legal-license-pos",
  );
}

function generateLegalReferencePositive(): Case {
  let value = faker.string.alphanumeric(faker.number.int({ min: 6, max: 14 })).toUpperCase();

  if (!/\d/.test(value)) {
    value += String(faker.number.int({ min: 0, max: 9 }));
  }

  return ctxWrap(
    value,
    ["Matter", "Engagement", "Client", "Settlement", "Agreement", "Retainer", "NDA", "Confidentiality", "Non-Disclosure", "Contract", "CNTR", "Legal", "Law Firm", "Attorney", "Counsel"],
    "legal_reference",
    "legal-ref-pos",
  );
}

function generateNegativeNearMiss(): Case {
  const id = `neg-near-${faker.string.alphanumeric(8)}`;
  const types = [
    () => {
      const local = faker.string.alphanumeric(8).toLowerCase();
      return { text: `Contact ${local}@localhost`, expected: [] };
    },
    () => {
      const local = faker.string.alphanumeric(8).toLowerCase();
      return { text: `Contact ${local}@example`, expected: [] };
    },
    () => {
      while (true) {
        const digits = faker.finance.creditCardNumber().replace(/[^0-9]/g, "");
        const invalid = digits.slice(0, -1) + (digits.slice(-1) === "0" ? "1" : "0");
        if (
          (invalid.length === 15 || invalid.length === 16) &&
          luhnValid(invalid.slice(0, 15))
        ) {
          continue;
        }
        return { text: `Card: ${invalid}`, expected: [] };
      }
    },
    () => {
      while (true) {
        const digits = faker.string.numeric(12);
        if (!myNumberValid(digits)) {
          return { text: `Ref: ${digits}`, expected: [] };
        }
      }
    },
    () => {
      const digits = faker.string.numeric(20);
      return { text: `ID: ${digits}`, expected: [] };
    },
    () => {
      while (true) {
        const ssn = generateSSN();
        if (luhnValid(ssn.compact) || tfnMod11Valid(ssn.compact)) {
          continue;
        }
        return { text: `Ref: ${ssn.compact}`, expected: [] };
      }
    },
    () => {
      while (true) {
        const ssn = generateSSN();
        if (luhnValid(ssn.compact) || tfnMod11Valid(ssn.compact)) {
          continue;
        }
        return { text: `ID ${ssn.compact}`, expected: [] };
      }
    },
    () => {
      while (true) {
        const f = "000";
        const m = String(faker.number.int({ min: 1, max: 99 })).padStart(2, "0");
        const l = String(faker.number.int({ min: 1, max: 9999 })).padStart(4, "0");
        const digits = `${f}${m}${l}`;
        if (luhnValid(digits) || tfnMod11Valid(digits)) {
          continue;
        }
        return { text: `SSN: ${digits}`, expected: [] };
      }
    },
    () => {
      while (true) {
        const f = "666";
        const m = String(faker.number.int({ min: 1, max: 99 })).padStart(2, "0");
        const l = String(faker.number.int({ min: 1, max: 9999 })).padStart(4, "0");
        const digits = `${f}${m}${l}`;
        if (luhnValid(digits) || tfnMod11Valid(digits)) {
          continue;
        }
        return { text: `SSN: ${digits}`, expected: [] };
      }
    },
    () => {
      while (true) {
        const f = String(faker.number.int({ min: 900, max: 999 })).padStart(3, "0");
        const m = String(faker.number.int({ min: 1, max: 99 })).padStart(2, "0");
        const l = String(faker.number.int({ min: 1, max: 9999 })).padStart(4, "0");
        const digits = `${f}${m}${l}`;
        if (luhnValid(digits) || tfnMod11Valid(digits)) {
          continue;
        }
        return { text: `SSN: ${digits}`, expected: [] };
      }
    },
    () => {
      while (true) {
        const f = String(faker.number.int({ min: 1, max: 899 })).padStart(3, "0");
        if (f === "666") continue;
        const digits = `${f}000001`;
        if (luhnValid(digits) || tfnMod11Valid(digits)) {
          continue;
        }
        return { text: `SSN: ${digits}`, expected: [] };
      }
    },
    () => {
      while (true) {
        const f = String(faker.number.int({ min: 1, max: 899 })).padStart(3, "0");
        if (f === "666") continue;
        const m = String(faker.number.int({ min: 1, max: 99 })).padStart(2, "0");
        const digits = `${f}${m}0000`;
        if (luhnValid(digits) || tfnMod11Valid(digits)) {
          continue;
        }
        return { text: `SSN: ${digits}`, expected: [] };
      }
    },
    () => {
      const digits = "1".repeat(16);
      return { text: `Card: ${digits}`, expected: [] };
    },
    () => {
      while (true) {
        const raw = faker.finance.creditCardNumber().replace(/[^0-9]/g, "");
        const tail = raw.slice(8);
        if (tail.length >= 8 && tail.length <= 9 && tfnMod11Valid(tail)) {
          continue;
        }
        const invalid = raw.slice(0, -1) + (raw.slice(-1) === "0" ? "1" : "0");
        if (
          (invalid.length === 15 || invalid.length === 16) &&
          luhnValid(invalid.slice(0, 15))
        ) {
          continue;
        }
        return { text: `Card: ${invalid}`, expected: [] };
      }
    },
    () => {
      const digits = faker.string.numeric(6);
      return { text: `Phone: ${digits}`, expected: [] };
    },
    () => {
      while (true) {
        const digits = faker.string.numeric(16);
        if (!luhnValid(digits) && !luhnValid(digits.slice(0, 15))) {
          return { text: `Phone: +${digits}`, expected: [] };
        }
      }
    },
    () => {
      return { text: `24-01-15`, expected: [] };
    },
    () => {
      return { text: `01-15-24`, expected: [] };
    },
    () => {
      const digits = faker.string.numeric(8);
      return { text: `NINO: ZZ${digits}A`, expected: [] };
    },
    () => {
      while (true) {
        const sin = generateSin();
        const invalid = sin.compact.slice(0, -1) + (sin.compact.slice(-1) === "0" ? "1" : "0");
        if (!tfnMod11Valid(invalid)) {
          return { text: `SIN: ${invalid}`, expected: [] };
        }
      }
    },
    () => {
      while (true) {
        const digits = faker.string.numeric(9);
        if (!tfnMod11Valid(digits) && !luhnValid(digits)) {
          return { text: `TFN: ${digits}`, expected: [] };
        }
      }
    },
    () => {
      const digits = faker.string.numeric({ exclude: "0" }) + faker.string.numeric(10);
      return { text: `My Number: ${digits}`, expected: [] };
    },
    () => {
      const digits = faker.string.numeric(7);
      return { text: `VAT: DE${digits}`, expected: [] };
    },
    () => {
      const digits = faker.string.numeric(20);
      return { text: `IBAN: GB${digits}`, expected: [] };
    },
    () => {
      while (true) {
        const digits = faker.string.numeric(8);
        if (!tfnMod11Valid(digits)) {
          return { text: `Passport: ${digits}`, expected: [] };
        }
      }
    },
    () => {
      const value = faker.string.alphanumeric(5);
      return { text: `DL: ${value}`, expected: [] };
    },
  ];

  const result = faker.helpers.arrayElement(types)();
  return { id, text: result.text, kind: "negative", expected: [] as Tuple[] };
}

function generateNegativePlain(): Case {
  const id = `neg-plain-${faker.string.alphanumeric(8)}`;
  const sentenceCount = faker.number.int({ min: 3, max: 12 });
  const sentences: string[] = [];

  for (let i = 0; i < sentenceCount; i++) {
    sentences.push(faker.hacker.phrase());
  }

  const text = sentences.join(" ");
  return { id, text, kind: "negative", expected: [] as Tuple[] };
}

function generateDeferred(): Case {
  const id = `deferred-${faker.string.alphanumeric(8)}`;
  const types = [
    () => {
      const local = faker.string.alphanumeric(8).toLowerCase();
      return { text: `"${local}"@example.com`, kind: "deferred" as const };
    },
    () => {
      const local = faker.string.alphanumeric(8).toLowerCase();
      return { text: `"${local}@example.com"`, kind: "deferred" as const };
    },
    () => {
      const local = faker.string.alphanumeric(8).toLowerCase();
      return { text: `${local}@localhost`, kind: "deferred" as const };
    },
    () => {
      const local = faker.string.alphanumeric(8).toLowerCase();
      return { text: `${local}@example`, kind: "deferred" as const };
    },
    () => {
      const local = faker.string.alphanumeric(8).toLowerCase();
      return { text: `é${local}@example.com`, kind: "deferred" as const };
    },
    () => {
      const local = faker.string.alphanumeric(8).toLowerCase();
      return { text: `${local}@𝐞𝐱𝐚𝐦𝐩𝐥𝐞.𝐜𝐨𝐦`, kind: "deferred" as const };
    },
    () => {
      const digits = faker.string.numeric(12);
      return { text: `Card: ${digits}`, kind: "deferred" as const };
    },
    () => {
      const digits = faker.string.numeric(20);
      return { text: `Card: ${digits}`, kind: "deferred" as const };
    },
    () => {
      const ssn = generateSSN();
      const f = String(faker.number.int({ min: 1, max: 899 })).padStart(3, "0");
      if (f === "666") return { text: `SSN: 001-01-0001`, kind: "deferred" as const };
      const m = String(faker.number.int({ min: 1, max: 99 })).padStart(2, "0");
      const l = String(faker.number.int({ min: 1, max: 9999 })).padStart(4, "0");
      return { text: `SSN: ${f}-${m}-${l} extra context here`, kind: "deferred" as const };
    },
  ];

  const result = faker.helpers.arrayElement(types)();
  return { id, text: result.text, kind: result.kind, expected: [] };
}

function generateMixedRule(): Case {
  const id = `mixed-${faker.string.alphanumeric(8)}`;

  const email = `${faker.string.alphanumeric(8).toLowerCase()}@${faker.helpers.arrayElement(["example.com", "test.org", "demo.net", "sample.io"])}`;
  const cardDigits = faker.finance.creditCardNumber().replace(/[^0-9]/g, "");
  const ssn = generateSSN();
  const phone = `+1${faker.string.numeric(10)}`;
  const nino = generateNino();
  const sin = generateSin();
  const tfn = generateTfn();
  const myNumber = generateMyNumber();
  const vat = generateVat();
  const iban = generateIban();
  const passport = generatePassport();
  const dl = generateDriversLicense();
  const name = generatePersonName();

  const items = [
    { type: "email" as const, part: `Email: ${email}`, value: email },
    { type: "payment_card" as const, part: `Card: ${cardDigits.match(/.{1,4}/g)?.join("-") ?? cardDigits}`, value: cardDigits.match(/.{1,4}/g)?.join("-") ?? cardDigits },
    { type: "us_ssn" as const, part: `SSN: ${ssn.formatted}`, value: ssn.formatted },
    { type: "phone" as const, part: `Phone: ${phone}`, value: phone },
    { type: "uk_nino" as const, part: `NINO: ${nino}`, value: nino },
    { type: "ca_sin" as const, part: `SIN: ${sin.formatted}`, value: sin.formatted },
    { type: "au_tfn" as const, part: `TFN: ${tfn.spaced}`, value: tfn.spaced },
    { type: "jp_my_number" as const, part: `My Number: ${myNumber.compact}`, value: myNumber.compact },
    { type: "eu_vat" as const, part: `VAT: ${vat}`, value: vat },
    { type: "iban" as const, part: `IBAN: ${iban.compact}`, value: iban.compact },
    { type: "passport" as const, part: `Passport: ${passport}`, value: passport },
    { type: "drivers_license" as const, part: `DL: ${dl}`, value: dl },
    { type: "person_name_lite" as const, part: `Name: ${name}`, value: name },
  ];

  const order = faker.helpers.shuffle(items);
  const selected = order.slice(0, faker.number.int({ min: 3, max: 6 }));

  const separators = [". ", "\n", " | ", "; "];
  let text = "";
  const spans: Tuple[] = [];

  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];

    if (item === undefined) {
      continue;
    }

    if (i > 0) {
      text += faker.helpers.arrayElement(separators);
    }

    text += item.part;
    spans.push(spanFor(text, item.value, item.type));
  }

  return { id, text, kind: "supported", expected: spans };
}

// ── Additional generator helpers ─────────────────────────────────────────────

function allSameChar(candidate: string): boolean {
  const first = candidate.charCodeAt(0);

  for (let i = 1; i < candidate.length; i++) {
    if (candidate.charCodeAt(i) !== first) {
      return false;
    }
  }

  return true;
}

const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const VIN_TRANSLIT: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4,
  "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
};

function generateVin(): string {
  while (true) {
    let vin = "";

    for (let i = 0; i < 17; i++) {
      if (i === 8) {
        vin += "0";
      } else {
        vin += faker.helpers.arrayElement(VIN_CHARS.split(""));
      }
    }

    if (!/\d/.test(vin)) {
      continue;
    }

    if (allSameChar(vin)) {
      continue;
    }

    let sum = 0;

    for (let i = 0; i < 17; i++) {
      const value = VIN_TRANSLIT[vin[i]!];
      sum += (value ?? 0) * VIN_WEIGHTS[i]!;
    }

    const computed = sum % 11;
    const checkChar = computed === 10 ? "X" : String(computed);
    const result = vin.slice(0, 8) + checkChar + vin.slice(9);

    return result;
  }
}

function generateVinPositive(): Case {
  const vin = generateVin();
  const id = `vin-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((v: string) => string)[] = [
    (v) => `VIN: ${v}`,
    (v) => `Vehicle ID: ${v}`,
    (v) => v,
    (v) => `Chassis No: ${v}`,
    (v) => `VIN #${v}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(vin);
  const span = spanFor(text, vin, "vin");

  const expected: Tuple[] = [span];

  for (const pc of postalCodeSpans(text)) {
    if (pc.start === span.start && pc.end === span.end) {
      continue;
    }
    expected.push(pc);
  }

  return { id, text, kind: "supported", expected };
}

function generateImeiPositive(): Case {
  const isImeiSv = faker.datatype.boolean(0.3);
  const prefix = faker.string.numeric(14);
  const checkDigit = luhnCheckDigit(prefix);
  let imei = prefix + String(checkDigit);

  if (isImeiSv) {
    imei += faker.string.numeric(1);
  }

  if (allSameDigit(imei)) {
    imei = prefix + String(checkDigit);
  }

  const id = `imei-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((v: string) => string)[] = [
    (v) => `IMEI: ${v}`,
    (v) => `Device ID: ${v}`,
    (v) => v,
    (v) => `Phone IMEI: ${v}`,
    (v) => `IMEI #${v}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(imei);
  const span = spanFor(text, imei, "imei");

  const expected: Tuple[] = [span];

  if (imei.length === 15 && !hasCrossFP(imei)) {
    expected.push({ ...span, ruleId: "payment_card" });
  }

  for (const pc of postalCodeSpans(text)) {
    if (pc.start === span.start && pc.end === span.end) {
      continue;
    }
    expected.push(pc);
  }

  return { id, text, kind: "supported", expected };
}

function generateImsiPositive(): Case {
  const imsi = numericNotLuhn(15);
  const id = `imsi-pos-${faker.string.alphanumeric(8)}`;

  const labels = [
    "IMSI",
    "Subscriber ID",
    "Subscriber Number",
    "Mobile Subscriber",
  ];

  return ctxWrapGeneric(imsi, labels, "imsi", id);
}

function upsCheckDigit(chars15: string): number {
  let sum = 0;

  for (let i = 0; i < 15; i++) {
    const c = chars15[i]!;
    const value =
      c >= "0" && c <= "9"
        ? c.charCodeAt(0) - 48
        : c.toUpperCase().charCodeAt(0) - 48;
    const weight = i % 2 === 0 ? 3 : 1;
    const product = value * weight;
    sum += Math.floor(product / 10) + (product % 10);
  }

  return (10 - (sum % 10)) % 10;
}

function fedexExpressCheckDigit(digits11: string): number {
  let sum = 0;

  for (let i = 0; i < 11; i++) {
    sum += parseInt(digits11[i]!, 10) * (i + 1);
  }

  const checkDigit = sum % 11;
  return checkDigit === 10 ? 0 : checkDigit;
}

function mod10CheckDigit(digits: string): number {
  const len = digits.length;
  let sum = 0;

  for (let i = 0; i < len; i++) {
    const d = parseInt(digits[i]!, 10);
    const weight = (len - 1 - i) % 2 === 0 ? 3 : 1;
    sum += d * weight;
  }

  return (10 - (sum % 10)) % 10;
}

function dhlCheckDigit(digits9: string): number {
  const num = parseInt(digits9, 10);
  return num % 7;
}

function generateTrackingNumberPositive(): Case {
  const carrier = faker.helpers.arrayElement([
    "ups",
    "fedex_express",
    "fedex_ground",
    "usps",
    "dhl",
  ] as const);

  let value: string;

  switch (carrier) {
    case "ups": {
      const alphaNumChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let chars15 = "";

      for (let i = 0; i < 15; i++) {
        chars15 += faker.helpers.arrayElement(alphaNumChars.split(""));
      }

      const check = upsCheckDigit(chars15);
      value = `1Z${chars15}${check}`;
      break;
    }
    case "fedex_express": {
      const digits11 = faker.string.numeric(11);
      const check = fedexExpressCheckDigit(digits11);
      value = `${digits11}${check}`;
      break;
    }
    case "fedex_ground": {
      const digits14 = faker.string.numeric(14);
      const check = mod10CheckDigit(digits14);
      value = `${digits14}${check}`;
      break;
    }
    case "usps": {
      const len = faker.number.int({ min: 19, max: 21 });
      const digits = faker.string.numeric(len);
      const check = mod10CheckDigit(digits);
      value = `${digits}${check}`;
      break;
    }
    case "dhl": {
      const digits9 = faker.string.numeric(9);
      const check = dhlCheckDigit(digits9);
      value = `${digits9}${check}`;
      break;
    }
  }

  const id = `tracking-pos-${faker.string.alphanumeric(8)}`;

  const labels = [
    "Tracking Number",
    "Tracking No.",
    "Tracking ID",
    "Package ID",
    "Shipment ID",
    "Waybill No.",
    "Consignment No.",
  ];

  return ctxWrapGeneric(value, labels, "tracking_number", id);
}

function generateHttpAuthHeaderPositive(): Case {
  const value = faker.string.alphanumeric(24);
  const id = `httpauth-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((v: string) => string)[] = [
    (v) => `Authorization: Basic ${v}`,
    (v) => `Authorization: Bearer ${v}`,
    (v) => `Authorization: Digest ${v}`,
    (v) => `Proxy-Authorization: Basic ${v}`,
    (v) => `Proxy-Authorization: Bearer ${v}`,
    (v) => `Proxy-Authorization: Digest ${v}`,
    (v) => `Api-Key: ${v}`,
    (v) => `ApiKey: ${v}`,
    (v) => `Ocp-Apim-Subscription-Key: ${v}`,
    (v) => `X-Api-Key: ${v}`,
    (v) => `X-Auth-Token: ${v}`,
    (v) => `X-Secret-Key: ${v}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(value);
  const span = spanFor(text, value, "http_auth_header");

  return { id, text, kind: "supported", expected: [span] };
}

function generateUrlQueryKeyPositive(): Case {
  const value = faker.string.alphanumeric(20);
  const id = `urlqk-pos-${faker.string.alphanumeric(8)}`;

  const keys = [
    "api_key", "api-key", "apikey", "api_token", "api-token", "apitoken",
    "access_token", "access-token", "accesstoken", "auth_token", "auth-token",
    "authtoken", "access_key", "access-key", "accesskey", "secret_key",
    "secret-key", "secretkey", "secret", "private_key", "private-key",
    "privatekey", "oauth_token", "oauth-token", "oauthtoken",
  ];

  const key = faker.helpers.arrayElement(keys);
  const host = faker.helpers.arrayElement([
    "example.com", "api.test.org", "service.demo.net", "app.sample.io",
  ]);
  const path = faker.helpers.arrayElement(["/v1/data", "/users", "/search", ""]);
  const url = `https://${host}${path}?${key}=${value}`;
  const text = url;
  const span = spanFor(text, value, "url_query_key");

  return { id, text, kind: "supported", expected: [span] };
}

// ---------------------------------------------------------------------------
// TruffleHog-ported detectors
// ---------------------------------------------------------------------------

function generateDigitalOceanTokenPositive(): Case {
  const prefix = faker.helpers.arrayElement([
    "dop_v1_",
    "doo_v1_",
    "dor_v1_",
  ]);
  const hex = faker.string.hexadecimal({ length: 64, casing: "lower" }).slice(2);
  const token = `${prefix}${hex}`;
  const id = `doplctn-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => t,
    (t) => `DO_TOKEN: ${t}`,
    (t) => `DigitalOcean: ${t}`,
    (t) => `export DIGITALOCEAN_TOKEN=${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "digitalocean_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateCloudflareApiTokenPositive(): Case {
  const prefix = faker.helpers.arrayElement(["cfk_", "cfut_", "cfat_"]);
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  const len = faker.number.int({ min: 20, max: 40 });
  let body = "";

  for (let i = 0; i < len; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const token = `${prefix}${body}`;
  const id = `cftoken-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => t,
    (t) => `CLOUDFLARE_API_TOKEN: ${t}`,
    (t) => `Cloudflare: ${t}`,
    (t) => `export CF_API_TOKEN=${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "cloudflare_api_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateSendGridApiKeyPositive(): Case {
  const part1Len = faker.number.int({ min: 20, max: 24 });
  const part2Len = faker.number.int({ min: 39, max: 50 });
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  let p1 = "";
  let p2 = "";

  for (let i = 0; i < part1Len; i++) {
    p1 += faker.helpers.arrayElement(chars.split(""));
  }

  for (let i = 0; i < part2Len; i++) {
    p2 += faker.helpers.arrayElement(chars.split(""));
  }

  const key = `SG.${p1}.${p2}`;
  const id = `sgkey-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => k,
    (k) => `SENDGRID_API_KEY: ${k}`,
    (k) => `SendGrid: ${k}`,
    (k) => `export SENDGRID_API_KEY=${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "sendgrid_api_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateHuggingFaceTokenPositive(): Case {
  const prefix = faker.helpers.arrayElement(["hf_", "api_org_"]);
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let body = "";

  for (let i = 0; i < 34; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const token = `${prefix}${body}`;
  const id = `hftoken-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => t,
    (t) => `HUGGINGFACE_TOKEN: ${t}`,
    (t) => `HuggingFace: ${t}`,
    (t) => `export HF_TOKEN=${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "huggingface_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateSlackWebhookUrlPositive(): Case {
  const tPart = faker.string.alphanumeric({ length: 8, casing: "upper" });
  const bPart = faker.string.alphanumeric({ length: 8, casing: "upper" });
  const tailLen = faker.number.int({ min: 23, max: 25 });
  const tailChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let tail = "";

  for (let i = 0; i < tailLen; i++) {
    tail += faker.helpers.arrayElement(tailChars.split(""));
  }

  const url = `https://hooks.slack.com/services/T${tPart}/B${bPart}/${tail}`;
  const id = `slackhook-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((u: string) => string)[] = [
    (u) => u,
    (u) => `SLACK_WEBHOOK: ${u}`,
    (u) => `Slack webhook: ${u}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(url);
  const span = spanFor(text, url, "slack_webhook_url");

  return { id, text, kind: "supported", expected: [span] };
}

function generateTelegramBotTokenPositive(): Case {
  const botId = faker.string.numeric({ length: { min: 8, max: 12 } });
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  let body = "";

  for (let i = 0; i < 35; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const token = `${botId}:AA${body}`;
  const id = `tgbot-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => t,
    (t) => `TELEGRAM_BOT_TOKEN: ${t}`,
    (t) => `Telegram: ${t}`,
    (t) => `export TELEGRAM_BOT_TOKEN=${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "telegram_bot_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateGitLabTokenPositive(): Case {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=-_";
  const len = faker.number.int({ min: 20, max: 22 });
  let body = "";

  for (let i = 0; i < len; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const token = `glpat-${body}`;
  const id = `gltoken-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => t,
    (t) => `GITLAB_TOKEN: ${t}`,
    (t) => `GitLab: ${t}`,
    (t) => `export GITLAB_TOKEN=${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "gitlab_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateNpmTokenPositive(): Case {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let body = "";

  for (let i = 0; i < 36; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const token = `npm_${body}`;
  const id = `npmtoken-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => t,
    (t) => `NPM_TOKEN: ${t}`,
    (t) => `npm: ${t}`,
    (t) => `export NPM_TOKEN=${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "npm_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateOpenAIApiKeyPositive(): Case {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  const p1Len = faker.number.int({ min: 20, max: 40 });
  const p2Len = faker.number.int({ min: 20, max: 40 });
  let p1 = "";
  let p2 = "";

  for (let i = 0; i < p1Len; i++) {
    p1 += faker.helpers.arrayElement(chars.split(""));
  }

  for (let i = 0; i < p2Len; i++) {
    p2 += faker.helpers.arrayElement(chars.split(""));
  }

  const key = `sk-${p1}T3BlbkFJ${p2}`;
  const id = `openai-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => k,
    (k) => `OPENAI_API_KEY: ${k}`,
    (k) => `OpenAI: ${k}`,
    (k) => `export OPENAI_API_KEY=${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "openai_api_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateAnthropicApiKeyPositive(): Case {
  const prefix = faker.helpers.arrayElement(["sk-ant-admin01-", "sk-ant-api03-"]);
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  let body = "";

  for (let i = 0; i < 93; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const key = `${prefix}${body}AA`;
  const id = `anthropic-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => k,
    (k) => `ANTHROPIC_API_KEY: ${k}`,
    (k) => `Anthropic: ${k}`,
    (k) => `export ANTHROPIC_API_KEY=${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "anthropic_api_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateShopifyTokenPositive(): Case {
  const prefix = faker.helpers.arrayElement([
    "shppa_",
    "shpat_",
    "shpca_",
    "shpss_",
  ]);
  const len = faker.number.int({ min: 32, max: 38 });
  const hex = faker.string.hexadecimal({ length: len, casing: "lower" }).slice(2);
  const token = `${prefix}${hex}`;
  const id = `shtoken-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => t,
    (t) => `SHOPIFY_TOKEN: ${t}`,
    (t) => `Shopify: ${t}`,
    (t) => `export SHOPIFY_TOKEN=${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "shopify_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateTwilioSidPositive(): Case {
  const hex = faker.string.hexadecimal({ length: 32, casing: "lower" }).slice(2);
  const sid = `AC${hex}`;
  const id = `twiliosid-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((s: string) => string)[] = [
    (s) => s,
    (s) => `TWILIO_SID: ${s}`,
    (s) => `Twilio: ${s}`,
    (s) => `export TWILIO_ACCOUNT_SID=${s}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(sid);
  const span = spanFor(text, sid, "twilio_sid");

  return { id, text, kind: "supported", expected: [span] };
}

function generateMailchimpApiKeyPositive(): Case {
  const hex = faker.string.hexadecimal({ length: 32, casing: "lower" }).slice(2);
  const dc = faker.number.int({ min: 1, max: 99 });
  const key = `${hex}-us${dc}`;
  const id = `mckey-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => k,
    (k) => `MAILCHIMP_API_KEY: ${k}`,
    (k) => `Mailchimp: ${k}`,
    (k) => `export MAILCHIMP_API_KEY=${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "mailchimp_api_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateNotionTokenPositive(): Case {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let body = "";

  for (let i = 0; i < 43; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const prefix = faker.helpers.arrayElement(["secret_", "ntn_"]);
  const token = `${prefix}${body}`;
  const id = `nottoken-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => t,
    (t) => `NOTION_TOKEN: ${t}`,
    (t) => `Notion: ${t}`,
    (t) => `export NOTION_TOKEN=${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "notion_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateSentryTokenPositive(): Case {
  const variant = faker.helpers.arrayElement(["sntrys_eyJ", "sntryu_"]);

  if (variant === "sntrys_eyJ") {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=_+/";
    let body = "";

    for (let i = 0; i < 197; i++) {
      body += faker.helpers.arrayElement(chars.split(""));
    }

    const token = `sntrys_eyJ${body}`;
    const id = `sentryt-pos-${faker.string.alphanumeric(8)}`;

    const contexts: ((t: string) => string)[] = [
      (t) => t,
      (t) => `SENTRY_AUTH_TOKEN: ${t}`,
      (t) => `Sentry: ${t}`,
    ];

    const ctx = faker.helpers.arrayElement(contexts);
    const text = ctx(token);
    const span = spanFor(text, token, "sentry_token");

    return { id, text, kind: "supported", expected: [span] };
  }

  const hex = faker.string.hexadecimal({ length: 64, casing: "lower" }).slice(2);
  const token = `sntryu_${hex}`;
  const id = `sentryt-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => t,
    (t) => `SENTRY_AUTH_TOKEN: ${t}`,
    (t) => `Sentry: ${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "sentry_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateHerokuApiKeyPositive(): Case {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  let body = "";

  for (let i = 0; i < 60; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const key = `HRKU-${body}`;
  const id = `hrkey-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => k,
    (k) => `HEROKU_API_KEY: ${k}`,
    (k) => `Heroku: ${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "heroku_api_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateLinearApiKeyPositive(): Case {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let body = "";

  for (let i = 0; i < 40; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const key = `lin_api_${body}`;
  const id = `linkey-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => k,
    (k) => `LINEAR_API_KEY: ${k}`,
    (k) => `Linear: ${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "linear_api_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateMailgunApiKeyPositive(): Case {
  const variant = faker.helpers.arrayElement(["key-", "uuid"]);

  let key: string;

  if (variant === "key-") {
    const lower = "abcdefghijklmnopqrstuvwxyz0123456789";
    let body = "";

    for (let i = 0; i < 32; i++) {
      body += faker.helpers.arrayElement(lower.split(""));
    }

    key = `key-${body}`;
  } else {
    const h1 = faker.string.hexadecimal({ length: 32, casing: "lower" }).slice(2);
    const h2 = faker.string.hexadecimal({ length: 8, casing: "lower" }).slice(2);
    const h3 = faker.string.hexadecimal({ length: 8, casing: "lower" }).slice(2);
    key = `${h1}-${h2}-${h3}`;
  }

  const id = `mgkey-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => `mailgun api key: ${k}`,
    (k) => `MAILGUN_API_KEY=${k}`,
    (k) => `mailgun: ${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "mailgun_api_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generateOktaTokenPositive(): Case {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  let body = "";

  for (let i = 0; i < 40; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const token = `00${body}`;
  const id = `okatoken-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => `okta token: ${t}`,
    (t) => `OKTA_API_TOKEN=${t}`,
    (t) => `okta: ${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "okta_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateSquareTokenPositive(): Case {
  const variant = faker.helpers.arrayElement(["EAAA", "sq0atp-", "sq0csp-"]);

  if (variant === "EAAA") {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-+=";
    let body = "";

    for (let i = 0; i < 60; i++) {
      body += faker.helpers.arrayElement(chars.split(""));
    }

    const token = `${variant}${body}`;
    const id = `sqtoken-pos-${faker.string.alphanumeric(8)}`;

    const contexts: ((t: string) => string)[] = [
      (t) => `square token: ${t}`,
      (t) => `SQUARE_ACCESS_TOKEN=${t}`,
      (t) => `square: ${t}`,
    ];

    const ctx = faker.helpers.arrayElement(contexts);
    const text = ctx(token);
    const span = spanFor(text, token, "square_token");

    return { id, text, kind: "supported", expected: [span] };
  }

  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  const len = variant === "sq0atp-" ? 36 : 43;
  let body = "";

  for (let i = 0; i < len; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const token = `${variant}${body}`;
  const id = `sqtoken-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => `square token: ${t}`,
    (t) => `SQUARE_ACCESS_TOKEN=${t}`,
    (t) => `square: ${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "square_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateDiscordBotTokenPositive(): Case {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
  let p1 = "";
  let p2 = "";
  let p3 = "";

  for (let i = 0; i < 24; i++) {
    p1 += faker.helpers.arrayElement(chars.split(""));
  }

  for (let i = 0; i < 6; i++) {
    p2 += faker.helpers.arrayElement(chars.split(""));
  }

  for (let i = 0; i < 27; i++) {
    p3 += faker.helpers.arrayElement(chars.split(""));
  }

  const token = `${p1}.${p2}.${p3}`;
  const id = `dctoken-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => `discord bot token: ${t}`,
    (t) => `DISCORD_BOT_TOKEN=${t}`,
    (t) => `discord: ${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "discord_bot_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateDatadogApiKeyPositive(): Case {
  const len = faker.helpers.arrayElement([40, 32]);
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let body = "";

  for (let i = 0; i < len; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const key = body;
  const id = `ddkey-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => `datadog api key: ${k}`,
    (k) => `DATADOG_API_KEY=${k}`,
    (k) => `dd api key: ${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "datadog_api_key");

  return { id, text, kind: "supported", expected: [span] };
}

function generatePagerDutyTokenPositive(): Case {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_+";
  let body = "";

  for (let i = 0; i < 19; i++) {
    body += faker.helpers.arrayElement(chars.split(""));
  }

  const token = `y${body}`;
  const id = `pdtoken-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((t: string) => string)[] = [
    (t) => `pagerduty token: ${t}`,
    (t) => `PAGERDUTY_TOKEN=${t}`,
    (t) => `pager_duty: ${t}`,
    (t) => `pd_ key: ${t}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(token);
  const span = spanFor(text, token, "pagerduty_token");

  return { id, text, kind: "supported", expected: [span] };
}

function generateScalewayKeyPositive(): Case {
  const lower = "abcdefghijklmnopqrstuvwxyz0123456789";
  const parts = [8, 4, 4, 4, 12];
  const segments: string[] = [];

  for (const len of parts) {
    let seg = "";

    for (let i = 0; i < len; i++) {
      seg += faker.helpers.arrayElement(lower.split(""));
    }

    segments.push(seg);
  }

  const key = segments.join("-");
  const id = `sckey-pos-${faker.string.alphanumeric(8)}`;

  const contexts: ((k: string) => string)[] = [
    (k) => `scaleway key: ${k}`,
    (k) => `SCALEWAY_API_KEY=${k}`,
    (k) => `scaleway: ${k}`,
  ];

  const ctx = faker.helpers.arrayElement(contexts);
  const text = ctx(key);
  const span = spanFor(text, key, "scaleway_key");

  return { id, text, kind: "supported", expected: [span] };
}

function main(): void {
  faker.seed(42);

  const cases: Case[] = [];
  const generators: (() => Case)[] = [
    generateEmailPositive,
    generatePaymentCardPositive,
    generateSSNPositive,
    generatePhonePositive,
    generateNinoPositive,
    generateSinPositive,
    generateTfnPositive,
    generateMyNumberPositive,
    generateVatPositive,
    generateIbanPositive,
    generatePassportPositive,
    generateDriversLicensePositive,
    generatePersonNamePositive,
    generateIPv4Positive,
    generateIPv6Positive,
    generateMacAddressPositive,
    generateUrlWithAuthPositive,
    generateAwsAccessKeyPositive,
    generateGoogleApiKeyPositive,
    generateStripeApiKeyPositive,
    generateSlackTokenPositive,
    generateGithubTokenPositive,
    generateJwtTokenPositive,
    generatePrivateKeyPositive,
    generateGenericApiKeyPositive,
    generateSwiftBicPositive,
    generateUkSortCodePositive,
    generateRoutingPositive,
    generateUkBankAccountPositive,
    generateNhsPositive,
    generateItinPositive,
    generateEinPositive,
    generateIrdPositive,
    generateNpiPositive,
    generateDeaPositive,
    generateMrnPositive,
    // checksum national IDs
    generateClRutPositive,
    generateEsDniPositive,
    generateFrInseePositive,
    generateItCodiceFiscalePositive,
    generateNlBsnPositive,
    generatePlPeselPositive,
    generateThIdPositive,
    // structural national IDs
    generateBgEgnPositive,
    generateBhCprPositive,
    generateCzIdPositive,
    generateDeIdPositive,
    generateEcCedulaPositive,
    generateEgIdPositive,
    generateKwIdPositive,
    generateKzIinPositive,
    generateMyIcPositive,
    generatePeRucPositive,
    generateRoCnpPositive,
    generateRsJmbgPositive,
    generateZaIdPositive,
    // format-only national IDs
    generateArCuitPositive,
    generateArDniPositive,
    generateCoCedulaPositive,
    generateCoNitPositive,
    generateFjIdPositive,
    generateGhCardPositive,
    generateHuIdPositive,
    generateHuTaxIdPositive,
    generateIdNikPositive,
    generateIdNpwpPositive,
    generateIlIdPositive,
    generateJoIdPositive,
    generateKeIdPositive,
    generateKeKraPinPositive,
    generateKgPinPositive,
    generateLbIdPositive,
    generateMaIdPositive,
    generateMmNrcPositive,
    generateNgBvnPositive,
    generateNgNinPositive,
    generateNzDriverLicensePositive,
    generateNzIrdExtraPositive,
    generateNzPassportPositive,
    generateOmIdPositive,
    generatePeDniPositive,
    generatePhUmidPositive,
    generatePngIdPositive,
    generateQaIdPositive,
    generateRuPassportPositive,
    generateRuSnilsPositive,
    generateSaIdPositive,
    generateTjIdPositive,
    generateTmPassportPositive,
    generateToIdPositive,
    generateTrIdPositive,
    generateUaInnPositive,
    generateUaPassportPositive,
    generateUaeIdPositive,
    generateUyCedulaPositive,
    generateUzPassportPositive,
    generateUzStirPositive,
    generateVeCedulaPositive,
    generateVeRifPositive,
    generateVnCccdPositive,
    generateWsIdPositive,
    // non-national-ID
    generateAddressPositive,
    generatePostalCodePositive,
    generateCryptoAddressPositive,
    generateCryptoTxHashPositive,
    generateCardDataPositive,
    generateFinancialReferencePositive,
    generateInvestmentAccountPositive,
    generatePaymentGatewayIdPositive,
    generateClinicalTrialIdPositive,
    generateGeneticInfoPositive,
    generateHealthInsuranceIdPositive,
    generateMedicalCodePositive,
    generateMedicalDeviceIdPositive,
    generateMedicalReferencePositive,
    generateHrCompensationPositive,
    generateHrIdentifierPositive,
    generateHrRecruitmentPositive,
    generateHrScreeningPositive,
    generateDigitalIdentityPositive,
    generateLicensePlatePositive,
    generateLegalCasePositive,
    generateLegalLicensePositive,
    generateLegalReferencePositive,
    // Additional detectors
    generateVinPositive,
    generateImeiPositive,
    generateImsiPositive,
    generateTrackingNumberPositive,
    generateHttpAuthHeaderPositive,
    generateUrlQueryKeyPositive,
    // TruffleHog-ported detectors
    generateDigitalOceanTokenPositive,
    generateCloudflareApiTokenPositive,
    generateSendGridApiKeyPositive,
    generateHuggingFaceTokenPositive,
    generateSlackWebhookUrlPositive,
    generateTelegramBotTokenPositive,
    generateGitLabTokenPositive,
    generateNpmTokenPositive,
    generateOpenAIApiKeyPositive,
    generateAnthropicApiKeyPositive,
    generateShopifyTokenPositive,
    generateTwilioSidPositive,
    generateMailchimpApiKeyPositive,
    generateNotionTokenPositive,
    generateSentryTokenPositive,
    generateHerokuApiKeyPositive,
    generateLinearApiKeyPositive,
    generateMailgunApiKeyPositive,
    generateOktaTokenPositive,
    generateSquareTokenPositive,
    generateDiscordBotTokenPositive,
    generateDatadogApiKeyPositive,
    generatePagerDutyTokenPositive,
    generateScalewayKeyPositive,
  ];

  for (const gen of generators) {
    for (let i = 0; i < POSITIVES_PER_DETECTOR; i++) {
      cases.push(gen());
    }
  }

  for (let i = 0; i < NEGATIVE_COUNT; i++) {
    if (faker.datatype.boolean(0.3)) {
      cases.push(generateNegativeNearMiss());
    } else {
      cases.push(generateNegativePlain());
    }
  }

  for (let i = 0; i < DEFERRED_COUNT; i++) {
    cases.push(generateDeferred());
  }

  for (let i = 0; i < MIXED_COUNT; i++) {
    cases.push(generateMixedRule());
  }

  for (const c of cases) {
    if (c.kind !== "supported") {
      continue;
    }

    const existing = new Set(c.expected.map((t) => `${t.ruleId}:${t.start}:${t.end}`));

    for (const pc of postalCodeSpans(c.text)) {
      const key = `${pc.ruleId}:${pc.start}:${pc.end}`;
      if (!existing.has(key)) {
        c.expected.push(pc);
        existing.add(key);
      }
    }
  }

  const redactor = createRedactor({
    rules: Object.fromEntries(
      RULES.map((rule) => [rule, { action: "redact" }]),
    ),
  });

  for (const c of cases) {
    if (c.kind !== "supported") {
      continue;
    }

    const existing = new Set(c.expected.map((t) => `${t.ruleId}:${t.start}:${t.end}`));

    const detected = redactor.inspect(c.text).groups.flatMap((group) =>
      group.matches.map((m) => ({
        ruleId: m.ruleId,
        start: m.start,
        end: m.end,
      })),
    );

    for (const d of detected) {
      const key = `${d.ruleId}:${d.start}:${d.end}`;
      if (!existing.has(key)) {
        c.expected.push(d);
        existing.add(key);
      }
    }
  }

  const corpus = {
    revision: "independent",
    provenance: "independent" as const,
    reviewed: true,
    rules: [...RULES],
    cases,
  };

  const outputPath = Bun.argv[2] ?? "eval/corpus.json";
  Bun.write(outputPath, `${JSON.stringify(corpus, null, 2)}\n`);
  console.log(
    `Generated ${cases.length} cases (${POSITIVES_PER_DETECTOR * RULES.length} positives, ${NEGATIVE_COUNT} negatives, ${DEFERRED_COUNT} deferred, ${MIXED_COUNT} mixed) -> ${outputPath}`,
  );
}

main();
