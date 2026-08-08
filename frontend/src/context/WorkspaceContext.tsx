"use client";

import {createContext, useContext, useMemo, useState} from "react";
import {useAccount, useReadContract} from "wagmi";
import {coOpVaultAbi, getCoOpVaultAddress, isContractDeployed} from "@/config/contracts";

interface WorkspaceContextValue {
  /** Currently selected workspace id, or undefined once none exist yet. */
  selectedWorkspaceId: bigint | undefined;
  setSelectedWorkspaceId: (id: bigint | undefined) => void;
  /** Total workspaces created on the connected chain's CoOpVault deployment. */
  workspaceCount: bigint;
  isLoadingWorkspaceCount: boolean;
  vaultAddress: `0x${string}`;
  vaultDeployed: boolean;
  refetchWorkspaceCount: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({children}: {children: React.ReactNode}) {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const vaultDeployed = isContractDeployed(vaultAddress);

  // Raw user pick, if any. The effective selection (below) falls back to the
  // most recently created workspace whenever this is unset or points past
  // the current workspace count.
  const [userSelectedWorkspaceId, setUserSelectedWorkspaceId] = useState<bigint | undefined>(undefined);

  const {
    data: workspaceCountData,
    isLoading: isLoadingWorkspaceCount,
    refetch: refetchWorkspaceCount,
  } = useReadContract({
    abi: coOpVaultAbi,
    address: vaultAddress,
    functionName: "workspaceCount",
    query: {enabled: vaultDeployed, refetchInterval: 8000},
  });

  const workspaceCount = workspaceCountData ?? 0n;

  const selectedWorkspaceId = useMemo(() => {
    if (
      userSelectedWorkspaceId !== undefined &&
      userSelectedWorkspaceId > 0n &&
      userSelectedWorkspaceId <= workspaceCount
    ) {
      return userSelectedWorkspaceId;
    }
    return workspaceCount > 0n ? workspaceCount : undefined;
  }, [userSelectedWorkspaceId, workspaceCount]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      selectedWorkspaceId,
      setSelectedWorkspaceId: setUserSelectedWorkspaceId,
      workspaceCount,
      isLoadingWorkspaceCount,
      vaultAddress,
      vaultDeployed,
      refetchWorkspaceCount,
    }),
    [selectedWorkspaceId, workspaceCount, isLoadingWorkspaceCount, vaultAddress, vaultDeployed, refetchWorkspaceCount]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspaceContext must be used within a WorkspaceProvider");
  return context;
}
