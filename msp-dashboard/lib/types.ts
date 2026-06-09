export interface Workspace {
  name: string;
  apiKey: string;
}

export interface DrataFramework {
  id: number;
  name: string;
  slug: string;
}

export interface DrataControl {
  id: number;
  name: string;
  description?: string;
  code?: string;
  status: "PASSING" | "FAILING" | "NEEDS_ATTENTION" | "NOT_APPLICABLE" | string;
  owner?: { name: string; email: string };
  frameworkSlug?: string;
}

export interface DrataTask {
  id: number;
  name: string;
  description?: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETE" | "DISMISSED" | string;
  dueDate?: string; // ISO date
  assignee?: { name: string; email: string };
  controlCode?: string;
}

export interface DrataRisk {
  id: number;
  name: string;
  description?: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  status: "OPEN" | "IN_TREATMENT" | "ACCEPTED" | "CLOSED" | string;
  owner?: { name: string };
}

export interface DrataEvent {
  id: number;
  action: string;
  description?: string;
  createdAt: string;
  actor?: { name: string; email: string };
}

export interface DrataMonitoringTest {
  id: number;
  name: string;
  status: "PASSING" | "FAILING" | "NOT_EVALUATED" | string;
  controlCode?: string;
}

export interface FrameworkHealth {
  id: number;
  name: string;
  slug: string;
  passingCount: number;
  failingCount: number;
  needsAttentionCount: number;
  totalCount: number;
  score: number; // 0-100 percentage of passing
}

export interface HistoryPoint {
  date: string; // ISO date YYYY-MM-DD
  score: number; // 0-100
}

export interface WorkspaceSnapshot {
  workspaceName: string;
  capturedAt: string; // ISO timestamp
  stale: boolean; // true if older than 15 min
  frameworks: FrameworkHealth[];
  overallScore: number; // weighted average across frameworks
  ragStatus: "green" | "amber" | "red";
  totalControls: number;
  passingControls: number;
  failingControls: number;
  needsAttentionControls: number;
  overdueTasksCount: number;
  upcomingTasksCount: number; // due in next 30 days, not complete
  openHighRisks: number;
  openCriticalRisks: number;
  failingTestsCount: number;
  recentEvents: DrataEvent[]; // last 5
  history: HistoryPoint[]; // last 30 daily snapshots for sparkline
  error?: string; // if fetch failed
}
