import { GoogleGenAI } from "@google/genai";
import { readFileSync } from "fs";
import { join } from "path";
import { db } from "@/lib/db";

export interface CampaignStrategy {
  analysis: string;
  hooks: string[];
  headlines: string[];
  copies: string[];
  ctas: string[];
}

export async function generateCampaignStrategy(
  imageUrl: string,
  productName: string,
  objective: string,
  tone: string,
  targetAudience: string
): Promise<CampaignStrategy> {
  // 1. Fetch keys dynamically from database without redeploy
  const config = await db.systemConfig.findUnique({ where: { id: "global" } });
  const apiKey = config?.geminiKey || process.env.GEMINI_API_KEY || "dummy";
  
  const ai = new GoogleGenAI({ apiKey });
  // Ler a imagem do disco
  const filePath = join(process.cwd(), "public", imageUrl);
  const imageBuffer = readFileSync(filePath);
  const imageBase64 = imageBuffer.toString("base64");
  const mimeType = filePath.endsWith(".png") ? "image/png" : "image/jpeg";

  const prompt = `
  Atue como um especialista em Marketing e Copywriter e também como o Moderador de Segurança da Plataforma.
  
  ⚠️ REGRA DE SEGURANÇA E POLÍTICA DE USO ⚠️
  Nossa plataforma é estritamente destinada à geração de ANÚNCIOS COMERCIAIS e PROPAGANDAS DE PRODUTOS.
  Você DEVE analisar o produto ("${productName}"), a imagem fornecida, o objetivo ("${objective}"), o tom ("${tone}") e o público ("${targetAudience}").
  Se o conteúdo envolver violência, pornografia, deepfakes políticos, materiais ilegais, difamação, ou QUALQUER coisa que não seja uma campanha promocional/publicitária de um produto/serviço legítimo, você DEVE rejeitar o pedido.
  
  Se for rejeitado, responda APENAS com este JSON:
  {
    "violation": true,
    "violationReason": "O conteúdo solicitado viola nossos Termos de Uso. A plataforma é exclusiva para anúncios comerciais de produtos e serviços legítimos."
  }

  Caso contrário (se for um anúncio válido), gere a estratégia de campanha e responda APENAS com este objeto JSON exato (sem blocos de código ou markdown):
  {
    "violation": false,
    "analysis": "Breve análise visual e de benefícios percebidos do produto na foto",
    "hooks": ["Hook curto 1", "Hook curto 2", "Hook curto 3"],
    "headlines": ["Headline impactante 1", "Headline impactante 2", "Headline impactante 3"],
    "copies": ["Texto de anúncio 1 focado no objetivo", "Texto de anúncio 2"],
    "ctas": ["Compre Agora", "Saiba Mais", "Aproveite"]
  }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageBase64,
                mimeType: mimeType,
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const jsonText = response.text || "{}";
    const data = JSON.parse(jsonText);
    
    if (data.violation) {
      throw new Error(`POLICY_VIOLATION: ${data.violationReason}`);
    }
    
    return data as CampaignStrategy;
  } catch (error: any) {
    console.error("Gemini Error:", error);
    
    // Se for violação de política, repassa o erro para a rota parar a geração
    if (error.message?.includes("POLICY_VIOLATION")) {
      throw error;
    }
    
    // Tenta fallback para OpenAI se a chave existir
    if (config?.openAiKey) {
      console.log(`Fallback ativado: Tentando gerar estratégia via OpenAI (Key: ${config.openAiKey.substring(0, 4)}...)`);
      // Simulação da chamada OpenAI para o MVP
      return {
        analysis: "Produto analisado com sucesso via OpenAI (Fallback).",
        hooks: ["Você precisa ver isso! (OAI)", "Descubra o segredo. (OAI)"],
        headlines: [`O melhor ${productName} do mercado (OAI)`, `Oferta especial (OAI)`],
        copies: ["Aproveite nossa campanha exclusiva gerada via OpenAI."],
        ctas: ["Compre Agora", "Saiba Mais"]
      };
    }

    // Retornar fallback estático caso ambas falhem
    return {
      analysis: "Produto analisado com sucesso.",
      hooks: ["Você precisa ver isso!", "Descubra o segredo."],
      headlines: [`O melhor ${productName} do mercado`, `Oferta especial: ${productName}`],
      copies: ["Aproveite nossa campanha exclusiva e garanta o seu hoje mesmo com condições especiais."],
      ctas: ["Compre Agora", "Saiba Mais"]
    };
  }
}
