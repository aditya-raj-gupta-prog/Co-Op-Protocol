import type {Address} from "viem";
import {arbitrumSepolia, baseSepolia, sepolia} from "wagmi/chains";
import {anvilLocal} from "./wagmi";
import {attestationRegistryAbi} from "./abis/AttestationRegistry";
import {coOpVaultAbi} from "./abis/CoOpVault";
import deploymentConfig from "./contracts.json";

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

/**
 * Hardcoded fallbacks for the local Anvil deployment (chain id 31337). These are
 * the deterministic CREATE addresses produced by `forge script script/Deploy.s.sol`
 * when broadcast from Anvil's default account 0 on a fresh chain — the same
 * addresses SeedDemo.s.sol hardcodes as VAULT_ADDR/REGISTRY_ADDR. They keep the
 * app usable out of the box (locally and on Vercel demo deploys) even if
 * contracts.json hasn't been regenerated and env vars aren't set.
 */
const ANVIL_COOP_VAULT_FALLBACK: Address = "0x5FbDB2315678afccB33F46c0c4A8f22b1e6bd5ef";
const ANVIL_ATTESTATION_REGISTRY_FALLBACK: Address = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

function envAddress(name: string): Address | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  return value as Address;
}

function getAddressFromConfig(chain: "anvil" | "sepolia" | "baseSepolia" | "arbitrumSepolia", contract: "coOpVault" | "attestationRegistry"): Address {
  const addr = deploymentConfig[chain]?.[contract];
  if (addr && addr !== ZERO_ADDRESS) return addr as Address;
  return ZERO_ADDRESS;
}

/**
 * Deployment addresses per chain id. Reads from contracts.json first (generated
 * by export-abi.ts post-deployment), then falls back to environment variables,
 * then (for Anvil only) to the known local-deployment addresses above. Testnet
 * chains without a real deployment still resolve to the zero address.
 */
export const coOpVaultAddresses: Record<number, Address> = {
  [anvilLocal.id]: getAddressFromConfig("anvil", "coOpVault") || envAddress("NEXT_PUBLIC_COOP_VAULT_ADDRESS_ANVIL") || ANVIL_COOP_VAULT_FALLBACK,
  [sepolia.id]: getAddressFromConfig("sepolia", "coOpVault") || envAddress("NEXT_PUBLIC_COOP_VAULT_ADDRESS_SEPOLIA") || ZERO_ADDRESS,
  [baseSepolia.id]: getAddressFromConfig("baseSepolia", "coOpVault") || envAddress("NEXT_PUBLIC_COOP_VAULT_ADDRESS_BASE_SEPOLIA") || ZERO_ADDRESS,
  [arbitrumSepolia.id]: getAddressFromConfig("arbitrumSepolia", "coOpVault") || envAddress("NEXT_PUBLIC_COOP_VAULT_ADDRESS_ARBITRUM_SEPOLIA") || ZERO_ADDRESS,
};

export const attestationRegistryAddresses: Record<number, Address> = {
  [anvilLocal.id]: getAddressFromConfig("anvil", "attestationRegistry") || envAddress("NEXT_PUBLIC_ATTESTATION_REGISTRY_ADDRESS_ANVIL") || ANVIL_ATTESTATION_REGISTRY_FALLBACK,
  [sepolia.id]: getAddressFromConfig("sepolia", "attestationRegistry") || envAddress("NEXT_PUBLIC_ATTESTATION_REGISTRY_ADDRESS_SEPOLIA") || ZERO_ADDRESS,
  [baseSepolia.id]: getAddressFromConfig("baseSepolia", "attestationRegistry") || envAddress("NEXT_PUBLIC_ATTESTATION_REGISTRY_ADDRESS_BASE_SEPOLIA") || ZERO_ADDRESS,
  [arbitrumSepolia.id]: getAddressFromConfig("arbitrumSepolia", "attestationRegistry") || envAddress("NEXT_PUBLIC_ATTESTATION_REGISTRY_ADDRESS_ARBITRUM_SEPOLIA") || ZERO_ADDRESS,
};

export function getCoOpVaultAddress(chainId: number | undefined): Address {
  return coOpVaultAddresses[chainId ?? anvilLocal.id] ?? ZERO_ADDRESS;
}

export function getAttestationRegistryAddress(chainId: number | undefined): Address {
  return attestationRegistryAddresses[chainId ?? anvilLocal.id] ?? ZERO_ADDRESS;
}

export function isContractDeployed(address: Address): boolean {
  return address !== ZERO_ADDRESS;
}

export {attestationRegistryAbi, coOpVaultAbi};
