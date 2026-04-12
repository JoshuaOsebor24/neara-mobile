import { Stack } from 'expo-router';

import { DrawerProvider } from '@/components/navigation/drawer-provider';

export default function TabLayout() {
  return (
    <DrawerProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: "transparent",
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
