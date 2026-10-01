import { memo } from "react";

export type MascotMood = "idle" | "working" | "happy" | "sleeping" | "confused";

/**
 * "Vy", o mascote da Vysify, em pixel art 16x16 desenhada em SVG (nítido em qualquer tamanho,
 * sem imagens externas). Animações em CSS (globals.css), desligadas com prefers-reduced-motion.
 *
 * Legenda: O contorno · B corpo · L brilho · W olho · P pupila · C bochecha · . vazio
 */
const BODY = [
  "................",
  "................",
  "...OOOOOOOOOO...",
  "..OLLLLLLLLLLO..",
  ".OLBBBBBBBBBBBO.",
  ".OBBBBBBBBBBBBO.",
  ".OBBBBBBBBBBBBO.",
  ".OBBBBBBBBBBBBO.",
  ".OBCCBBOOBBCCBO.",
  ".OBBBBBBBBBBBBO.",
  "..OBBBBBBBBBBO..",
  "...OOOOOOOOOO...",
  "....OB....BO....",
  "....OO....OO....",
];

// Linhas 5 e 6 (olhos) para cada expressão.
const EYES: Record<string, [string, string]> = {
  open: [".OBBWWBBBBWWBBO.", ".OBBWPBBBBWPBBO."],
  closed: [".OBBBBBBBBBBBBO.", ".OBBOOBBBBOOBBO."],
  happy: [".OBBPBBBBBBPBBO.", ".OBPBPBBBBPBPBO."],
  sleepy: [".OBBBBBBBBBBBBO.", ".OBPPBBBBBBPPBO."],
  focused: [".OBBWWBBBBWWBBO.", ".OBBPWBBBBPWBBO."],
  confused: [".OBWWWBBBBBWWBO.", ".OBWPWBBBBBPWBO."],
};

const COLORS: Record<string, string> = {
  O: "#2e1065",
  B: "#8b5cf6",
  L: "#c4b5fd",
  W: "#ffffff",
  P: "#1e1b4b",
  C: "#f9a8d4",
};

function pixels(rows: string[], offsetY = 0) {
  const out: React.ReactElement[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      const fill = COLORS[ch];
      if (fill) out.push(<rect key={`${x}-${y + offsetY}`} x={x} y={y + offsetY} width={1.02} height={1.02} fill={fill} />);
    }
  });
  return out;
}

function eyeRows(kind: keyof typeof EYES) {
  return pixels(EYES[kind], 5);
}

export const PixelMascot = memo(function PixelMascot({
  mood = "idle",
  size = 48,
  className = "",
  title = "Vy, o mascote da Vysify",
}: {
  mood?: MascotMood;
  size?: number;
  className?: string;
  title?: string;
}) {
  const body = pixels(BODY.map((row, i) => (i === 5 || i === 6 ? ".OBBBBBBBBBBBBO." : row)));

  let eyes: React.ReactNode;
  if (mood === "sleeping") eyes = eyeRows("sleepy");
  else if (mood === "happy") eyes = eyeRows("happy");
  else if (mood === "confused") eyes = eyeRows("confused");
  else {
    const open = mood === "working" ? "focused" : "open";
    eyes = (
      <>
        <g className="vy-eyes-open">{eyeRows(open)}</g>
        <g className="vy-eyes-closed" style={{ opacity: 0 }}>{eyeRows("closed")}</g>
      </>
    );
  }

  return (
    <span className={`vy vy-${mood} inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="-1 -3 18 18" width={size} height={size} shapeRendering="crispEdges" role="img" aria-label={title}>
        <title>{title}</title>
        <g className="vy-bob">
          {/* antena */}
          <rect x={7} y={1} width={2} height={1.02} fill={COLORS.O} />
          <rect className="vy-antenna" x={7} y={0} width={2} height={1.02} fill="#fde047" />
          {body}
          {eyes}
        </g>

        {mood === "working" && (
          <g>
            <rect className="vy-dot" x={14.5} y={1} width={1} height={1} fill="#a78bfa" />
            <rect className="vy-dot" x={15.8} y={0} width={1} height={1} fill="#a78bfa" />
            <rect className="vy-dot" x={17.1} y={-1} width={1} height={1} fill="#a78bfa" />
          </g>
        )}
        {mood === "sleeping" && (
          <g fill="#a78bfa">
            <g className="vy-z"><rect x={13} y={0} width={2} height={0.6} /><rect x={13.7} y={0.6} width={0.6} height={0.6} /><rect x={13} y={1.2} width={2} height={0.6} /></g>
            <g className="vy-z"><rect x={14.5} y={-1.5} width={1.5} height={0.5} /><rect x={15} y={-1} width={0.5} height={0.5} /><rect x={14.5} y={-0.5} width={1.5} height={0.5} /></g>
          </g>
        )}
        {mood === "confused" && (
          <g fill="#fde047">
            <rect x={14} y={-2} width={2} height={1} />
            <rect x={16} y={-1} width={1} height={1} />
            <rect x={15} y={0} width={1} height={1} />
            <rect x={15} y={2} width={1} height={1} />
          </g>
        )}
        {mood === "happy" && (
          <g fill="#fde047">
            <rect x={-1} y={2} width={1} height={1} />
            <rect x={16} y={1} width={1} height={1} />
            <rect x={15} y={-1} width={1} height={1} />
          </g>
        )}
      </svg>
    </span>
  );
});
