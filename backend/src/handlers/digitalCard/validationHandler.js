import DigitalCard from '../../models/DigitalCard.js';
import Coupon from '../../models/Coupon.js';
import Partner from '../../models/Partner.js';
import { UserCache } from '../../services/cache/strategies/userCache.js';
import { SubscriptionCache } from '../../services/cache/strategies/subscriptionCache.js';
import websocketService from '../../services/websocketService.js';
import {
  validateTOTP,
  calculateUserDiscount,
  calculateAmounts,
  generateTOTP
} from '../../services/totpService.js';
import { getDigitalCardSecret } from '../../utils/secretManager.js';

// Valider une carte digitale scannée (VENDOR uniquement)
export const validateDigitalCardHandler = async (event) => {
  const { scannedToken, amount, partnerId } = event.args.input;
  const vendorId = event.context.user.id;
  
  try {
    // Validations d'entrée
    if (!scannedToken) {
      throw new Error('Token scanné requis');
    }
    
    if (!amount || amount <= 0) {
      throw new Error('Montant invalide');
    }
    
    console.log(`Validation carte - Token: ${scannedToken}, Montant: ${amount}, Partner: ${partnerId}`);
    
    // Rechercher la carte avec le token actuel ou précédent
    const digitalCard = await DigitalCard.findOne({
      $or: [
        { currentToken: scannedToken },
        { previousToken: scannedToken }
      ],
      isActive: true
    }).populate('user');
    
    if (!digitalCard) {
      throw new Error('Token invalide ou expiré');
    }
    
    // Vérifier que le token n'a pas déjà été utilisé récemment
    const recentUsage = digitalCard.tokenHistory.find(t => 
      t.token === scannedToken && t.isUsed
    );
    
    if (recentUsage) {
      throw new Error('Token déjà utilisé récemment');
    }
    
    // Valider le token avec TOTP
    const secret = await getDigitalCardSecret(digitalCard);
    if (!secret) {
      throw new Error('Secret TOTP manquant');
    }
    
    const validation = validateTOTP(scannedToken, secret, 1);
    
    if (!validation.valid) {
      throw new Error('Token expiré ou invalide');
    }
    
    // Récupérer l'abonnement de l'utilisateur
    const subscriptionFeatures = await SubscriptionCache.getSubscriptionFeatures(digitalCard.user._id);
    
    if (!subscriptionFeatures?.isActive) {
      throw new Error('Abonnement client inactif ou expiré');
    }
    
    // Calculer la réduction applicable
    const userPlan = subscriptionFeatures.plan;
    let partnerDiscount = subscriptionFeatures.maxDiscount; // Par défaut
    let partnerInfo = null;
    
    // Si partnerId fourni, récupérer la réduction du partenaire
    if (partnerId) {
      const partner = await Partner.findById(partnerId);
      if (!partner || !partner.isActive) {
        throw new Error('Partenaire invalide ou inactif');
      }

      if (partner.owner && partner.owner.toString() !== vendorId) {
        throw new Error('Vous ne pouvez valider qu\'avec vos propres partenaires');
      }

      partnerDiscount = partner.discount;
      partnerInfo = {
        id: partner._id,
        name: partner.name,
        category: partner.category,
        address: partner.address
      };
    }
    
    // Appliquer le plafond selon le plan
    const finalDiscount = calculateUserDiscount(partnerDiscount, userPlan);
    
    // Calculer les montants avec précision
    const amounts = calculateAmounts(amount, finalDiscount);
    
    // Marquer le token comme utilisé
    const tokenHistoryIndex = digitalCard.tokenHistory.findIndex(t => t.token === scannedToken);
    if (tokenHistoryIndex !== -1) {
      digitalCard.tokenHistory[tokenHistoryIndex].isUsed = true;
      digitalCard.tokenHistory[tokenHistoryIndex].usedAt = new Date();
    }

    // Générer un nouveau token après chaque validation pour éviter la réutilisation
    const newToken = generateTOTP(secret);
    const now = new Date();
    digitalCard.previousToken = digitalCard.currentToken;
    digitalCard.currentToken = newToken;
    digitalCard.lastRotation = now;
    digitalCard.qrCodeData = JSON.stringify({
      userId: digitalCard.user._id.toString(),
      token: newToken,
      cardNumber: digitalCard.cardNumber,
      timestamp: now.getTime(),
      userPlan: subscriptionFeatures.plan
    });
    digitalCard.tokenHistory.push({
      token: newToken,
      createdAt: now,
      isUsed: false
    });
    if (digitalCard.tokenHistory.length > 10) {
      digitalCard.tokenHistory = digitalCard.tokenHistory.slice(-10);
    }

    await digitalCard.save();
    
    // Créer un coupon pour l'historique client
    let couponDoc = null;
    try {
      console.log('Création coupon automatique pour validation carte digitale');
      
      const coupon = new Coupon({
        code: `DIGITAL-${scannedToken}-${Date.now()}`,
        user: digitalCard.user._id,
        partner: partnerInfo ? partnerInfo.id : null,
        discountApplied: finalDiscount,
        originalAmount: amounts.original,
        discountAmount: amounts.discountAmount,
        finalAmount: amounts.finalAmount,
        status: 'used',
        usedAt: new Date(),
        qrCode: scannedToken,
        digitalCardValidation: true,
        validatedBy: vendorId,
        metadata: {
          userPlan,
          digitalCardValidation: true,
          tokenWindow: validation.timeWindow,
          validatedBy: vendorId,
          partnerOriginalDiscount: partnerDiscount,
          appliedDiscount: finalDiscount
        }
      });
      
      couponDoc = await coupon.save();
      console.log(`Coupon créé automatiquement: ${coupon.code} pour historique client`);
    } catch (couponError) {
      console.error('Erreur création coupon automatique:', couponError);
      // Ne pas faire échouer la validation même si le coupon échoue
    }

    try {
      const userIdString = digitalCard.user._id.toString();

      await Promise.all([
        SubscriptionCache.invalidateSubscription(userIdString),
        UserCache.invalidateAllUserCache(userIdString, digitalCard.user.email)
      ]);

      await websocketService.notifyUser(userIdString, {
        type: 'coupon_validated',
        coupon: {
          id: couponDoc?._id?.toString?.() || null,
          partner: partnerInfo,
          discount: {
            offered: partnerDiscount,
            applied: finalDiscount
          },
          amounts: {
            original: amounts.original,
            discount: amounts.discountAmount,
            final: amounts.finalAmount,
            savings: amounts.discountAmount
          },
          plan: userPlan,
          usedAt: new Date().toISOString()
        }
      });
    } catch (notifyError) {
      console.error('❌ Erreur notification coupon:', notifyError);
    }
    
    console.log(`Carte validée: ${digitalCard.cardNumber} - Réduction: ${finalDiscount}%`);
    
    return {
      valid: true,
      client: {
        name: `${digitalCard.user.firstname} ${digitalCard.user.lastname}`,
        email: digitalCard.user.email,
        cardNumber: digitalCard.cardNumber,
        plan: userPlan
      },
      partner: partnerInfo,
      discount: {
        offered: partnerDiscount,
        applied: finalDiscount,
        reason: userPlan === 'premium' ? 'Premium - accès total' : `${userPlan} - plafonné à ${subscriptionFeatures.maxDiscount}%`
      },
      amounts: {
        original: amounts.original,
        discount: amounts.discountAmount,
        final: amounts.finalAmount,
        savings: amounts.discountAmount
      },
      validation: {
        timestamp: new Date(),
        tokenWindow: validation.timeWindow,
        validatedBy: vendorId
      }
    };
  } catch (error) {
    console.error('Erreur validation carte:', error);
    throw error;
  }
};

