import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Palm Bite Cafe, a social community cafe";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview card shown when a Palm Bite link is shared or found on Google. */
export default async function OpengraphImage() {
  const photo = await readFile(join(process.cwd(), "public/photos/melis.jpg"));
  const src = `data:image/jpeg;base64,${photo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#5d724b", color: "#FBF7EE" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "64px" }}>
          <div style={{ fontSize: 30, color: "#EECFBA", fontWeight: 600 }}>pour. sip. stay a while.</div>
          <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, marginTop: 18 }}>Palm Bite Cafe</div>
          <div style={{ fontSize: 38, marginTop: 22 }}>A social community cafe</div>
          <div style={{ fontSize: 26, marginTop: 30, color: "#DDE5D3" }}>Coffee, fresh juice, pastries, clubs and good people</div>
          <div style={{ fontSize: 26, marginTop: 36, color: "#EECFBA" }}>palmbitecafe.app</div>
        </div>
        <img src={src} alt="" width={420} height={630} style={{ objectFit: "cover" }} />
      </div>
    ),
    size,
  );
}
