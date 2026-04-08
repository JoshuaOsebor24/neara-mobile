import Ionicons from "@expo/vector-icons/Ionicons";
import { type Href, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { theme } from "@/constants/theme";
import {
  buildSessionPatchFromAuthUser,
  loginWithBackend,
  refreshMobileSessionFromBackend,
} from "@/services/auth-api";
import { buildPostLoginHref } from "@/services/auth-routing";
import { showFlashFeedback } from "@/services/flash-feedback";
import {
  updateMobileSession,
  useMobileSession,
} from "@/services/mobile-session";

type Notice = {
  type: "error" | "success";
  text: string;
} | null;

type LoginErrors = {
  email?: string;
  password?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getLoginFieldError(field: "email" | "password", value: string) {
  if (field === "email") {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return "Email is required.";
    }

    return isValidEmail(trimmedValue) ? undefined : "Enter a valid email.";
  }

  if (!value.trim()) {
    return "Password is required.";
  }

  return value.length >= 6
    ? undefined
    : "Password must be at least 6 characters.";
}

export function AuthScreen({
  brandSubtitle,
  brandTitle,
  defaultReturnTo,
  footerHref,
  footerLinkLabel,
  footerPrefix,
  introEyebrow,
  introText,
  loginMode = "default",
  returnTo,
}: {
  brandSubtitle: string;
  brandTitle: string;
  defaultReturnTo: Href;
  footerHref: Href;
  footerLinkLabel: string;
  footerPrefix: string;
  introEyebrow: string;
  introText: string;
  loginMode?: "default" | "owner";
  returnTo?: string | null;
}) {
  const router = useRouter();
  const session = useMobileSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hydrated = true;
  const hasSession = session.isAuthenticated;

  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();
  const canSubmit =
    trimmedEmail.length > 0 &&
    trimmedPassword.length >= 6 &&
    !errors.email &&
    !errors.password &&
    !isSubmitting;

  useEffect(() => {
    if (!hydrated || !hasSession) {
      return;
    }

    const nextHref = buildPostLoginHref({
      fallbackHref: defaultReturnTo,
      isStoreOwner: session.isStoreOwner,
      primaryStoreId: session.primaryStoreId,
      returnTo,
    });

    router.replace(nextHref);
  }, [
    defaultReturnTo,
    hasSession,
    hydrated,
    loginMode,
    router,
    returnTo,
    session.isStoreOwner,
    session.primaryStoreId,
  ]);

  const setFieldValue = (field: "email" | "password", value: string) => {
    if (field === "email") {
      setEmail(value);
    } else {
      setPassword(value);
    }

    setErrors((current) => {
      const next = { ...current };
      const fieldError = getLoginFieldError(field, value);

      if (fieldError) {
        next[field] = fieldError;
      } else {
        delete next[field];
      }

      return next;
    });

    setNotice(null);
  };

  const handleFieldBlur = (field: "email" | "password") => {
    const value = field === "email" ? email : password;

    setErrors((current) => {
      const next = { ...current };
      const fieldError = getLoginFieldError(field, value);

      if (fieldError) {
        next[field] = fieldError;
      } else {
        delete next[field];
      }

      return next;
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    const nextErrors: LoginErrors = {};
    const emailError = getLoginFieldError("email", email);
    const passwordError = getLoginFieldError("password", password);

    if (emailError) {
      nextErrors.email = emailError;
    }

    if (passwordError) {
      nextErrors.password = passwordError;
    }

    setErrors(nextErrors);

    if (emailError || passwordError || !canSubmit) {
      setNotice(null);
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    const result = await loginWithBackend({
      email: trimmedEmail.toLowerCase(),
      password,
    });

    if (!result.ok) {
      setIsSubmitting(false);
      setNotice({
        type: "error",
        text: result.error,
      });
      return;
    }

    updateMobileSession(
      buildSessionPatchFromAuthUser(result.user, result.token),
    );

    await refreshMobileSessionFromBackend();

    setIsSubmitting(false);
    setNotice({
      type: "success",
      text: result.message || "Logged in successfully.",
    });
    showFlashFeedback(result.message || "Login successful.");

    router.replace(
      buildPostLoginHref({
        fallbackHref: defaultReturnTo,
        isStoreOwner: false,
        primaryStoreId: null,
        returnTo,
      }),
    );
  };

  if (!hydrated) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasSession) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Opening your account...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safeArea}>
      <StatusBar style="light" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.page}>
            <View style={styles.heroGlowPrimary} />
            <View style={styles.heroGlowSecondary} />
            <View style={styles.cardStack}>
              <View style={styles.brandHeader}>
                <View style={styles.brandBadge}>
                  <Text style={styles.brandBadgeText}>
                    {loginMode === "owner" ? "Store Access" : "Customer Access"}
                  </Text>
                </View>
                <View style={styles.brandMark}>
                  <View style={styles.brandGlow} />
                  <Text style={styles.brandMarkText}>N</Text>
                </View>

                <View style={styles.brandTextWrap}>
                  <Text style={styles.brandTitle}>{brandTitle}</Text>
                  <Text style={styles.brandSubtitle}>{brandSubtitle}</Text>
                </View>
              </View>

              <View style={styles.formCard}>
                <View style={styles.introBlock}>
                  <Text style={styles.introEyebrow}>{introEyebrow}</Text>
                  <Text style={styles.introText}>{introText}</Text>
                  <View style={styles.trustRow}>
                    <View style={styles.trustPill}>
                      <Ionicons
                        color={theme.colors.accent}
                        name="shield-checkmark-outline"
                        size={14}
                      />
                      <Text style={styles.trustPillText}>Real stores</Text>
                    </View>
                    <View style={styles.trustPill}>
                      <Ionicons
                        color={theme.colors.accent}
                        name="chatbubble-ellipses-outline"
                        size={14}
                      />
                      <Text style={styles.trustPillText}>Live chat</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.formStack}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <View
                      style={[
                        styles.inputShell,
                        errors.email && styles.inputShellError,
                      ]}
                    >
                      <Ionicons color="#64748b" name="mail-outline" size={18} />
                      <TextInput
                        autoCapitalize="none"
                        keyboardType="email-address"
                        onBlur={() => handleFieldBlur("email")}
                        onChangeText={(value) => setFieldValue("email", value)}
                        placeholder="Enter your email"
                        placeholderTextColor={theme.colors.mutedText}
                        selectionColor={theme.colors.accent}
                        style={styles.input}
                        value={email}
                      />
                    </View>
                    {errors.email ? (
                      <Text style={styles.errorText}>{errors.email}</Text>
                    ) : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Password</Text>
                    <View
                      style={[
                        styles.inputShell,
                        errors.password && styles.inputShellError,
                      ]}
                    >
                      <Ionicons
                        color="#64748b"
                        name="lock-closed-outline"
                        size={18}
                      />
                      <TextInput
                        autoCapitalize="none"
                        onBlur={() => handleFieldBlur("password")}
                        onChangeText={(value) =>
                          setFieldValue("password", value)
                        }
                        placeholder="Enter your password"
                        placeholderTextColor={theme.colors.mutedText}
                        secureTextEntry={!showPassword}
                        selectionColor={theme.colors.accent}
                        style={styles.input}
                        value={password}
                      />
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setShowPassword((current) => !current)}
                      >
                        <Ionicons
                          color="#94a3b8"
                          name={
                            showPassword ? "eye-off-outline" : "eye-outline"
                          }
                          size={18}
                        />
                      </TouchableOpacity>
                    </View>
                    {errors.password ? (
                      <Text style={styles.errorText}>{errors.password}</Text>
                    ) : null}
                  </View>

                  {notice ? (
                    <View
                      style={[
                        styles.notice,
                        notice.type === "error"
                          ? styles.noticeError
                          : styles.noticeSuccess,
                      ]}
                    >
                      <Text style={styles.noticeText}>{notice.text}</Text>
                    </View>
                  ) : null}

                  <Button
                    label={isSubmitting ? "Logging in..." : "Log In"}
                    onPress={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                  />
                </View>
              </View>

              <Text style={styles.footerText}>
                {footerPrefix}{" "}
                <Text
                  onPress={() => router.push(footerHref)}
                  style={styles.footerLink}
                >
                  {footerLinkLabel}
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 36,
  },
  page: {
    flex: 1,
    justifyContent: "center",
    position: "relative",
  },
  heroGlowPrimary: {
    position: "absolute",
    top: 20,
    left: -48,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(56, 189, 248, 0.10)",
  },
  heroGlowSecondary: {
    position: "absolute",
    right: -30,
    bottom: 90,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(125, 211, 252, 0.08)",
  },
  cardStack: {
    gap: 18,
  },
  brandHeader: {
    alignItems: "center",
    gap: 14,
    paddingTop: 8,
  },
  brandBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.20)",
    backgroundColor: "rgba(14, 165, 233, 0.10)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  brandBadgeText: {
    color: "#d8f3ff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  brandGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(56,189,248,0.16)",
    borderRadius: 24,
  },
  brandMarkText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },
  brandTextWrap: {
    alignItems: "center",
    gap: 6,
  },
  brandTitle: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  brandSubtitle: {
    color: theme.colors.mutedText,
    fontSize: 15,
  },
  formCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(16, 26, 46, 0.92)",
    padding: 22,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.34,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  introBlock: {
    marginBottom: 22,
  },
  introEyebrow: {
    color: "#c7ecff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.9,
    textTransform: "uppercase",
  },
  introText: {
    marginTop: 10,
    color: "#e5edf7",
    fontSize: 16,
    lineHeight: 24,
  },
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  trustPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trustPillText: {
    color: "#d9e7f5",
    fontSize: 12,
    fontWeight: "700",
  },
  formStack: {
    gap: 18,
  },
  fieldGroup: {
    gap: 9,
  },
  fieldLabel: {
    color: "#d1dae7",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(6, 12, 25, 0.84)",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputShellError: {
    borderColor: "rgba(244,63,94,0.4)",
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    paddingVertical: 0,
  },
  errorText: {
    color: "#fda4af",
    fontSize: 12,
  },
  notice: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeError: {
    borderColor: "rgba(244,63,94,0.2)",
    backgroundColor: "rgba(244,63,94,0.12)",
  },
  noticeSuccess: {
    borderColor: "rgba(52,211,153,0.2)",
    backgroundColor: "rgba(52,211,153,0.12)",
  },
  noticeText: {
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  submitButton: {
    borderRadius: 20,
    backgroundColor: theme.colors.text,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  submitButtonText: {
    color: "#020617",
    fontSize: 16,
    fontWeight: "800",
  },
  submitButtonTextDisabled: {
    color: "#cbd5e1",
  },
  footerText: {
    color: "#94a3b8",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  footerLink: {
    color: "#dbeafe",
    fontWeight: "700",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: theme.colors.text,
    fontSize: 15,
  },
});
