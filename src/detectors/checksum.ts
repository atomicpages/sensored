export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    const digit = digits.charCodeAt(i) - 48;

    if (double) {
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += digit;
    }

    double = !double;
  }

  return sum % 10 === 0;
}

export function npiLuhnValid(digits: string): boolean {
  if (digits.length !== 10) {
    return false;
  }

  const prefixed = `80840${digits}`;
  let sum = 0;
  let alternate = false;

  for (let i = prefixed.length - 1; i >= 0; i--) {
    let d = prefixed.charCodeAt(i) - 48;

    if (alternate) {
      d *= 2;
      if (d > 9) {
        d -= 9;
      }
    }

    sum += d;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}
