import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import type { PrimitiveScene } from "../../core/primitives/schema";
import { CanvasReading } from "./CanvasReading";

const site = "https://fontex.sypablitodp.site";
async function logoCanvas() {
  const img = new Image();
  img.src = `${import.meta.env.BASE_URL}brand/fontex-mark.svg`;
  await img.decode();
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
  canvas.getContext("2d")!.drawImage(img, 0, 0, 256, 256);
  return canvas;
}
export async function exportCanvasPdf(scene: PrimitiveScene, shareUrl?: string) {
  const [{ jsPDF }, { toCanvas }, QRCode] = await Promise.all([import("jspdf"), import("html-to-image"), import("qrcode")]);
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-12000px;top:0;width:1000px;pointer-events:none;";
  host.setAttribute("aria-hidden", "true"); host.dataset.theme = "light";
  host.className = "pc-app pc-export-sheet";
  document.body.append(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<CanvasReading scene={scene} />));
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const logo = await logoCanvas();
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    let page = 1, y = 32;
    const header = () => {
      pdf.setFillColor(255,255,255); pdf.rect(0,0,210,297,"F");
      pdf.addImage(logo,"PNG",12,9,10,10);
      pdf.setTextColor(20,50,35); pdf.setFont("helvetica","bold"); pdf.setFontSize(14); pdf.text("fontex.",24,16);
      pdf.setFontSize(9); pdf.text(pdf.splitTextToSize(scene.title || "Sin título",85) as string[],108,13,{align:"center"});
      pdf.setFont("helvetica","normal"); pdf.setFontSize(7); pdf.text("fontex.sypablitodp.site",198,15,{align:"right"});
      pdf.setDrawColor(215,225,219); pdf.line(12,24,198,24);
      pdf.setFontSize(8); pdf.text(String(page),198,289,{align:"right"});
      y = 32;
    };
    const next = () => { pdf.addPage(); page++; header(); };
    header();
    for (const item of host.querySelectorAll<HTMLElement>(".pc-export-item")) {
      const pixelRatio = Math.min(1.5, 16000 / Math.max(1, item.scrollHeight), Math.sqrt(12000000 / Math.max(1, item.scrollWidth * item.scrollHeight)));
      const canvas = await toCanvas(item, { pixelRatio, backgroundColor: "#ffffff", cacheBust: false });
      const mmPerPixel = 186 / canvas.width;
      const totalHeight = canvas.height * mmPerPixel;
      if (totalHeight <= 245 && y + totalHeight > 280) next();
      let offset = 0;
      while (offset < canvas.height) {
        if (y >= 279) next();
        let pixels = Math.min(canvas.height - offset, Math.floor((280-y)/mmPerPixel));
        // Prefer a whitespace row to avoid splitting text across pages.
        if (offset + pixels < canvas.height && pixels > 100) {
          const ctx = canvas.getContext("2d")!;
          for(let row = offset + pixels - 1; row > offset + pixels - 60; row--) {
            const data = ctx.getImageData(0,row,canvas.width,1).data;
            let ink = 0; for(let x=0;x<data.length;x+=4) if(data[x]!<235 || data[x+1]!<235 || data[x+2]!<235) ink++;
            if(ink < 3) { pixels = row-offset; break; }
          }
        }
        const slice = document.createElement("canvas"); slice.width = canvas.width; slice.height = pixels;
        slice.getContext("2d")!.drawImage(canvas,0,offset,canvas.width,pixels,0,0,canvas.width,pixels);
        pdf.addImage(slice,"PNG",12,y,186,pixels*mmPerPixel);
        y += pixels*mmPerPixel; offset += pixels;
        if(offset < canvas.height) next();
      }
      y += 6;
    }
    if(y > 222) next();
    const qr = document.createElement("canvas");
    await QRCode.toCanvas(qr,shareUrl || site,{errorCorrectionLevel:"H",width:440,margin:4});
    const ctx = qr.getContext("2d")!;
    ctx.fillStyle = "white"; ctx.fillRect(178,178,84,84); ctx.drawImage(logo,184,184,72,72);
    pdf.addImage(qr,"PNG",87,y+3,36,36);
    pdf.setFontSize(9); pdf.setTextColor(20,50,35);
    pdf.text(shareUrl ? "Abre este lienzo en Fontex" : "Creado con Fontex",105,y+44,{align:"center"});
    pdf.link(87,y+3,36,36,{url:shareUrl || site});
    const filename = (scene.title || "Fontex").replace(/[<>:"/\\|?*]/g,"-");
    pdf.save(`${filename}.pdf`);
  } finally { root.unmount(); host.remove(); }
}
