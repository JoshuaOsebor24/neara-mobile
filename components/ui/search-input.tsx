import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Pressable,
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

type SearchInputInputProps = TextInputProps & {
  inputStyle?: StyleProp<TextStyle>;
  mode?: "input";
  onPress?: never;
  style?: StyleProp<ViewStyle>;
  value: string;
};

type SearchInputPressableProps = {
  mode: "pressable";
  onPress: () => void;
  placeholder: string;
  style?: StyleProp<ViewStyle>;
  value?: never;
};

type SearchInputProps = SearchInputInputProps | SearchInputPressableProps;

export function SearchInput(props: SearchInputProps) {
  const { placeholder, style } = props;

  return (
    <View style={[styles.wrap, style]}>
      <Ionicons color={theme.colors.mutedText} name="search" size={20} />
      {props.mode === "pressable" ? (
        <Pressable onPress={props.onPress} style={styles.pressable}>
          <Text numberOfLines={1} style={styles.placeholder}>
            {placeholder}
          </Text>
        </Pressable>
      ) : (
        (() => {
          const { inputStyle, style: _style, mode: _mode, ...inputProps } = props;

          return (
            <TextInput
              {...inputProps}
              placeholder={placeholder}
              placeholderTextColor={theme.colors.mutedText}
              selectionColor={theme.colors.accent}
              style={[styles.input, inputStyle]}
            />
          );
        })()
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    backgroundColor: theme.form.inputBackground,
    borderColor: theme.form.inputBorder,
    borderRadius: theme.radius.input,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: theme.controls.inputHeight,
    paddingHorizontal: 16,
  },
  input: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    marginLeft: 12,
    paddingVertical: 0,
  },
  pressable: {
    flex: 1,
    justifyContent: "center",
    marginLeft: 12,
    minHeight: theme.controls.inputHeight - 2,
  },
  placeholder: {
    color: theme.colors.mutedText,
    fontSize: 15,
  },
});
