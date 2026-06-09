import ClientDetail from "@/components/ClientDetail";

interface Props {
  params: { workspace: string };
}

export default function ClientDetailPage({ params }: Props) {
  const workspaceId = parseInt(params.workspace, 10);
  return <ClientDetail workspaceId={workspaceId} />;
}
