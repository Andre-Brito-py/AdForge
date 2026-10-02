import { COMPANY } from "@/lib/company";
import { CookieSettingsButton } from "@/components/consent/ConsentManager";

const ROWS = {
  pt: [
    ["next-auth.session-token", "Essencial", "Mantém você conectado à sua conta.", "30 dias"],
    ["next-auth.csrf-token / callback-url", "Essencial", "Protege o login contra ataques (CSRF) e lembra para onde voltar.", "Sessão"],
    ["NEXT_LOCALE", "Essencial", "Idioma da interface.", "1 ano"],
    ["CURRENCY", "Essencial", "Moeda dos preços.", "1 ano"],
    ["TZ", "Essencial", "Fuso horário, para mostrar datas no seu horário.", "1 ano"],
    ["vysify_consent", "Essencial", "Guarda suas escolhas de cookies.", "6 meses"],
    ["meta_oauth_nonce", "Essencial", "Segurança temporária ao conectar o Facebook/Instagram.", "10 minutos"],
    ["theme, vy-hidden (armazenamento local)", "Essencial", "Tema claro/escuro e se o mascote está oculto.", "Até você limpar"],
  ],
  en: [
    ["next-auth.session-token", "Essential", "Keeps you signed in to your account.", "30 days"],
    ["next-auth.csrf-token / callback-url", "Essential", "Protects sign-in against CSRF attacks and remembers where to return.", "Session"],
    ["NEXT_LOCALE", "Essential", "Interface language.", "1 year"],
    ["CURRENCY", "Essential", "Price currency.", "1 year"],
    ["TZ", "Essential", "Time zone, to show dates in your local time.", "1 year"],
    ["vysify_consent", "Essential", "Stores your cookie choices.", "6 months"],
    ["meta_oauth_nonce", "Essential", "Temporary security while connecting Facebook/Instagram.", "10 minutes"],
    ["theme, vy-hidden (local storage)", "Essential", "Light/dark theme and whether the mascot is hidden.", "Until you clear it"],
  ],
};

const OPTIONAL = {
  pt: [
    ["_ga, _ga_*", "Análise (Google Analytics)", "Estatísticas anônimas de uso. Só com o seu consentimento e se estiver ativado.", "Até 2 anos"],
    ["_fbp", "Marketing (Meta Pixel)", "Medição de campanhas de anúncios. Só com o seu consentimento e se estiver ativado.", "3 meses"],
  ],
  en: [
    ["_ga, _ga_*", "Analytics (Google Analytics)", "Anonymous usage statistics. Only with your consent and if enabled.", "Up to 2 years"],
    ["_fbp", "Marketing (Meta Pixel)", "Ad campaign measurement. Only with your consent and if enabled.", "3 months"],
  ],
};

export function CookiesPolicy({ locale }: { locale: "pt" | "en" }) {
  const pt = locale === "pt";
  const head = pt ? ["Nome", "Tipo", "Para que serve", "Duração"] : ["Name", "Type", "Purpose", "Duration"];
  const table = (rows: string[][]) => (
    <div className="my-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r[0]}>{r.map((c, i) => <td key={i} className={`px-3 py-2 align-top ${i === 0 ? "font-mono text-xs text-foreground" : "text-muted-foreground"}`}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{pt ? "Política de Cookies" : "Cookie Policy"}</h1>
      <p className="mt-6">
        {pt
          ? "Cookies são pequenos arquivos guardados no seu navegador. A Vysify usa apenas o necessário para funcionar. Cookies opcionais de análise e marketing só são usados se estiverem ativados e depois que você der consentimento."
          : "Cookies are small files stored in your browser. Vysify uses only what it needs to work. Optional analytics and marketing cookies are only used if enabled and after you give your consent."}
      </p>

      <h2>{pt ? "Cookies essenciais" : "Essential cookies"}</h2>
      <p>{pt ? "Necessários para o site funcionar; por isso não dependem de consentimento." : "Required for the site to work, so they don't require consent."}</p>
      {table(ROWS[locale])}

      <h2>{pt ? "Cookies opcionais" : "Optional cookies"}</h2>
      <p>
        {pt
          ? "Só são carregados se o recurso estiver ativado pela Vysify e você aceitar. Você pode recusar sem perder nenhuma funcionalidade."
          : "Only loaded if the feature is enabled by Vysify and you accept. You can refuse without losing any functionality."}
      </p>
      {table(OPTIONAL[locale])}

      <h2>{pt ? "Como mudar suas escolhas" : "How to change your choices"}</h2>
      <p>
        {pt ? "Você pode mudar ou retirar o consentimento a qualquer momento: " : "You can change or withdraw your consent at any time: "}
        <CookieSettingsButton className="font-medium text-brand underline underline-offset-4" />.{" "}
        {pt ? "Também é possível apagar cookies nas configurações do seu navegador." : "You can also delete cookies in your browser settings."}
      </p>
      <p>
        {pt ? "Dúvidas: " : "Questions: "}
        <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>
      </p>
    </>
  );
}
