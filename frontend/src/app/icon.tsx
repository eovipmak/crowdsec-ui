import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * App icon generated as a metadata file — a stable placeholder shield for
 * the dashboard shell. Replaced by real branding assets in a later task if
 * approved.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0f172a"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3l7 3v5c0 4.56-2.9 8.36-7 10-4.1-1.64-7-5.44-7-10V6l7-3z" />
        </svg>
      </div>
    ),
    { width: 32, height: 32 },
  );
}
