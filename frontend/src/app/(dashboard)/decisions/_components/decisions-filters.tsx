"use client";

/**
 * DecisionsFilters — typed filter inputs for `decisions.list` (matrix row).
 *
 * Only the matrix-approved filter fields are rendered: ip, scope, type,
 * origin, scenario (architecture §6.1). Values are typed strings; no
 * free-form flags, expressions, or SQL reach the adapter. The filter is
 * applied on submit and the page keeps its filter state across refresh.
 */
import { useState } from "react";
import type { FormEvent } from "react";
import type { DecisionsListRequest } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/forms";

interface DecisionsFiltersProps {
  value: NonNullable<DecisionsListRequest["filter"]>;
  onChange: (next: NonNullable<DecisionsListRequest["filter"]>) => void;
  limit: number;
  onLimitChange: (next: number) => void;
}

const LIMIT_OPTIONS = [25, 50, 100];

export function DecisionsFilters({ value, onChange, limit, onLimitChange }: DecisionsFiltersProps) {
  const [ip, setIp] = useState(value.ip ?? "");
  const [scope, setScope] = useState(value.scope ?? "");
  const [type, setType] = useState(value.type ?? "");
  const [origin, setOrigin] = useState(value.origin ?? "");
  const [scenario, setScenario] = useState(value.scenario ?? "");

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    const next: NonNullable<DecisionsListRequest["filter"]> = {};
    if (ip.trim()) {
      next.ip = ip.trim();
    }
    if (scope.trim()) {
      next.scope = scope.trim();
    }
    if (type.trim()) {
      next.type = type.trim();
    }
    if (origin.trim()) {
      next.origin = origin.trim();
    }
    if (scenario.trim()) {
      next.scenario = scenario.trim();
    }
    onChange(next);
  }

  function clearFilters() {
    setIp("");
    setScope("");
    setType("");
    setOrigin("");
    setScenario("");
    onChange({});
  }

  return (
    <form
      onSubmit={applyFilters}
      className="rounded-md border border-slate-200 bg-white p-4"
      aria-label="Filter decisions"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="IP or range" htmlFor="decisions-filter-ip">
          <TextInput
            id="decisions-filter-ip"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="e.g. 198.51.100.7"
          />
        </Field>
        <Field label="Scope" htmlFor="decisions-filter-scope">
          <TextInput
            id="decisions-filter-scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="e.g. Ip"
          />
        </Field>
        <Field label="Type" htmlFor="decisions-filter-type">
          <TextInput
            id="decisions-filter-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="e.g. ban"
          />
        </Field>
        <Field label="Origin" htmlFor="decisions-filter-origin">
          <TextInput
            id="decisions-filter-origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="e.g. cscli"
          />
        </Field>
        <Field label="Scenario" htmlFor="decisions-filter-scenario">
          <TextInput
            id="decisions-filter-scenario"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="e.g. crowdsecurity/ssh-bf"
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <Field label="Results per page" htmlFor="decisions-filter-limit">
          <select
            id="decisions-filter-limit"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-2 focus:outline-offset-1 focus:outline-slate-500"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-center gap-2">
          {Object.keys(value).length > 0 ? (
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
          <Button variant="primary" size="sm" type="submit">
            Apply filters
          </Button>
        </div>
      </div>
    </form>
  );
}
