/** Development tooling; never imported by the published library. */
export const EVAL_RULES: readonly string[] = [
  "email", "payment_card", "us_ssn", "phone", "uk_nino",
  "ca_sin", "au_tfn", "jp_my_number", "eu_vat", "iban",
  "passport", "drivers_license", "person_name_lite",
  "ipv4", "ipv6", "mac_address", "url_with_auth",
  "aws_access_key", "google_api_key", "stripe_api_key", "slack_token",
  "github_token", "jwt_token", "private_key", "generic_api_key",
  "swift_bic", "uk_sort_code", "us_routing", "uk_bank_account",
  "uk_nhs", "us_itin", "us_ein", "nz_ird",
  "us_npi", "us_dea", "medical_record_number",
  // contact
  "address", "postal_code",
  // crypto
  "crypto_address", "crypto_tx_hash",
  // financial
  "card_data", "financial_reference", "investment_account", "payment_gateway_id",
  // healthcare
  "clinical_trial_id", "genetic_info", "health_insurance_id",
  "medical_code", "medical_device_id", "medical_reference",
  // hr
  "hr_compensation", "hr_identifier", "hr_recruitment", "hr_screening",
  // identity
  "digital_identity", "license_plate",
  // legal
  "legal_case", "legal_license", "legal_reference",
  // national-id
  "ar_cuit", "ar_dni", "bg_egn", "bh_cpr", "cl_rut", "co_cedula", "co_nit",
  "cz_id", "de_id", "ec_cedula", "eg_id", "es_dni", "fj_id", "fr_insee",
  "gh_card", "hu_id", "hu_tax_id", "id_nik", "id_npwp", "il_id",
  "it_codice_fiscale", "jo_id", "ke_id", "ke_kra_pin", "kg_pin", "kw_id",
  "kz_iin", "lb_id", "ma_id", "mm_nrc", "my_ic", "ng_bvn", "ng_nin",
  "nl_bsn", "nz_driver_license", "nz_ird_extra", "nz_passport", "om_id",
  "pe_dni", "pe_ruc", "ph_umid", "pl_pesel", "png_id", "qa_id", "ro_cnp",
  "rs_jmbg", "ru_passport", "ru_snils", "sa_id", "th_id", "tj_id",
  "tm_passport", "to_id", "tr_id", "ua_inn", "ua_passport", "uae_id",
  "uy_cedula", "uz_passport", "uz_stir", "ve_cedula", "ve_rif", "vn_cccd",
  "ws_id", "za_id",
  // logistics
  "vin", "imei", "imsi", "tracking_number",
];

export interface Tuple {
  ruleId: string;
  start: number;
  end: number;
}
export interface Case {
  id: string;
  text: string;
  kind: "supported" | "negative" | "deferred";
  expected: Tuple[];
}
export interface Corpus {
  revision: string;
  provenance: "independent" | "synthetic";
  reviewed: boolean;
  rules: string[];
  cases: Case[];
}
export interface Counts {
  tp: number;
  fp: number;
  fn: number;
}
export interface Metrics extends Counts {
  precision: number | null;
  recall: number | null;
}
export interface Report {
  version: 1;
  revision: string;
  fingerprint: string;
  independentReviewed: boolean;
  rules: Record<string, Metrics>;
  micro: Metrics;
  macro: { precision: number | null; recall: number | null };
  documents: {
    scored: number;
    negative: number;
    deferred: number;
    falsePositiveRate: number | null;
    lengths: number[];
  };
  cases: {
    id: string;
    counts: Counts;
    outcomes: { tp: string[]; fp: string[]; fn: string[] };
  }[];
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object");
  }

  return value as Record<string, unknown>;
}

function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.-]{1,100}$/.test(value)) {
    throw new Error("Expected a safe identifier");
  }

  return value;
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array");
  }

  return value;
}

function tuple(value: unknown, length: number, rules: string[]): Tuple {
  const item = object(value);
  const ruleId = identifier(item.ruleId);

  if (
    !rules.includes(ruleId) ||
    typeof item.start !== "number" ||
    typeof item.end !== "number" ||
    !Number.isSafeInteger(item.start) ||
    !Number.isSafeInteger(item.end) ||
    item.start < 0 ||
    item.start >= item.end ||
    item.end > length
  ) {
    throw new Error("Invalid detection tuple");
  }

  return { ruleId, start: item.start, end: item.end };
}

