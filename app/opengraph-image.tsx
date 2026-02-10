import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const alt = "Hippocampus";
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#020617",
          backgroundImage:
            "radial-gradient(circle at 25% 25%, rgba(34, 211, 238, 0.18), transparent 45%), radial-gradient(circle at 75% 75%, rgba(20, 184, 166, 0.2), transparent 45%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          <div
            style={{
              fontSize: 112,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
              backgroundImage: "linear-gradient(90deg, #22d3ee, #14b8a6)",
              color: "transparent",
              backgroundClip: "text",
            }}
          >
            Hippocampus
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#cbd5e1",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            Team Memory Layer
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
