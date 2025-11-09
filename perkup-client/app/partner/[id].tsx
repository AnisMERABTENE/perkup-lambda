import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@apollo/client/react';

import AppColors from '@/constants/Colors';
import { GET_PARTNER_DETAIL } from '@/graphql/queries/partners';

const { width } = Dimensions.get('window');

export default function PartnerDetailScreen() {
  // ✅ CORRIGÉ: Utilise directement l'ID MongoDB depuis l'URL
  const { id } = useLocalSearchParams<{ id: string }>();
  
  console.log('🔍 Partner Detail - ID reçu:', { id });

  // 🚀 OPTIMISÉ: Utilise GET_PARTNER_DETAIL avec cache partagé par plan
  const { data, loading, error, refetch } = useQuery(GET_PARTNER_DETAIL, {
    variables: { id },
    errorPolicy: 'all',
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: true,
    skip: !id, // Ne pas exécuter si pas d'ID
  });

  const partnerData = data?.getPartner;
  
  React.useEffect(() => {
    if (loading) {
      console.log('🌀 Partner detail loading...', { id, loading });
    }
  }, [loading, id]);

  React.useEffect(() => {
    if (error) {
      console.log('❌ Partner detail error', error);
    }
  }, [error]);

  React.useEffect(() => {
    if (partnerData) {
      console.log('🧾 Partner detail reçu', {
        id: partnerData.id,
        offeredDiscount: partnerData.offeredDiscount,
        userDiscount: partnerData.userDiscount,
        cacheInfo: partnerData._cacheInfo,
        fetchedAt: new Date().toISOString()
      });
    }
  }, [partnerData]);

  const handleCall = () => {
    if (partnerData?.phone) {
      Linking.openURL(`tel:${partnerData.phone}`);
    }
  };

  const handleDirections = () => {
    if (partnerData?.address) {
      const address = `${partnerData.address}, ${partnerData.city}`;
      const url = `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
      Linking.openURL(url);
    }
  };

  const handleWebsite = () => {
    if (partnerData?.website) {
      Linking.openURL(partnerData.website);
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'boulangerie': 'storefront',
      'beaute': 'cut',
      'bar': 'wine',
      'restaurant': 'restaurant',
      'cinema': 'film',
      'sport': 'fitness',
      'fleuriste': 'flower',
      'technologie': 'phone-portrait',
      'jeux': 'game-controller',
      'vetements': 'shirt',
      'kebab': 'fast-food',
      'pharmacie': 'medical',
      'tabac': 'library',
    };
    return icons[category?.toLowerCase()] || 'storefront';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error || !partnerData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={48} color={AppColors.error} />
        <Text style={styles.errorText}>Partenaire introuvable</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header avec image pleine largeur */}
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButtonTop} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={AppColors.textInverse} />
          </TouchableOpacity>
          
          {partnerData.logo ? (
            <Image 
              source={{ uri: partnerData.logo }} 
              style={styles.headerImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient colors={AppColors.gradientPrimary} style={styles.headerGradient}>
              <View style={styles.iconContainer}>
                <Ionicons 
                  name={getCategoryIcon(partnerData.category) as any} 
                  size={64} 
                  color={AppColors.textInverse} 
                />
              </View>
            </LinearGradient>
          )}
          
          {/* Badge de remise superposé */}
          <View style={styles.discountBadgeFloat}>
            <LinearGradient colors={['#FF6B35', '#F7931E']} style={styles.discountBadge}>
              <Text style={styles.discountText}>{partnerData.userDiscount}%</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Contenu principal */}
        <View style={styles.contentContainer}>
          {/* Informations principales */}
          <View style={styles.mainInfoSection}>
            <Text style={styles.partnerName}>{partnerData.name}</Text>
            <Text style={styles.partnerCategory}>{partnerData.category}</Text>
            
            {partnerData.description && (
              <Text style={styles.description}>{partnerData.description}</Text>
            )}
          </View>

          {/* Boutons d'action - BIEN VISIBLES */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity style={styles.primaryActionButton} onPress={handleCall}>
              <LinearGradient colors={['#4CAF50', '#45A049']} style={styles.actionButtonGradient}>
                <Ionicons name="call" size={20} color={AppColors.textInverse} />
                <Text style={styles.actionButtonText}>Appeler</Text>
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.primaryActionButton} onPress={handleDirections}>
              <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.actionButtonGradient}>
                <Ionicons name="navigate" size={20} color={AppColors.textInverse} />
                <Text style={styles.actionButtonText}>Itinéraire</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Section Réductions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Votre avantage</Text>
            
            <View style={styles.discountCard}>
              <View style={styles.discountRow}>
                <Ionicons name="pricetag" size={20} color={AppColors.primary} />
                <View style={styles.discountInfo}>
                  <Text style={styles.discountLabel}>Réduction offerte par le magasin</Text>
                  <Text style={styles.discountValue}>{partnerData.offeredDiscount}%</Text>
                </View>
              </View>
              
              <View style={styles.discountRow}>
                <Ionicons name="person-circle" size={20} color={AppColors.success} />
                <View style={styles.discountInfo}>
                  <Text style={styles.discountLabel}>Votre accès {partnerData.userPlan}</Text>
                  <Text style={[styles.discountValue, { color: AppColors.success }]}>{partnerData.userDiscount}%</Text>
                </View>
              </View>
            </View>

            {partnerData.isPremiumOnly && (
              <View style={styles.premiumNotice}>
                <Ionicons name="star" size={16} color={AppColors.warning} />
                <Text style={styles.premiumText}>Offre réservée aux abonnés Premium</Text>
              </View>
            )}
          </View>

          {/* Section Contact & Adresse */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Informations</Text>
            
            <View style={styles.contactItem}>
              <Ionicons name="location" size={20} color={AppColors.primary} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>Adresse</Text>
                <Text style={styles.contactValue}>{partnerData.address}</Text>
                <Text style={styles.contactValue}>{partnerData.zipCode} {partnerData.city}</Text>
              </View>
            </View>

            {partnerData.phone && (
              <TouchableOpacity style={styles.contactItem} onPress={handleCall}>
                <Ionicons name="call" size={20} color={AppColors.primary} />
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Téléphone</Text>
                  <Text style={[styles.contactValue, styles.linkText]}>{partnerData.phone}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={AppColors.textSecondary} />
              </TouchableOpacity>
            )}

            {partnerData.website && (
              <TouchableOpacity style={styles.contactItem} onPress={handleWebsite}>
                <Ionicons name="globe" size={20} color={AppColors.primary} />
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Site web</Text>
                  <Text style={[styles.contactValue, styles.linkText]}>Visiter le site</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={AppColors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: AppColors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: AppColors.error,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: AppColors.textInverse,
    fontWeight: '600',
  },
  // NOUVEAU DESIGN AVEC IMAGE PLEINE LARGEUR
  headerContainer: {
    position: 'relative',
    width: width,
    height: 280,
  },
  headerImage: {
    width: '100%',
    height: '100%',
  },
  headerGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonTop: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  discountBadgeFloat: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  discountBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  discountText: {
    color: AppColors.textInverse,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  // CONTENU PRINCIPAL
  contentContainer: {
    flex: 1,
    backgroundColor: AppColors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingTop: 24,
    paddingHorizontal: 20,
    gap: 20,
  },
  mainInfoSection: {
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
  },
  partnerName: {
    fontSize: 32,
    fontWeight: '800',
    color: AppColors.text,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  partnerCategory: {
    fontSize: 18,
    color: AppColors.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 8,
  },
  // BOUTONS D'ACTION PRINCIPAUX - TRÈS VISIBLES
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 10,
  },
  primaryActionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 8,
  },
  actionButtonText: {
    color: AppColors.textInverse,
    fontSize: 16,
    fontWeight: '700',
  },
  // SECTIONS
  section: {
    backgroundColor: AppColors.surface,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 16,
  },
  // REMISES
  discountCard: {
    gap: 16,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  discountInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  discountLabel: {
    fontSize: 15,
    color: AppColors.text,
    fontWeight: '500',
    flex: 1,
  },
  discountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: AppColors.primary,
  },
  premiumNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AppColors.warning + '15',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  premiumText: {
    fontSize: 14,
    color: AppColors.warning,
    fontWeight: '500',
  },
  // CONTACT
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.border + '30',
  },
  contactInfo: {
    flex: 1,
    gap: 4,
  },
  contactLabel: {
    fontSize: 14,
    color: AppColors.textSecondary,
    fontWeight: '500',
  },
  contactValue: {
    fontSize: 16,
    color: AppColors.text,
    fontWeight: '500',
  },
  linkText: {
    color: AppColors.primary,
  },
  bottomSpacing: {
    height: 60,
  },
});
