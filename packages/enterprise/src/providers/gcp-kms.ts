import { BaseKmsProvider } from "./base";

interface GcpKmsClient {
  encrypt(request: {
    name: string;
    plaintext: Buffer;
  }): Promise<[{ ciphertext: Buffer | null }]>;
  decrypt(request: {
    name: string;
    ciphertext: Buffer;
  }): Promise<[{ plaintext: Buffer | null }]>;
}

export interface GcpKmsProviderOptions {
  readonly keyName: string;
  readonly credentialsJson?: string;
}

export class GcpKmsProvider extends BaseKmsProvider<GcpKmsClient> {
  readonly name = "gcp-kms";
  private readonly keyName: string;
  private readonly credentialsJson?: string;

  constructor(options: GcpKmsProviderOptions) {
    super();
    this.keyName = options.keyName;
    this.credentialsJson = options.credentialsJson;
  }

  protected async createClient(): Promise<GcpKmsClient> {
    const { KeyManagementServiceClient } = await import("@google-cloud/kms");
    const opts: Record<string, unknown> = {};
    if (this.credentialsJson) {
      opts.credentials = JSON.parse(this.credentialsJson);
    }
    return new KeyManagementServiceClient(
      opts as never,
    ) as unknown as GcpKmsClient;
  }

  protected async encryptRaw(plaintext: string): Promise<string> {
    const client = await this.getClient();
    const [response] = await client.encrypt({
      name: this.keyName,
      plaintext: Buffer.from(plaintext, "utf8"),
    });
    if (!response.ciphertext) {
      throw new Error("GCP KMS returned empty ciphertext");
    }
    return Buffer.from(response.ciphertext).toString("base64");
  }

  protected async decryptRaw(ciphertext: string): Promise<string> {
    const client = await this.getClient();
    const [response] = await client.decrypt({
      name: this.keyName,
      ciphertext: Buffer.from(ciphertext, "base64"),
    });
    if (!response.plaintext) {
      throw new Error("GCP KMS returned empty plaintext");
    }
    return Buffer.from(response.plaintext).toString("utf8");
  }
}
