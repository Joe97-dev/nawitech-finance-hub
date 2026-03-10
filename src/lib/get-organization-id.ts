import { supabase } from "@/integrations/supabase/client";

let cachedOrgId: string | null = null;

export async function getOrganizationId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const { data, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (error || !data?.organization_id) {
    throw new Error("Could not determine organization");
  }

  cachedOrgId = data.organization_id;
  return cachedOrgId;
}

// Clear cache on auth state change
supabase.auth.onAuthStateChange(() => {
  cachedOrgId = null;
});
