import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, handler, parseBody } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { PRE_ACCEPT_COOKIE, preAcceptCookieOptions, preAcceptValue, recordTermsAcceptance, TERMS_VERSION } from "@/lib/terms";

const bodySchema = z.object({ accept: z.literal(true), version: z.string().max(20) });

/**
 * Aceite dos Termos e da Privacidade.
 * - Logado (versão nova dos textos, ou conta criada pelo Google sem aceite): registra na hora.
 * - Sem login (checkbox antes do "Continuar com Google"): guarda um cookie assinado; a conta, criada na volta
 *   do Google, registra o aceite.
 */
export const POST = handler(async (request: Request) => {
  await enforceRateLimit(request, "terms-accept", 20, 60 * 60);
  const { version } = await parseBody(request, bodySchema);
  // A pessoa precisa ter visto a versão atual (a tela foi aberta antes de uma atualização dos textos?).
  if (version !== TERMS_VERSION) return NextResponse.json({ error: "outdated", version: TERMS_VERSION }, { status: 409 });

  const user = await getSessionUser();
  if (user) {
    await recordTermsAcceptance(user, "reaccept");
    return NextResponse.json({ success: true });
  }
  const res = NextResponse.json({ success: true, pending: true });
  res.cookies.set(PRE_ACCEPT_COOKIE, preAcceptValue(), preAcceptCookieOptions);
  return res;
});