// Récupérer l'historique des validations côté vendeur
export const getVendorValidationsHandler = async (event) => {
  const vendorId = event.context.user.id;
  const { limit = 20, page = 1, status = 'used' } = event.args;
  
  try {
    // Trouver les partenaires appartenant au vendeur
    const vendorPartners = await Partner.find({ owner: vendorId });
    const partnerIds = vendorPartners.map(p => p._id);
    
    let query = { 
      digitalCardValidation: true,
      validatedBy: vendorId
    };
    
    // Si le vendeur a des partenaires, inclure aussi les validations sur ses partenaires
    if (partnerIds.length > 0) {
      query = {
        $or: [
          { digitalCardValidation: true, validatedBy: vendorId },
          { partner: { $in: partnerIds }, digitalCardValidation: true }
        ]
      };
    }
    
    if (status) {
      query.status = status;
    }
    
    const coupons = await Coupon.find(query)
      .populate('user', 'firstname lastname email')
      .populate('partner', 'name category address')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Coupon.countDocuments(query);
    
    const stats = await Coupon.aggregate([
      { $match: { ...query, status: 'used' } },
      { 
        $group: { 
          _id: null, 
          totalRevenue: { $sum: '$finalAmount' },
          totalValidations: { $sum: 1 },
          totalSavings: { $sum: '$discountAmount' }
        } 
      }
    ]);
    
    return {
      validations: coupons.map(coupon => ({
        id: coupon._id,
        code: coupon.code,
        client: coupon.user ? {
          name: `${coupon.user.firstname} ${coupon.user.lastname}`,
          email: coupon.user.email
        } : null,
        partner: coupon.partner,
        discountApplied: coupon.discountApplied,
        originalAmount: coupon.originalAmount,
        discountAmount: coupon.discountAmount,
        finalAmount: coupon.finalAmount,
        status: coupon.status,
        createdAt: coupon.createdAt,
        usedAt: coupon.usedAt
      })),
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / parseInt(limit)),
        count: coupons.length,
        totalValidations: total
      },
      stats: {
        totalRevenue: stats.length > 0 ? stats[0].totalRevenue : 0,
        totalValidations: stats.length > 0 ? stats[0].totalValidations : 0,
        totalSavings: stats.length > 0 ? stats[0].totalSavings : 0
      }
    };
  } catch (error) {
    console.error('Erreur historique validations vendeur:', error);
    throw error;
  }
};
