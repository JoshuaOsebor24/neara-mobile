import Ionicons from "@expo/vector-icons/Ionicons";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { theme } from "@/constants/theme";

type FormFieldProps = {
  label: string;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  error?: string;
  hint?: string;
  inputProps?: TextInputProps;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  rightIcon?: React.ComponentProps<typeof Ionicons>["name"];
  multiline?: boolean;
};

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  error,
  hint,
  inputProps,
  style,
  inputStyle,
  rightIcon,
  multiline,
}: FormFieldProps) {
  return (
    <View style={[styles.field, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {rightIcon ? (
          <Ionicons name={rightIcon} size={14} color={theme.colors.mutedText} />
        ) : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor || theme.colors.mutedText}
        selectionColor={theme.colors.accent}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multilineInput, inputStyle]}
        {...inputProps}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: theme.colors.mutedText,
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    minHeight: theme.controls.inputHeight,
    borderRadius: theme.radius.input,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: theme.form.inputBackground,
    color: theme.colors.text,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  multilineInput: {
    minHeight: 108,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    lineHeight: 18,
  },
  hintText: {
    color: theme.colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
});
