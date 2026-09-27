import type { Detector } from "../types";

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

import { addressDetector } from "./contact/address";
import { emailDetector } from "./contact/email";
import { phoneDetector } from "./contact/phone";
import { postalCodeDetector } from "./contact/postal-code";

// ---------------------------------------------------------------------------
// Crypto
// ---------------------------------------------------------------------------

import { cryptoAddressDetector } from "./crypto/crypto-address";
import { cryptoTxHashDetector } from "./crypto/crypto-tx-hash";

// ---------------------------------------------------------------------------
// Cloud
// ---------------------------------------------------------------------------

import { awsAccessKeyDetector } from "./cloud/aws-access-key";
import { googleApiKeyDetector } from "./cloud/google-api-key";
import { slackTokenDetector } from "./cloud/slack-token";
import { stripeApiKeyDetector } from "./cloud/stripe-api-key";

// ---------------------------------------------------------------------------
// Financial
// ---------------------------------------------------------------------------

import { cardDataDetector } from "./financial/card-data";
import { euVatDetector } from "./financial/eu-vat";
import { financialReferenceDetector } from "./financial/financial-reference";
import { ibanDetector } from "./financial/iban";
import { investmentAccountDetector } from "./financial/investment-account";
import { paymentCardDetector } from "./financial/payment-card";
import { paymentGatewayIdDetector } from "./financial/payment-gateway-id";
import { swiftBicDetector } from "./financial/swift-bic";
import { ukBankAccountDetector } from "./financial/uk-bank-account";
import { ukSortCodeDetector } from "./financial/uk-sort-code";
import { usRoutingDetector } from "./financial/us-routing";

// ---------------------------------------------------------------------------
// Healthcare
// ---------------------------------------------------------------------------

import { clinicalTrialIdDetector } from "./healthcare/clinical-trial-id";
import { geneticInfoDetector } from "./healthcare/genetic-info";
import { healthInsuranceIdDetector } from "./healthcare/health-insurance-id";
import { medicalCodeDetector } from "./healthcare/medical-code";
import { medicalDeviceIdDetector } from "./healthcare/medical-device-id";
import { medicalRecordNumberDetector } from "./healthcare/medical-record-number";
import { medicalReferenceDetector } from "./healthcare/medical-reference";
import { usDeaDetector } from "./healthcare/us-dea";
import { usNpiDetector } from "./healthcare/us-npi";

// ---------------------------------------------------------------------------
// HR
// ---------------------------------------------------------------------------

import { hrCompensationDetector } from "./hr/hr-compensation";
import { hrIdentifierDetector } from "./hr/hr-identifier";
import { hrRecruitmentDetector } from "./hr/hr-recruitment";
import { hrScreeningDetector } from "./hr/hr-screening";

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

import { digitalIdentityDetector } from "./identity/digital-identity";
import { driversLicenseDetector } from "./identity/drivers-license";
import { imeiDetector } from "./identity/imei";
import { imsiDetector } from "./identity/imsi";
import { licensePlateDetector } from "./identity/license-plate";
import { passportDetector } from "./identity/passport";
import { vinDetector } from "./identity/vin";

// ---------------------------------------------------------------------------
// Legal
// ---------------------------------------------------------------------------

import { legalCaseDetector } from "./legal/legal-case";
import { legalLicenseDetector } from "./legal/legal-license";
import { legalReferenceDetector } from "./legal/legal-reference";

// ---------------------------------------------------------------------------
// National ID
// ---------------------------------------------------------------------------

