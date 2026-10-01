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
};

export const LEGAL_UPDATED_AT = "1º de outubro de 2026";
