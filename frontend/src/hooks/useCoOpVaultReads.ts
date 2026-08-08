"use client";

import {useMemo} from "react";
import {useAccount, useReadContract, useReadContracts} from "wagmi";
import {coOpVaultAbi, getCoOpVaultAddress, isContractDeployed} from "@/config/contracts";

export interface WorkspaceData {
  id: bigint;
  name: string;
  approvalThreshold: bigint;
  memberCount: bigint;
  active: boolean;
}

export interface ExpenseData {
  id: bigint;
  workspaceId: bigint;
  recipient: `0x${string}`;
  amount: bigint;
  metadataHash: string;
  approvalsCount: bigint;
  executed: boolean;
  rejected: boolean;
}

function range(count: bigint): bigint[] {
  const ids: bigint[] = [];
  for (let i = 1n; i <= count; i++) ids.push(i);
  return ids;
}

/** Every workspace ever created on the connected chain's CoOpVault, newest first. */
export function useWorkspaceList() {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const vaultDeployed = isContractDeployed(vaultAddress);

  const {data: countData, isLoading: isLoadingCount} = useReadContract({
    abi: coOpVaultAbi,
    address: vaultAddress,
    functionName: "workspaceCount",
    query: {enabled: vaultDeployed, refetchInterval: 8000},
  });

  const count = countData ?? 0n;
  const ids = useMemo(() => range(count), [count]);

  const {data, isLoading: isLoadingWorkspaces, refetch} = useReadContracts({
    contracts: ids.map((id) => ({
      abi: coOpVaultAbi,
      address: vaultAddress,
      functionName: "getWorkspace",
      args: [id],
    })),
    query: {enabled: vaultDeployed && ids.length > 0, refetchInterval: 8000},
  });

  const workspaces = useMemo<WorkspaceData[]>(() => {
    if (!data) return [];
    return data
      .map((entry) => (entry.status === "success" ? (entry.result as unknown as WorkspaceData) : null))
      .filter((entry): entry is WorkspaceData => entry !== null)
      .sort((a, b) => (b.id > a.id ? 1 : -1));
  }, [data]);

  return {
    workspaces,
    workspaceCount: count,
    isLoading: isLoadingCount || isLoadingWorkspaces,
    vaultDeployed,
    refetch,
  };
}

export function useWorkspace(workspaceId: bigint | undefined) {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const vaultDeployed = isContractDeployed(vaultAddress);
  const enabled = vaultDeployed && workspaceId !== undefined;

  const workspaceQuery = useReadContract({
    abi: coOpVaultAbi,
    address: vaultAddress,
    functionName: "getWorkspace",
    args: workspaceId !== undefined ? [workspaceId] : undefined,
    query: {enabled, refetchInterval: 6000},
  });

  const treasuryQuery = useReadContract({
    abi: coOpVaultAbi,
    address: vaultAddress,
    functionName: "treasuryOf",
    args: workspaceId !== undefined ? [workspaceId] : undefined,
    query: {enabled, refetchInterval: 6000},
  });

  const membersQuery = useReadContract({
    abi: coOpVaultAbi,
    address: vaultAddress,
    functionName: "getMembers",
    args: workspaceId !== undefined ? [workspaceId] : undefined,
    query: {enabled, refetchInterval: 8000},
  });

  const refetch = () => {
    workspaceQuery.refetch();
    treasuryQuery.refetch();
    membersQuery.refetch();
  };

  return {
    workspace: workspaceQuery.data as WorkspaceData | undefined,
    treasury: treasuryQuery.data,
    members: (membersQuery.data ?? []) as `0x${string}`[],
    isLoading: workspaceQuery.isLoading || treasuryQuery.isLoading || membersQuery.isLoading,
    refetch,
  };
}

/** Every expense proposed against a workspace, newest first. */
export function useExpenseList(workspaceId: bigint | undefined) {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const vaultDeployed = isContractDeployed(vaultAddress);

  const {data: countData, isLoading: isLoadingCount} = useReadContract({
    abi: coOpVaultAbi,
    address: vaultAddress,
    functionName: "expenseCount",
    query: {enabled: vaultDeployed, refetchInterval: 6000},
  });

  const count = countData ?? 0n;
  const ids = useMemo(() => range(count), [count]);

  const {data, isLoading: isLoadingExpenses, refetch} = useReadContracts({
    contracts: ids.map((id) => ({
      abi: coOpVaultAbi,
      address: vaultAddress,
      functionName: "getExpense",
      args: [id],
    })),
    query: {enabled: vaultDeployed && ids.length > 0, refetchInterval: 6000},
  });

  const expenses = useMemo<ExpenseData[]>(() => {
    if (!data || workspaceId === undefined) return [];
    return data
      .map((entry) => (entry.status === "success" ? (entry.result as unknown as ExpenseData) : null))
      .filter((entry): entry is ExpenseData => entry !== null && entry.workspaceId === workspaceId)
      .sort((a, b) => (b.id > a.id ? 1 : -1));
  }, [data, workspaceId]);

  return {
    expenses,
    isLoading: isLoadingCount || isLoadingExpenses,
    refetch,
  };
}

export function useIsMember(workspaceId: bigint | undefined, address: `0x${string}` | undefined) {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const enabled = isContractDeployed(vaultAddress) && workspaceId !== undefined && address !== undefined;

  const {data} = useReadContract({
    abi: coOpVaultAbi,
    address: vaultAddress,
    functionName: "isMember",
    args: workspaceId !== undefined && address !== undefined ? [workspaceId, address] : undefined,
    query: {enabled},
  });

  return Boolean(data);
}

export function useHasApproved(expenseId: bigint | undefined, address: `0x${string}` | undefined) {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const enabled = isContractDeployed(vaultAddress) && expenseId !== undefined && address !== undefined;

  const {data} = useReadContract({
    abi: coOpVaultAbi,
    address: vaultAddress,
    functionName: "hasApproved",
    args: expenseId !== undefined && address !== undefined ? [expenseId, address] : undefined,
    query: {enabled, refetchInterval: 6000},
  });

  return Boolean(data);
}
