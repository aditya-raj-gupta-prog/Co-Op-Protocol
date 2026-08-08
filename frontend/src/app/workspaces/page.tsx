import type {Metadata} from "next";
import {WorkspaceOverview} from "@/components/WorkspaceOverview";

export const metadata: Metadata = {title: "Workspaces — Co-Op Protocol"};

export default function WorkspacesPage() {
  return <WorkspaceOverview />;
}
