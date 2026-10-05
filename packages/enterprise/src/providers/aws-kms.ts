import { VaultError } from "sensored/vault";
import { BaseKmsProvider } from "./base";

interface KmsResponse {
  readonly CiphertextBlob?: Uint8Array;
  readonly Plaintext?: Uint8Array;
}

interface KmsClient {
  send(command: unknown): Promise<KmsResponse>;
}

export interface AwsKmsProviderOptions {
  readonly keyId: string;
  readonly region?: string;
  readonly credentials?: {
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly sessionToken?: string;
  };
}

export class AwsKmsProvider extends BaseKmsProvider<KmsClient> {
  readonly name = "aws-kms";
  private readonly keyId: string;
  private readonly region?: string;
  private readonly credentials?: AwsKmsProviderOptions["credentials"];

  constructor(options: AwsKmsProviderOptions) {
    super();
    this.keyId = options.keyId;
    this.region = options.region;
    this.credentials = options.credentials;
  }

  protected async createClient(): Promise<KmsClient> {
    const { KMSClient } = await import("@aws-sdk/client-kms");
    const config: Record<string, unknown> = {};

    if (this.region) {
      config.region = this.region;
    }

    if (this.credentials) {
      config.credentials = this.credentials;
    }

    return new KMSClient(config) as KmsClient;
  }

  protected async encryptRaw(plaintext: string): Promise<string> {
    const client = await this.getClient();
    const { EncryptCommand } = await import("@aws-sdk/client-kms");

    const response = await client.send(
      new EncryptCommand({
        KeyId: this.keyId,
        Plaintext: Buffer.from(plaintext, "utf8"),
      }),
    );

    if (!response.CiphertextBlob) {
      throw new Error("AWS KMS returned empty ciphertext");
    }

    return Buffer.from(response.CiphertextBlob).toString("base64");
  }

  protected async decryptRaw(ciphertext: string): Promise<string> {
    const client = await this.getClient();
    const { DecryptCommand } = await import("@aws-sdk/client-kms");

    const response = await client.send(
      new DecryptCommand({
        KeyId: this.keyId,
        CiphertextBlob: Buffer.from(ciphertext, "base64"),
      }),
    );

    if (!response.Plaintext) {
      throw new Error("AWS KMS returned empty plaintext");
    }

    return Buffer.from(response.Plaintext).toString("utf8");
  }

  override async generateDataKey(): Promise<{
    plaintext: string;
    encrypted: string;
  }> {
    try {
      const client = await this.getClient();
      const { GenerateDataKeyCommand } = await import("@aws-sdk/client-kms");

      const response = await client.send(
        new GenerateDataKeyCommand({
          KeyId: this.keyId,
          KeySpec: "AES_256",
        }),
      );

      if (!response.Plaintext || !response.CiphertextBlob) {
        throw new Error("AWS KMS returned incomplete data key");
      }

      return {
        plaintext: Buffer.from(response.Plaintext).toString("base64"),
        encrypted: Buffer.from(response.CiphertextBlob).toString("base64"),
      };
    } catch (e) {
      if (e instanceof VaultError) {
        throw e;
      }
      throw new VaultError("VAULT_DEK_GENERATION_FAILED", e);
    }
  }

  override async decryptDataKey(encrypted: string): Promise<string> {
    try {
      const client = await this.getClient();
      const { DecryptCommand } = await import("@aws-sdk/client-kms");

      const response = await client.send(
        new DecryptCommand({
          KeyId: this.keyId,
          CiphertextBlob: Buffer.from(encrypted, "base64"),
        }),
      );

      if (!response.Plaintext) {
        throw new Error("AWS KMS returned empty plaintext");
      }

      return Buffer.from(response.Plaintext).toString("base64");
    } catch (e) {
      if (e instanceof VaultError) {
        throw e;
      }
      throw new VaultError("VAULT_DEK_DECRYPT_FAILED", e);
    }
  }
}
