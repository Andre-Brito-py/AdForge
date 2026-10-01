"use client";

// Último recurso: erro no layout raiz. Precisa renderizar <html> e <body> próprios.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#0f0f12", color: "#fafafa" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>A Vysify encontrou um problema</h1>
          <p style={{ opacity: 0.7, marginBottom: 24 }}>Tente recarregar a página em instantes.</p>
          <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 10, border: 0, background: "#7c3aed", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Recarregar
          </button>
        </div>
      </body>
    </html>
  );
}
