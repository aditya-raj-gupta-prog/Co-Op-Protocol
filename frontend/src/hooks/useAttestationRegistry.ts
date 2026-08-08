"use client";

import {useCallback, useMemo} from "react";
import {useAccount, useReadContract, useReadContracts} from "wagmi";
import {attestationRegistryAbi, getAttestationRegistryAddress, isContractDeployed} from "@/config/contracts";
import {useContractTxFlow} from "./useContractTxFlow";

export interface AttestationData {
  tokenId: bigint;
  workspaceId: bigint;
  contributor: `0x${string}`;
  issuer: `0x${string}`;
  taskHash: string;
  metadataURI: string;
  issuedAt: bigint;
}

function range(count: bigint): bigint[] {
  const ids: bigint[] = [];
  for (let i = 1n; i <= count; i++) ids.push(i);
  return ids;
}

/** Every soulbound attestation ever minted, newest first. */
export function useAttestationList() {
  const {chainId} = useAccount();
  const registryAddress = getAttestationRegistryAddress(chainId);
  const registryDeployed = isContractDeployed(registryAddress);

  const {data: totalData, isLoading: isLoadingTotal} = useReadContract({
    abi: attestationRegistryAbi,
    address: registryAddress,
    functionName: "totalMinted",
    query: {enabled: registryDeployed, refetchInterval: 8000},
  });

  const total = totalData ?? 0n;
  const ids = useMemo(() => range(total), [total]);

  const {data, isLoading: isLoadingAttestations, refetch} = useReadContracts({
    contracts: ids.map((id) => ({
      abi: attestationRegistryAbi,
      address: registryAddress,
      functionName: "getAttestation",
      args: [id],
    })),
    query: {enabled: registryDeployed && ids.length > 0, refetchInterval: 8000},
  });

  const attestations = useMemo<AttestationData[]>(() => {
    if (!data) return [];
    return data
      .map((entry) => (entry.status === "success" ? (entry.result as unknown as AttestationData) : null))
      .filter((entry): entry is AttestationData => entry !== null)
      .sort((a, b) => (b.tokenId > a.tokenId ? 1 : -1));
  }, [data]);

  return {
    attestations,
    isLoading: isLoadingTotal || isLoadingAttestations,
    registryDeployed,
    refetch,
  };
}

export function useMintAttestation(onSuccess?: () => void) {
  const {chainId} = useAccount();
  const registryAddress = getAttestationRegistryAddress(chainId);
  const flow = useContractTxFlow(onSuccess);

  const mintAttestation = useCallback(
    (contributor: `0x${string}`, workspaceId: bigint, taskHash: string, metadataURI: string) =>
      flow.execute(
        {
          address: registryAddress,
          abi: attestationRegistryAbi,
          functionName: "mintAttestation",
          args: [contributor, workspaceId, taskHash, metadataURI],
        },
        {
          pendingTitle: "Minting attestation…",
          pendingDescription: taskHash,
          successTitle: "Attestation minted",
          successDescription: `Issued to ${contributor}`,
          errorTitle: "Failed to mint attestation",
        }
      ),
    [flow, registryAddress]
  );

  return {mintAttestation, ...flow};
}
