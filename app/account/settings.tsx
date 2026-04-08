import { Button } from "@/components/ui/button";
import { useRouter } from "expo-router";
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

import { BackPillButton } from "@/components/ui/back-pill-button";
import { BrandPill } from "@/components/ui/brand-pill";
import { ScreenCard } from "@/components/ui/screen-card";
import { theme } from "@/constants/theme";
import {
  buildSessionPatchFromAuthUser,
  updateCurrentUserWithBackend,
} from "@/services/auth-api";
import {
  resetMobileSession,
  updateMobileSession,
  useMobileSession,
} from "@/services/mobile-session";

type EditingField = "email" | "name" | "phone" | null;

export default function SettingsScreen() {
  const router = useRouter();
  const session = useMobileSession();
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [settingsName, setSettingsName] = useState(session.name);
  const [settingsEmail, setSettingsEmail] = useState(session.email);
  const [settingsPhone, setSettingsPhone] = useState(session.phoneNumber);
  const [settingsNotice, setSettingsNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!session.isAuthenticated) {
      router.replace("/login");
    }
  }, [router, session.isAuthenticated]);

  useEffect(() => {
    setSettingsName(session.name);
    setSettingsEmail(session.email);
    setSettingsPhone(session.phoneNumber);
  }, [session.email, session.name, session.phoneNumber]);

  const handleSaveSettings = async () => {
    if (!session.authToken || isSaving) {
      return;
    }

    setIsSaving(true);
    const result = await updateCurrentUserWithBackend(session.authToken, {
      email: settingsEmail.trim() || session.email,
      name: settingsName.trim() || session.name,
      phone_number: settingsPhone.trim() || undefined,
    });

    if (!result.ok) {
      setIsSaving(false);
      setSettingsNotice(result.error);
      setTimeout(() => setSettingsNotice(""), 2400);
      return;
    }

    updateMobileSession(
      buildSessionPatchFromAuthUser(result.user, session.authToken),
    );
    setIsSaving(false);
    setSettingsNotice(result.message || "Account updated successfully.");
    setTimeout(() => setSettingsNotice(""), 2400);
  };

  const handleLogout = () => {
    resetMobileSession();
    router.replace("/login");
  };

  if (!session.isAuthenticated) {
    return (
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Opening login...</Text>
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
            <View style={styles.header}>
              <BackPillButton fallbackHref="/(tabs)/home" />
              <Text style={styles.headerBrand}>Neara</Text>
            </View>

            <ScreenCard style={styles.panel}>
              <BrandPill label="Neara" />
              <Text style={styles.title}>Settings</Text>

              <View style={styles.settingsStack}>
                <View>
                  <Text style={styles.groupLabel}>Account</Text>
                  <View style={styles.settingsGroup}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() =>
                        setEditingField((current) =>
                          current === "name" ? null : "name",
                        )
                      }
                      style={styles.settingRow}
                    >
                      <Text style={styles.settingLabel}>Display name</Text>
                      <Text style={styles.settingValue}>
                        {settingsName || "Add name"}
                      </Text>
                    </TouchableOpacity>
                    {editingField === "name" ? (
                      <View style={styles.inlineFieldWrap}>
                        <TextInput
                          onChangeText={setSettingsName}
                          placeholder="Your name"
                          placeholderTextColor="#64748b"
                          selectionColor={theme.colors.accent}
                          style={styles.textField}
                          value={settingsName}
                        />
                      </View>
                    ) : null}

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() =>
                        setEditingField((current) =>
                          current === "email" ? null : "email",
                        )
                      }
                      style={styles.settingRow}
                    >
                      <Text style={styles.settingLabel}>Email</Text>
                      <Text numberOfLines={1} style={styles.settingValue}>
                        {settingsEmail || "Add email"}
                      </Text>
                    </TouchableOpacity>
                    {editingField === "email" ? (
                      <View style={styles.inlineFieldWrap}>
                        <TextInput
                          autoCapitalize="none"
                          keyboardType="email-address"
                          onChangeText={setSettingsEmail}
                          placeholder="you@example.com"
                          placeholderTextColor="#64748b"
                          selectionColor={theme.colors.accent}
                          style={styles.textField}
                          value={settingsEmail}
                        />
                      </View>
                    ) : null}

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() =>
                        setEditingField((current) =>
                          current === "phone" ? null : "phone",
                        )
                      }
                      style={styles.settingRow}
                    >
                      <Text style={styles.settingLabel}>Phone</Text>
                      <Text numberOfLines={1} style={styles.settingValue}>
                        {settingsPhone || "Add phone number"}
                      </Text>
                    </TouchableOpacity>
                    {editingField === "phone" ? (
                      <View style={styles.inlineFieldWrap}>
                        <TextInput
                          keyboardType="phone-pad"
                          onChangeText={setSettingsPhone}
                          placeholder="0800 000 0000"
                          placeholderTextColor="#64748b"
                          selectionColor={theme.colors.accent}
                          style={styles.textField}
                          value={settingsPhone}
                        />
                      </View>
                    ) : null}
                  </View>
                </View>

                <View>
                  <Text style={styles.groupLabel}>Preferences</Text>
                  <View style={styles.settingsGroup}>
                    <View style={styles.preferenceRow}>
                      <Text style={styles.settingLabel}>
                        Location suggestions
                      </Text>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>On</Text>
                      </View>
                    </View>

                    <View style={styles.preferenceRow}>
                      <Text style={styles.settingLabel}>Saved sync</Text>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>On</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.logoutSection}>
                  <TouchableOpacity activeOpacity={0.85} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Log out</Text>
                  </TouchableOpacity>
                </View>

                {settingsNotice ? (
                  <View style={styles.notice}>
                    <Text style={styles.noticeText}>{settingsNotice}</Text>
                  </View>
                ) : null}

                <Button
                  label={isSaving ? "Saving..." : "Save Changes"}
                  onPress={() => void handleSaveSettings()}
                  disabled={isSaving}
                />
              </View>
            </ScreenCard>
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  loadingWrap: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    color: theme.colors.mutedText,
    fontSize: 14,
    textAlign: "center",
  },
  page: {
    width: "100%",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  headerBrand: {
    color: "#94a3b8",
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  panel: {
    padding: 20,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: "700",
    marginTop: 16,
  },
  settingsStack: {
    gap: 28,
    marginTop: 28,
  },
  groupLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  settingsGroup: {
    borderBottomColor: "rgba(255,255,255,0.10)",
    borderBottomWidth: 1,
    borderTopColor: "rgba(255,255,255,0.10)",
    borderTopWidth: 1,
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  settingLabel: {
    color: "#cbd5e1",
    fontSize: 14,
  },
  settingValue: {
    color: theme.colors.text,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "500",
    textAlign: "right",
  },
  inlineFieldWrap: {
    paddingBottom: 16,
  },
  textField: {
    backgroundColor: "rgba(2, 6, 23, 0.6)",
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    borderWidth: 1,
    color: theme.colors.text,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  preferenceRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  statusPill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: {
    color: "#d1fae5",
    fontSize: 12,
    fontWeight: "600",
  },
  logoutSection: {
    borderTopColor: "rgba(255,255,255,0.10)",
    borderTopWidth: 1,
    paddingTop: 4,
  },
  logoutText: {
    color: "#fda4af",
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 16,
  },
  notice: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.18)",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticeText: {
    color: "#d1fae5",
    fontSize: 14,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "700",
  },
});
