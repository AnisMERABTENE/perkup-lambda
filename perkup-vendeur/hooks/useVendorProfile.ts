import { useMemo } from 'react';
import { useQuery } from '@apollo/client/react';
import { GET_VENDOR_PROFILE, VendorProfileResponse, VendorProfileStore } from '@/graphql/queries/vendor';

interface UseVendorProfileResult {
  loading: boolean;
  error?: Error;
  store: VendorProfileStore | null;
  stores: VendorProfileStore[];
  refetch: () => Promise<any>;
  refreshing: boolean;
  user?: VendorProfileResponse['getVendorProfile']['user'];
  hasStores: boolean;
  isSetupComplete: boolean;
}

export const useVendorProfile = (): UseVendorProfileResult => {
  const { data, loading, error, refetch, networkStatus } = useQuery<VendorProfileResponse>(GET_VENDOR_PROFILE, {
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true
  });

  const stores = data?.getVendorProfile?.stores ?? [];
  const store = useMemo(() => (stores.length > 0 ? stores[0] : null), [stores]);

  return {
    loading,
    error: error as Error | undefined,
    store,
    stores,
    refetch,
    refreshing: networkStatus === 4,
    user: data?.getVendorProfile?.user,
    hasStores: data?.getVendorProfile?.hasStores ?? false,
    isSetupComplete: data?.getVendorProfile?.isSetupComplete ?? false
  };
};

export default useVendorProfile;
