import EvidenceSync from "@/components/EvidenceSync";

export default function Home() {
  const hasTenants = !!process.env.DRATA_TENANTS;
  const hasSingleKey = !!process.env.DRATA_API_KEY;
  const hasEnvKey = hasTenants || hasSingleKey;

  return <EvidenceSync hasTenants={hasTenants} hasEnvKey={hasEnvKey} />;
}
