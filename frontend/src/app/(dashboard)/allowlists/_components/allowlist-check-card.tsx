"use client";

/**
 * AllowlistCheckCard — `allowlists.check` read operation (architecture §6.1).
 *
 * The matrix request field is typed: `ip_or_range` (validated IP/CIDR).
 * Invalid IPs are rejected before execution (matrix §4). The result is a
 * fixed matched/no-match (`{ matched: boolean }`). This is a read — no
 * confirmation is involved. The caller owns capability gating so an
 * unsupported row renders no control and no fetch.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiClient } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { CapabilityBadge } from "@/components/shared/capability-badge";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/forms";
import type { CapabilityState } from "@/lib/api/capabilities";
import type { SuccessEnvelope } from "@/lib/api/types";
import { isValidIpOrRange } from "@/app/(dashboard)/allowlists/_components/validation";

interface AllowlistCheckCardProps {
  capability: CapabilityState;
}

export function AllowlistCheckCard({ capability }: AllowlistCheckCardProps) {
  const [ipOrRange, setIpOrRange] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const resource = useApiResource<SuccessEnvelope<{ matched?: boolean }>>(
    () =>
      query
        ? apiClient.checkAllowlist({ ip_or_range: query })
        : Promise.resolve({
            operation: "allowlists.check",
            request: {},
            result: { matched: false },
            source: { system: "crowdsec", command: "cscli allowlists check", version: "1.7.8" },
          }),
    { key: query },
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ipOrRange.trim()) {
      setFieldError("IP or range is required.");
      return;
    }
    if (!isValidIpOrRange(ipOrRange)) {
      setFieldError("Enter a valid IPv4 address or IPv4 CIDR range.");
      return;
    }
    setFieldError("");
    setQuery(ipOrRange.trim());
  }

  if (capability === "unsupported") {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Check allowlist</h2>
          <CapabilityBadge state={capability} />
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Allowlist checking is not supported by this installation. No control is available.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Check allowlist</h2>
        <CapabilityBadge state={capability} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-4 space-y-4"
        aria-label="Check an IP in allowlists"
      >
        <Field
          label="IP or range"
          htmlFor="allowlist-check-ip"
          hint="A single IPv4 address or IPv4 CIDR range."
        >
          <TextInput
            id="allowlist-check-ip"
            value={ipOrRange}
            onChange={(e) => setIpOrRange(e.target.value)}
            placeholder="e.g. 198.51.100.7"
            required
          />
        </Field>
        {fieldError ? (
          <p role="alert" className="text-xs font-medium text-red-700">
            {fieldError}
          </p>
        ) : null}
        <Button variant="primary" type="submit" disabled={resource.isRefreshing}>
          {resource.isRefreshing ? "Checking…" : "Check"}
        </Button>
      </form>

      <div className="mt-4">
        {resource.status === "loading" && query ? (
          <p className="text-sm text-slate-500">Checking…</p>
        ) : resource.status === "error" ? (
          <div role="alert" className="flex flex-col gap-2">
            <p className="text-sm text-red-700">
              {isApiError(resource.error)
                ? resource.error.message
                : "The allowlists.check operation did not complete."}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void resource.refresh()}>
                Retry
              </Button>
              <span className="font-mono text-xs text-red-600">allowlists.check</span>
            </div>
          </div>
        ) : resource.status === "success" && query ? (
          <p className="text-sm text-slate-700">
            {resource.data.result.matched === true ? (
              <span className="font-medium text-amber-700">
                {query} is covered by an allowlist.
              </span>
            ) : (
              <span className="font-medium text-emerald-700">
                {query} is not covered by any allowlist.
              </span>
            )}
          </p>
        ) : null}
      </div>
    </section>
  );
}
