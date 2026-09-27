import { ContextDetector, streamMeta } from "../base";

export class SwiftBicDetector extends ContextDetector {
  readonly id = "swift_bic";
  readonly entityType = "swift_bic";
  readonly replacement = "[SWIFT_BIC]";

  protected readonly pattern = /[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?/g;
  protected readonly contextLabels = "(?:swift|bic|bank[- ]?code)";
  protected readonly labelStrings = ["swift", "bic", "bank code"] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 40;

  override readonly stream = streamMeta(
    11,
    this.leftContext,
    this.rightContext,
  );
}

export const swiftBicDetector = new SwiftBicDetector();
