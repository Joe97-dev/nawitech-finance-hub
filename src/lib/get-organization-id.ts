import { supabase } from "@/integrations/supabase/client";

let cachedOrgId: string | null = null;
let cachedUserId: string | null = null;

export async function getOrganizationId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // Return cached if same user
  if (cachedOrgId && cachedUserId === user.id) return cachedOrgId;

  const { data, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (error || !data?.organization_id) {
    throw new Error("Could not determine organization");
  }

  cachedOrgId = data.organization_id;
  cachedUserId = user.id;
  return data.organization_id;
}
