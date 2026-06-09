import ClientDetail from "@/components/ClientDetail";

interface Props {
  params: { workspace: string };
}

export default function ClientDetailPage({ params }: Props) {
  const workspaceName = decodeURIComponent(params.workspace);
  return <ClientDetail workspaceName={workspaceName} />;
}
