import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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
  const sendDisabled = disabled || !value.trim() || isSending;

  return (
    <View style={styles.container}>
      <View style={styles.wrapper}>
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
        <TouchableOpacity
          disabled={sendDisabled}
          onPress={onSend}
          style={[styles.sendButton, sendDisabled && styles.sendButtonDisabled]}
        >
          <Text
            style={[
              styles.sendButtonText,
              sendDisabled && styles.sendButtonTextDisabled,
            ]}
          >
            {isSending ? "Sending..." : "Send"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(10, 18, 32, 0.98)",
    borderTopColor: "rgba(255,255,255,0.06)",
    borderTopWidth: 1,
    paddingBottom: theme.spacing.screenBottom,
    paddingHorizontal: theme.spacing.screenHorizontal,
    paddingTop: 12,
  },
  wrapper: {
    alignItems: "flex-end",
    backgroundColor: theme.form.inputBackground,
    borderColor: theme.form.inputBorder,
    borderRadius: theme.radius.input,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  input: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    marginRight: 12,
    maxHeight: 100,
    minHeight: 20,
    paddingBottom: 0,
    paddingTop: 0,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.button,
    justifyContent: "center",
    minWidth: 96,
    paddingHorizontal: 18,
    paddingVertical: 12,
    ...theme.shadows.soft,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.border,
    elevation: 0,
    shadowOpacity: 0,
  },
  sendButtonText: {
    color: theme.colors.background,
    fontSize: 14,
    fontWeight: "600",
  },
  sendButtonTextDisabled: {
    color: theme.colors.mutedText,
  },
});
