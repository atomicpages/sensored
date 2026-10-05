import { BaseKmsProvider } from "./base";

interface AzureCryptoClient {
  encrypt(request: {
    algorithm: string;
    plaintext: Buffer;
  }): Promise<{ result: Buffer | null }>;
  decrypt(request: {
    algorithm: string;
    ciphertext: Buffer;
  }): Promise<{ result: Buffer | null }>;
}

export interface AzureKeyVaultProviderOptions {
  readonly vaultUrl: string;
  readonly keyName: string;
  readonly credential?: unknown;
}

export class AzureKeyVaultProvider extends BaseKmsProvider<AzureCryptoClient> {
  readonly name = "azure-key-vault";
  private readonly vaultUrl: string;
  private readonly keyName: string;
  private readonly credential?: unknown;

  constructor(options: AzureKeyVaultProviderOptions) {
    super();

    this.vaultUrl = options.vaultUrl;
    this.keyName = options.keyName;
    this.credential = options.credential;
  }

  protected async createClient(): Promise<AzureCryptoClient> {
    const { DefaultAzureCredential } = await import("@azure/identity");

    const { KeyClient, CryptographyClient } = await import(
      "@azure/keyvault-keys"
    );

    const credential = this.credential ?? new DefaultAzureCredential();
    const keyClient = new KeyClient(this.vaultUrl, credential as never);
    const key = await keyClient.getKey(this.keyName);

    return new CryptographyClient(
      key,
      credential as never,
    ) as unknown as AzureCryptoClient;
  }

  protected async encryptRaw(plaintext: string): Promise<string> {
    const client = await this.getClient();

    const result = await client.encrypt({
      algorithm: "RSA-OAEP-256",
      plaintext: Buffer.from(plaintext, "utf8"),
    });

    if (!result.result) {
      throw new Error("Azure Key Vault returned empty ciphertext");
    }

    return Buffer.from(result.result).toString("base64");
  }

  protected async decryptRaw(ciphertext: string): Promise<string> {
    const client = await this.getClient();

    const result = await client.decrypt({
      algorithm: "RSA-OAEP-256",
      ciphertext: Buffer.from(ciphertext, "base64"),
    });

    if (!result.result) {
      throw new Error("Azure Key Vault returned empty plaintext");
    }

    return Buffer.from(result.result).toString("utf8");
  }
}
