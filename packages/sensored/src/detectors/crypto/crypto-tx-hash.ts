import { ContextDetector, streamMeta } from "../base";

export class CryptoTxHashDetector extends ContextDetector {
  readonly id = "crypto_tx_hash";
  readonly entityType = "crypto_tx_hash";
  readonly replacement = "[CRYPTO_TX_HASH]";

  protected readonly pattern = /[0-9a-fA-F]{64}/g;
  protected readonly contextLabels =
    "(?:Transaction|Tx Hash|Transaction ID|Transaction Hash|Blockchain Transaction|TXID)";
  protected readonly labelStrings = [
    "Transaction",
    "Tx Hash",
    "Transaction ID",
    "Transaction Hash",
    "Blockchain Transaction",
    "TXID",
  ] as const;
  protected readonly leftContext = 40;
  protected readonly rightContext = 20;

  override readonly stream = streamMeta(
    64,
    this.leftContext,
    this.rightContext,
  );
}

export const cryptoTxHashDetector = new CryptoTxHashDetector();
