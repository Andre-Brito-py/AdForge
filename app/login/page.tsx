import { isGoogleLoginActive } from "@/lib/auth";
import { getLocale } from "next-intl/server";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  return { title: (await getLocale()) === "en" ? "Sign in" : "Entrar" };
}

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  return (
    <LoginForm
      googleEnabled={await isGoogleLoginActive()}
      from={typeof sp.from === "string" ? sp.from : null}
      oauthError={typeof sp.error === "string" ? sp.error : null}
      expired={"expired" in sp}
    />
  );
}
