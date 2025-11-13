import mongoose from 'mongoose';
import DigitalCard from '../../models/DigitalCard.js';
import Coupon from '../../models/Coupon.js';
import { UserCache } from '../../services/cache/strategies/userCache.js';
import { SubscriptionCache } from '../../services/cache/strategies/subscriptionCache.js';
import {
  generateTOTP,
  generateCardNumber,
  generateTOTPSecret,
  TOTP_WINDOW
} from '../../services/totpService.js';
import { encryptSecret, getDigitalCardSecret } from '../../utils/secretManager.js';

// Créer ou récupérer la carte digitale de l'utilisateur (CLIENT uniquement)
export const getMyDigitalCardHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    // Vérifier l'abonnement
    const subscriptionFeatures = await SubscriptionCache.getSubscriptionFeatures(userId);
    if (!subscriptionFeatures?.isActive) {
      throw new Error('Abonnement requis pour accéder à la carte digitale');
    }
    
    let digitalCard = await DigitalCard.findOne({ user: userId });
    
    if (!digitalCard) {
      // Créer une nouvelle carte digitale
      const userSecret = generateTOTPSecret();
      const currentToken = generateTOTP(userSecret);
      const cardNumber = generateCardNumber();
      
      digitalCard = new DigitalCard({
        user: userId,
        currentToken,
        previousToken: null,
        cardNumber,
        lastRotation: new Date(),
        secret: encryptSecret(userSecret),
        qrCodeData: JSON.stringify({
          userId,
          token: currentToken,
          cardNumber,
          timestamp: Date.now(),
          userPlan: subscriptionFeatures.plan
        }),
        tokenHistory: [{
          token: currentToken,
          createdAt: new Date()
        }]
      });
      
      await digitalCard.save();
      
      console.log(`Carte digitale créée pour utilisateur ${userId} - Numéro: ${cardNumber}`);
    } else {
      const decryptedSecret = await getDigitalCardSecret(digitalCard);

      // Vérifier si le token doit être mis à jour
      const now = new Date();
      const timeSinceRotation = (now - digitalCard.lastRotation) / 1000;
      
      if (timeSinceRotation >= TOTP_WINDOW) {
        // Générer un nouveau token avec le secret existant
        const newToken = generateTOTP(decryptedSecret);
        
        // Sauvegarder l'ancien token et générer le nouveau
        digitalCard.previousToken = digitalCard.currentToken;
        digitalCard.currentToken = newToken;
        digitalCard.lastRotation = now;
        digitalCard.qrCodeData = JSON.stringify({
          userId,
          token: newToken,
          cardNumber: digitalCard.cardNumber,
          timestamp: Date.now(),
          userPlan: subscriptionFeatures.plan
        });
        
        // Ajouter à l'historique (garder seulement les 10 derniers)
        digitalCard.tokenHistory.push({
          token: newToken,
          createdAt: now
        });
        
        if (digitalCard.tokenHistory.length > 10) {
          digitalCard.tokenHistory = digitalCard.tokenHistory.slice(-10);
        }
        
        await digitalCard.save();
        
        console.log(`Token mis à jour pour utilisateur ${userId} - Nouveau: ${newToken}`);
      }
    }
    
    // Calculer le temps restant avant la prochaine rotation
    const timeSinceRotation = (Date.now() - digitalCard.lastRotation) / 1000;
    const timeUntilRotation = Math.max(0, TOTP_WINDOW - timeSinceRotation);
    
    // Récupérer les informations utilisateur
    const userData = await UserCache.getUser(userId);
    
    const lastUsedEntry = digitalCard.tokenHistory
      ?.filter(entry => entry.isUsed && entry.usedAt)
      ?.sort((a, b) => new Date(a.usedAt) - new Date(b.usedAt))
      ?.slice(-1)[0];

    return {
      card: {
        cardNumber: digitalCard.cardNumber,
        qrCode: digitalCard.currentToken,
        qrCodeData: digitalCard.qrCodeData,
        isActive: digitalCard.isActive,
        validUntil: new Date(Date.now() + (timeUntilRotation * 1000)),
        timeUntilRotation: Math.ceil(timeUntilRotation),
        userPlan: subscriptionFeatures.plan,
        userInfo: {
          name: `${userData.firstname} ${userData.lastname}`,
          email: userData.email
        }
      },
      instructions: 'Présentez ce QR code au vendeur pour bénéficier de votre réduction',
      security: {
        tokenRotates: `Toutes les ${TOTP_WINDOW} secondes (${Math.round(TOTP_WINDOW / 60)} minutes)`,
        currentlyValid: `${Math.ceil(timeUntilRotation)} secondes restantes`,
        lastValidation: lastUsedEntry?.usedAt ? new Date(lastUsedEntry.usedAt).toISOString() : null
      }
    };
  } catch (error) {
    console.error('Erreur récupération carte digitale:', error);
    throw error;
  }
};

