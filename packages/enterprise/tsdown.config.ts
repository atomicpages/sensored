import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/providers/aws-kms.ts",
    "src/providers/gcp-kms.ts",
    "src/providers/azure-key-vault.ts",
    "src/providers/hashicorp-vault.ts",
    "src/providers/workos-ekm.ts",
  ],
  format: "esm",
  dts: true,
  exports: {
    customExports(generated) {
      const kmsMap: Record<string, string> = {
        "./providers/aws-kms": "./kms/aws",
        "./providers/gcp-kms": "./kms/gcp",
        "./providers/azure-key-vault": "./kms/azure",
        "./providers/hashicorp-vault": "./kms/hashicorp",
        "./providers/workos-ekm": "./kms/workos",
      };

      const clean: Record<string, string> = {};

      for (const [key, value] of Object.entries(generated)) {
        clean[kmsMap[key] ?? key] = value;
      }

      return clean;
    },
  },
  target: "es2022",
  unbundle: true,
  publint: true,
  attw: true,
  clean: true,
  sourcemap: true,
});
