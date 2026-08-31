import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export function ControlButton({
  label,
  onPress,
  onDown,
  onUp,
  wide,
}: {
  label: string;
  onPress?: () => void;
  onDown?: () => void;
  onUp?: () => void;
  wide?: boolean;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onDown}
      onPressOut={onUp}
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, wide && styles.wide, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(114,251,255,0.5)',
    borderWidth: 2,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 22,
    minWidth: 84,
    marginHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wide: { minWidth: 140 },
  pressed: { backgroundColor: 'rgba(114,251,255,0.18)' },
  label: { color: '#eaffff', fontWeight: '900', fontSize: 18, letterSpacing: 1 },
});