// Activer/désactiver la carte digitale
export const toggleDigitalCardHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    const digitalCard = await DigitalCard.findOne({ user: userId });
    
    if (!digitalCard) {
      throw new Error('Aucune carte digitale trouvée');
    }
    
    digitalCard.isActive = !digitalCard.isActive;
    await digitalCard.save();
    
    const status = digitalCard.isActive ? 'activée' : 'désactivée';
    console.log(`Carte ${status} pour utilisateur ${userId}`);
    
    return {
      message: `Carte ${status} avec succès`,
      card: {
        cardNumber: digitalCard.cardNumber,
        isActive: digitalCard.isActive
      }
    };
  } catch (error) {
    console.error('Erreur toggle carte:', error);
    throw error;
  }
};

// Historique d'utilisation de la carte
export const getCardUsageHistoryHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    const digitalCard = await DigitalCard.findOne({ user: userId });
    
    if (!digitalCard) {
      throw new Error('Aucune carte digitale trouvée');
    }

    console.log('=== DEBUG: Récupération historique carte ===');
    console.log('User ID:', userId);
    
    const [recentCoupons, totalCoupons, totalSavings] = await Promise.all([
      Coupon.find({ user: userId, digitalCardValidation: true })
        .sort({ usedAt: -1 })
        .limit(10)
        .populate('partner', 'name category address logo owner isActive')
        .populate('validatedBy', 'firstname lastname businessName'),
      Coupon.countDocuments({ user: userId, digitalCardValidation: true }),
      Coupon.aggregate([
        { $match: { user: digitalCard.user, digitalCardValidation: true } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$discountAmount', 0] } } } }
      ])
    ]);
    
    console.log('Nombre de coupons trouvés:', recentCoupons.length);
    console.log('Premier coupon (debug):');
    if (recentCoupons.length > 0) {
      console.log('- ID:', recentCoupons[0]._id);
      console.log('- Partner field:', recentCoupons[0].partner);
      console.log('- Partner populated:', !!recentCoupons[0].partner);
      if (recentCoupons[0].partner) {
        console.log('- Partner name:', recentCoupons[0].partner.name);
      }
      console.log('- ValidatedBy:', recentCoupons[0].validatedBy);
    }

    const totalSavingsValue = totalSavings?.[0]?.total || 0;
    
    const timeSinceRotation = (Date.now() - digitalCard.lastRotation) / 1000;
    const timeUntilRotation = Math.max(0, TOTP_WINDOW - timeSinceRotation);
    const lastValidationDate = recentCoupons[0]?.usedAt
      ? new Date(recentCoupons[0].usedAt).toISOString()
      : null;

    return {
      card: {
        cardNumber: digitalCard.cardNumber,
        createdAt: digitalCard.createdAt,
        isActive: digitalCard.isActive
      },
      usage: {
        totalScans: totalCoupons,
        totalSavings: totalSavingsValue,
        recentUsage: recentCoupons.map((coupon) => {
          const maskedToken = coupon.qrCode
            ? coupon.qrCode.replace(/.(?=.{2})/g, '*')
            : '********';
          const partnerDoc = coupon.partner;
          const validatorDoc = coupon.validatedBy;
          
          // Formater l'adresse si elle existe
          let addressString = null;
          if (partnerDoc?.address) {
            if (typeof partnerDoc.address === 'string') {
              addressString = partnerDoc.address;
            } else if (partnerDoc.address.street || partnerDoc.address.city) {
              const addressParts = [];
              if (partnerDoc.address.street) addressParts.push(partnerDoc.address.street);
              if (partnerDoc.address.city) addressParts.push(partnerDoc.address.city);
              if (partnerDoc.address.zipCode) addressParts.push(partnerDoc.address.zipCode);
              addressString = addressParts.join(', ');
            }
          }
          
          return {
            usedAt: coupon.usedAt || coupon.updatedAt,
            token: maskedToken,
            partner: partnerDoc
              ? {
                  id: partnerDoc._id?.toString?.() || null,
                  name: partnerDoc.name,
                  category: partnerDoc.category,
                  address: addressString,
                  logo: partnerDoc.logo || null,
                  isActive: partnerDoc.isActive
                }
              : null,
            validator: validatorDoc
              ? {
                  id: validatorDoc._id?.toString?.() || null,
                  name: validatorDoc.businessName || `${validatorDoc.firstname || ''} ${validatorDoc.lastname || ''}`.trim(),
                  businessName: validatorDoc.businessName
                }
              : null,
            amounts: {
              original: coupon.originalAmount || 0,
              discount: coupon.discountAmount || 0,
              final: coupon.finalAmount || 0,
              savings: coupon.discountAmount || 0
            },
            plan: coupon.metadata?.userPlan || 'inconnu',
            validationDate: coupon.usedAt ? new Date(coupon.usedAt).toLocaleDateString('fr-FR', {
              year: 'numeric',
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }) : null,
            discountApplied: coupon.discountApplied || 0
          };
        })
      },
      security: {
        tokenRotates: `Toutes les ${TOTP_WINDOW} secondes (${Math.round(TOTP_WINDOW / 60)} minutes)`,
        currentlyValid: `${Math.ceil(timeUntilRotation)} secondes restantes`,
        lastValidation: lastValidationDate
      }
    };
  } catch (error) {
    console.error('Erreur historique carte:', error);
    throw error;
  }
};

