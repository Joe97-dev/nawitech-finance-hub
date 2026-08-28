export interface ClientLoanMatchInput {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ClientStatusLoanInput {
  client: string;
  status: string;
}

const CLOSED_LOAN_STATUSES = new Set(["closed", "rejected", "written_off", "abandoned"]);

export const normalizeClientText = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

export const clientMatchesLoan = (
  client: ClientLoanMatchInput,
  loanClientField: string,
  options: { allowNameMatch?: boolean } = {},
) => {
  if (loanClientField === client.id) return true;
  if (options.allowNameMatch === false) return false;

  return (
    normalizeClientText(loanClientField) ===
    normalizeClientText(`${client.first_name} ${client.last_name}`)
  );
};

export const loanIsOpen = (status: string) => !CLOSED_LOAN_STATUSES.has(status);

export const clientHasOpenLoans = (
  client: ClientLoanMatchInput,
  loans: ClientStatusLoanInput[],
  options: { allowNameMatch?: boolean } = {},
) =>
  loans.some(
    (loan) => clientMatchesLoan(client, loan.client, options) && loanIsOpen(loan.status),
  );

/**
 * Names shared by more than one client. Loans stored by name alone cannot be
 * attributed to a single client in these cases, so name matching must be skipped.
 */
export const getDuplicateClientNames = (clients: ClientLoanMatchInput[]) => {
  const counts = new Map<string, number>();
  for (const c of clients) {
    const key = normalizeClientText(`${c.first_name} ${c.last_name}`);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k));
};

export const isNameShared = (
  client: ClientLoanMatchInput,
  duplicateNames: Set<string>,
) => duplicateNames.has(normalizeClientText(`${client.first_name} ${client.last_name}`));

