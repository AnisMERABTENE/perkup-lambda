import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import AppColors from '@/constants/Colors';
import { validateRegisterForm } from '@/utils/validation';
import { useAuth } from '@/hooks/useAuth';

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ✅ Hook centralisé pour authentification vendeur
  const { registerVendor, loading } = useAuth();

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Effacer les erreurs quand l'utilisateur tape
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleRegister = async () => {
    try {
      setErrors([]);

      // ✅ Validation côté frontend
      const validation = validateRegisterForm(formData);
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      // ✅ Inscription avec hook centralisé
      await registerVendor({
        firstname: formData.firstname.trim(),
        lastname: formData.lastname.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
      });

    } catch (error: any) {
      console.error('Erreur inscription frontend:', error);
      setErrors(['Erreur inattendue lors de l\'inscription']);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header avec logo et titre */}
        <View style={styles.header}>
          <LinearGradient
            colors={AppColors.gradientBusiness}
            style={styles.logoContainer}
          >
            <Ionicons name="business" size={40} color={AppColors.textInverse} />
          </LinearGradient>
          
          <Text style={styles.title}>Devenir Vendeur</Text>
          <Text style={styles.subtitle}>
            Rejoignez PerkUP et développez votre business
          </Text>
        </View>

        {/* Formulaire */}
        <View style={styles.form}>
          {/* Affichage des erreurs */}
          {errors.length > 0 && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={AppColors.error} />
              <View style={styles.errorTextContainer}>
                {errors.map((error, index) => (
                  <Text key={index} style={styles.errorText}>
                    {error}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* Champ Prénom */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Prénom</Text>
            <View style={styles.inputWrapper}>
              <Ionicons 
                name="person-outline" 
                size={20} 
                color={AppColors.textSecondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Votre prénom"
                placeholderTextColor={AppColors.textLight}
                value={formData.firstname}
                onChangeText={(value) => handleInputChange('firstname', value)}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Champ Nom */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nom</Text>
            <View style={styles.inputWrapper}>
              <Ionicons 
                name="person-outline" 
                size={20} 
                color={AppColors.textSecondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Votre nom"
                placeholderTextColor={AppColors.textLight}
                value={formData.lastname}
                onChangeText={(value) => handleInputChange('lastname', value)}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Champ Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email professionnel</Text>
            <View style={styles.inputWrapper}>
              <Ionicons 
                name="mail-outline" 
                size={20} 
                color={AppColors.textSecondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="votre@email-pro.com"
                placeholderTextColor={AppColors.textLight}
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* Champ Mot de passe */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputWrapper}>
              <Ionicons 
                name="lock-closed-outline" 
                size={20} 
                color={AppColors.textSecondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Minimum 8 caractères"
                placeholderTextColor={AppColors.textLight}
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={AppColors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Champ Confirmation mot de passe */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirmer le mot de passe</Text>
            <View style={styles.inputWrapper}>
              <Ionicons 
                name="lock-closed-outline" 
                size={20} 
                color={AppColors.textSecondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Confirmez votre mot de passe"
                placeholderTextColor={AppColors.textLight}
                value={formData.confirmPassword}
                onChangeText={(value) => handleInputChange('confirmPassword', value)}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={AppColors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Info mot de passe */}
          <View style={styles.passwordInfoContainer}>
            <Ionicons name="information-circle-outline" size={16} color={AppColors.textSecondary} />
            <Text style={styles.passwordInfoText}>
              Le mot de passe doit contenir au moins 8 caractères avec majuscules, minuscules et chiffres
            </Text>
          </View>

          {/* Bouton d'inscription */}
          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <LinearGradient
              colors={loading ? [AppColors.textLight, AppColors.textLight] : AppColors.gradientBusiness}
              style={styles.registerButtonGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color={AppColors.textInverse} />
              ) : (
                <>
                  <Ionicons name="business-outline" size={20} color={AppColors.textInverse} style={{ marginRight: 8 }} />
                  <Text style={styles.registerButtonText}>Créer mon compte vendeur</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Lien vers connexion */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Déjà un compte vendeur ? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity disabled={loading}>
                <Text style={styles.loginLink}>Se connecter</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Avantages vendeur */}
          <View style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Pourquoi rejoindre PerkUP ?</Text>
            
            <View style={styles.benefitItem}>
              <Ionicons name="people" size={18} color={AppColors.accent} />
              <Text style={styles.benefitText}>Attirez plus de clients</Text>
            </View>
            
            <View style={styles.benefitItem}>
              <Ionicons name="trending-up" size={18} color={AppColors.accent} />
              <Text style={styles.benefitText}>Augmentez votre chiffre d'affaires</Text>
            </View>
            
            <View style={styles.benefitItem}>
              <Ionicons name="phone-portrait" size={18} color={AppColors.accent} />
              <Text style={styles.benefitText}>Interface simple et intuitive</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: AppColors.error + '15',
    borderLeftWidth: 3,
    borderLeftColor: AppColors.error,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  errorTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  errorText: {
    color: AppColors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: AppColors.text,
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  passwordInfoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: AppColors.info + '15',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  passwordInfoText: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  registerButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonGradient: {
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textInverse,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  loginText: {
    fontSize: 16,
    color: AppColors.textSecondary,
  },
  loginLink: {
    fontSize: 16,
    color: AppColors.primary,
    fontWeight: '600',
  },
  benefitsContainer: {
    backgroundColor: AppColors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 16,
    color: AppColors.textSecondary,
    marginLeft: 12,
  },
});