import { listWorkspaceNames } from "@/lib/drata-client";
import Dashboard from "@/components/Dashboard";

export default function DashboardPage() {
  const workspaces = listWorkspaceNames();
  return <Dashboard workspaceNames={workspaces} />;
}
