import { googleEnabled } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Criar conta" };

export default async function SignupPage() {
  const { signupCredits } = await getAppConfig();
  return <SignupForm googleEnabled={googleEnabled} signupCredits={signupCredits} />;
}