const key = (match: Tuple) => `${match.ruleId}:${match.start}:${match.end}`;

function unique(values: string[]): void {
  if (new Set(values).size !== values.length) {
    throw new Error("Duplicate identifier or tuple");
  }
}

export function parseCorpus(value: unknown): Corpus {
  const data = object(value);
  const revision = identifier(data.revision);

  if (data.provenance !== "independent" && data.provenance !== "synthetic") {
    throw new Error("Invalid provenance");
  }

  if (typeof data.reviewed !== "boolean") {
    throw new Error("Invalid reviewed flag");
  }

  const reviewed = data.reviewed;
  const rules = list(data.rules).map(identifier);
  unique(rules);

  if (rules.length === 0) {
    throw new Error("Rules cannot be empty");
  }

  const cases = list(data.cases).map((value): Case => {
    const row = object(value);
    const id = identifier(row.id);

    if (
      typeof row.text !== "string" ||
      (row.kind !== "supported" &&
        row.kind !== "negative" &&
        row.kind !== "deferred")
    ) {
      throw new Error("Invalid case");
    }

    const input = row.text;

    const expected = list(row.expected).map((value) =>
      tuple(value, input.length, rules),
    );

    unique(expected.map(key));

    if (row.kind !== "supported" && expected.length !== 0) {
      throw new Error(
        "Negative and deferred cases cannot declare covered occurrences",
      );
    }

    return { id, text: row.text, kind: row.kind, expected };
  });

  unique(cases.map((row) => row.id));

  return { revision, provenance: data.provenance, reviewed, rules, cases };
}

const counts = (): Counts => ({ tp: 0, fp: 0, fn: 0 });

function metrics(c: Counts): Metrics {
  return {
    ...c,
    precision: c.tp + c.fp === 0 ? null : c.tp / (c.tp + c.fp),
    recall: c.tp + c.fn === 0 ? null : c.tp / (c.tp + c.fn),
  };
}
export async function evaluate(
  corpus: Corpus,
  detect: (text: string) => readonly Tuple[] | Promise<readonly Tuple[]>,
  onProgress?: (done: number, total: number) => void,
): Promise<Report> {
  const totals = Object.fromEntries(
    corpus.rules.map((rule) => [rule, counts()]),
  );

  const cases: Report["cases"] = [];
  let fpDocuments = 0;
  const scored = corpus.cases.filter((row) => row.kind !== "deferred");
  let done = 0;

  for (const row of scored) {
    const actual = (await detect(row.text)).map((value) =>
      tuple(value, row.text.length, corpus.rules),
    );

    unique(actual.map(key));

    const expectedKeys = new Set(row.expected.map(key));
    const actualKeys = new Set(actual.map(key));
    const document = counts();

    const outcomes: Report["cases"][number]["outcomes"] = {
      tp: [],
      fp: [],
      fn: [],
    };

    for (const match of actual) {
      const field = expectedKeys.has(key(match)) ? "tp" : "fp";
      const total = totals[match.ruleId];

      if (!total) {
        throw new Error("Unknown rule");
      }

      total[field]++;
      document[field]++;
      outcomes[field].push(key(match));
    }

    for (const match of row.expected) {
      if (!actualKeys.has(key(match))) {
        const total = totals[match.ruleId];

        if (!total) {
          throw new Error("Unknown rule");
        }

        total.fn++;
        document.fn++;
        outcomes.fn.push(key(match));
      }
    }

    if (document.fp > 0) {
      fpDocuments++;
    }

    cases.push({ id: row.id, counts: document, outcomes });
    done++;
    onProgress?.(done, scored.length);
  }

  const rules = Object.fromEntries(
    Object.entries(totals).map(([id, value]) => [id, metrics(value)]),
  );

  const all = Object.values(rules);

  const mean = (field: "precision" | "recall"): number | null =>
    all.some((rule) => rule[field] === null)
      ? null
      : all.reduce((sum, rule) => sum + (rule[field] ?? 0), 0) / all.length;

  return {
    version: 1,
    revision: corpus.revision,
    fingerprint: new Bun.CryptoHasher("sha256")
      .update(JSON.stringify(corpus))
      .digest("hex"),
    independentReviewed:
      corpus.provenance === "independent" && corpus.reviewed,
    rules,
    micro: metrics(
      all.reduce(
        (sum, item) => ({
          tp: sum.tp + item.tp,
          fp: sum.fp + item.fp,
          fn: sum.fn + item.fn,
        }),
        counts(),
      ),
    ),
    macro: { precision: mean("precision"), recall: mean("recall") },
    documents: {
      scored: cases.length,
      negative: corpus.cases.filter((row) => row.kind === "negative").length,
      deferred: corpus.cases.filter((row) => row.kind === "deferred").length,
      falsePositiveRate: cases.length === 0 ? null : fpDocuments / cases.length,
      lengths: corpus.cases
        .filter((row) => row.kind !== "deferred")
        .map((row) => row.text.length),
    },
    cases,
  };
}
/** Baselines are previous reports from this tool, stored in owner-controlled review history. */
export function releaseGate(report: Report, baseline?: Report): string[] {
  const failures: string[] = [];

  if (!report.independentReviewed) {
    failures.push("Independent owner-reviewed corpus is missing");
  }

  if (report.documents.negative < 1000) {
    failures.push("At least 1000 negative documents required");
  }

  for (const rule of EVAL_RULES) {
    const score = Object.hasOwn(report.rules, rule)
      ? report.rules[rule]
      : undefined;

    if (
      !score ||
      score.tp + score.fn < 200 ||
      score.precision === null ||
      score.precision < 0.99 ||
      score.recall === null ||
      score.recall < 0.95
    ) {
      failures.push(`Coverage or quality target unmet: ${rule}`);
    }
  }

  if (!baseline) {
    failures.push("Reviewed baseline is missing");
  } else if (
    baseline.version !== 1 ||
    report.fingerprint !== baseline.fingerprint
  ) {
    failures.push(
      "Corpus changed; owner review and a new baseline are required",
    );
  } else {
    if (!baseline.independentReviewed) {
      failures.push("Baseline must use owner-reviewed independent data");
    }

    if (baseline.cases.length !== report.cases.length) {
      failures.push("Baseline case coverage differs");
    }

    const previous = new Map(
      baseline.cases.map((row) => [row.id, row.outcomes]),
    );

    for (const row of report.cases) {
      const before = previous.get(row.id);

      if (
        !before ||
        row.outcomes.fp.some((key) => !before.fp.includes(key)) ||
        row.outcomes.fn.some((key) => !before.fn.includes(key)) ||
        before.tp.some((key) => !row.outcomes.tp.includes(key))
      ) {
        failures.push(`Regression: ${row.id}`);
      }
    }
  }

  return failures;
}

