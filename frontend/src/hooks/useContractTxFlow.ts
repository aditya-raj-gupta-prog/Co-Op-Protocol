"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import type {Abi} from "viem";
import {useWaitForTransactionReceipt, useWriteContract} from "wagmi";
import {useToast} from "@/components/ui/Toast";
import {extractErrorMessage} from "@/lib/errors";

interface WriteParams {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

interface FlowLabels {
  pendingTitle: string;
  pendingDescription?: string;
  successTitle: string;
  successDescription?: string;
  errorTitle: string;
}

/**
 * Wraps a single wagmi write call with toast feedback across every phase:
 * wallet signature request, mempool confirmation, and final success/failure.
 * One instance tracks one in-flight transaction, so call this once per
 * write action (e.g. inside each "Approve" button) rather than sharing it.
 */
export function useContractTxFlow(onSuccess?: () => void) {
  const {push, dismiss} = useToast();
  const {writeContractAsync, isPending: isSigning, reset: resetWrite} = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>();
  const labelsRef = useRef<FlowLabels | null>(null);
  const pendingToastIdRef = useRef<number | null>(null);
  const settledRef = useRef(false);

  const {
    isLoading: isConfirming,
    isSuccess: receiptSuccess,
    isError: receiptFailed,
    error: receiptError,
  } = useWaitForTransactionReceipt({hash, query: {enabled: Boolean(hash)}});

  useEffect(() => {
    if (!hash || settledRef.current) return;
    if (receiptSuccess) {
      settledRef.current = true;
      if (pendingToastIdRef.current !== null) dismiss(pendingToastIdRef.current);
      push({
        title: labelsRef.current?.successTitle ?? "Transaction confirmed",
        description: labelsRef.current?.successDescription,
        variant: "success",
      });
      onSuccess?.();
    } else if (receiptFailed) {
      settledRef.current = true;
      if (pendingToastIdRef.current !== null) dismiss(pendingToastIdRef.current);
      push({
        title: labelsRef.current?.errorTitle ?? "Transaction failed",
        description: extractErrorMessage(receiptError),
        variant: "error",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash, receiptSuccess, receiptFailed, receiptError]);

  const execute = useCallback(
    async (params: WriteParams, labels: FlowLabels) => {
      labelsRef.current = labels;
      settledRef.current = false;
      resetWrite();
      const toastId = push({
        title: labels.pendingTitle,
        description: labels.pendingDescription,
        variant: "pending",
        duration: 0,
      });
      pendingToastIdRef.current = toastId;
      try {
        const txHash = await writeContractAsync(params);
        setHash(txHash);
        return txHash;
      } catch (err) {
        settledRef.current = true;
        dismiss(toastId);
        push({title: labels.errorTitle, description: extractErrorMessage(err), variant: "error"});
        throw err;
      }
    },
    [writeContractAsync, resetWrite, push, dismiss]
  );

  return {
    execute,
    isSigning,
    isConfirming,
    isSuccess: receiptSuccess,
    hash,
  };
}
