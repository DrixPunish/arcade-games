import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// On garde l'écran de démarrage tant que l'app n'est pas montée.
// La promesse est ignorée volontairement : un rejet ici ne doit pas remonter
// comme « unhandled promise rejection ».
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout(): React.ReactElement {
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
