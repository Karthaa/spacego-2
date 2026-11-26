import { ImageResponse } from "next/og";
import { LOGO_MARK } from "@/components/brand/Logo";

// Image metadata
export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

const ACCENT = "#0f766e";
const ON_ACCENT = "#ffffff";

// Full-bleed tile: iOS applies its own rounded mask to touch icons.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ACCENT,
        }}
      >
        <svg width="150" height="150" viewBox={LOGO_MARK.viewBox}>
          <path d={LOGO_MARK.room} fill={ON_ACCENT} />
          <rect {...LOGO_MARK.block} fill={ON_ACCENT} />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
