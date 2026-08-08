import type {Metadata} from "next";
import {Attestations} from "@/components/Attestations";

export const metadata: Metadata = {title: "Attestations — Co-Op Protocol"};

export default function AttestationsPage() {
  return <Attestations />;
}
