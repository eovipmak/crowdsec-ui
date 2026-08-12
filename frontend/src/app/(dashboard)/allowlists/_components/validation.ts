/**
 * Client-side validation for allowlist request fields, mirroring the matrix
 * §3 parameter rules. The browser never sends raw command/flag text — these
 * helpers reject input that would not be a valid typed matrix field.
 */

export const NAME_PATTERN = "^[A-Za-z0-9][A-Za-z0-9_./:-]{0,255}$";
/** Finite positive duration accepted by the adapter grammar, ≤365 days. */
export const DURATION_PATTERN = "^[0-9]+(s|m|h|d)$";

/** Validate an allowlist `name` identifier (matrix §3). */
export function isValidName(name: string): boolean {
  return new RegExp(NAME_PATTERN).test(name);
}

/** Validate a finite positive duration within 365 days (matrix §3). */
export function isValidDuration(duration: string): boolean {
  if (!new RegExp(DURATION_PATTERN).test(duration)) {
    return false;
  }
  const unit = duration[duration.length - 1];
  const value = Number.parseInt(duration.slice(0, -1), 10);
  const days =
    unit === "d"
      ? value
      : unit === "h"
        ? value / 24
        : unit === "m"
          ? value / (24 * 60)
          : value / (24 * 60 * 60);
  return days <= 365;
}

/** Validate a single IPv4 address or IPv4 CIDR range (matrix `ip_or_range`). */
export function isValidIpOrRange(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.includes("/")) {
    const [ip, prefix] = trimmed.split("/", 2);
    if (!isValidIpv4(ip)) {
      return false;
    }
    const n = Number(prefix);
    return Number.isInteger(n) && n >= 0 && n <= 32;
  }
  return isValidIpv4(trimmed);
}

function isValidIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

/** Validate a 1–256 char, newline-free UTF-8 text field (description/comment). */
export function isValidText(value: string): boolean {
  return value.length >= 1 && value.length <= 256 && !value.includes("\n");
}
