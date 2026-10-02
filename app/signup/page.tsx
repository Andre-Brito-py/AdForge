import { getAppConfig } from "@/lib/config";
import { getLocale } from "next-intl/server";
import { SignupForm } from "./signup-form";

export async function generateMetadata() {
  return { title: (await getLocale()) === "en" ? "Create account" : "Criar conta" };
}

export default async function SignupPage() {
  const { signupCredits, googleLogin } = await getAppConfig();
  return <SignupForm googleEnabled={googleLogin.active} signupCredits={signupCredits} />;
}