import { arCuitDetector } from "./national-id/ar-cuit";
import { arDniDetector } from "./national-id/ar-dni";
import { auTfnDetector } from "./national-id/au-tfn";
import { bgEgnDetector } from "./national-id/bg-egn";
import { bhCprDetector } from "./national-id/bh-cpr";
import { caSinDetector } from "./national-id/ca-sin";
import { clRutDetector } from "./national-id/cl-rut";
import { coCedulaDetector } from "./national-id/co-cedula";
import { coNitDetector } from "./national-id/co-nit";
import { czIdDetector } from "./national-id/cz-id";
import { deIdDetector } from "./national-id/de-id";
import { ecCedulaDetector } from "./national-id/ec-cedula";
import { egIdDetector } from "./national-id/eg-id";
import { esDniDetector } from "./national-id/es-dni";
import { fjIdDetector } from "./national-id/fj-id";
import { frInseeDetector } from "./national-id/fr-insee";
import { ghCardDetector } from "./national-id/gh-card";
import { huIdDetector } from "./national-id/hu-id";
import { huTaxIdDetector } from "./national-id/hu-tax-id";
import { idNikDetector } from "./national-id/id-nik";
import { idNpwpDetector } from "./national-id/id-npwp";
import { ilIdDetector } from "./national-id/il-id";
import { itCodiceFiscaleDetector } from "./national-id/it-codice-fiscale";
import { joIdDetector } from "./national-id/jo-id";
import { jpMyNumberDetector } from "./national-id/jp-my-number";
import { keIdDetector } from "./national-id/ke-id";
import { keKraPinDetector } from "./national-id/ke-kra-pin";
import { kgPinDetector } from "./national-id/kg-pin";
import { kwIdDetector } from "./national-id/kw-id";
import { kzIinDetector } from "./national-id/kz-iin";
import { lbIdDetector } from "./national-id/lb-id";
import { maIdDetector } from "./national-id/ma-id";
import { mmNrcDetector } from "./national-id/mm-nrc";
import { myIcDetector } from "./national-id/my-ic";
import { ngBvnDetector } from "./national-id/ng-bvn";
import { ngNinDetector } from "./national-id/ng-nin";
import { nlBsnDetector } from "./national-id/nl-bsn";
import { nzDriverLicenseDetector } from "./national-id/nz-driver-license";
import { nzIrdDetector } from "./national-id/nz-ird";
import { nzIrdExtraDetector } from "./national-id/nz-ird-extra";
import { nzPassportDetector } from "./national-id/nz-passport";
import { omIdDetector } from "./national-id/om-id";
import { peDniDetector } from "./national-id/pe-dni";
import { peRucDetector } from "./national-id/pe-ruc";
import { phUmidDetector } from "./national-id/ph-umid";
import { plPeselDetector } from "./national-id/pl-pesel";
import { pngIdDetector } from "./national-id/png-id";
import { qaIdDetector } from "./national-id/qa-id";
import { roCnpDetector } from "./national-id/ro-cnp";
import { rsJmbgDetector } from "./national-id/rs-jmbg";
import { ruPassportDetector } from "./national-id/ru-passport";
import { ruSnilsDetector } from "./national-id/ru-snils";
import { saIdDetector } from "./national-id/sa-id";
import { ssnDetector } from "./national-id/ssn";
import { thIdDetector } from "./national-id/th-id";
import { tjIdDetector } from "./national-id/tj-id";
import { tmPassportDetector } from "./national-id/tm-passport";
import { toIdDetector } from "./national-id/to-id";
import { trIdDetector } from "./national-id/tr-id";
import { uaInnDetector } from "./national-id/ua-inn";
import { uaPassportDetector } from "./national-id/ua-passport";
import { uaeIdDetector } from "./national-id/uae-id";
import { ukNhsDetector } from "./national-id/uk-nhs";
import { ukNinoDetector } from "./national-id/uk-nino";
import { usEinDetector } from "./national-id/us-ein";
import { usItinDetector } from "./national-id/us-itin";
import { uyCedulaDetector } from "./national-id/uy-cedula";
import { uzPassportDetector } from "./national-id/uz-passport";
import { uzStirDetector } from "./national-id/uz-stir";
import { veCedulaDetector } from "./national-id/ve-cedula";
import { veRifDetector } from "./national-id/ve-rif";
import { vnCccdDetector } from "./national-id/vn-cccd";
import { wsIdDetector } from "./national-id/ws-id";
import { zaIdDetector } from "./national-id/za-id";

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

import { ipv4Detector } from "./network/ipv4";
import { ipv6Detector } from "./network/ipv6";
import { macAddressDetector } from "./network/mac-address";
import { urlWithAuthDetector } from "./network/url-with-auth";

// ---------------------------------------------------------------------------
// Person
// ---------------------------------------------------------------------------

import { personNameDetector } from "./person/person-name";
import { personNameLiteDetector } from "./person/person-name-lite";

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

import { genericApiKeyDetector } from "./token/generic-api-key";
import { gitHubTokenDetector } from "./token/github-token";
import { jwtTokenDetector } from "./token/jwt-token";
import { privateKeyDetector } from "./token/private-key";

