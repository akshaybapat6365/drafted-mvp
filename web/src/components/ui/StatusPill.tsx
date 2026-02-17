import { Badge } from "./Badge";

export function StatusPill({
  status,
  stage,
}: {
  status: string;
  stage?: string;
}) {
  const suffix = stage ? ` · ${stage}` : "";

  if (status === "failed") {
    return <Badge tone="danger">failed{suffix}</Badge>;
  }
  if (status === "succeeded") {
    return <Badge tone="success">succeeded{suffix}</Badge>;
  }
  if (status === "running") {
    return (
      <Badge tone="accent" pulse>
        running{suffix}
      </Badge>
    );
  }
  return <Badge tone="neutral">{status}{suffix}</Badge>;
}
