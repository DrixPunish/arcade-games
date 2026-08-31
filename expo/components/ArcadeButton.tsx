import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

export type ArcadeButtonVariant = 'primary' | 'ghost' | 'danger';

export function ArcadeButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: ArcadeButtonVariant;
}): React.ReactElement {
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.button, variant === 'ghost' && styles.ghost, variant === 'danger' && styles.danger]}
    >
      <Text style={[styles.buttonText, variant === 'ghost' && styles.ghostText]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#12d6d6',
    borderColor: '#b8ffff',
    borderWidth: 2,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 24,
    minWidth: 210,
    shadowColor: '#12d6d6',
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 5,
  },
  ghost: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(114,251,255,0.45)',
    // Le halo cyan et l'elevation sont pensés pour un bouton plein : sur une
    // surface translucide ils bavent (bande sombre sous le bouton sur Android).
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  danger: { backgroundColor: '#ff4778', borderColor: '#ffc2d1' },
  buttonText: {
    color: '#031018',
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  // Le fond ghost est sombre : le texte quasi noir des boutons pleins y serait
  // illisible (contraste 1,26:1).
  ghostText: { color: '#eaffff' },
});
