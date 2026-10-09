// IA simulada para os testes de ponta a ponta (sem custo e sem rede): responde no formato da API do Gemini
// para estratégia/textos, moderação de imagem e geração de imagem. Porta em MOCK_AI_PORT (padrão 54400).
import http from "node:http";
import zlib from "node:zlib";

const PORT = Number(process.env.MOCK_AI_PORT || 54400);

/** PNG sólido com uma faixa (para a imagem "gerada" ser reconhecível). */
function png(w, h, rgb, stripe) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = y > h * 0.4 && y < h * 0.6 ? stripe : rgb;
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const reply = (res, obj) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(obj) }] }, finishReason: "STOP" }] }));
};

const server = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  if (!req.url.includes(":generateContent")) {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "not found" }));
  }
  const json = JSON.parse(body || "{}");
  const text = (json.contents?.[0]?.parts || []).map((p) => p.text || "").join("\n");

  if (/image safety reviewer/i.test(text)) return reply(res, { allowed: true, hasPeople: false });
  if (body.includes('"IMAGE"')) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      candidates: [{ content: { role: "model", parts: [{ inlineData: { mimeType: "image/png", data: png(400, 500, [233, 213, 255], [124, 58, 237]).toString("base64") } }] }, finishReason: "STOP" }],
    }));
  }
  if (/You moderate change requests/.test(text)) return reply(res, { violation: false, outOfScope: false });
  // Revisões de quadro/direção de cena (vídeo) não são usadas no teste de imagem; respostas neutras.
  if (/score|reviewer/i.test(text) && !/create exactly/.test(text)) return reply(res, { score: 9, approved: true, problems: [] });

  const n = Number((text.match(/create exactly (\d+) distinct/) || [])[1] || 1);
  return reply(res, {
    violation: false,
    outOfScope: false,
    language: "pt-BR",
    analysis: "Garrafa térmica premium para quem treina.",
    hooks: ["Seu café ainda quente às 18h"],
    variants: Array.from({ length: n }, (_, i) => ({
      headline: ["Café quente por 12 horas", "Leve para qualquer lugar", "Frete grátis só hoje"][i % 3],
      copy: "Aço inox de verdade, tampa que não vaza e 12h de temperatura. ☕",
      cta: "Compre agora",
      hashtags: ["#garrafatermica", "#cafe", "#academia", "#Cafe"],
      visualConcept: "Bottle on a marble counter, morning light",
    })),
  });
});

server.listen(PORT, () => console.log(`mock AI on ${PORT}`));
