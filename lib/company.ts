import { getAppConfig } from "./config";

/**
 * Dados do fornecedor exigidos pelo Decreto 7.962/2013 (comércio eletrônico) e pela LGPD,
 * mais os representantes exigidos pela GDPR (art. 27) / UK GDPR.
 * Editáveis em Admin › Configurações gerais (as variáveis NEXT_PUBLIC_COMPANY_* valem como reserva).
 */
export async function getCompany() {
  return (await getAppConfig()).settings.company;
}

export const LEGAL_UPDATED_AT = "9 de outubro de 2026";
export const LEGAL_UPDATED_AT_EN = "October 9, 2026";
