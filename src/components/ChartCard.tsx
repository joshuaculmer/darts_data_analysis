import { useRef, useState, useCallback } from "react";
import { Download, Minus, Plus, X } from "lucide-react";

interface Props {
  title: string;
  children: React.ReactNode;
  downloadName?: string;
  onClose?: () => void;
  style?: React.CSSProperties;
}

export function ChartCard({ title, children, downloadName, onClose, style }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownload = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    const svg = card.querySelector<SVGSVGElement>("svg");
    if (!svg) return;

    const bbox = svg.getBoundingClientRect();
    const w = Math.max(Math.ceil(bbox.width), 100);
    const h = Math.max(Math.ceil(bbox.height), 100);

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "#1e293b");
    clone.insertBefore(bg, clone.firstChild);

    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) { URL.revokeObjectURL(url); return; }
      ctx.scale(scale, scale);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const png = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = png;
      a.download = `${(downloadName ?? title).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [title, downloadName]);

  return (
    <div className="chart-card" ref={cardRef} style={style}>
      <div className="chart-card__header">
        <h2 className="chart-card__title">{title}</h2>
        <div className="chart-card__actions">
          <button
            className="chart-card__btn"
            onClick={handleDownload}
            title="Download as PNG"
          >
            <Download size={13} />
          </button>
          {onClose ? (
            <button className="chart-card__btn" onClick={onClose} title="Close">
              <X size={13} />
            </button>
          ) : (
            <button
              className="chart-card__btn"
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <Plus size={13} /> : <Minus size={13} />}
            </button>
          )}
        </div>
      </div>
      {!collapsed && children}
    </div>
  );
}
