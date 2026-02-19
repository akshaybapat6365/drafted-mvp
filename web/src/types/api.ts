export type ProviderMode = "mock" | "gemini";

export type HealthOut = {
  ok?: boolean;
  provider_mode: ProviderMode;
  queue?: {
    queued?: number;
    running?: number;
    failed_last_24h?: number;
    succeeded_last_24h?: number;
  };
};

export type SessionOut = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

export type ProviderMetaCall = {
  model?: string;
  provider?: string;
};

export type JobOut = {
  id: string;
  session_id: string;
  prompt: string;
  bedrooms: number;
  bathrooms: number;
  style: string;
  status: string;
  stage: string;
  error: string | null;
  failure_code: string | null;
  retry_count: number;
  provider_meta: { calls?: ProviderMetaCall[] };
  stage_timestamps: Record<string, string>;
  warnings: string[];
  created_at: string;
  updated_at: string;
};

export type ArtifactOut = {
  id: string;
  type: string;
  mime_type: string;
  checksum_sha256: string | null;
  size_bytes: number | null;
  url: string;
  created_at: string;
};

export type ArtifactsOut = {
  job_id: string;
  items: ArtifactOut[];
};
