export type { VaultProvider } from "sensored/vault";

export type { CompositeAuditSinkOptions } from "./audit/composite-sink";
export { CompositeAuditSink } from "./audit/composite-sink";

export type {
  CounterLike,
  MeterLike,
  MeterProviderLike,
  OtelMetricsSinkOptions,
} from "./audit/otel-metrics-sink";
export { OtelMetricsSink } from "./audit/otel-metrics-sink";

export type {
  LoggerLike,
  LoggerProviderLike,
  OtelAuditSinkOptions,
} from "./audit/otel-sink";
export { OtelAuditSink } from "./audit/otel-sink";

export { createLangfuseMaskFunction } from "./langfuse/mask-adapter";
export { SensoredLogRecordProcessor } from "./otel/log-processor";
export type { RedactionConfig } from "./otel/redaction-utils";
export {
  redactStringAttributes,
  shouldRedactAttribute,
} from "./otel/redaction-utils";
export { SensoredSpanProcessor } from "./otel/span-processor";

export { AwsKmsProvider } from "./providers/aws-kms";
export { AzureKeyVaultProvider } from "./providers/azure-key-vault";
export { GcpKmsProvider } from "./providers/gcp-kms";
export { HashiCorpVaultProvider } from "./providers/hashicorp-vault";
export { WorkOsEkmProvider } from "./providers/workos-ekm";
