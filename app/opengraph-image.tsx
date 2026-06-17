import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "+90 — convoque lendas e conquiste a Copa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Imagem de compartilhamento (WhatsApp/Insta/Twitter). Gerada no build a partir
// deste JSX — sem asset binário. Trocar aqui muda o card em todo lugar.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg,#0e3f24 0%,#0b3320 50%,#072417 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 150, lineHeight: 1 }}>⭐</div>
        <div style={{ display: "flex", fontSize: 220, fontWeight: 900, letterSpacing: -4, marginTop: 4 }}>
          <span style={{ color: "#FFC81B" }}>+</span>
          <span style={{ color: "#FFFDF5" }}>90</span>
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 38,
            fontWeight: 800,
            color: "#141512",
            background: "#9ACD1E",
            border: "5px solid #141512",
            borderRadius: 999,
            padding: "12px 36px",
          }}
        >
          Convoque lendas · comande sua seleção · vença a Copa
        </div>
      </div>
    ),
    { ...size },
  );
}
