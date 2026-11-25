import { ImageResponse } from "next/og";
import { LOGO_MARK } from "@/components/brand/Logo";

// Image metadata
export const alt = "SpaceGo · Find the right space";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Satori cannot read CSS variables, so the light theme palette is inlined.
const CANVAS = "#f8fafc";
const INK = "#0f172a";
const INK_MUTED = "#475569";
const LINE = "#e2e8f0";
const ACCENT = "#0f766e";
const ON_ACCENT = "#ffffff";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "88px 96px",
          background: CANVAS,
          color: INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="112" height="112" viewBox={LOGO_MARK.viewBox}>
            <rect width="32" height="32" rx={LOGO_MARK.tileRadius} fill={ACCENT} />
            <path d={LOGO_MARK.room} fill={ON_ACCENT} />
            <rect {...LOGO_MARK.block} fill={ON_ACCENT} />
          </svg>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, letterSpacing: -2 }}>
            SpaceGo
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700, letterSpacing: -1.5, color: INK }}>
            Find the right space
          </div>
          <div style={{ display: "flex", fontSize: 34, color: INK_MUTED }}>
            Coworking desks, private offices, meeting rooms and studios, booked directly with the host.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingTop: 28,
            borderTop: `2px solid ${LINE}`,
            fontSize: 28,
            color: INK_MUTED,
          }}
        >
          <div style={{ display: "flex", width: 14, height: 14, borderRadius: 4, background: ACCENT }} />
          <div style={{ display: "flex" }}>Search, request, get confirmed</div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