export const getCardValidationHistoryHandler = async (event) => {
  const userId = event.context.user.id;
  const input = event.arguments?.input || {};

  const limit = Math.min(Math.max(input.limit ?? 20, 5), 50);
  const page = Math.max(input.page ?? 1, 1);
  const categoryFilter = input.category || null;
  const skip = (page - 1) * limit;

  const userObjectId = new mongoose.Types.ObjectId(userId);
  const baseMatch = {
    user: userObjectId,
    digitalCardValidation: true
  };

  const lookupPartner = {
    $lookup: {
      from: 'partners',
      localField: 'partner',
      foreignField: '_id',
      as: 'partner'
    }
  };

  const lookupValidator = {
    $lookup: {
      from: 'users',
      localField: 'validatedBy',
      foreignField: '_id',
      as: 'validator'
    }
  };

  const unwindValidator = {
    $unwind: {
      path: '$validator',
      preserveNullAndEmptyArrays: true
    }
  };

  const unwindPartner = {
    $unwind: {
      path: '$partner',
      preserveNullAndEmptyArrays: true
    }
  };

  const matchPipeline = [
    { $match: baseMatch },
    lookupPartner,
    unwindPartner,
    lookupValidator,
    unwindValidator
  ];

  const matchWithCategory = categoryFilter
    ? [...matchPipeline, { $match: { 'partner.category': categoryFilter } }]
    : matchPipeline;

  const historyPipeline = [
    ...matchWithCategory,
    { $sort: { usedAt: -1, createdAt: -1 } },
    { $skip: skip },
    { $limit: limit }
  ];

  const countPipeline = [
    ...matchWithCategory,
    { $count: 'total' }
  ];

  const savingsPipeline = [
    ...matchWithCategory,
    {
      $project: {
        discountAmount: { $ifNull: ['$discountAmount', 0] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$discountAmount' }
      }
    }
  ];

  const categoriesPipeline = [
    { $match: baseMatch },
    lookupPartner,
    unwindPartner,
    { $match: { 'partner.category': { $ne: null } } },
    { $group: { _id: '$partner.category' } },
    { $sort: { _id: 1 } }
  ];

  try {
    console.log('=== DEBUG: Récupération historique complet ===');
    console.log('User ID:', userId);
    console.log('Category filter:', categoryFilter);
    console.log('Page:', page, 'Limit:', limit);
    
    const [historyResult, countResult, savingsResult, categoriesResult] = await Promise.all([
      Coupon.aggregate(historyPipeline),
      Coupon.aggregate(countPipeline),
      Coupon.aggregate(savingsPipeline),
      Coupon.aggregate(categoriesPipeline)
    ]);
    
    console.log('Résultats aggregation:');
    console.log('- historyResult length:', historyResult.length);
    console.log('- Premier résultat (debug):');
    if (historyResult.length > 0) {
      console.log('  - ID:', historyResult[0]._id);
      console.log('  - Partner:', historyResult[0].partner);
      console.log('  - Validator:', historyResult[0].validator);
    }

    const total = countResult?.[0]?.total || 0;
    const totalSavings = savingsResult?.[0]?.total || 0;
    const categories = categoriesResult
      .map((entry) => entry?._id)
      .filter((value) => typeof value === 'string');

    const items = historyResult.map((coupon) => {
      const partnerDoc = coupon.partner;
      const validatorDoc = coupon.validator;

      // Formater l'adresse si elle existe
      let addressString = null;
      if (partnerDoc?.address) {
        if (typeof partnerDoc.address === 'string') {
          addressString = partnerDoc.address;
        } else if (partnerDoc.address.street || partnerDoc.address.city) {
          const addressParts = [];
          if (partnerDoc.address.street) addressParts.push(partnerDoc.address.street);
          if (partnerDoc.address.city) addressParts.push(partnerDoc.address.city);
          if (partnerDoc.address.zipCode) addressParts.push(partnerDoc.address.zipCode);
          addressString = addressParts.join(', ');
        }
      }

      return {
        id: coupon._id?.toString?.() || null,
        usedAt: coupon.usedAt?.toISOString?.() || coupon.updatedAt?.toISOString?.() || null,
        token: coupon.qrCode || '********',
        partner: partnerDoc
          ? {
              id: partnerDoc._id?.toString?.() || null,
              name: partnerDoc.name,
              category: partnerDoc.category,
              address: addressString,
              logo: partnerDoc.logo || null,
              isActive: partnerDoc.isActive
            }
          : null,
        validator: validatorDoc
          ? {
              id: validatorDoc._id?.toString?.() || null,
              name: validatorDoc.businessName || `${validatorDoc.firstname || ''} ${validatorDoc.lastname || ''}`.trim(),
              businessName: validatorDoc.businessName
            }
          : null,
        amounts: {
          original: coupon.originalAmount || 0,
          discount: coupon.discountAmount || 0,
          final: coupon.finalAmount || 0,
          savings: coupon.discountAmount || 0
        },
        plan: coupon.metadata?.userPlan || 'inconnu',
        validationDate: coupon.usedAt ? new Date(coupon.usedAt).toLocaleDateString('fr-FR', {
          year: 'numeric',
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : null,
        discountApplied: coupon.discountApplied || 0
      };
    });

    return {
      items,
      total,
      limit,
      page,
      hasMore: page * limit < total,
      totalSavings,
      categories
    };
  } catch (error) {
    console.error('Erreur historique complet de la carte:', error);
    throw error;
  }
};

// Supprimer/réinitialiser la carte
export const resetDigitalCardHandler = async (event) => {
  const userId = event.context.user.id;
  
  try {
    const result = await DigitalCard.findOneAndDelete({ user: userId });
    
    if (result) {
      console.log(`Carte supprimée pour utilisateur ${userId}`);
      return { 
        message: 'Carte supprimée avec succès',
        cardNumber: result.cardNumber
      };
    } else {
      return { message: 'Aucune carte à supprimer' };
    }
  } catch (error) {
    console.error('Erreur suppression carte:', error);
    throw error;
  }
};
