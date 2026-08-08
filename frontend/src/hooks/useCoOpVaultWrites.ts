"use client";

import {useCallback} from "react";
import {useAccount} from "wagmi";
import {coOpVaultAbi, getCoOpVaultAddress} from "@/config/contracts";
import {useContractTxFlow} from "./useContractTxFlow";

export function useCreateWorkspace(onSuccess?: () => void) {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const flow = useContractTxFlow(onSuccess);

  const createWorkspace = useCallback(
    (name: string, initialMembers: `0x${string}`[], threshold: bigint) =>
      flow.execute(
        {
          address: vaultAddress,
          abi: coOpVaultAbi,
          functionName: "createWorkspace",
          args: [name, initialMembers, threshold],
        },
        {
          pendingTitle: "Creating workspace…",
          pendingDescription: name,
          successTitle: "Workspace created",
          successDescription: name,
          errorTitle: "Failed to create workspace",
        }
      ),
    [flow, vaultAddress]
  );

  return {createWorkspace, ...flow};
}

export function useDeposit(onSuccess?: () => void) {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const flow = useContractTxFlow(onSuccess);

  const deposit = useCallback(
    (workspaceId: bigint, amountWei: bigint, amountLabel: string) =>
      flow.execute(
        {address: vaultAddress, abi: coOpVaultAbi, functionName: "deposit", args: [workspaceId], value: amountWei},
        {
          pendingTitle: "Depositing funds…",
          pendingDescription: `${amountLabel} to workspace #${workspaceId}`,
          successTitle: "Deposit confirmed",
          successDescription: `${amountLabel} added to the treasury`,
          errorTitle: "Deposit failed",
        }
      ),
    [flow, vaultAddress]
  );

  return {deposit, ...flow};
}

export function useCreateExpense(onSuccess?: () => void) {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const flow = useContractTxFlow(onSuccess);

  const createExpense = useCallback(
    (workspaceId: bigint, recipient: `0x${string}`, amountWei: bigint, metadataHash: string) =>
      flow.execute(
        {
          address: vaultAddress,
          abi: coOpVaultAbi,
          functionName: "createExpense",
          args: [workspaceId, recipient, amountWei, metadataHash],
        },
        {
          pendingTitle: "Submitting proposal…",
          pendingDescription: metadataHash,
          successTitle: "Proposal submitted",
          successDescription: "Members can now vote to approve it",
          errorTitle: "Failed to submit proposal",
        }
      ),
    [flow, vaultAddress]
  );

  return {createExpense, ...flow};
}

export function useApproveExpense(onSuccess?: () => void) {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const flow = useContractTxFlow(onSuccess);

  const approveExpense = useCallback(
    (expenseId: bigint) =>
      flow.execute(
        {address: vaultAddress, abi: coOpVaultAbi, functionName: "approveExpense", args: [expenseId]},
        {
          pendingTitle: "Approving expense…",
          pendingDescription: `Expense #${expenseId}`,
          successTitle: "Approval recorded",
          successDescription: "Payout executes automatically once the threshold is met",
          errorTitle: "Approval failed",
        }
      ),
    [flow, vaultAddress]
  );

  return {approveExpense, ...flow};
}

export function useExecuteExpense(onSuccess?: () => void) {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const flow = useContractTxFlow(onSuccess);

  const executeExpense = useCallback(
    (expenseId: bigint) =>
      flow.execute(
        {address: vaultAddress, abi: coOpVaultAbi, functionName: "executeExpense", args: [expenseId]},
        {
          pendingTitle: "Executing payout…",
          pendingDescription: `Expense #${expenseId}`,
          successTitle: "Payout executed",
          successDescription: "Funds transferred to the recipient",
          errorTitle: "Execution failed",
        }
      ),
    [flow, vaultAddress]
  );

  return {executeExpense, ...flow};
}

export function useRejectExpense(onSuccess?: () => void) {
  const {chainId} = useAccount();
  const vaultAddress = getCoOpVaultAddress(chainId);
  const flow = useContractTxFlow(onSuccess);

  const rejectExpense = useCallback(
    (expenseId: bigint) =>
      flow.execute(
        {address: vaultAddress, abi: coOpVaultAbi, functionName: "rejectExpense", args: [expenseId]},
        {
          pendingTitle: "Rejecting expense…",
          pendingDescription: `Expense #${expenseId}`,
          successTitle: "Expense rejected",
          errorTitle: "Rejection failed",
        }
      ),
    [flow, vaultAddress]
  );

  return {rejectExpense, ...flow};
}
