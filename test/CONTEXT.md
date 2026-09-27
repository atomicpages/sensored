# Regression tests

Bun tests exercise complete-string output, malformed address rejection, UTF-16
reports, immutable configuration, safe errors and configurable input limits.
Transformation tests cover graphemes, preservation overflow, transitive overlaps,
precedence, replacement conflicts, adjacency, and trusted custom detector
context/span contracts. All custom behavior is tested through createRedactor.
These implementer fixtures are not independent evaluation evidence.
