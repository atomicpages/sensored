//! Shared check-digit algorithms. Mirrors `detectors/checksum.ts`.
//!
//! Inputs are ASCII digit strings; callers strip separators first.

/// Luhn (mod 10) over ASCII digits.
pub fn luhn_valid(digits: &str) -> bool {
    let mut sum = 0;
    let mut double = false;

    for byte in digits.bytes().rev() {
        let digit = u32::from(byte.wrapping_sub(b'0'));

        if double {
            let doubled = digit * 2;
            sum += if doubled > 9 { doubled - 9 } else { doubled };
        } else {
            sum += digit;
        }

        double = !double;
    }

    sum % 10 == 0
}

/// NPI check: Luhn over the 10 digits prefixed with `80840`.
pub fn npi_luhn_valid(digits: &str) -> bool {
    digits.len() == 10 && luhn_valid(&format!("80840{digits}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn luhn() {
        assert!(luhn_valid("4111111111111111"));
        assert!(!luhn_valid("4111111111111112"));
    }

    #[test]
    fn npi() {
        assert!(npi_luhn_valid("1234567893"));
        assert!(!npi_luhn_valid("1234567890"));
        assert!(!npi_luhn_valid("123456789"));
    }
}
