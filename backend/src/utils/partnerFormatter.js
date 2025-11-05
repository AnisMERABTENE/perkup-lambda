/**
 * Normalize a partner mongoose document or plain object for websocket notifications.
 * Ensures consistent shape with frontend GraphQL expectations.
 */
export const formatPartnerForNotification = (partner) => {
  if (!partner) return null;

  const source = typeof partner.toObject === 'function' ? partner.toObject() : { ...partner };
  const id = (source._id || source.id)?.toString?.() || source.id;

  const hasCoordinates = Array.isArray(source.location?.coordinates) && source.location.coordinates.length === 2;
  const latitude = hasCoordinates ? Number(source.location.coordinates[1]) : source.location?.latitude;
  const longitude = hasCoordinates ? Number(source.location.coordinates[0]) : source.location?.longitude;

  const createdAt = source.createdAt ? new Date(source.createdAt).toISOString() : undefined;
  const updatedAt = source.updatedAt ? new Date(source.updatedAt).toISOString() : new Date().toISOString();

  return {
    __typename: 'Partner',
    id,
    name: source.name,
    category: source.category,
    address: source.address,
    city: source.city,
    zipCode: source.zipCode,
    phone: source.phone || '',
    discount: source.discount,
    offeredDiscount: source.discount,
    description: source.description || '',
    logo: source.logo || null,
    website: source.website || null,
    isActive: source.isActive !== undefined ? source.isActive : true,
    createdAt,
    updatedAt,
    location: latitude != null && longitude != null ? {
      latitude,
      longitude
    } : null
  };
};

export default formatPartnerForNotification;
