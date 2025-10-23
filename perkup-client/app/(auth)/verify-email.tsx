import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@apollo/client/react';

import AppColors from '@/constants/Colors';
import { VERIFY_EMAIL, VerifyEmailInput, VerifyEmailResponse } from '@/graphql/mutations/auth';
import { validateVerificationCode } from '@/utils/validation';

export default function VerifyEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Références pour les inputs
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Mutation GraphQL pour la vérification
  const [verifyEmailMutation] = useMutation<VerifyEmailResponse, { input: VerifyEmailInput }>(VERIFY_EMAIL);

  // Countdown pour le renvoi d'email
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleCodeChange = (value: string, index: number) => {
    const newCode = [...code];
    
    // Gérer le collage de code complet
    if (value.length > 1) {
      const pastedCode = value.slice(0, 6).split('');
      for (let i = 0; i < 6; i++) {
        newCode[i] = pastedCode[i] || '';
      }
      setCode(newCode);
      
      // Focus sur le dernier champ ou le suivant
      const nextIndex = Math.min(pastedCode.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // Saisie normale
      newCode[index] = value;
      setCode(newCode);
      
      // Auto-focus sur le champ suivant
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
    
    // Effacer les erreurs
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      // Retour au champ précédent si vide
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    try {
      setIsLoading(true);
      setErrors([]);

      const codeString = code.join('');
      
      // Validation côté frontend
      const validation = validateVerificationCode(codeString);
      if (!validation.isValid) {
        setErrors(validation.errors);
        return;
      }

      // Appel GraphQL
      const { data } = await verifyEmailMutation({
        variables: {
          input: {
            email: email || '',
            code: codeString,
          },
        },
      });

      if (data?.verifyEmail) {
        const { message } = data.verifyEmail;

        // Afficher le succès et rediriger
        Alert.alert(
          'Email vérifié !',
          message,
          [
            {
              text: 'Continuer',
              onPress: () => {
                router.replace('/(auth)/login');
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Erreur vérification:', error);
      
      // Gestion des erreurs GraphQL
      if (error.graphQLErrors?.length > 0) {
        setErrors([error.graphQLErrors[0].message]);
      } else if (error.networkError) {
        setErrors(['Erreur de connexion. Vérifiez votre internet.']);
      } else {
        setErrors(['Code de vérification invalide.']);
      }
      
      // Réinitialiser le code en cas d'erreur
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    
    try {
      // TODO: Ajouter une mutation pour renvoyer le code
      // Pour l'instant, simuler le renvoi
      setCountdown(60);
      setCanResend(false);
      
      Alert.alert(
        'Code renvoyé',
        'Un nouveau code de vérification a été envoyé à votre email.'
      );
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de renvoyer le code.');
    }
  };

  // Auto-vérification quand tous les champs sont remplis
  useEffect(() => {
    const fullCode = code.join('');
    if (fullCode.length === 6 && !isLoading) {
      handleVerify();
    }
  }, [code]);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={AppColors.gradientAccent}
            style={styles.logoContainer}
          >
            <Ionicons name="mail-open" size={40} color={AppColors.textInverse} />
          </LinearGradient>
          
          <Text style={styles.title}>Vérifiez votre email</Text>
          <Text style={styles.subtitle}>
            Nous avons envoyé un code de vérification à :
          </Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* Formulaire de code */}
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

          {/* Champs de code */}
          <Text style={styles.label}>Code de vérification</Text>
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[
                  styles.codeInput,
                  digit && styles.codeInputFilled,
                  errors.length > 0 && styles.codeInputError
                ]}
                value={digit}
                onChangeText={(value) => handleCodeChange(value, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                keyboardType="numeric"
                maxLength={6} // Permet le collage de code complet
                selectTextOnFocus
                editable={!isLoading}
                autoFocus={index === 0}
              />
            ))}
          </View>

          {/* Instructions */}
          <Text style={styles.instructions}>
            Entrez le code à 6 chiffres reçu par email
          </Text>

          {/* Bouton de vérification */}
          <TouchableOpacity
            style={[styles.verifyButton, isLoading && styles.verifyButtonDisabled]}
            onPress={handleVerify}
            disabled={isLoading || code.join('').length !== 6}
          >
            <LinearGradient
              colors={isLoading ? [AppColors.textLight, AppColors.textLight] : AppColors.gradientAccent}
              style={styles.verifyButtonGradient}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={AppColors.textInverse} />
              ) : (
                <Text style={styles.verifyButtonText}>Vérifier</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Renvoi de code */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>
              Vous n'avez pas reçu le code ?{' '}
            </Text>
            {canResend ? (
              <TouchableOpacity onPress={handleResendCode}>
                <Text style={styles.resendLink}>Renvoyer</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.countdown}>
                Renvoyer dans {countdown}s
              </Text>
            )}
          </View>

          {/* Retour à la connexion */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={20} color={AppColors.primary} />
            <Text style={styles.backText}>Retour à la connexion</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: AppColors.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.primary,
    textAlign: 'center',
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
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    color: AppColors.text,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  codeInputFilled: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primary + '10',
  },
  codeInputError: {
    borderColor: AppColors.error,
    backgroundColor: AppColors.error + '10',
  },
  instructions: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  verifyButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: AppColors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyButtonDisabled: {
    opacity: 0.7,
  },
  verifyButtonGradient: {
    paddingVertical: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.textInverse,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  resendText: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  resendLink: {
    fontSize: 14,
    color: AppColors.primary,
    fontWeight: '600',
  },
  countdown: {
    fontSize: 14,
    color: AppColors.textLight,
  },
  backButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backText: {
    fontSize: 16,
    color: AppColors.primary,
    fontWeight: '600',
    marginLeft: 8,
  },
});
