import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { ArcadeButton } from './ArcadeButton';
import { normalizeInitials } from '../lib/highScores';

/**
 * Saisie des initiales après un score qui entre au classement.
 * Le champ n'accepte que ce que la base accepte : 3 caractères A-Z / 0-9.
 */
export function HighScorePrompt({
  visible,
  saving,
  onSubmit,
  onDismiss,
}: {
  visible: boolean;
  saving: boolean;
  onSubmit: (initials: string) => void;
  onDismiss: () => void;
}): React.ReactElement {
  const [initials, setInitials] = useState<string>('AAA');

  return (
    <Modal transparent visible={visible} onRequestClose={onDismiss} animationType="fade">
      <View style={styles.modal}>
        <View style={styles.card}>
          <Text style={styles.title}>Nouveau high score</Text>
          <TextInput
            value={initials}
            onChangeText={(text) => setInitials(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3))}
            maxLength={3}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!saving}
            style={styles.input}
          />
          <ArcadeButton
            label={saving ? 'Envoi…' : 'Enregistrer'}
            onPress={() => {
              if (!saving) onSubmit(normalizeInitials(initials));
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#071426',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#72fbff',
    gap: 16,
    alignItems: 'center',
  },
  title: { color: '#fff', fontWeight: '900', fontSize: 28, textAlign: 'center' },
  input: {
    color: '#fff',
    borderBottomWidth: 2,
    borderColor: '#ffe083',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 8,
    minWidth: 130,
    textAlign: 'center',
  },
});
