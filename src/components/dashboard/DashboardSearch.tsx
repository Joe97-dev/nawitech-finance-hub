import { useState, useEffect, useRef } from "react";
import { Search, User, CreditCard, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SearchResult {
  id: string;
  type: "client" | "loan";
  label: string;
  subtitle: string;
  icon: typeof User;
}

export const DashboardSearch = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      const items: SearchResult[] = [];

      // Search clients by name, client_number, or id_number
      const { data: clients } = await supabase
        .from("clients")
        .select("id, first_name, last_name, client_number, id_number, phone")
        .or(
          `first_name.ilike.%${query}%,last_name.ilike.%${query}%,client_number.ilike.%${query}%,id_number.ilike.%${query}%,phone.ilike.%${query}%`
        )
        .limit(5);

      if (clients) {
        clients.forEach((c) =>
          items.push({
            id: c.id,
            type: "client",
            label: `${c.first_name} ${c.last_name}`,
            subtitle: c.client_number || c.id_number,
            icon: User,
          })
        );
      }

      // Search loans by loan_number
      const { data: loans } = await supabase
        .from("loans")
        .select("id, loan_number, client, amount, status")
        .or(`loan_number.ilike.%${query}%,client.ilike.%${query}%`)
        .limit(5);

      if (loans) {
        loans.forEach((l) =>
          items.push({
            id: l.id,
            type: "loan",
            label: l.loan_number || "—",
            subtitle: `${l.client} · Ksh ${Number(l.amount).toLocaleString()}`,
            icon: CreditCard,
          })
        );
      }

      setResults(items);
      setOpen(items.length > 0);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery("");
    if (result.type === "client") {
      navigate(`/clients/${result.id}`);
    } else {
      navigate(`/loans/${result.id}`);
    }
  };

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search client name, loan number, ID..."
          className="pl-9 pr-4"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <ul className="py-1">
              {results.map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left"
                    onClick={() => handleSelect(r)}
                  >
                    <r.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.subtitle}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {r.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