/** Validate baseline fields used by the gate; ignore summaries and never copy input text. */
export function parseBaseline(value: unknown): Report {
  const data = object(value);

  if (
    data.version !== 1 ||
    typeof data.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.fingerprint)
  ) {
    throw new Error("Invalid baseline identity");
  }

  const cases = list(data.cases).map((value) => {
    const row = object(value);
    const raw = object(row.counts);
    const checked = counts();

    for (const field of ["tp", "fp", "fn"] as const) {
      const number = raw[field];

      if (
        typeof number !== "number" ||
        !Number.isSafeInteger(number) ||
        number < 0
      ) {
        throw new Error("Invalid baseline counts");
      }

      checked[field] = number;
    }

    const rawOutcomes = object(row.outcomes);

    const outcomes: Report["cases"][number]["outcomes"] = {
      tp: [],
      fp: [],
      fn: [],
    };

    for (const field of ["tp", "fp", "fn"] as const) {
      outcomes[field] = list(rawOutcomes[field]).map((value) => {
        if (
          typeof value !== "string" ||
          !/^[A-Za-z0-9_.-]{1,100}:[0-9]+:[0-9]+$/.test(value)
        ) {
          throw new Error("Invalid baseline tuple");
        }

        return value;
      });

      unique(outcomes[field]);

      if (outcomes[field].length !== checked[field]) {
        throw new Error("Baseline counts disagree with outcomes");
      }
    }

    return { id: identifier(row.id), counts: checked, outcomes };
  });

  unique(cases.map((row) => row.id));

  return {
    version: 1,
    revision: identifier(data.revision),
    fingerprint: data.fingerprint,
    independentReviewed: data.independentReviewed === true,
    cases,
    rules: {},
    micro: metrics(counts()),
    macro: { precision: null, recall: null },
    documents: {
      scored: cases.length,
      negative: 0,
      deferred: 0,
      falsePositiveRate: null,
      lengths: [],
    },
  };
}
