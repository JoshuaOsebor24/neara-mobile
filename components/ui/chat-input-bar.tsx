import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { theme } from "@/constants/theme";

export function ChatInputBar({
  disabled,
  isSending,
  onChangeText,
  onSend,
  placeholder,
  value,
}: {
  disabled?: boolean;
  isSending?: boolean;
  onChangeText: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  value: string;
}) {
  const hasText = Boolean(value.trim());
  const sendDisabled = disabled || !hasText || isSending;

  return (
    <View style={styles.container}>
      <View style={[styles.wrapper, hasText && styles.wrapperActive]}>
        <TextInput
          blurOnSubmit={false}
          maxLength={4000}
          multiline
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.mutedText}
          style={styles.input}
          value={value}
        />
        <Pressable
          disabled={sendDisabled}
          onPress={onSend}
          style={({ pressed }) => [
            styles.sendButton,
            hasText && !sendDisabled && styles.sendButtonActive,
            sendDisabled && styles.sendButtonDisabled,
            pressed && !sendDisabled && styles.sendButtonPressed,
          ]}
        >
          <Ionicons
            color={
              sendDisabled
                ? theme.colors.mutedText
                : theme.colors.primaryTextOnAccent
            }
            name={isSending ? "time-outline" : "send"}
            size={18}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    paddingBottom: theme.spacing.screenBottom,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  wrapper: {
    alignItems: "flex-end",
    backgroundColor: "rgba(16, 24, 41, 0.98)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 9,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  wrapperActive: {
    borderColor: "rgba(96,143,255,0.30)",
    backgroundColor: "rgba(18, 29, 49, 1)",
  },
  input: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    marginRight: 10,
    maxHeight: 100,
    minHeight: 26,
    paddingBottom: 10,
    paddingLeft: 8,
    paddingRight: 0,
    paddingTop: 10,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "rgba(74,136,255,0.20)",
    borderRadius: 22,
    justifyContent: "center",
    height: 44,
    width: 44,
  },
  sendButtonActive: {
    backgroundColor: theme.colors.accent,
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(184,194,217,0.14)",
    elevation: 0,
    shadowOpacity: 0,
  },
  sendButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
});
