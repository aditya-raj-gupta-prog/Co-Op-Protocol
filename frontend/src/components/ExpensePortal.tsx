"use client";

import Link from "next/link";
import {useState} from "react";
import {formatEther, isAddress, parseEther} from "viem";
import {useAccount} from "wagmi";
import {Badge, type BadgeTone} from "@/components/ui/Badge";
import {Button} from "@/components/ui/Button";
import {Card, CardBody, CardHeader} from "@/components/ui/Card";
import {Field, Input, Textarea} from "@/components/ui/Input";
import {ProgressBar} from "@/components/ui/ProgressBar";
import {useToast} from "@/components/ui/Toast";
import {useWorkspaceContext} from "@/context/WorkspaceContext";
import {type ExpenseData, useExpenseList, useHasApproved, useIsMember, useWorkspace} from "@/hooks/useCoOpVaultReads";
import {
  useApproveExpense,
  useCreateExpense,
  useExecuteExpense,
  useRejectExpense,
} from "@/hooks/useCoOpVaultWrites";
import {formatAddress} from "@/lib/errors";

export function ExpensePortal() {
  const {isConnected} = useAccount();
  const {selectedWorkspaceId, vaultDeployed} = useWorkspaceContext();
  const {workspace, refetch: refetchWorkspace} = useWorkspace(selectedWorkspaceId);
  const {expenses, isLoading, refetch: refetchExpenses} = useExpenseList(selectedWorkspaceId);

  const handleChanged = () => {
    refetchExpenses();
    refetchWorkspace();
  };

  if (!vaultDeployed) {
    return (
      <Card className="p-6 text-sm text-zinc-400">
        <p className="font-medium text-zinc-200">CoOpVault is not deployed on this network.</p>
        <p className="mt-1">Switch to a supported network to manage expenses.</p>
      </Card>
    );
  }

  if (!selectedWorkspaceId || !workspace) {
    return (
      <Card className="p-6 text-sm text-zinc-400">
        No workspace selected.{" "}
        <Link href="/workspaces" className="text-cyan-400 hover:underline">
          Choose or create one
        </Link>{" "}
        first.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <SubmitProposalForm workspaceId={selectedWorkspaceId} isConnected={isConnected} onSubmitted={handleChanged} />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-200">Proposals</h2>
          {isLoading ? <span className="text-xs text-zinc-600">Refreshing…</span> : null}
        </div>

        {expenses.length === 0 ? (
          <Card className="p-6 text-sm text-zinc-500">No expense proposals yet for this workspace.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {expenses.map((expense) => (
              <ExpenseCard
                key={expense.id.toString()}
                expense={expense}
                approvalThreshold={workspace.approvalThreshold}
                onChanged={handleChanged}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubmitProposalForm({
  workspaceId,
  isConnected,
  onSubmitted,
}: {
  workspaceId: bigint;
  isConnected: boolean;
  onSubmitted: () => void;
}) {
  const {push} = useToast();
  const {address} = useAccount();
  const isMember = useIsMember(workspaceId, address);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [metadata, setMetadata] = useState("");

  const {createExpense, isSigning, isConfirming} = useCreateExpense(onSubmitted);
  const busy = isSigning || isConfirming;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isAddress(recipient)) {
      push({title: "Invalid recipient address", variant: "error"});
      return;
    }

    let amountWei: bigint;
    try {
      amountWei = parseEther(amount || "0");
    } catch {
      push({title: "Invalid amount", variant: "error"});
      return;
    }
    if (amountWei <= 0n) {
      push({title: "Amount must be greater than zero", variant: "error"});
      return;
    }

    if (!metadata.trim()) {
      push({title: "Description / metadata URI is required", variant: "error"});
      return;
    }

    try {
      await createExpense(workspaceId, recipient as `0x${string}`, amountWei, metadata.trim());
      setRecipient("");
      setAmount("");
      setMetadata("");
    } catch {
      // Toast already surfaced by useContractTxFlow.
    }
  };

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-semibold text-zinc-200">Submit Proposal</p>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label="Recipient address" className="sm:col-span-1">
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x…"
              className="font-mono"
              required
            />
          </Field>
          <Field label="Amount (ETH)" className="sm:col-span-1">
            <Input
              type="number"
              step="any"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.25"
              required
            />
          </Field>
          <Field label="Task description / metadata URI" className="sm:col-span-2">
            <Textarea
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              placeholder="ipfs://… or a short description of the expense"
              rows={2}
              required
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={busy} disabled={busy || !isConnected} className="w-full sm:w-auto">
              {!isConnected ? "Connect a wallet" : busy ? "Submitting…" : "Submit Proposal"}
            </Button>
            {isConnected && !isMember ? (
              <p className="mt-2 text-xs text-amber-400">
                You are not a member of this workspace — submission will revert on-chain.
              </p>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

function statusOf(expense: ExpenseData): {label: string; tone: BadgeTone} {
  if (expense.executed) return {label: "Executed", tone: "success"};
  if (expense.rejected) return {label: "Rejected", tone: "danger"};
  return {label: "Pending", tone: "pending"};
}

function ExpenseCard({
  expense,
  approvalThreshold,
  onChanged,
}: {
  expense: ExpenseData;
  approvalThreshold: bigint;
  onChanged: () => void;
}) {
  const {address} = useAccount();
  const {selectedWorkspaceId} = useWorkspaceContext();
  const isMember = useIsMember(selectedWorkspaceId, address);
  const hasApproved = useHasApproved(expense.id, address);

  const {approveExpense, isSigning: isApproving, isConfirming: isApprovingConfirm} = useApproveExpense(onChanged);
  const {executeExpense, isSigning: isExecuting, isConfirming: isExecutingConfirm} = useExecuteExpense(onChanged);
  const {rejectExpense, isSigning: isRejecting, isConfirming: isRejectingConfirm} = useRejectExpense(onChanged);

  const status = statusOf(expense);
  const pending = !expense.executed && !expense.rejected;
  const thresholdMet = expense.approvalsCount >= approvalThreshold;
  const anyBusy =
    isApproving || isApprovingConfirm || isExecuting || isExecutingConfirm || isRejecting || isRejectingConfirm;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <p className="text-sm font-semibold text-zinc-200">Expense #{expense.id.toString()}</p>
        <Badge tone={status.tone}>{status.label}</Badge>
      </CardHeader>
      <CardBody className="flex flex-1 flex-col gap-3 text-sm">
        <div>
          <p className="text-xs text-zinc-500">Recipient</p>
          <p className="truncate font-mono text-xs text-zinc-300" title={expense.recipient}>
            {formatAddress(expense.recipient)}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Amount</p>
          <p className="font-medium text-zinc-100">{formatEther(expense.amount)} ETH</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Description / metadata</p>
          <p className="break-words text-xs text-zinc-400">{expense.metadataHash}</p>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Approvals</span>
            <span className="text-zinc-400">
              {expense.approvalsCount.toString()} / {approvalThreshold.toString()}
            </span>
          </div>
          <ProgressBar value={Number(expense.approvalsCount)} max={Number(approvalThreshold)} />
        </div>

        {pending ? (
          <div className="mt-auto flex flex-wrap gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => approveExpense(expense.id).catch(() => {})}
              loading={isApproving || isApprovingConfirm}
              disabled={anyBusy || !isMember || hasApproved}
            >
              {hasApproved ? "Approved" : "Approve"}
            </Button>
            {thresholdMet ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => executeExpense(expense.id).catch(() => {})}
                loading={isExecuting || isExecutingConfirm}
                disabled={anyBusy}
              >
                Execute
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="danger"
              onClick={() => rejectExpense(expense.id).catch(() => {})}
              loading={isRejecting || isRejectingConfirm}
              disabled={anyBusy}
            >
              Reject
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
