"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui";
import { apiJson } from "@/lib/api";
import type { HealthOut, ProviderMode } from "@/types/api";

export default function RuntimeModeBadge() {
  const [mode, setMode] = useState<ProviderMode | "unknown">("unknown");
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    let active = true;
    void apiJson<HealthOut>("/api/v1/system/health", {
      retries: 1,
    }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setMode("unknown");
        setDegraded(true);
        return;
      }
      setMode(result.data.provider_mode);
      setDegraded(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (mode === "gemini") {
    return <Badge tone="success">runtime: gemini</Badge>;
  }
  if (mode === "mock") {
    return <Badge tone="warning">runtime: local/mock</Badge>;
  }
  if (degraded) {
    return <Badge tone="danger">runtime: degraded</Badge>;
  }
  return <Badge tone="neutral">runtime: probing</Badge>;
}
