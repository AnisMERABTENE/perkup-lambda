import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@apollo/client/react';
import { router } from 'expo-router';

import AppColors from '@/constants/Colors';
import { UPDATE_VENDOR_PROFILE, UpdateVendorProfileInput, UpdateVendorProfileResponse } from '@/graphql/mutations/vendor';
import { useAuthContext } from '@/providers/AuthProvider';

export default function ManageProfileScreen() {
  const { user, updateUser } = useAuthContext();
  const [firstname, setFirstname] = useState(user?.firstname ?? '');
  const [lastname, setLastname] = useState(user?.lastname ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const [updateProfile, { loading }] = useMutation<UpdateVendorProfileResponse, { input: UpdateVendorProfileInput }>(
    UPDATE_VENDOR_PROFILE
  );

  const hasNameChange = useMemo(() => {
    return firstname.trim() !== (user?.firstname ?? '') || lastname.trim() !== (user?.lastname ?? '');
  }, [firstname, lastname, user?.firstname, user?.lastname]);

  const hasEmailChange = useMemo(() => {
    return email.trim().toLowerCase() !== (user?.email ?? '').toLowerCase();
  }, [email, user?.email]);

  const handleSubmit = async () => {
    const validationErrors: string[] = [];
    const payload: UpdateVendorProfileInput = {};

    const trimmedFirstname = firstname.trim();
    const trimmedLastname = lastname.trim();
    const trimmedEmail = email.trim();

    if (hasNameChange) {
      if (!trimmedFirstname) {
        validationErrors.push('Le prénom ne peut pas être vide.');
      } else {
        payload.firstname = trimmedFirstname;
      }

      if (!trimmedLastname) {
        validationErrors.push('Le nom ne peut pas être vide.');
      } else {
        payload.lastname = trimmedLastname;
      }
    }

    if (hasEmailChange) {
      if (!trimmedEmail) {
        validationErrors.push('L\'email ne peut pas être vide.');
      } else {
        payload.email = trimmedEmail.toLowerCase();
      }
    }

    const wantsPasswordChange = Boolean(newPassword || confirmNewPassword);
    if (wantsPasswordChange) {
      if (!newPassword || !confirmNewPassword) {
        validationErrors.push('Merci de saisir et confirmer le nouveau mot de passe.');
      } else {
        payload.newPassword = newPassword;
        payload.confirmNewPassword = confirmNewPassword;
      }
    }

    const requiresPassword = Boolean(payload.email || payload.newPassword);
    if (requiresPassword) {
      if (!currentPassword) {
        validationErrors.push('Le mot de passe actuel est requis pour modifier l\'email ou le mot de passe.');
      } else {
        payload.currentPassword = currentPassword;
      }
    }

    if (!hasNameChange && !hasEmailChange && !wantsPasswordChange) {
      validationErrors.push('Aucune modification détectée.');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setErrors([]);
      const { data } = await updateProfile({ variables: { input: payload } });

      if (data?.updateVendorProfile.user) {
        await updateUser(data.updateVendorProfile.user);
        Alert.alert('Succès', data.updateVendorProfile.message, [
          { text: 'OK', onPress: () => router.back() }
        ]);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      }
    } catch (error: any) {
      const graphQLError = error?.graphQLErrors?.[0]?.message;
      setErrors([graphQLError || 'Une erreur est survenue lors de la mise à jour.']);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.wrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={AppColors.primary} />
            <Text style={styles.backText}>Retour</Text>
          </TouchableOpacity>

      <Text style={styles.title}>Gérer mon profil</Text>
      <Text style={styles.subtitle}>Mettez à jour vos informations personnelles et vos accès.</Text>

      {errors.length > 0 && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color={AppColors.error} />
          <View style={{ flex: 1 }}>
            {errors.map((error, index) => (
              <Text key={index} style={styles.errorText}>{error}</Text>
            ))}
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Identité</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Prénom</Text>
          <TextInput
            style={styles.input}
            placeholder="Votre prénom"
            value={firstname}
            onChangeText={setFirstname}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={styles.input}
            placeholder="Votre nom"
            value={lastname}
            onChangeText={setLastname}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Email</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Adresse email</Text>
          <TextInput
            style={styles.input}
            placeholder="email@exemple.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sécurité</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mot de passe actuel</Text>
          <TextInput
            style={styles.input}
            placeholder="Mot de passe actuel"
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nouveau mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="Nouveau mot de passe"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Confirmation</Text>
          <TextInput
            style={styles.input}
            placeholder="Confirmez le nouveau mot de passe"
            secureTextEntry
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
          />
        </View>
        <Text style={styles.helperText}>
          • Le mot de passe actuel est requis pour changer d'email ou de mot de passe.
        </Text>
        <Text style={styles.helperText}>
          • Le nouveau mot de passe doit contenir au moins 8 caractères.
        </Text>
      </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={AppColors.textInverse} />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color={AppColors.textInverse} />
                <Text style={styles.submitText}>Mettre à jour</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  wrapper: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  container: {
    padding: 24,
    paddingBottom: 160,
    gap: 16,
    flexGrow: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  backText: {
    color: AppColors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.text,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    marginBottom: 8,
  },
  card: {
    backgroundColor: AppColors.card,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: AppColors.text,
    backgroundColor: AppColors.surface,
  },
  helperText: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  submitButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AppColors.primary,
    paddingVertical: 16,
    borderRadius: 18,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: AppColors.textInverse,
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.error,
    backgroundColor: AppColors.errorBackground,
  },
  errorText: {
    color: AppColors.error,
    fontSize: 14,
  },
});
