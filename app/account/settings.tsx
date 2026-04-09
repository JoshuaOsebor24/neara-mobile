import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
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
  const [locationSuggestions, setLocationSuggestions] = useState(true);
  const [savedSync, setSavedSync] = useState(true);

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
                      activeOpacity={0.7}
                      onPress={() =>
                        setEditingField((current) =>
                          current === "name" ? null : "name",
                        )
                      }
                      style={styles.settingRow}
                    >
                      <Text style={styles.settingLabel}>Display name</Text>
                      <View style={styles.settingValueRow}>
                        <Text style={styles.settingValue}>
                          {settingsName || "Add name"}
                        </Text>
                        <Ionicons
                          color="#64748b"
                          name="chevron-forward"
                          size={16}
                        />
                      </View>
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
                      activeOpacity={0.7}
                      onPress={() =>
                        setEditingField((current) =>
                          current === "email" ? null : "email",
                        )
                      }
                      style={styles.settingRow}
                    >
                      <Text style={styles.settingLabel}>Email</Text>
                      <View style={styles.settingValueRow}>
                        <Text numberOfLines={1} style={styles.settingValue}>
                          {settingsEmail || "Add email"}
                        </Text>
                        <Ionicons
                          color="#64748b"
                          name="chevron-forward"
                          size={16}
                        />
                      </View>
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
                      activeOpacity={0.7}
                      onPress={() =>
                        setEditingField((current) =>
                          current === "phone" ? null : "phone",
                        )
                      }
                      style={styles.settingRow}
                    >
                      <Text style={styles.settingLabel}>Phone</Text>
                      <View style={styles.settingValueRow}>
                        {settingsPhone ? (
                          <Text numberOfLines={1} style={styles.settingValue}>
                            {settingsPhone}
                          </Text>
                        ) : (
                          <View style={styles.addPhoneRow}>
                            <Ionicons
                              color="#38bdf8"
                              name="add-circle-outline"
                              size={16}
                              style={styles.addIcon}
                            />
                            <Text style={styles.addPhoneText}>
                              Add phone number
                            </Text>
                          </View>
                        )}
                        <Ionicons
                          color="#64748b"
                          name="chevron-forward"
                          size={16}
                        />
                      </View>
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
                      <Switch
                        trackColor={{
                          false: "#374151",
                          true: "rgba(56, 189, 248, 0.3)",
                        }}
                        thumbColor={locationSuggestions ? "#38bdf8" : "#9ca3af"}
                        ios_backgroundColor="#374151"
                        onValueChange={setLocationSuggestions}
                        value={locationSuggestions}
                      />
                    </View>

                    <View style={styles.preferenceRow}>
                      <Text style={styles.settingLabel}>Saved sync</Text>
                      <Switch
                        trackColor={{
                          false: "#374151",
                          true: "rgba(56, 189, 248, 0.3)",
                        }}
                        thumbColor={savedSync ? "#38bdf8" : "#9ca3af"}
                        ios_backgroundColor="#374151"
                        onValueChange={setSavedSync}
                        value={savedSync}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.logoutSection}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleLogout}
                    style={styles.logoutRow}
                  >
                    <Ionicons
                      color="#fda4af"
                      name="log-out-outline"
                      size={16}
                      style={styles.logoutIcon}
                    />
                    <Text style={styles.logoutText}>Log out</Text>
                  </TouchableOpacity>
                </View>

                {settingsNotice ? (
                  <View style={styles.notice}>
                    <Text style={styles.noticeText}>{settingsNotice}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={isSaving}
                  onPress={() => void handleSaveSettings()}
                  style={[
                    styles.saveButton,
                    isSaving && styles.saveButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.saveButtonText,
                      isSaving && styles.saveButtonTextDisabled,
                    ]}
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Text>
                </TouchableOpacity>
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
  settingValueRow: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 8,
  },
  addPhoneRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  addIcon: {
    marginTop: 1,
  },
  addPhoneText: {
    color: "#38bdf8",
    fontSize: 14,
    fontWeight: "500",
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
  logoutSection: {
    borderTopColor: "rgba(255,255,255,0.10)",
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 16,
  },
  logoutRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutIcon: {
    marginTop: 1,
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
  saveButton: {
    alignItems: "center",
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    borderColor: "rgba(56, 189, 248, 0.20)",
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#38bdf8",
    fontSize: 16,
    fontWeight: "600",
  },
  saveButtonTextDisabled: {
    color: "#64748b",
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
