// ============================================================
// หารกัน (HanGun) — shared types
// ============================================================

export type SplitMode = 'equal' | 'custom';
export type ExpenseKind = 'expense' | 'debt';

export type Member = {
  id: string;
  name: string;
  photoUrl: string | null;
  paymentQrUrl: string | null;
  isOwner: boolean;
};

export type ExpenseShare = {
  memberId: string;
  amount: number;
};

export type Expense = {
  id: string;
  kind: ExpenseKind;
  category: string;
  title: string;
  amount: number;
  /** expense: who paid · debt: the lender */
  payerId: string | null;
  /** debt only: the borrower */
  counterId: string | null;
  splitMode: SplitMode;
  createdBy: string | null;
  /** resolved who-owes-what — populated for kind='expense' */
  shares: ExpenseShare[];
};

export type Settlement = {
  id: string;
  fromMember: string;
  toMember: string;
  amount: number;
  slipUrl: string | null;
  slipRef: string | null;
  note: string | null;
};

export type Project = {
  id: string;
  name: string;
  joinCode: string;
  members: Member[];
  expenses: Expense[];
  settlements: Settlement[];
};
