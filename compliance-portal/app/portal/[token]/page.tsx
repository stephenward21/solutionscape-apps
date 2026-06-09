import PortalView from "@/components/PortalView";

export default function PortalPage({ params }: { params: { token: string } }) {
  return <PortalView token={params.token} />;
}
