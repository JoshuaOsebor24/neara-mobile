import { useLocalSearchParams } from "expo-router";

import { AuthScreen } from "@/components/auth/auth-screen";

export default function LoginScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();

  return (
    <AuthScreen
      brandSubtitle="Find stores around you"
      brandTitle="Neara"
      defaultReturnTo="/"
      footerHref="/signup"
      footerLinkLabel="Sign up"
      footerPrefix="Don't have an account?"
      introEyebrow="Welcome back"
      introText="Use one Neara account across Pro and store mode."
      returnTo={typeof params.returnTo === "string" ? params.returnTo : null}
    />
  );
}
