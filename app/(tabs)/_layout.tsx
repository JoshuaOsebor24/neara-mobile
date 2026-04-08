import { Stack } from 'expo-router';

import { DrawerProvider } from '@/components/navigation/drawer-provider';
import { theme } from '@/constants/theme';

export default function TabLayout() {
  return (
    <DrawerProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
          animation: 'none',
        }}>
        <Stack.Screen
          name="home"
          options={{
            animation: 'none',
          }}
        />
        <Stack.Screen name="chats" />
        <Stack.Screen
          name="search"
          options={{
            animation: 'none',
          }}
        />
        <Stack.Screen name="saved" />
        <Stack.Screen name="profile" />
      </Stack>
    </DrawerProvider>
  );
}
