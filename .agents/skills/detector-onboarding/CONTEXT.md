# Detector onboarding skill

This skill provides an invocable, reproducible workflow for contributing new
detectors to sensored. It is the contributor-facing entry point for the
detector extension contract defined in `src/types.ts` (`DetectorDefinition`)
and the independent evaluation process in `eval/`.

## Relationship to the detector contract

The skill documents the public extension contract: required fields (`id`,
`entityType`, `replacement`, `pattern`), optional fields (`context`, `stream`,
`validate`), grapheme alignment enforcement, and adjacent character checks.
It references `src/employee-id.ts` as the canonical extension example and
`src/ssn.ts` / `src/payment-card.ts` as built-in detector references.

## Relationship to eval tooling

The skill covers the eval workflow (`eval/cli.ts` score and gate commands),
corpus schema (`eval/README.md`), the release gate (`eval/evaluator.ts`
`releaseGate`), and the trust boundary between implementer fixtures and
independent owner-reviewed corpus data. It enforces that expectations cannot
be silently weakened to pass the gate.

## What this skill is not

This skill does not replace maintainer review. It does not manufacture
independent evaluation evidence. It does not auto-refresh baselines or
bypass release gates. It is a workflow guide, not an automated approval
process.
