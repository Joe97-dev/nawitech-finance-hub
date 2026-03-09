
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Organization {
  id: string;
  name: string;
  subdomain: string;
}

interface OrganizationContextType {
  organization: Organization | null;
  organizationId: string | null;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

/**
 * Detects subdomain from the current URL.
 * For production: nawiri.superdon.com → "nawiri"
 * For dev/preview: falls back to user's profile org.
 */
function detectSubdomain(): string | null {
  const hostname = window.location.hostname;
  
  // Skip for localhost and Lovable preview URLs
  if (hostname === 'localhost' || hostname.includes('lovable.app') || hostname.includes('127.0.0.1')) {
    return null;
  }
  
  // Extract subdomain: xxx.domain.com → xxx
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    const subdomain = parts[0];
    if (subdomain !== 'www') {
      return subdomain;
    }
  }
  
  return null;
}

export const OrganizationProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrganization = async () => {
      if (!isAuthenticated || !user) {
        setOrganization(null);
        setLoading(false);
        return;
      }

      try {
        const subdomain = detectSubdomain();

        if (subdomain) {
          // Production: resolve org by subdomain
          const { data, error } = await supabase
            .from('organizations')
            .select('id, name, subdomain')
            .eq('subdomain', subdomain)
            .single();

          if (!error && data) {
            setOrganization(data);
            setLoading(false);
            return;
          }
        }

        // Dev/fallback: resolve org from user's profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('id', user.id)
          .single();

        if (profileError || !profile?.organization_id) {
          console.error('No organization found for user');
          setOrganization(null);
          setLoading(false);
          return;
        }

        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('id, name, subdomain')
          .eq('id', profile.organization_id)
          .single();

        if (!orgError && orgData) {
          setOrganization(orgData);
        }
      } catch (error) {
        console.error('Failed to fetch organization:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganization();
  }, [user, isAuthenticated]);

  return (
    <OrganizationContext.Provider value={{
      organization,
      organizationId: organization?.id || null,
      loading
    }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
