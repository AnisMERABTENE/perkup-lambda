import { createStoreHandler, updateStoreHandler, getVendorProfileHandler, getVendorStoresHandler } from '../../handlers/vendor/storeHandler.js';
import { withAuth } from '../../middlewares/checkSubscription.js';

const vendorResolvers = {
  Query: {
    getVendorProfile: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Accès réservé aux vendeurs');
      }
      
      return await getVendorProfileHandler(event);
    }),
    
    getVendorStores: withAuth(async (_, __, context) => {
      const event = { context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Accès réservé aux vendeurs');
      }
      
      return await getVendorStoresHandler(event);
    })
  },

  Mutation: {
    createStore: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Seuls les vendeurs peuvent créer des boutiques');
      }
      
      return await createStoreHandler(event);
    }),
    
    updateStore: withAuth(async (_, args, context) => {
      const event = { args, context };
      
      if (context.user.role !== 'vendor') {
        throw new Error('Seuls les vendeurs peuvent modifier des boutiques');
      }
      
      return await updateStoreHandler(event);
    })
  }
};

export default vendorResolvers;
