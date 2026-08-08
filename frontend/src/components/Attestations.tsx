"use client";

import {useState} from "react";
import {isAddress} from "viem";
import {useAccount} from "wagmi";
import {Badge} from "@/components/ui/Badge";
import {Button} from "@/components/ui/Button";
import {Card, CardBody, CardHeader} from "@/components/ui/Card";
import {Field, Input} from "@/components/ui/Input";
import {Modal} from "@/components/ui/Modal";
import {useToast} from "@/components/ui/Toast";
import {useWorkspaceContext} from "@/context/WorkspaceContext";
import {useAttestationList, useMintAttestation} from "@/hooks/useAttestationRegistry";
import {formatAddress} from "@/lib/errors";

function formatIssuedAt(issuedAt: bigint): string {
  const date = new Date(Number(issuedAt) * 1000);
  return date.toLocaleDateString(undefined, {year: "numeric", month: "short", day: "numeric"});
}

export function Attestations() {
  const {isConnected} = useAccount();
  const {attestations, isLoading, registryDeployed, refetch} = useAttestationList();
  const [mintOpen, setMintOpen] = useState(false);

  if (!registryDeployed) {
    return (
      <Card className="p-6 text-sm text-zinc-400">
        <p className="font-medium text-zinc-200">AttestationRegistry is not deployed on this network.</p>
        <p className="mt-1">
          Set the matching{" "}
          <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">NEXT_PUBLIC_ATTESTATION_REGISTRY_ADDRESS_*</code>{" "}
          environment variable, or switch to a network where it&apos;s deployed.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Attestation & Provenance Gallery</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Soulbound records of verified contributions — non-transferable, tied to the wallet that earned them.
          </p>
        </div>
        <Button onClick={() => setMintOpen(true)} disabled={!isConnected}>
          + Mint Attestation
        </Button>
      </div>

      {isLoading && attestations.length === 0 ? (
        <Card className="p-6 text-sm text-zinc-500">Loading attestations…</Card>
      ) : attestations.length === 0 ? (
        <Card className="p-6 text-sm text-zinc-500">No attestations minted yet.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {attestations.map((attestation) => (
            <Card key={attestation.tokenId.toString()}>
              <CardHeader>
                <p className="text-sm font-semibold text-zinc-200">Attestation #{attestation.tokenId.toString()}</p>
                <Badge tone="info">Workspace #{attestation.workspaceId.toString()}</Badge>
              </CardHeader>
              <CardBody className="flex flex-col gap-3 text-sm">
                <div>
                  <p className="text-xs text-zinc-500">Contributor</p>
                  <p className="truncate font-mono text-xs text-zinc-300" title={attestation.contributor}>
                    {formatAddress(attestation.contributor)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Task</p>
                  <p className="break-words text-xs text-zinc-300">{attestation.taskHash}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Metadata</p>
                  <p className="break-words text-xs text-zinc-400">{attestation.metadataURI}</p>
                </div>
                <div className="flex items-center justify-between border-t border-zinc-800 pt-3 text-xs text-zinc-500">
                  <span>Issued {formatIssuedAt(attestation.issuedAt)}</span>
                  <span className="font-mono" title={attestation.issuer}>
                    by {formatAddress(attestation.issuer)}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <MintAttestationModal open={mintOpen} onClose={() => setMintOpen(false)} onMinted={() => refetch()} />
    </div>
  );
}

function MintAttestationModal({open, onClose, onMinted}: {open: boolean; onClose: () => void; onMinted: () => void}) {
  const {push} = useToast();
  const {selectedWorkspaceId} = useWorkspaceContext();
  const [contributor, setContributor] = useState("");
  const [workspaceId, setWorkspaceId] = useState(selectedWorkspaceId?.toString() ?? "");
  const [taskHash, setTaskHash] = useState("");
  const [metadataURI, setMetadataURI] = useState("");

  const resetAndClose = () => {
    setContributor("");
    setTaskHash("");
    setMetadataURI("");
    onClose();
  };

  const {mintAttestation, isSigning, isConfirming} = useMintAttestation(() => {
    onMinted();
    resetAndClose();
  });
  const busy = isSigning || isConfirming;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isAddress(contributor)) {
      push({title: "Invalid contributor address", variant: "error"});
      return;
    }
    const workspaceIdValue = Number(workspaceId);
    if (!Number.isInteger(workspaceIdValue) || workspaceIdValue < 1) {
      push({title: "Workspace id must be a positive integer", variant: "error"});
      return;
    }
    if (!taskHash.trim()) {
      push({title: "Task identifier is required", variant: "error"});
      return;
    }
    if (!metadataURI.trim()) {
      push({title: "Metadata URI is required", variant: "error"});
      return;
    }

    try {
      await mintAttestation(contributor as `0x${string}`, BigInt(workspaceIdValue), taskHash.trim(), metadataURI.trim());
    } catch {
      // Toast already surfaced by useContractTxFlow.
    }
  };

  return (
    <Modal open={open} title="Mint Attestation" onClose={resetAndClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="rounded-md border border-amber-900 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          Only the registry owner or an authorized workspace issuer can mint. The transaction will revert otherwise.
        </p>
        <Field label="Contributor address">
          <Input
            value={contributor}
            onChange={(e) => setContributor(e.target.value)}
            placeholder="0x…"
            className="font-mono"
            required
          />
        </Field>
        <Field label="Workspace id">
          <Input type="number" min={1} value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} required />
        </Field>
        <Field label="Task identifier" hint="A hash, issue id, or commit that identifies the completed task.">
          <Input value={taskHash} onChange={(e) => setTaskHash(e.target.value)} placeholder="task:design-system-v2" required />
        </Field>
        <Field label="Metadata URI">
          <Input
            value={metadataURI}
            onChange={(e) => setMetadataURI(e.target.value)}
            placeholder="ipfs://…"
            required
          />
        </Field>
        <Button type="submit" loading={busy} disabled={busy} className="w-full">
          {busy ? "Minting…" : "Mint Attestation"}
        </Button>
      </form>
    </Modal>
  );
}
