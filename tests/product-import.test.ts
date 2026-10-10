import { afterEach, describe, expect, it, vi } from "vitest";
import { isPrivateIp, safeFetch } from "@/lib/safe-fetch";
import {
  htmlToText, importProduct, mercadoLivreIds, normalizeProductUrl, parsePrice, parseProductPage,
} from "@/lib/product-import";
import { reviewsForPrompt } from "@/services/ai/text";
import { parseProductReviews } from "@/lib/validation";

describe("busca segura (SSRF)", () => {
  it("reconhece endereços internos", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "200.147.67.142", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });

  it("recusa esquemas, portas e hosts internos antes de conectar", async () => {
    for (const url of ["file:///etc/passwd", "ftp://x.com/a", "http://localhost/", "http://127.0.0.1/", "http://169.254.169.254/latest", "https://x.com:22/", "http://user:pw@x.com/", "http://[::1]/"]) {
      await expect(safeFetch(url), url).rejects.toMatchObject({ code: expect.stringMatching(/INVALID_URL|BLOCKED/) });
    }
  });
});

describe("leitura da página do produto", () => {
  const ld = (obj: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(obj)}</script></head><body></body></html>`;

  it("lê o schema.org/Product dentro de @graph, com oferta agregada e avaliações", () => {
    const html = ld({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", name: "Loja" },
        {
          "@type": "Product",
          name: "Garrafa Térmica 1L",
          description: "<p>Mantém gelado por <b>24h</b>.</p><ul><li>Inox</li></ul>",
          image: [{ "@type": "ImageObject", url: "/img/garrafa.jpg" }, "https://cdn.loja.com/2.jpg"],
          brand: { "@type": "Brand", name: "Gelada" },
          category: "Casa > Cozinha > Garrafas",
          offers: { "@type": "AggregateOffer", lowPrice: "89.90", priceCurrency: "BRL" },
          aggregateRating: { ratingValue: "4.76", reviewCount: "321" },
          review: [
            { reviewRating: { ratingValue: 5 }, reviewBody: "Gela muito, uso na academia todo dia." },
            { reviewRating: { ratingValue: 3 }, description: "A tampa vaza um pouco." },
            { reviewRating: { ratingValue: 4 } },
          ],
        },
      ],
    });
    const p = parseProductPage(html, "https://loja.com/produtos/garrafa");
    expect(p).toMatchObject({
      name: "Garrafa Térmica 1L", price: 89.9, currency: "BRL", brand: "Gelada", category: "Garrafas",
      rating: { value: 4.8, count: 321 },
    });
    expect(p.description).toBe("Mantém gelado por 24h.\n• Inox");
    expect(p.images).toEqual(["https://loja.com/img/garrafa.jpg", "https://cdn.loja.com/2.jpg"]);
    expect(p.reviews).toEqual([
      { rating: 5, text: "Gela muito, uso na academia todo dia." },
      { rating: 3, text: "A tampa vaza um pouco." },
    ]);
  });

  it("usa as metatags Open Graph quando não há JSON-LD", () => {
    const html = `<html><head><title>Fone X | Loja</title>
      <meta property="og:title" content="Fone Bluetooth X &amp; Case" />
      <meta property="og:image" content="//cdn.loja.com/fone.webp" />
      <meta property="product:price:amount" content="199,90" />
      <meta property="product:price:currency" content="brl" />
      <meta name="description" content="Som limpo e 30h de bateria." /></head></html>`;
    const p = parseProductPage(html, "https://loja.com/fone");
    expect(p).toMatchObject({ name: "Fone Bluetooth X & Case", price: 199.9, currency: "BRL", description: "Som limpo e 30h de bateria.", images: ["https://cdn.loja.com/fone.webp"] });
  });

  it("ignora JSON-LD inválido e pega o ProductGroup com variante", () => {
    const html = `<script type="application/ld+json">{ inválido </script>` + ld({
      "@type": "ProductGroup", name: "Camiseta",
      hasVariant: [{ "@type": "Product", image: "https://cdn/x.jpg", offers: { price: 59, priceCurrency: "BRL" } }],
    });
    expect(parseProductPage(html, "https://loja.com/c")).toMatchObject({ name: "Camiseta", price: 59, images: ["https://cdn/x.jpg"] });
  });
});

describe("utilitários", () => {
  it("entende preços em formatos brasileiro e americano", () => {
    expect(parsePrice("1.299,90")).toBe(1299.9);
    expect(parsePrice("1,299.90")).toBe(1299.9);
    expect(parsePrice("R$ 89,9")).toBe(89.9);
    expect(parsePrice("129.90")).toBe(129.9);
    expect(parsePrice("1.299")).toBe(1299);
    expect(parsePrice(59)).toBe(59);
    expect(parsePrice("grátis")).toBeNull();
    expect(parsePrice(0)).toBeNull();
  });

  it("acha o código do anúncio do Mercado Livre", () => {
    expect(mercadoLivreIds(new URL("https://produto.mercadolivre.com.br/MLB-3463371563-caixa-de-som-_JM"))).toEqual({ item: "MLB3463371563", catalog: null });
    expect(mercadoLivreIds(new URL("https://www.mercadolivre.com.br/caixa/p/MLB19568310?pdp_filters=item_id:MLB123456789"))).toMatchObject({ catalog: "MLB19568310" });
    expect(mercadoLivreIds(new URL("https://www.mercadolivre.com.br/caixa/p/MLB19568310?item_id=MLB4455667788"))).toEqual({ item: "MLB4455667788", catalog: "MLB19568310" });
  });

  it("normaliza o link colado", () => {
    expect(normalizeProductUrl("loja.com/produto/1")).toBe("https://loja.com/produto/1");
    expect(normalizeProductUrl("Olha esse: https://loja.com/p?id=2 que lindo")).toBe("https://loja.com/p?id=2");
    expect(() => normalizeProductUrl("não é link")).toThrow();
  });

  it("limpa HTML da descrição", () => {
    expect(htmlToText("<script>x()</script><p>Olá&nbsp;<strong>mundo</strong></p><br>Linha &#8212; 2")).toBe("Olá mundo\n\nLinha — 2");
  });
});

describe("Mercado Livre (API)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("traz anúncio, descrição e avaliações pela API oficial", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const path = new URL(input).pathname;
      calls.push(path);
      const body =
        path === "/items/MLB123456789" ? { id: "MLB123456789", title: "Caixa de Som JBL", price: 349.9, currency_id: "BRL", pictures: [{ secure_url: "https://http2.mlstatic.com/a.jpg" }], attributes: [{ id: "BRAND", value_name: "JBL" }] }
        : path.endsWith("/description") ? { plain_text: "Som potente.\nÀ prova d'água." }
        : path.startsWith("/reviews/item/") ? { reviews: [{ rate: 5, title: "Excelente", content: "Grave forte" }, { rate: 2, content: "" }], rating_average: 4.73, paging: { total: 812 } }
        : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
    const p = await importProduct("https://produto.mercadolivre.com.br/MLB-123456789-caixa-_JM");
    expect(p).toMatchObject({
      source: "mercadolivre", name: "Caixa de Som JBL", price: 349.9, currency: "BRL", brand: "JBL",
      images: ["https://http2.mlstatic.com/a.jpg"], rating: { value: 4.7, count: 812 },
      reviews: [{ rating: 5, text: "Excelente. Grave forte" }],
    });
    expect(p.description).toContain("À prova d'água.");
    expect(calls).toContain("/reviews/item/MLB123456789");
  });

  it("usa o token quando a API exige login", async () => {
    const auth: (string | null)[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      const header = (init?.headers as Record<string, string> | undefined)?.Authorization ?? null;
      auth.push(header);
      if (!header) return new Response("{}", { status: 403 });
      const path = new URL(input).pathname;
      const body = path === "/items/MLB999999" ? { id: "MLB999999", title: "Produto", price: 10, pictures: [{ url: "https://x/a.jpg" }] } : {};
      return new Response(JSON.stringify(body), { status: 200 });
    }));
    const p = await importProduct("https://produto.mercadolivre.com.br/MLB-999999-x", { mlToken: async () => "tok" });
    expect(p.name).toBe("Produto");
    expect(auth).toContain("Bearer tok");
  });
});

describe("avaliações no roteiro", () => {
  it("envia nota, total e trechos; nada quando não há avaliações", () => {
    const reviews = parseProductReviews(JSON.stringify({ rating: { value: 4.8, count: 1200 }, items: [{ rating: 5, text: "Ótimo" }, { rating: null, text: "Chegou rápido" }] }));
    expect(reviewsForPrompt(reviews)).toEqual({ average_rating: "4.8/5", total_reviews: 1200, samples: ["[5/5] Ótimo", "Chegou rápido"] });
    expect(reviewsForPrompt(null)).toBeNull();
    expect(reviewsForPrompt({ rating: null, items: [] })).toBeNull();
    expect(parseProductReviews("{lixo")).toBeNull();
    expect(parseProductReviews(JSON.stringify({ rating: null, items: [{ rating: 9, text: "x" }] }))).toBeNull();
  });
});
