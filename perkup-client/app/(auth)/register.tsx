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
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@apollo/client/react';

import AppColors from '@/constants/Colors';
import { REGISTER_CLIENT, RegisterInput, RegisterResponse } from '@/graphql/mutations/auth';
import { validateRegisterForm, getPasswordStrength } from '@/utils/validation';

export default function RegisterScreen() {
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<{[key: string]: string}>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Mutation GraphQL pour l'inscription
  const [registerMutation] = useMutation<RegisterResponse, { input: RegisterInput }>(REGISTER_CLIENT);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Effacer les erreurs quand l'utilisateur tape
    if (errors.length > 0) {
      setErrors([]);
    }
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleRegister = async () => {
    try {
      setIsLoading(true);
      setErrors([]);

      console.log('🚀 Début inscription...');
      
      // Vérifier l'acceptation des conditions
      if (!acceptedTerms) {
        setErrors(['Vous devez accepter les conditions d\'utilisation']);
        return;
      }

      // Validation côté frontend
      const validation = validateRegisterForm(formData);
      if (!validation.isValid) {
        console.log('❌ Validation échouée:', validation.errors);
        setErrors(validation.errors);
        return;
      }

      console.log('✅ Validation réussie, envoi vers backend...');
      console.log('📡 URL Backend:', 'https://63g5x92epf.execute-api.eu-west-1.amazonaws.com/prod/graphql');
      console.log('📋 Données envoyées:', {
        firstname: formData.firstname.trim(),
        lastname: formData.lastname.trim(),
        email: formData.email.trim().toLowerCase(),
        // Ne pas logger le mot de passe pour sécurité
      });

      // Appel GraphQL
      const result = await registerMutation({
        variables: {
          input: {
            firstname: formData.firstname.trim(),
            lastname: formData.lastname.trim(),
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
            confirmPassword: formData.confirmPassword,
          },
        },
      });

      console.log('✅ Résultat complet:', JSON.stringify(result, null, 2));
      
      // Vérifier s'il y a des erreurs GraphQL
      const graphqlErrors = result.errors || result.error?.errors;
      if (graphqlErrors && graphqlErrors.length > 0) {
        console.log('🚨 Erreurs GraphQL détectées:', graphqlErrors);
        const errorMessage = graphqlErrors[0].message;
        
        // Analyser le type d'erreur pour l'affecter au bon champ
        if (errorMessage.toLowerCase().includes('email')) {
          setFieldErrors({ email: errorMessage });
        } else if (errorMessage.toLowerCase().includes('mot de passe') || errorMessage.toLowerCase().includes('password')) {
          setFieldErrors({ password: errorMessage });
        } else {
          // Erreur générale
          setErrors([errorMessage]);
        }
        return;
      }

      const { data } = result;
      console.log('✅ Réponse du backend:', JSON.stringify(data, null, 2));
      console.log('🔍 registerClient dans data:', data?.registerClient);

      if (data?.registerClient) {
        const { message } = data.registerClient;
        console.log('🎉 Inscription réussie:', message);

        // Afficher le message de succès et rediriger
        Alert.alert(
          'Inscription réussie !', 
          message + '\n\nVérifiez votre email pour activer votre compte.',
          [
            {
              text: 'Vérifier mon email',
              onPress: () => {
                router.push({
                  pathname: '/(auth)/verify-email',
                  params: { email: formData.email.trim().toLowerCase() }
                });
              },
            },
          ]
        );
      } else {
        // Si data est null mais pas d'erreur dans catch, c'est une erreur GraphQL
        console.log('⚠️ Aucune donnée reçue - probablement une erreur GraphQL');
        setErrors(['Une erreur s\'est produite lors de l\'inscription.']);
      }
    } catch (error: any) {
      console.error('💥 Erreur inscription:', error);
      
      // Log détaillé de l'erreur
      if (error.networkError) {
        console.error('🌐 Erreur réseau:', error.networkError);
        console.error('🌐 Status:', error.networkError.statusCode);
        console.error('🌐 Response:', error.networkError.result);
      }
      
      if (error.graphQLErrors?.length > 0) {
        console.error('📊 Erreurs GraphQL:', error.graphQLErrors);
        setErrors([error.graphQLErrors[0].message]);
      } else if (error.networkError) {
        setErrors(['Erreur de connexion. Vérifiez votre internet.']);
      } else {
        setErrors(['Une erreur inattendue s\'est produite.']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Calcul de la force du mot de passe
  const passwordStrength = getPasswordStrength(formData.password);

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
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={AppColors.gradientSecondary}
            style={styles.logoContainer}
          >
            <Ionicons name="person-add" size={40} color={AppColors.textInverse} />
          </LinearGradient>
          
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>
            Rejoignez PerkUP et bénéficiez de réductions exclusives
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
                    • {error}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* Prénom */}
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
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Nom */}
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
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <View style={[
              styles.inputWrapper,
              fieldErrors.email && styles.inputWrapperError
            ]}>
              <Ionicons 
                name="mail-outline" 
                size={20} 
                color={fieldErrors.email ? AppColors.error : AppColors.textSecondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="votre@email.com"
                placeholderTextColor={AppColors.textLight}
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>
            {fieldErrors.email && (
              <Text style={styles.fieldError}>{fieldErrors.email}</Text>
            )}
          </View>

          {/* Mot de passe */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={[
              styles.inputWrapper,
              fieldErrors.password && styles.inputWrapperError
            ]}>
              <Ionicons 
                name="lock-closed-outline" 
                size={20} 
                color={fieldErrors.password ? AppColors.error : AppColors.textSecondary} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="Créez un mot de passe sécurisé"
                placeholderTextColor={AppColors.textLight}
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={AppColors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            
            {fieldErrors.password && (
              <Text style={styles.fieldError}>{fieldErrors.password}</Text>
            )}
            
            {/* Indicateur de force du mot de passe */}
            {formData.password.length > 0 && !fieldErrors.password && (
              <View style={styles.passwordStrengthContainer}>
                <View style={styles.strengthBar}>
                  <View 
                    style={[
                      styles.strengthFill,
                      { 
                        width: `${(passwordStrength.score / 5) * 100}%`,
                        backgroundColor: passwordStrength.color
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                  {passwordStrength.label}
                </Text>
              </View>
            )}
          </View>

          {/* Confirmation mot de passe */}
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
                placeholder="Retapez votre mot de passe"
                placeholderTextColor={AppColors.textLight}
                value={formData.confirmPassword}
                onChangeText={(value) => handleInputChange('confirmPassword', value)}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={AppColors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Conditions d'utilisation */}
          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => setAcceptedTerms(!acceptedTerms)}
            disabled={isLoading}
          >
            <View style={[
              styles.checkbox,
              acceptedTerms && styles.checkboxChecked
            ]}>
              {acceptedTerms && (
                <Ionicons name="checkmark" size={16} color={AppColors.textInverse} />
              )}
            </View>
            <View style={styles.termsTextContainer}>
              <Text style={styles.termsText}>
                J'accepte les{' '}
                <Text style={styles.termsLink}>conditions d'utilisation</Text>
                {' '}et la{' '}
                <Text style={styles.termsLink}>politique de confidentialité</Text>
              </Text>
            </View>
          </TouchableOpacity>

          {/* Bouton d'inscription */}
          <TouchableOpacity
            style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            <LinearGradient
              colors={isLoading ? [AppColors.textLight, AppColors.textLight] : AppColors.gradientSecondary}
              style={styles.registerButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={AppColors.textInverse} />
              ) : (
                <Text style={styles.registerButtonText}>Créer mon compte</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Lien vers connexion */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Déjà un compte ? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity disabled={isLoading}>
                <Text style={styles.loginLink}>Se connecter</Text>
              </TouchableOpacity>
            </Link>
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
    shadowColor: AppColors.secondary,
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
    marginBottom: 20,
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
  inputWrapperError: {
    borderColor: AppColors.error,
    borderWidth: 2,
    backgroundColor: AppColors.error + '08',
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
  passwordStrengthContainer: {
    marginTop: 8,
  },
  strengthBar: {
    height: 4,
    backgroundColor: AppColors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '500',
  },
  fieldError: {
    color: AppColors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: AppColors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  termsTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  termsText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: AppColors.primary,
    fontWeight: '600',
  },
  registerButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: AppColors.secondary,
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
});
