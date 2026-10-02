/**
 * Dados do fornecedor exigidos pelo Decreto 7.962/2013 (comércio eletrônico) e pela LGPD.
 * Preencha as variáveis NEXT_PUBLIC_COMPANY_* antes de colocar o site no ar.
 */
export const COMPANY = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || "[RAZÃO SOCIAL]",
  cnpj: process.env.NEXT_PUBLIC_COMPANY_CNPJ || "[CNPJ]",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "[ENDEREÇO COMPLETO]",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "suporte@vysify.com",
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "privacidade@vysify.com",
  // Representantes exigidos pela GDPR (art. 27) / UK GDPR para empresas sem sede na Europa
  // que atendem clientes de lá. Preencha quando contratar o serviço de representação.
  euRepresentative: process.env.NEXT_PUBLIC_EU_REPRESENTATIVE || "",
  ukRepresentative: process.env.NEXT_PUBLIC_UK_REPRESENTATIVE || "",
};

export const LEGAL_UPDATED_AT = "2 de outubro de 2026";
export const LEGAL_UPDATED_AT_EN = "October 2, 2026";
