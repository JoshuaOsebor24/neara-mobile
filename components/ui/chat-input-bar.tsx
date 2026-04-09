import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

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
            color={sendDisabled ? theme.colors.mutedText : "#082f49"}
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
    backgroundColor: "rgba(6, 12, 24, 0.98)",
    borderTopColor: "rgba(255,255,255,0.05)",
    borderTopWidth: 1,
    paddingBottom: theme.spacing.screenBottom,
    paddingHorizontal: theme.spacing.screenHorizontal,
    paddingTop: 10,
  },
  wrapper: {
    alignItems: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.98)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  wrapperActive: {
    borderColor: "rgba(56,189,248,0.24)",
    backgroundColor: "rgba(15, 23, 42, 1)",
  },
  input: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    marginRight: 10,
    maxHeight: 100,
    minHeight: 24,
    paddingBottom: 10,
    paddingLeft: 8,
    paddingRight: 0,
    paddingTop: 10,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "rgba(56,189,248,0.24)",
    borderRadius: 22,
    justifyContent: "center",
    height: 44,
    width: 44,
    ...theme.shadows.soft,
  },
  sendButtonActive: {
    backgroundColor: theme.colors.accent,
  },
  sendButtonDisabled: {
    backgroundColor: "rgba(148,163,184,0.18)",
    elevation: 0,
    shadowOpacity: 0,
  },
  sendButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
});
