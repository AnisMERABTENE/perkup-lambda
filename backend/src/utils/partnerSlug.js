export const buildPartnerSlug = (name) => {
  if (!name) return null;
  
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || null;
};

export default buildPartnerSlug;
