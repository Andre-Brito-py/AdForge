import { googleEnabled } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  return (
    <LoginForm
      googleEnabled={googleEnabled}
      from={typeof sp.from === "string" ? sp.from : null}
      oauthError={typeof sp.error === "string" ? sp.error : null}
      expired={"expired" in sp}
    />
  );
}
