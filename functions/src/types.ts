export type JobStatus = "queued" | "running" | "succeeded" | "failed";
export type JobStage =
  | "init"
  | "spec"
  | "plan"
  | "render"
  | "image"
  | "retry_wait"
  | "done";

export interface ProviderCallMeta {
  provider: string;
  model: string;
  request_id?: string | null;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  image_tokens?: number;
}

export interface HouseSpecRoom {
  id: string;
  type: string;
  name: string;
  area_ft2: number;
}

export interface HouseSpec {
  version: string;
  style: string;
  bedrooms: number;
  bathrooms: number;
  rooms: HouseSpecRoom[];
  notes: string[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlanRoom {
  id: string;
  name: string;
  type: string;
  area_ft2: number;
  rect_ft: Rect;
}

export interface PlanEdge {
  a: string;
  b: string;
  kind: string;
}

export interface PlanGraph {
  version: string;
  outline_ft: Rect;
  rooms: PlanRoom[];
  edges: PlanEdge[];
  warnings: string[];
}

export interface JobDoc {
  uid: string;
  sessionId: string;
  parentJobId?: string | null;
  prompt: string;
  bedrooms: number;
  bathrooms: number;
  style: string;
  wantExteriorImage: boolean;
  idempotencyKey?: string | null;
  requestHash?: string | null;
  priority: "normal" | "high";
  status: JobStatus;
  stage: JobStage;
  error?: string | null;
  failureCode?: string | null;
  retryCount: number;
  providerMeta: {
    calls: ProviderCallMeta[];
    reuseSpec?: boolean;
    regeneratedFromJobId?: string;
  };
  stageTimestamps: Record<string, string>;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
  houseSpec?: HouseSpec;
  planGraph?: PlanGraph;
}

export interface ArtifactDoc {
  id: string;
  type: string;
  mimeType: string;
  storagePath: string;
  checksumSha256: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDoc {
  uid: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export function isoNow(): string {
  return new Date().toISOString();
}