// ---------------------------------------------------------------------------
// Logistics
// ---------------------------------------------------------------------------

import { trackingNumberDetector } from "./logistics/tracking-number";

// ---------------------------------------------------------------------------
// Built-in detector registry
// ---------------------------------------------------------------------------

const builtIns: readonly Detector[] = [
  // Contact
  addressDetector,
  emailDetector,
  phoneDetector,
  postalCodeDetector,

  // Crypto
  cryptoAddressDetector,
  cryptoTxHashDetector,

  // Cloud
  awsAccessKeyDetector,
  googleApiKeyDetector,
  slackTokenDetector,
  stripeApiKeyDetector,

  // Financial
  cardDataDetector,
  euVatDetector,
  financialReferenceDetector,
  ibanDetector,
  investmentAccountDetector,
  paymentCardDetector,
  paymentGatewayIdDetector,
  swiftBicDetector,
  ukBankAccountDetector,
  ukSortCodeDetector,
  usRoutingDetector,

  // Healthcare
  clinicalTrialIdDetector,
  geneticInfoDetector,
  healthInsuranceIdDetector,
  medicalCodeDetector,
  medicalDeviceIdDetector,
  medicalRecordNumberDetector,
  medicalReferenceDetector,
  usDeaDetector,
  usNpiDetector,

  // HR
  hrCompensationDetector,
  hrIdentifierDetector,
  hrRecruitmentDetector,
  hrScreeningDetector,

  // Identity
  digitalIdentityDetector,
  driversLicenseDetector,
  imeiDetector,
  imsiDetector,
  licensePlateDetector,
  passportDetector,
  vinDetector,

  // Legal
  legalCaseDetector,
  legalLicenseDetector,
  legalReferenceDetector,

  // National ID
  arCuitDetector,
  arDniDetector,
  auTfnDetector,
  bgEgnDetector,
  bhCprDetector,
  caSinDetector,
  clRutDetector,
  coCedulaDetector,
  coNitDetector,
  czIdDetector,
  deIdDetector,
  ecCedulaDetector,
  egIdDetector,
  esDniDetector,
  fjIdDetector,
  frInseeDetector,
  ghCardDetector,
  huIdDetector,
  huTaxIdDetector,
  idNikDetector,
  idNpwpDetector,
  ilIdDetector,
  itCodiceFiscaleDetector,
  joIdDetector,
  jpMyNumberDetector,
  kgPinDetector,
  keIdDetector,
  keKraPinDetector,
  kzIinDetector,
  kwIdDetector,
  lbIdDetector,
  maIdDetector,
  mmNrcDetector,
  myIcDetector,
  ngBvnDetector,
  ngNinDetector,
  nlBsnDetector,
  nzDriverLicenseDetector,
  nzIrdDetector,
  nzIrdExtraDetector,
  nzPassportDetector,
  omIdDetector,
  peDniDetector,
  peRucDetector,
  phUmidDetector,
  plPeselDetector,
  pngIdDetector,
  qaIdDetector,
  roCnpDetector,
  rsJmbgDetector,
  ruPassportDetector,
  ruSnilsDetector,
  saIdDetector,
  ssnDetector,
  thIdDetector,
  tjIdDetector,
  tmPassportDetector,
  toIdDetector,
  trIdDetector,
  uaInnDetector,
  uaPassportDetector,
  uaeIdDetector,
  ukNhsDetector,
  ukNinoDetector,
  usEinDetector,
  usItinDetector,
  uyCedulaDetector,
  uzPassportDetector,
  uzStirDetector,
  veCedulaDetector,
  veRifDetector,
  vnCccdDetector,
  wsIdDetector,
  zaIdDetector,

  // Network
  ipv4Detector,
  ipv6Detector,
  macAddressDetector,
  urlWithAuthDetector,

  // Person
  personNameDetector,
  personNameLiteDetector,

  // Token
  genericApiKeyDetector,
  gitHubTokenDetector,
  jwtTokenDetector,
  privateKeyDetector,

  // Logistics
  trackingNumberDetector,
];

export function builtInDetectors(): Map<string, Detector> {
  const map = new Map<string, Detector>();

  for (const detector of builtIns) {
    map.set(detector.id, detector);
  }

  return map;
}
