import { BaseKmsProvider } from "./base";

interface VaultClient {
  write(
    path: string,
    data: Record<string, unknown>,
  ): Promise<{ data: { ciphertext?: string; plaintext?: string } }>;
}

export interface HashiCorpVaultProviderOptions {
  readonly vaultUrl: string;
  readonly token: string;
  readonly keyName: string;
  readonly mountPath?: string;
}

export class HashiCorpVaultProvider extends BaseKmsProvider<VaultClient> {
  readonly name = "hashicorp-vault";
  private readonly vaultUrl: string;
  private readonly token: string;
  private readonly keyName: string;
  private readonly mountPath: string;

  constructor(options: HashiCorpVaultProviderOptions) {
    super();
    this.vaultUrl = options.vaultUrl;
    this.token = options.token;
    this.keyName = options.keyName;
    this.mountPath = options.mountPath ?? "transit";
  }

  protected async createClient(): Promise<VaultClient> {
    const vault = await import("node-vault");
    const client = vault.default({
      endpoint: this.vaultUrl,
      token: this.token,
    }) as VaultClient;
    return client;
  }

  protected async encryptRaw(plaintext: string): Promise<string> {
    const client = await this.getClient();

    const response = await client.write(
      `${this.mountPath}/encrypt/${this.keyName}`,
      {
        plaintext: Buffer.from(plaintext, "utf8").toString("base64"),
      },
    );

    if (!response.data?.ciphertext) {
      throw new Error("HashiCorp Vault returned empty ciphertext");
    }

    return response.data.ciphertext;
  }

  protected async decryptRaw(ciphertext: string): Promise<string> {
    const client = await this.getClient();

    const response = await client.write(
      `${this.mountPath}/decrypt/${this.keyName}`,
      { ciphertext },
    );

    if (!response.data?.plaintext) {
      throw new Error("HashiCorp Vault returned empty plaintext");
    }

    return Buffer.from(response.data.plaintext, "base64").toString("utf8");
  }
}
