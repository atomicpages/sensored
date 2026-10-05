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
  target: "es2022",
  unbundle: true,
  publint: true,
  attw: true,
  clean: true,
  sourcemap: true,
});
