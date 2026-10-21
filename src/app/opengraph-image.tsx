import { ImageResponse } from "next/og"
export const alt = "OpenBids — South African public tenders"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: "#ffffff",
          padding: 72,
          color: "#171717",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, color: "#7008e7", fontWeight: 700 }}>
          OpenBids
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, letterSpacing: -2 }}>
            South African public tenders
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#525252" }}>
            Find opportunities. Prepare your response.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#525252" }}>www.openbid.co.za</div>
      </div>
    ),
    size
  )
}
