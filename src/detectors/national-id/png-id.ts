import { ContextDetector, streamMeta } from "../base";

export class PngIdDetector extends ContextDetector {
  readonly id = "png_id";
  readonly entityType = "png_id";
  readonly replacement = "[PNG_ID]";

  protected readonly pattern = /[A-Z0-9]{8,12}/gi;
  protected readonly contextLabels =
    "(?:Papua New Guinea|Papua|New Guinea|National ID)";
  protected readonly labelStrings = [
    "Papua New Guinea",
    "Papua",
    "New Guinea",
    "National ID",
  ] as const;
  protected readonly leftContext = 35;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    12,
    this.leftContext,
    this.rightContext,
  );
}

export const pngIdDetector = new PngIdDetector();
