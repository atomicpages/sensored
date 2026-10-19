import { BaseKmsProvider } from "./base";

interface WorkOsEkmClient {
  vault: {
    encrypt(data: string, context: unknown): Promise<string>;
    decrypt(encryptedData: string): Promise<string>;
  };
}

export interface WorkOsEkmProviderOptions {
  readonly apiKey: string;
  readonly ekmId: string;
  readonly keyId: string;
}

export class WorkOsEkmProvider extends BaseKmsProvider<WorkOsEkmClient> {
  readonly name = "workos-ekm";
  private readonly apiKey: string;
  private readonly ekmId: string;
  private readonly keyId: string;

  constructor(options: WorkOsEkmProviderOptions) {
    super();
    this.apiKey = options.apiKey;
    this.ekmId = options.ekmId;
    this.keyId = options.keyId;
  }

  protected async createClient(): Promise<WorkOsEkmClient> {
    const { WorkOS } = await import("@workos-inc/node");
    return new WorkOS(this.apiKey) as unknown as WorkOsEkmClient;
  }

  protected async encryptRaw(plaintext: string): Promise<string> {
    const client = await this.getClient();

    return client.vault.encrypt(
      Buffer.from(plaintext, "utf8").toString("base64"),
      { ekmId: this.ekmId, keyId: this.keyId },
    );
  }

  protected async decryptRaw(ciphertext: string): Promise<string> {
    const client = await this.getClient();

    const plaintext = await client.vault.decrypt(ciphertext);
    return Buffer.from(plaintext, "base64").toString("utf8");
  }
}
