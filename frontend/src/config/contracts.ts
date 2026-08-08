import type {Address} from "viem";
import {arbitrumSepolia, baseSepolia, sepolia} from "wagmi/chains";
import {anvilLocal} from "./wagmi";
import {attestationRegistryAbi} from "./abis/AttestationRegistry";
import {coOpVaultAbi} from "./abis/CoOpVault";
import deploymentConfig from "./contracts.json";

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

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
 * by export-abi.ts post-deployment), then falls back to environment variables.
 * Until set, every chain resolves to the zero address and writes will revert.
 */
export const coOpVaultAddresses: Record<number, Address> = {
  [anvilLocal.id]: getAddressFromConfig("anvil", "coOpVault") || envAddress("NEXT_PUBLIC_COOP_VAULT_ADDRESS_ANVIL") || ZERO_ADDRESS,
  [sepolia.id]: getAddressFromConfig("sepolia", "coOpVault") || envAddress("NEXT_PUBLIC_COOP_VAULT_ADDRESS_SEPOLIA") || ZERO_ADDRESS,
  [baseSepolia.id]: getAddressFromConfig("baseSepolia", "coOpVault") || envAddress("NEXT_PUBLIC_COOP_VAULT_ADDRESS_BASE_SEPOLIA") || ZERO_ADDRESS,
  [arbitrumSepolia.id]: getAddressFromConfig("arbitrumSepolia", "coOpVault") || envAddress("NEXT_PUBLIC_COOP_VAULT_ADDRESS_ARBITRUM_SEPOLIA") || ZERO_ADDRESS,
};

export const attestationRegistryAddresses: Record<number, Address> = {
  [anvilLocal.id]: getAddressFromConfig("anvil", "attestationRegistry") || envAddress("NEXT_PUBLIC_ATTESTATION_REGISTRY_ADDRESS_ANVIL") || ZERO_ADDRESS,
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
