import cacheService from '../services/cache/cacheService.js';

const USER_PLANS = ['free', 'basic', 'super', 'premium'];

export const buildPartnerDetailCacheKeys = (identifier) => {
  if (!identifier) return [];
  const keys = [`partner_detail:${identifier}`];
  USER_PLANS.forEach((plan) => {
    keys.push(`partner_detail:${identifier}:${plan}`);
  });
  return keys;
};

export const invalidatePartnerDetailCaches = async (identifiers = []) => {
  const uniqueIdentifiers = [...new Set(identifiers.filter(Boolean))];
  if (uniqueIdentifiers.length === 0) {
    return;
  }

  const keys = uniqueIdentifiers.flatMap(buildPartnerDetailCacheKeys);
  const uniqueKeys = [...new Set(keys)];

  // Supprimer explicitement chaque clé (toutes couches) puis invalider par motif
  await Promise.allSettled(
    uniqueKeys.map((key) => cacheService.del(key, 'partners'))
  );

  await Promise.allSettled(
    uniqueKeys.map((key) => cacheService.invalidate(key, 'partners'))
  );
};

export default invalidatePartnerDetailCaches;
