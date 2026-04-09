import { AuthScreen } from "@/components/auth/auth-screen";

export default function LoginScreen() {
  return (
    <AuthScreen
      brandSubtitle="Find stores around you"
      brandTitle="Neara"
      defaultReturnTo="/(tabs)/home"
      footerHref="/signup"
      footerLinkLabel="Sign up"
      footerPrefix="Don't have an account?"
      introEyebrow="Welcome back"
      introText="Use one Neara account across Pro and store mode."
    />
  );
}
