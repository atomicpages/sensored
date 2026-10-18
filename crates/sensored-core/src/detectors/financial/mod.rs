//! Built-in `financial` detectors. Mirrors `packages/sensored/src/detectors/financial/`.
//!
//! One file per detector; the porting recipe is `national_id/CONTEXT.md`.

use std::sync::Arc;

use super::{Registry, regex};

mod card_data;
mod eu_vat;
mod financial_reference;
mod iban;
mod investment_account;
mod payment_card;
mod payment_gateway_id;
mod swift_bic;
mod uk_bank_account;
mod uk_sort_code;
mod us_routing;

pub fn register(registry: &mut Registry) {
    registry.insert(Arc::new(card_data::detector()));
    registry.insert(Arc::new(eu_vat::detector()));
    registry.insert(Arc::new(financial_reference::detector()));
    registry.insert(Arc::new(iban::IbanDetector));
    registry.insert(Arc::new(investment_account::detector()));
    registry.insert(Arc::new(payment_card::detector()));
    registry.insert(Arc::new(payment_gateway_id::detector()));
    registry.insert(Arc::new(swift_bic::detector()));
    registry.insert(Arc::new(uk_bank_account::detector()));
    registry.insert(Arc::new(uk_sort_code::detector()));
    registry.insert(Arc::new(us_routing::detector()));
}

#[cfg(test)]
use super::test_support;
