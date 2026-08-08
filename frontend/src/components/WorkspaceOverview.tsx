"use client";

import {useState} from "react";
import {formatEther, isAddress, parseEther} from "viem";
import {useAccount} from "wagmi";
import {Badge} from "@/components/ui/Badge";
import {Button} from "@/components/ui/Button";
import {Field, Input} from "@/components/ui/Input";
import {Card, CardBody, CardHeader} from "@/components/ui/Card";
import {Modal} from "@/components/ui/Modal";
import {useToast} from "@/components/ui/Toast";
import {useWorkspaceContext} from "@/context/WorkspaceContext";
import {useWorkspace, useWorkspaceList} from "@/hooks/useCoOpVaultReads";
import {useCreateWorkspace, useDeposit} from "@/hooks/useCoOpVaultWrites";
import {formatAddress} from "@/lib/errors";

export function WorkspaceOverview() {
  const {isConnected} = useAccount();
  const {selectedWorkspaceId, setSelectedWorkspaceId, vaultDeployed, refetchWorkspaceCount} = useWorkspaceContext();
  const {workspaces, isLoading: isLoadingList, refetch: refetchList} = useWorkspaceList();
  const {workspace, treasury, members, isLoading: isLoadingDetail, refetch: refetchDetail} =
    useWorkspace(selectedWorkspaceId);

  const [createOpen, setCreateOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  if (!vaultDeployed) {
    return (
      <Card className="p-6 text-sm text-zinc-400">
        <p className="font-medium text-zinc-200">CoOpVault is not deployed on this network.</p>
        <p className="mt-1">
          Set the matching <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">NEXT_PUBLIC_COOP_VAULT_ADDRESS_*</code>{" "}
          environment variable, or switch to a network where it&apos;s deployed.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500" htmlFor="workspace-switcher">
            Workspace
          </label>
          <select
            id="workspace-switcher"
            value={selectedWorkspaceId?.toString() ?? ""}
            onChange={(event) => setSelectedWorkspaceId(event.target.value ? BigInt(event.target.value) : undefined)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-500"
            disabled={workspaces.length === 0}
          >
            {workspaces.length === 0 ? <option value="">No workspaces yet</option> : null}
            {workspaces.map((ws) => (
              <option key={ws.id.toString()} value={ws.id.toString()}>
                #{ws.id.toString()} — {ws.name}
              </option>
            ))}
          </select>
          {isLoadingList ? <span className="text-xs text-zinc-600">Loading…</span> : null}
        </div>

        <Button onClick={() => setCreateOpen(true)} disabled={!isConnected}>
          + New Workspace
        </Button>
      </div>

      {!selectedWorkspaceId ? (
        <Card className="p-6 text-sm text-zinc-400">
          {isConnected
            ? "No workspace selected yet — create one to get started."
            : "Connect a wallet, then create a workspace to get started."}
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Treasury Balance</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-100">
                  {treasury !== undefined ? formatEther(treasury) : "…"} <span className="text-sm text-zinc-500">ETH</span>
                </p>
              </div>
              <Badge tone={workspace?.active ? "success" : "danger"}>{workspace?.active ? "Active" : "Inactive"}</Badge>
            </CardHeader>
            <CardBody className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">Workspace #{selectedWorkspaceId.toString()}</p>
              <Button size="sm" onClick={() => setDepositOpen(true)} disabled={!isConnected}>
                Deposit Funds
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Workspace Info</p>
              {isLoadingDetail ? <span className="text-xs text-zinc-600">Refreshing…</span> : null}
            </CardHeader>
            <CardBody className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Name</span>
                <span className="font-medium text-zinc-100">{workspace?.name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Total members</span>
                <span className="font-medium text-zinc-100">{workspace?.memberCount.toString() ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Approval threshold</span>
                <span className="font-medium text-zinc-100">
                  {workspace ? `${workspace.approvalThreshold.toString()} of ${workspace.memberCount.toString()}` : "—"}
                </span>
              </div>
              <div>
                <p className="mb-1.5 text-zinc-500">Members</p>
                <ul className="flex flex-col gap-1.5">
                  {members.map((member) => (
                    <li
                      key={member}
                      className="truncate rounded-md border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-xs text-zinc-300"
                      title={member}
                    >
                      {member}
                    </li>
                  ))}
                </ul>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <CreateWorkspaceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          refetchList();
          refetchWorkspaceCount();
        }}
      />

      {selectedWorkspaceId ? (
        <DepositModal
          open={depositOpen}
          workspaceId={selectedWorkspaceId}
          onClose={() => setDepositOpen(false)}
          onDeposited={() => {
            setDepositOpen(false);
            refetchDetail();
          }}
        />
      ) : null}
    </div>
  );
}

function CreateWorkspaceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const {push} = useToast();
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([""]);
  const [threshold, setThreshold] = useState("1");

  const {createWorkspace, isSigning, isConfirming} = useCreateWorkspace(onCreated);

  const busy = isSigning || isConfirming;

  const resetAndClose = () => {
    setName("");
    setMembers([""]);
    setThreshold("1");
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      push({title: "Name is required", variant: "error"});
      return;
    }

    const addresses = members.map((m) => m.trim()).filter((m) => m.length > 0);
    const invalid = addresses.find((address) => !isAddress(address));
    if (invalid) {
      push({title: "Invalid member address", description: invalid, variant: "error"});
      return;
    }

    const thresholdValue = Number(threshold);
    if (!Number.isInteger(thresholdValue) || thresholdValue < 1) {
      push({title: "Threshold must be a positive integer", variant: "error"});
      return;
    }

    try {
      await createWorkspace(trimmedName, addresses as `0x${string}`[], BigInt(thresholdValue));
      resetAndClose();
    } catch {
      // Toast already surfaced by useContractTxFlow.
    }
  };

  return (
    <Modal open={open} title="Create Workspace" onClose={resetAndClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Workspace name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Design Guild" required />
        </Field>

        <Field label="Initial members" hint="You are added automatically as a member.">
          <div className="flex flex-col gap-2">
            {members.map((member, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={member}
                  onChange={(e) =>
                    setMembers((prev) => prev.map((m, i) => (i === index ? e.target.value : m)))
                  }
                  placeholder="0x…"
                  className="flex-1 font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMembers((prev) => prev.filter((_, i) => i !== index))}
                  disabled={members.length === 1}
                >
                  &times;
                </Button>
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={() => setMembers((prev) => [...prev, ""])}>
              + Add member
            </Button>
          </div>
        </Field>

        <Field label="Approval threshold" hint="Approvals required to release an expense.">
          <Input type="number" min={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} required />
        </Field>

        <Button type="submit" loading={busy} disabled={busy} className="mt-2 w-full">
          {busy ? "Creating…" : "Create Workspace"}
        </Button>
      </form>
    </Modal>
  );
}

function DepositModal({
  open,
  workspaceId,
  onClose,
  onDeposited,
}: {
  open: boolean;
  workspaceId: bigint;
  onClose: () => void;
  onDeposited: () => void;
}) {
  const {push} = useToast();
  const [amount, setAmount] = useState("");
  const {deposit, isSigning, isConfirming} = useDeposit(onDeposited);
  const busy = isSigning || isConfirming;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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

    try {
      await deposit(workspaceId, amountWei, `${amount} ETH`);
      setAmount("");
      onClose();
    } catch {
      // Toast already surfaced by useContractTxFlow.
    }
  };

  return (
    <Modal open={open} title="Deposit Funds" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Amount (ETH)">
          <Input
            type="number"
            step="any"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.5"
            required
          />
        </Field>
        <Button type="submit" loading={busy} disabled={busy} className="w-full">
          {busy ? "Depositing…" : "Deposit"}
        </Button>
      </form>
    </Modal>
  );
}

// Re-exported so callers can render a compact address chip consistently.
export function AddressChip({address}: {address: `0x${string}`}) {
  return (
    <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 font-mono text-xs text-zinc-400">
      {formatAddress(address)}
    </span>
  );
}
