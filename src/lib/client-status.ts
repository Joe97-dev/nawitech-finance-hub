export interface ClientLoanMatchInput {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ClientStatusLoanInput {
  client: string;
  status: string;
}

const CLOSED_LOAN_STATUSES = new Set(["closed", "rejected", "written_off"]);

export const normalizeClientText = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

export const clientMatchesLoan = (
  client: ClientLoanMatchInput,
  loanClientField: string,
) => {
  if (loanClientField === client.id) return true;

  return (
    normalizeClientText(loanClientField) ===
    normalizeClientText(`${client.first_name} ${client.last_name}`)
  );
};

export const loanIsOpen = (status: string) => !CLOSED_LOAN_STATUSES.has(status);

export const clientHasOpenLoans = (
  client: ClientLoanMatchInput,
  loans: ClientStatusLoanInput[],
) => loans.some((loan) => clientMatchesLoan(client, loan.client) && loanIsOpen(loan.status));
