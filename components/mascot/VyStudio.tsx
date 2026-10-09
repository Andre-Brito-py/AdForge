"use client";

import { PixelMascot } from "./PixelMascot";

/**
 * Vy trabalhando no "estúdio" enquanto a campanha é gerada: mesa de edição com monitor, rolo de filme correndo,
 * claquete batendo a cada cena (vídeo) ou flash de câmera (imagem). Só CSS/SVG, sem bibliotecas; respeita
 * "reduzir movimento" do sistema. `progress` (0–100) enche o monitor quadro a quadro.
 */
export function VyStudio({ kind, progress, done }: { kind: "VIDEO" | "IMAGE"; progress: number; done?: boolean }) {
  const frames = 6;
  const filled = Math.max(0, Math.min(frames, Math.round((progress / 100) * frames)));

  return (
    <div className="vy-studio relative mx-auto h-56 w-full max-w-sm select-none" aria-hidden="true">
      <style>{`
        @keyframes vy-film { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes vy-clap { 0%, 70%, 100% { transform: rotate(-24deg); } 78% { transform: rotate(0deg); } }
        @keyframes vy-flash { 0%, 82%, 100% { opacity: 0; } 86% { opacity: .9; } }
        @keyframes vy-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes vy-type { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(2px); } }
        @keyframes vy-spark { 0% { opacity: 0; transform: translateY(6px) scale(.6); } 40% { opacity: 1; } 100% { opacity: 0; transform: translateY(-18px) scale(1); } }
        @keyframes vy-scan { from { transform: translateY(-100%); } to { transform: translateY(100%); } }
        .vy-studio .vy-film { animation: vy-film 3.2s linear infinite; }
        .vy-studio .vy-clap { animation: vy-clap 2.4s ease-in-out infinite; transform-origin: 6px 14px; }
        .vy-studio .vy-flash { animation: vy-flash 2.4s ease-out infinite; }
        .vy-studio .vy-bob { animation: vy-bob 1.6s ease-in-out infinite; }
        .vy-studio .vy-type { animation: vy-type .35s ease-in-out infinite; }
        .vy-studio .vy-spark { animation: vy-spark 1.8s ease-out infinite; }
        .vy-studio .vy-scan { animation: vy-scan 2.2s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .vy-studio * { animation: none !important; }
        }
      `}</style>

      {/* Rolo de filme correndo ao fundo */}
      <div className="absolute inset-x-0 top-3 overflow-hidden opacity-60">
        <div className={`flex w-[200%] ${done ? "" : "vy-film"}`}>
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="mx-1 h-9 w-12 shrink-0 rounded-sm border-y-4 border-dashed border-foreground/25 bg-brand/15" />
          ))}
        </div>
      </div>

      {/* Monitor: os quadros acendem conforme o progresso */}
      <div className="absolute left-1/2 top-16 w-44 -translate-x-1/2">
        <div className="relative overflow-hidden rounded-xl border-2 border-foreground/20 bg-background p-2 shadow-lg">
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: frames }).map((_, i) => (
              <div key={i} className={`aspect-video rounded-sm transition-colors duration-700 ${i < filled ? "bg-brand/70" : "bg-muted"}`} />
            ))}
          </div>
          {!done && <div className="vy-scan pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-b from-transparent via-brand/15 to-transparent" />}
        </div>
        <div className="mx-auto h-3 w-6 bg-foreground/20" />
        <div className="mx-auto h-1.5 w-20 rounded-full bg-foreground/20" />
      </div>

      {/* Vy na mesa, "digitando" */}
      <div className={`absolute bottom-2 left-4 ${done ? "" : "vy-bob"}`}>
        <PixelMascot mood={done ? "happy" : "working"} size={72} />
        <div className={`mx-auto -mt-1 h-2 w-14 rounded bg-foreground/25 ${done ? "" : "vy-type"}`} />
      </div>

      {/* Claquete (vídeo) ou câmera com flash (imagem) */}
      <div className="absolute bottom-6 right-6">
        {kind === "VIDEO" ? (
          <svg width="56" height="48" viewBox="0 0 56 48" className="text-foreground">
            <rect x="4" y="16" width="48" height="28" rx="3" className="fill-foreground/80" />
            <g className={done ? "" : "vy-clap"}>
              <rect x="4" y="6" width="48" height="10" rx="2" className="fill-foreground" />
              {[0, 1, 2, 3].map((i) => <rect key={i} x={8 + i * 12} y="6" width="6" height="10" className="fill-background" transform="skewX(-20)" />)}
            </g>
            <rect x="10" y="24" width="20" height="3" rx="1" className="fill-background/70" />
            <rect x="10" y="31" width="30" height="3" rx="1" className="fill-background/70" />
          </svg>
        ) : (
          <div className="relative">
            <svg width="56" height="44" viewBox="0 0 56 44">
              <rect x="4" y="12" width="48" height="30" rx="5" className="fill-foreground/80" />
              <rect x="18" y="6" width="20" height="8" rx="2" className="fill-foreground/80" />
              <circle cx="28" cy="27" r="9" className="fill-background" />
              <circle cx="28" cy="27" r="5" className="fill-brand" />
            </svg>
            {!done && <div className="vy-flash absolute -inset-4 rounded-full bg-white blur-md" />}
          </div>
        )}
      </div>

      {/* Faíscas de "ideia" */}
      {!done && [0, 1, 2].map((i) => (
        <span key={i} className="vy-spark absolute h-2 w-2 rounded-full bg-brand" style={{ left: `${30 + i * 8}%`, bottom: "38%", animationDelay: `${i * 0.6}s` }} />
      ))}
    </div>
  );
}
