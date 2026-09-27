# Person Name Detectors

## person_name

Person name detection using compromise.js Named Entity Recognition. Requires
the optional `compromise` peer dependency.

```bash
bun add compromise
```

```ts
const redactor = createRedactor({
  rules: { person_name: { action: "redact" } },
});

redactor.redact("The meeting was chaired by Dr. Sarah Johnson.");
// "The meeting was chaired by [PERSON_NAME_1]."
```

- **ID**: `person_name`
- **Entity type**: `person_name`
- **Context required**: No
- **Stream supported**: Yes (maxMatchLength: 40)
- **Validation**: compromise.js NER
- **Detection reason**: `person_name.ner`

::: warning Performance impact
The `person_name` detector adds ~178 MiB RSS and reduces throughput by ~4
orders of magnitude (0.06 MiB/s vs 505 MiB/s without it). Only use this when
you need maximum recall and can accept the performance trade-off.
:::

### Not in any preset

`person_name` is opt-in only. It's not included in any built-in preset.
You must add an explicit rule to enable it.

### Trailing punctuation

This detector trims trailing punctuation (unless the last term is an
abbreviation like "Jr.") and possessive `'s`.

## person_name_lite

Lightweight person name detection using regex candidate discovery and a bloom
filter. No runtime dependencies.

The regex finds candidate sequences (optional honorific + 1–4 capitalized
words + optional suffix). Single-word names are only matched with an honorific
prefix. Multi-word names require at least one word in the bloom filter AND not
in the stopword set.

The bloom filter contains 99,236 unique lowercase names sourced from
wikidata-names, compromise lexicon, and faker Latin locales. It uses FNV-1a +
DJB2 double hashing with a measured false positive rate of ~0.1%.

```ts
const redactor = createRedactor({
  rules: { person_name_lite: { action: "redact" } },
});

redactor.redact("Send the report to John Smith.");
// "Send the report to [PERSON_NAME_1]."
```

- **ID**: `person_name_lite`
- **Entity type**: `person_name_lite`
- **Context required**: No
- **Stream supported**: Yes (maxMatchLength: 40)
- **Validation**: Bloom filter membership + stopword exclusion
- **Detection reason**: `person_name_lite.bloom`

### Performance

The `person_name_lite` detector adds negligible overhead — no NLP dependency is
required. Throughput remains at ~10 MiB/s with this detector active.

### Trailing punctuation

The detector trims trailing punctuation and possessive `'s` from matches.
