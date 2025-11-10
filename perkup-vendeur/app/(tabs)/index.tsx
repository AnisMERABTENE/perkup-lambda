import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMutation } from '@apollo/client/react';
import { useRouter } from 'expo-router';

import AppColors from '@/constants/Colors';
import { VALIDATE_DIGITAL_CARD, ValidateDigitalCardResponse, ValidateDigitalCardInput } from '@/graphql/mutations/digitalCard';
import { getStoreData, StoreData } from '@/utils/storage';

export default function DashboardScreen() {
  const router = useRouter();
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [validationResult, setValidationResult] =
    useState<ValidateDigitalCardResponse['validateDigitalCard'] | null>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [validateCardMutation, { loading: validating }] = useMutation<
    ValidateDigitalCardResponse,
    { input: ValidateDigitalCardInput }
  >(VALIDATE_DIGITAL_CARD);

  useEffect(() => {
    (async () => {
      const data = await getStoreData();
      if (data) {
        setStoreData(data);
      }
    })();
  }, []);

  const formatAmount = useCallback((value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(value);
  }, []);

  const handleStartScan = useCallback(async () => {
    setScanError(null);
    setValidationResult(null);
    setScannedToken(null);
    setAmount('');

    try {
      const permissionResponse = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();

      if (!permissionResponse?.granted) {
        Alert.alert(
          'Permission requise',
          'La caméra est nécessaire pour scanner les cartes PerkUP.'
        );
        return;
      }

      setScannerActive(true);
      setScannerVisible(true);
    } catch (error) {
      console.error('❌ Erreur permission caméra:', error);
      Alert.alert(
        'Erreur caméra',
        'Impossible d’accéder à la caméra. Veuillez réessayer.'
      );
    }
  }, []);

  const handleBarCodeScanned = useCallback(
    ({ data }: { type: string; data: string }) => {
      if (!scannerActive) return;
      setScannerActive(false);
      setScannerVisible(false);

      setTimeout(() => {
        try {
          const parsed = JSON.parse(data);
          if (parsed?.token) {
            setScannedToken(parsed.token);
            setScanError(null);
          } else {
            setScannedToken(null);
            setScanError('QR invalide : token introuvable.');
          }
        } catch (parseError) {
          setScannedToken(null);
          setScanError('QR invalide : format non reconnu.');
        }
      }, 0);
    },
    [scannerActive]
  );

  const handleCloseScanner = useCallback(() => {
    setScannerVisible(false);
    setScannerActive(false);
  }, []);

  const handleValidate = useCallback(async () => {
    if (!scannedToken) {
      setScanError('Aucun code scanné. Veuillez scanner une carte.');
      return;
    }

    const normalizedAmount = amount.replace(',', '.');
    const amountValue = parseFloat(normalizedAmount);

    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setScanError('Veuillez saisir un montant valide supérieur à 0.');
      return;
    }

    setScanError(null);

    try {
      const { data } = await validateCardMutation({
        variables: {
          input: {
            scannedToken,
            amount: amountValue,
            partnerId: storeData?.id ?? undefined,
          },
        },
      });

      if (data?.validateDigitalCard) {
        setValidationResult(data.validateDigitalCard);
      }
    } catch (error: any) {
      console.error('❌ Erreur validation carte:', error);

      const gqlMessage =
        error?.graphQLErrors?.[0]?.message ||
        error?.message ||
        'Erreur lors de la validation. Veuillez réessayer.';

      setScanError(gqlMessage);
    }
  }, [amount, scannedToken, storeData?.id, validateCardMutation]);

  const handleResetValidation = useCallback(() => {
    setScannedToken(null);
    setAmount('');
    setScanError(null);
    setValidationResult(null);
  }, []);

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard Vendeur</Text>
        <Text style={styles.subtitle}>Bienvenue dans votre espace PerkUP</Text>
      </View>

      {/* Validation carte digitale */}
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ marginBottom: 32 }}
      >
        <View style={styles.validationCard}>
          <LinearGradient
            colors={AppColors.gradientPrimary}
            style={styles.validationGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.validationHeader}>
              <Ionicons name="scan" size={24} color={AppColors.textInverse} />
              <View style={styles.validationHeaderContent}>
                <Text style={styles.validationTitle}>Scanner une carte PerkUP</Text>
                <Text style={styles.validationSubtitle}>
                  Appliquez automatiquement votre réduction (
                  {storeData?.discount ? `${storeData.discount}%` : 'non définie'})
                  .
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleStartScan}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code-outline" size={20} color={AppColors.primary} />
              <Text style={styles.scanButtonText}>Scanner une carte</Text>
            </TouchableOpacity>
          </LinearGradient>

          {scannedToken && !validationResult && (
            <View style={styles.validationForm}>
              <View style={styles.tokenRow}>
                <Ionicons name="key" size={18} color={AppColors.textLight} />
                <Text style={styles.tokenText}>
                  Token scanné : {scannedToken.slice(0, 8)}...
                </Text>
              </View>

              <Text style={styles.inputLabel}>Montant TTC (€)</Text>
              <TextInput
                style={styles.amountInput}
                placeholder="Ex : 45.90"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={setAmount}
                returnKeyType="done"
              />

              {scanError && (
                <Text style={styles.errorText}>{scanError}</Text>
              )}

              <TouchableOpacity
                style={[styles.validateButton, validating && styles.validateButtonDisabled]}
                onPress={handleValidate}
                activeOpacity={0.9}
                disabled={validating}
              >
                {validating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.validateButtonText}>Valider la réduction</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {validationResult && (
            <View style={styles.validationResult}>
              <View style={styles.resultHeader}>
                <Ionicons name="checkmark-circle" size={22} color={AppColors.success} />
                <Text style={styles.resultTitle}>Réduction appliquée</Text>
              </View>

              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Client</Text>
                <Text style={styles.resultValue}>
                  {validationResult.client.name} • {validationResult.client.plan.toUpperCase()}
                </Text>
              </View>

              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Réduction appliquée</Text>
                <Text style={styles.resultValue}>
                  {validationResult.discount.applied}% (offert: {validationResult.discount.offered}%)
                </Text>
              </View>

              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Montant initial</Text>
                <Text style={styles.resultValue}>
                  {formatAmount(validationResult.amounts.original)}
                </Text>
              </View>

              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Réduction</Text>
                <Text style={styles.resultValue}>
                  -{formatAmount(validationResult.amounts.discount)}
                </Text>
              </View>

              <View style={styles.resultRow}>
                <Text style={[styles.resultLabel, styles.resultLabelHighlight]}>Total à payer</Text>
                <Text style={[styles.resultValue, styles.resultValueHighlight]}>
                  {formatAmount(validationResult.amounts.final)}
                </Text>
              </View>

              <Text style={styles.resultCaption}>
                {validationResult.discount.reason}
              </Text>

              <TouchableOpacity
                style={styles.resetButton}
                onPress={handleResetValidation}
                activeOpacity={0.85}
              >
                <Ionicons name="scan-outline" size={18} color={AppColors.primary} />
                <Text style={styles.resetButtonText}>Nouvelle validation</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Statistiques rapides */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <LinearGradient
            colors={AppColors.gradientAccent}
            style={styles.statGradient}
          >
            <Ionicons name="people" size={24} color={AppColors.textInverse} />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Clients</Text>
          </LinearGradient>
        </View>

        <View style={styles.statCard}>
          <LinearGradient
            colors={AppColors.gradientSecondary}
            style={styles.statGradient}
          >
            <Ionicons name="card" size={24} color={AppColors.textInverse} />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Ventes</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Actions rapides */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/(tabs)/store')}
        >
          <Ionicons name="storefront-outline" size={24} color={AppColors.primary} />
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Gérer ma boutique</Text>
            <Text style={styles.actionSubtitle}>Modifier les informations</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={AppColors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="analytics-outline" size={24} color={AppColors.primary} />
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Voir les statistiques</Text>
            <Text style={styles.actionSubtitle}>Performance de votre boutique</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={AppColors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="settings-outline" size={24} color={AppColors.primary} />
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Paramètres</Text>
            <Text style={styles.actionSubtitle}>Configurer votre compte</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={AppColors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.infoContainer}>
        <Ionicons name="checkmark-circle" size={24} color={AppColors.success} />
        <Text style={styles.infoText}>
          Votre boutique est maintenant configurée ! Les clients peuvent découvrir vos offres sur PerkUP.
        </Text>
      </View>
    </ScrollView>

    <Modal
      visible={scannerVisible}
      animationType="slide"
      onRequestClose={handleCloseScanner}
    >
      <View style={styles.modalContainer}>
        <Text style={styles.modalTitle}>Scanner la carte PerkUP</Text>
        <Text style={styles.modalSubtitle}>
          Placez le QR code du client dans le cadre.
        </Text>

        <View style={styles.scannerWrapper}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={scannerActive ? handleBarCodeScanned : undefined}
          />
          <View style={styles.scannerOverlay}>
            <View style={styles.scannerBorder} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeScannerButton}
          onPress={handleCloseScanner}
        >
          <Ionicons name="close" size={20} color={AppColors.primary} />
          <Text style={styles.closeScannerText}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
  validationCard: {
    backgroundColor: AppColors.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.borderLight,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  validationGradient: {
    padding: 20,
  },
  validationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  validationHeaderContent: {
    flex: 1,
    gap: 4,
  },
  validationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.textInverse,
  },
  validationSubtitle: {
    fontSize: 13,
    color: AppColors.textInverse + 'CC',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AppColors.textInverse,
    paddingVertical: 12,
    borderRadius: 14,
  },
  scanButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.primary,
  },
  validationForm: {
    padding: 20,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: AppColors.borderLight,
  },
  tokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tokenText: {
    fontSize: 13,
    color: AppColors.textSecondary,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.text,
  },
  amountInput: {
    backgroundColor: AppColors.surfaceSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
    fontSize: 16,
    color: AppColors.text,
  },
  errorText: {
    fontSize: 13,
    color: AppColors.error,
  },
  validateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  validateButtonDisabled: {
    opacity: 0.7,
  },
  validateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  validationResult: {
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: AppColors.borderLight,
    backgroundColor: AppColors.surfaceSecondary,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.success,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  resultValue: {
    fontSize: 15,
    fontWeight: '600',
    color: AppColors.text,
  },
  resultLabelHighlight: {
    color: AppColors.primaryDark,
  },
  resultValueHighlight: {
    color: AppColors.primaryDark,
  },
  resultCaption: {
    fontSize: 12,
    color: AppColors.textSecondary,
    lineHeight: 18,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: AppColors.primary,
    backgroundColor: 'white',
  },
  resetButtonText: {
    color: AppColors.primary,
    fontWeight: '600',
    fontSize: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 8,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: AppColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  statGradient: {
    padding: 20,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: AppColors.textInverse,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: AppColors.textInverse,
    opacity: 0.9,
  },
  actionsContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  actionContent: {
    flex: 1,
    marginLeft: 16,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.success + '15',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: AppColors.success,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: AppColors.textSecondary,
    marginLeft: 12,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: AppColors.background,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 32,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  scannerWrapper: {
    width: '100%',
    aspectRatio: 3 / 4,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: 'black',
  },
  scannerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerBorder: {
    width: '70%',
    height: '50%',
    borderWidth: 3,
    borderColor: AppColors.primary,
    borderRadius: 20,
  },
  closeScannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  closeScannerText: {
    color: AppColors.primary,
    fontWeight: '600',
  },
});
