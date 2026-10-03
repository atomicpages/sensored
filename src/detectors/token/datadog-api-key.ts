import { KeywordDetector } from "../base";

export class DatadogApiKeyDetector extends KeywordDetector {
  readonly id = "datadog_api_key";
  readonly entityType = "datadog_api_key";
  readonly replacement = "[DATADOG_API_KEY]";

  override readonly stream = Object.freeze({
    maxMatchLength: 40,
    leftContext: 40,
    rightContext: 40,
    boundaryLookaround: 1,
  });

  protected readonly pattern = /[a-zA-Z0-9]{40}|[a-zA-Z0-9]{32}/;
  protected readonly keywords = ["datadog", "dd"] as const;
}

export const datadogApiKeyDetector = new DatadogApiKeyDetector();
