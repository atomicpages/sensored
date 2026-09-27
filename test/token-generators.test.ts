import { describe, expect, it } from "bun:test";
import { DEFAULT_TOKEN_GENERATORS } from "../src/token-generators";

describe("DEFAULT_TOKEN_GENERATORS: coverage", () => {
  it("every generator produces a non-empty string", () => {
    for (const [key, gen] of Object.entries(DEFAULT_TOKEN_GENERATORS)) {
      const value = gen("test-input");
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it("generators are deterministic (same input → same output)", () => {
    for (const [key, gen] of Object.entries(DEFAULT_TOKEN_GENERATORS)) {
      const a = gen("input-a");
      const b = gen("input-a");
      expect(a).toBe(b);
    }
  });

  it("generators ignore input (constant output)", () => {
    for (const [key, gen] of Object.entries(DEFAULT_TOKEN_GENERATORS)) {
      const a = gen("anything");
      const b = gen("something-else");
      expect(a).toBe(b);
    }
  });
});

describe("DEFAULT_TOKEN_GENERATORS: format validity", () => {
  const cases: Record<string, RegExp> = {
    address:
      /\d+\s+\S+\s+(St|Ave|Rd|Blvd|Lane|Ln|Dr|Ct|Pl|Sq|Ter|Cir|Way|Pkwy|Hwy)/,
    ar_cuit: /\d{2}-\d{8}-\d/,
    ar_dni: /\d{7,8}/,
    bg_egn: /\d{10}/,
    bh_cpr: /\d{9}/,
    card_data: /CVV:\s*\d{3}/,
    cl_rut: /\d{1,2}\.\d{3}\.\d{3}-[\dKk]/,
    clinical_trial_id: /PARTICIPANT\s+ID\s+[A-Z]{2}\d{4}/,
    co_cedula: /\d{6,10}/,
    co_nit: /\d{9}-\d/,
    crypto_address: /^X/,
    crypto_tx_hash: /^[0-9a-f]{64}$/,
    cz_id: /\d{6}\/\d{4}/,
    de_id: /[A-Z0-9]{4}\d{7}|\d{10}/,
    digital_identity: /^redacted_user$/,
    ec_cedula: /\d{10}/,
    eg_id: /[12]\d{13}/,
    es_dni: /\d{8}[A-Z]/,
    financial_reference: /TXN-ID\s+\d{8}/,
    fj_id: /[A-Z0-9]{8,10}/,
    fr_insee: /\d{13}\s\d{2}/,
    genetic_info: /rs\d{6}/,
    gh_card: /GHA-\d{9}-\d/,
    health_insurance_id: /CLAIM\s+\d{8}/,
    hr_compensation: /\$\d+\.\d{2}/,
    hr_identifier: /EMP\d{4}/,
    hr_recruitment: /APP\d{4}/,
    hr_screening: /BGC\d{4}/,
    hu_id: /\d{6}[A-Z]{2}/,
    hu_tax_id: /\d{10}/,
    id_nik: /\d{16}/,
    id_npwp: /\d{2}\.?\d{3}\.?\d{3}\.?\d[-.]?\d{3}\.?\d{3}/,
    il_id: /\d{9}/,
    investment_account: /ISA\s+ACCOUNT\s+NO\s+\d{6}/,
    it_codice_fiscale: /[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]/,
    jo_id: /\d{10}/,
    ke_id: /\d{7,8}/,
    ke_kra_pin: /A\d{9}[A-Z]/,
    kg_pin: /\d{14}/,
    kw_id: /\d{12}/,
    kz_iin: /\d{12}/,
    lb_id: /\d{7,8}/,
    legal_case: /CASE\d{3}/,
    legal_license: /BAR\d{3}/,
    legal_reference: /NDA\d{3}/,
    license_plate: /[A-Z0-9]{2,}/,
    ma_id: /[A-Z]{1,2}\d{6,8}|\d{8}/,
    medical_code: /A00/,
    medical_device_id: /DEVICE\s+SERIAL\s+\d{8}/,
    medical_reference: /LAB\s+ID\s+\d{6}/,
    mm_nrc: /\d{1,2}\/[A-Z][a-z]+\([NC]\)\d{6}/,
    my_ic: /\d{6}-\d{2}-\d{4}/,
    ng_bvn: /\d{11}/,
    ng_nin: /\d{11}/,
    nl_bsn: /\d{3}\.\d{3}\.\d{3}/,
    nz_driver_license: /[A-Z]{2}\d{6}/,
    nz_ird_extra: /\d{8,9}/,
    nz_passport: /[A-Z]{2}\d{6}/,
    om_id: /\d{8}/,
    payment_gateway_id: /tok_\d{24}/,
    pe_dni: /\d{8}/,
    pe_ruc: /\d{11}/,
    ph_umid: /\d{4}-\d{7}-\d/,
    pl_pesel: /\d{11}/,
    png_id: /[A-Z0-9]{8,12}/,
    postal_code: /XXX/,
    qa_id: /\d{11}/,
    ro_cnp: /\d{13}/,
    rs_jmbg: /\d{13}/,
    ru_passport: /\d{4}\s?\d{6}/,
    ru_snils: /\d{3}-\d{3}-\d{3}\s?\d{2}/,
    sa_id: /[12]\d{9}/,
    th_id: /\d{13}/,
    tj_id: /\d{9,10}/,
    tm_passport: /[A-Z]\d{7}/,
    to_id: /[A-Z0-9]{8,10}/,
    tr_id: /[1-9]\d{10}/,
    ua_inn: /\d{10}/,
    ua_passport: /[A-Z]{2}\d{6}/,
    uae_id: /784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d/,
    uy_cedula: /\d\.\d{3}\.\d{3}-\d/,
    uz_passport: /[A-Z]{2}\d{7}/,
    uz_stir: /\d{9}/,
    ve_cedula: /[VE]-\d{1,8}/,
    ve_rif: /[VEJG]-\d{8,9}-\d/,
    vn_cccd: /\d{12}/,
    ws_id: /\d{8,10}/,
    za_id: /\d{13}/,
  };

  for (const [entityType, pattern] of Object.entries(cases)) {
    it(`${entityType} fake value matches expected format`, () => {
      const gen = DEFAULT_TOKEN_GENERATORS[entityType];
      expect(gen).toBeDefined();
      if (!gen) throw new Error(`missing generator for ${entityType}`);
      const value = gen("test");
      expect(value).toMatch(pattern);
    });
  }
});

describe("DEFAULT_TOKEN_GENERATORS: idempotency (fake values don't re-trigger)", () => {
  it("crypto_address fake value does not match crypto address regex", () => {
    const gen = DEFAULT_TOKEN_GENERATORS.crypto_address;
    if (!gen) throw new Error("missing crypto_address generator");
    const fake = gen("test");
    expect(fake).not.toMatch(
      /^(1|3|bc1|0x|ltc1|[LM]|addr1|cosmos1|[A-Z2-7]{58}|tz[1-4]|KT1|bnb1)/,
    );
  });

  it("postal_code fake value does not match postal code regex", () => {
    const gen = DEFAULT_TOKEN_GENERATORS.postal_code;
    if (!gen) throw new Error("missing postal_code generator");
    const fake = gen("test");
    expect(fake).not.toMatch(
      /\d{5}(?:-\d{4})?|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}|[A-Z]\d[A-Z] ?\d[A-Z]\d|\d{4}/,
    );
  });
});
