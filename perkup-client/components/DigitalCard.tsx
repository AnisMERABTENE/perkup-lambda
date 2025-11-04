import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import AppColors from '@/constants/Colors';
import useDigitalCard from '@/hooks/useDigitalCard';
import {
  formatCardNumber,
  getCardColors,
  getStatusText,
  getStatusIcon,
  getPlanDisplayName,
  formatErrorMessage,
} from '@/utils/cardUtils';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const CARD_HEIGHT = CARD_WIDTH * 0.63; // Ratio carte de crédit standard

interface DigitalCardProps {
  onSubscriptionPress?: () => void;
}

export default function DigitalCard({ onSubscriptionPress }: DigitalCardProps) {
  // 🎯 Hook personnalisé pour toute la logique
  const {
    subscriptionStatus,
    cardData,
    loading,
    toggleLoading,
    error,
    toggleCard,
    refreshAll,
    refetchCard,
  } = useDigitalCard();

  // 🎬 Animations
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const [showQR, setShowQR] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [qrTimeLeft, setQrTimeLeft] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);

  const normalizedInitialDuration = useCallback(() => {
    const backendDuration = cardData?.card?.timeUntilRotation;
    if (typeof backendDuration === 'number' && backendDuration > 0) {
      return backendDuration;
    }
    return 120;
  }, [cardData]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsTimerRunning(false);
  }, []);

  const refreshQrCode = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    try {
      await refetchCard();
    } catch (refreshError) {
      console.error('❌ Erreur refresh QR:', refreshError);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [refetchCard]);

  const startTimer = useCallback(() => {
    if (isTimerRunning) return;
    const initial = qrTimeLeft ?? normalizedInitialDuration();
    setQrTimeLeft(initial);
    setIsTimerRunning(true);
  }, [isTimerRunning, qrTimeLeft, normalizedInitialDuration]);

  useEffect(() => {
    if (!isTimerRunning) {
      return;
    }

    if (intervalRef.current) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setQrTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          refreshQrCode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isTimerRunning, refreshQrCode]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const nextDuration = normalizedInitialDuration();
    setQrTimeLeft(nextDuration);
  }, [
    isTimerRunning,
    normalizedInitialDuration,
    cardData?.card?.qrCode,
    cardData?.card?.qrCodeData,
    cardData?.card?.timeUntilRotation
  ]);

  useEffect(() => {
    if (!subscriptionStatus?.isActive) {
      stopTimer();
      setShowQR(false);
      setQrTimeLeft(null);
    }
  }, [subscriptionStatus?.isActive, stopTimer]);

  useEffect(() => {
    return () => {
      stopTimer();
    };
  }, [stopTimer]);

  // 🎯 Gestion du clic sur la carte
  const handleCardPress = async () => {
    // Haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!subscriptionStatus?.isActive) {
      // Si pas d'abonnement, aller vers la page des abonnements
      if (onSubscriptionPress) {
        onSubscriptionPress();
      } else {
        Alert.alert(
          'Abonnement requis',
          'Vous devez souscrire à un abonnement pour utiliser votre carte de réduction.',
          [{ text: 'OK', style: 'default' }]
        );
      }
      return;
    }

    // Animation de scale
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Animation de flip
    const toValue = showQR ? 0 : 1;
    
    Animated.timing(flipAnimation, {
      toValue,
      duration: 600,
      useNativeDriver: true,
    }).start();

    if (!showQR && subscriptionStatus?.isActive) {
      startTimer();
    }

    setShowQR(prev => !prev);
  };

  // 🎨 Calcul des interpolations d'animation
  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  // 📊 États de chargement
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AppColors.primary} />
        <Text style={styles.loadingText}>Chargement de votre carte...</Text>
      </View>
    );
  }

  // ❌ État d'erreur
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={AppColors.error} />
        <Text style={styles.errorText}>{formatErrorMessage(error)}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshAll}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Instructions visuelles */}
      <View style={styles.instructionContainer}>
        <Ionicons 
          name="hand-left" 
          size={24} 
          color={AppColors.primary} 
        />
        <Text style={styles.instructionText}>
          Appuyez sur votre carte pour {subscriptionStatus?.isActive ? 'afficher le QR code' : 'souscrire un abonnement'}
        </Text>
      </View>

      {/* Carte animée */}
      <Animated.View 
        style={[
          styles.cardContainer,
          { transform: [{ scale: scaleAnimation }] },
          subscriptionStatus?.isActive && styles.cardShadow,
        ]}
      >
        <TouchableOpacity onPress={handleCardPress} activeOpacity={0.9}>
          {/* Face avant - Carte */}
          <Animated.View
            style={[
              styles.card,
              { transform: [{ rotateY: frontInterpolate }] },
            ]}
          >
            <LinearGradient
              colors={getCardColors(subscriptionStatus?.subscription?.plan, subscriptionStatus?.isActive)}
              style={styles.cardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {/* Header de la carte */}
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>PerkUP</Text>
                <View style={styles.statusContainer}>
                  <Ionicons 
                    name={getStatusIcon(subscriptionStatus?.isActive)} 
                    size={16} 
                    color="white" 
                  />
                  <Text style={styles.statusText}>
                    {getStatusText(subscriptionStatus?.subscription, subscriptionStatus?.isActive)}
                  </Text>
                </View>
              </View>

              {/* Logo/Chip */}
              <View style={styles.chipContainer}>
                <View style={styles.chip}>
                  <Ionicons name="card" size={24} color="rgba(255,255,255,0.8)" />
                </View>
              </View>

              {/* Numéro de carte */}
              <View style={styles.cardNumberContainer}>
                <Text style={styles.cardNumber}>
                  {formatCardNumber(cardData?.card?.cardNumber)}
                </Text>
              </View>

              {/* Informations utilisateur */}
              <View style={styles.cardFooter}>
                <View style={styles.userInfo}>
                  <Text style={styles.userLabel}>TITULAIRE</Text>
                  <Text style={styles.userName}>
                    {cardData?.card?.userInfo?.name?.toUpperCase() || 'UTILISATEUR PERKUP'}
                  </Text>
                </View>
                
                <View style={styles.planInfo}>
                  <Text style={styles.planLabel}>PLAN</Text>
                  <Text style={styles.planName}>
                    {getPlanDisplayName(subscriptionStatus?.subscription?.plan)?.toUpperCase()}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* Face arrière - QR Code ou Message */}
          <Animated.View
            style={[
              styles.card,
              styles.cardBack,
              { transform: [{ rotateY: backInterpolate }] },
            ]}
          >
            {subscriptionStatus?.isActive && (cardData?.card?.qrCodeData || cardData?.card?.qrCode) ? (
              /* QR Code actif */
              <View style={styles.qrContainer}>
                <Text style={styles.qrTitle}>Votre Code de Réduction</Text>
                
                <View style={styles.qrImageContainer}>
                  {cardData.card.qrCodeData ? (
                    <QRCode
                      value={cardData.card.qrCodeData}
                      size={200}
                      backgroundColor="transparent"
                      color={AppColors.text}
                    />
                  ) : cardData.card.qrCode ? (
                    <Image 
                      source={{ uri: cardData.card.qrCode }} 
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.qrFallback}>
                      <Ionicons name="qr-code-outline" size={48} color={AppColors.textSecondary} />
                    </View>
                  )}
                </View>

                {/* Countdown */}
                <View style={styles.countdownContainer}>
                  <Ionicons name="time" size={16} color={AppColors.textLight} />
                  <Text style={styles.countdownText}>
                    Nouveau code dans {Math.max(0, qrTimeLeft ?? normalizedInitialDuration())}s
                  </Text>
                </View>

                <Text style={styles.qrInstructions}>
                  {cardData.instructions || 'Présentez ce code au vendeur pour obtenir votre réduction'}
                </Text>
              </View>
            ) : (
              /* Message d'abonnement */
              <View style={styles.subscriptionContainer}>
                <Ionicons 
                  name="lock-closed" 
                  size={48} 
                  color={AppColors.error} 
                />
                
                <Text style={styles.subscriptionTitle}>
                  Abonnement Requis
                </Text>
                
                <Text style={styles.subscriptionMessage}>
                  Veuillez prendre un abonnement pour avoir des réductions
                </Text>
                
                <TouchableOpacity 
                  style={styles.subscriptionButton}
                  onPress={onSubscriptionPress}
                >
                  <Text style={styles.subscriptionButtonText}>
                    Voir les Abonnements
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      {/* Informations supplémentaires */}
      {subscriptionStatus?.isActive && (
        <View style={styles.infoContainer}>
          <View style={styles.infoItem}>
            <Ionicons name="shield-checkmark" size={20} color={AppColors.success} />
            <Text style={styles.infoText}>
              Code sécurisé qui change toutes les 120 secondes
            </Text>
          </View>
          
          <View style={styles.infoItem}>
            <Ionicons name="storefront" size={20} color={AppColors.primary} />
            <Text style={styles.infoText}>
              Accepté chez tous nos partenaires
            </Text>
          </View>

          {/* Bouton toggle carte (debug/admin) */}
          {__DEV__ && (
            <TouchableOpacity 
              style={styles.debugButton} 
              onPress={toggleCard}
              disabled={toggleLoading}
            >
              {toggleLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.debugButtonText}>
                  {cardData?.card?.isActive ? 'Désactiver' : 'Activer'} la carte
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: AppColors.textLight,
    textAlign: 'center',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  errorText: {
    marginTop: 16,
    marginBottom: 24,
    fontSize: 16,
    color: AppColors.error,
    textAlign: 'center',
    lineHeight: 22,
  },

  retryButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },

  retryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: AppColors.surfaceSecondary,
    borderRadius: 12,
  },
  
  instructionText: {
    marginLeft: 12,
    fontSize: 14,
    color: AppColors.text,
    flex: 1,
  },

  cardContainer: {
    alignSelf: 'center',
    marginBottom: 32,
  },

  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },

  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
  },

  cardBack: {
    position: 'absolute',
    backgroundColor: 'white',
  },

  cardGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 1,
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statusText: {
    marginLeft: 4,
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },

  chipContainer: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },

  chip: {
    width: 50,
    height: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardNumberContainer: {
    marginTop: 16,
  },

  cardNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },

  userInfo: {
    flex: 1,
  },

  userLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },

  userName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },

  planInfo: {
    alignItems: 'flex-end',
  },

  planLabel: {
    fontSize: 8,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2,
  },

  planName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },

  // Face arrière - QR Code
  qrContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },

  qrTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: AppColors.text,
    marginBottom: 20,
    textAlign: 'center',
  },

  qrImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },

  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },

  qrFallback: {
    width: 200,
    height: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AppColors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppColors.surfaceSecondary,
  },

  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  countdownText: {
    marginLeft: 8,
    fontSize: 14,
    color: AppColors.textLight,
    fontWeight: '500',
  },

  qrInstructions: {
    fontSize: 12,
    color: AppColors.textLight,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Face arrière - Message d'abonnement
  subscriptionContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
  },

  subscriptionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: AppColors.error,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },

  subscriptionMessage: {
    fontSize: 14,
    color: AppColors.textLight,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },

  subscriptionButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },

  subscriptionButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Informations supplémentaires
  infoContainer: {
    paddingHorizontal: 16,
  },

  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  infoText: {
    marginLeft: 12,
    fontSize: 14,
    color: AppColors.textLight,
    flex: 1,
  },

  // Debug button (développement uniquement)
  debugButton: {
    backgroundColor: AppColors.warning,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
    marginTop: 16,
  },

  debugButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 12,
  },
});
