#!/usr/bin/env node

/**
 * Exports compiled ABIs and deployment addresses to a JSON file readable by the frontend.
 * Run after `forge build` and deployment.
 *
 * Usage:
 *   npx ts-node contracts/script/export-abi.ts \
 *     --vault 0x5FbDB2315678afccB33F46c0c4A8f22b1e6bd5ef \
 *     --registry 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 \
 *     --chain anvil
 */

import * as fs from "fs";
import * as path from "path";

interface DeploymentConfig {
  anvil: Record<string, string>;
  sepolia: Record<string, string>;
  baseSepolia: Record<string, string>;
  arbitrumSepolia: Record<string, string>;
}

const args = process.argv.slice(2);
const vaultArg = args[args.indexOf("--vault") + 1];
const registryArg = args[args.indexOf("--registry") + 1];
const chainArg = args[args.indexOf("--chain") + 1] || "anvil";

const contractsDir = path.join(__dirname, "..");
const coOpVaultJson = JSON.parse(
  fs.readFileSync(path.join(contractsDir, "out", "CoOpVault.sol", "CoOpVault.json"), "utf-8")
);
const attestationRegistryJson = JSON.parse(
  fs.readFileSync(path.join(contractsDir, "out", "AttestationRegistry.sol", "AttestationRegistry.json"), "utf-8")
);

const outputPath = path.join(__dirname, "..", "..", "frontend", "src", "config", "contracts.json");
const outputDir = path.dirname(outputPath);

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, {recursive: true});
}

let config: DeploymentConfig;
if (fs.existsSync(outputPath)) {
  config = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
} else {
  config = {
    anvil: {},
    sepolia: {},
    baseSepolia: {},
    arbitrumSepolia: {},
  };
}

if (vaultArg && registryArg && chainArg) {
  config[chainArg as keyof DeploymentConfig] = {
    coOpVault: vaultArg.toLowerCase(),
    attestationRegistry: registryArg.toLowerCase(),
  };

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        ...config,
        abis: {
          coOpVault: coOpVaultJson.abi,
          attestationRegistry: attestationRegistryJson.abi,
        },
      },
      null,
      2
    )
  );

  console.log(`✓ Exported ABIs and addresses to ${outputPath}`);
  console.log(`  ${chainArg}: vault=${vaultArg}, registry=${registryArg}`);
} else {
  console.error("Usage: ts-node export-abi.ts --vault <addr> --registry <addr> --chain <chain>");
  process.exit(1);
}
