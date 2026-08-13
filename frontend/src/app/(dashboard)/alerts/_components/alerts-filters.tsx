"use client";

/**
 * AlertsFilters — typed filter inputs for `alerts.list` (matrix row).
 *
 * Only the matrix-approved filter fields are rendered: scenario, ip
 * (architecture §6.1). Values are typed strings; no free-form flags,
 * expressions, or SQL reach the adapter. The filter is applied on submit and
 * the page keeps its filter/pagination state across refresh (task 09).
 */
import { useState } from "react";
import type { FormEvent } from "react";
import type { AlertsListRequest } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/forms";

interface AlertsFiltersProps {
  value: NonNullable<AlertsListRequest["filter"]>;
  onChange: (next: NonNullable<AlertsListRequest["filter"]>) => void;
  limit: number;
  onLimitChange: (next: number) => void;
}

const LIMIT_OPTIONS = [25, 50, 100];

export function AlertsFilters({ value, onChange, limit, onLimitChange }: AlertsFiltersProps) {
  const [scenario, setScenario] = useState(value.scenario ?? "");
  const [ip, setIp] = useState(value.ip ?? "");

  function applyFilters(e: FormEvent) {
    e.preventDefault();
    const next: NonNullable<AlertsListRequest["filter"]> = {};
    if (scenario.trim()) {
      next.scenario = scenario.trim();
    }
    if (ip.trim()) {
      next.ip = ip.trim();
    }
    onChange(next);
  }

  function clearFilters() {
    setScenario("");
    setIp("");
    onChange({});
  }

  return (
    <form
      onSubmit={applyFilters}
      className="rounded-md border border-slate-200 bg-white p-4"
      aria-label="Filter alerts"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scenario" htmlFor="alerts-filter-scenario">
          <TextInput
            id="alerts-filter-scenario"
            value={scenario}
            onChange={(e) => setScenario(e.target.value)}
            placeholder="e.g. crowdsecurity/ssh-bf"
          />
        </Field>
        <Field label="IP or range" htmlFor="alerts-filter-ip">
          <TextInput
            id="alerts-filter-ip"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="e.g. 198.51.100.7"
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <Field label="Results per page" htmlFor="alerts-filter-limit">
          <select
            id="alerts-filter-limit"
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
