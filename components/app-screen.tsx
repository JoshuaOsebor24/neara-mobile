import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/constants/theme';

type AppScreenProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

export function AppScreen({ title, subtitle, children }: AppScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.content}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing.screenHorizontal,
    paddingTop: theme.spacing.screenTop,
    paddingBottom: theme.spacing.screenBottom,
    backgroundColor: theme.colors.background,
  },
  header: {
    gap: 8,
    marginBottom: 24,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: theme.colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
  },
  content: {
    flex: 1,
  },
});
