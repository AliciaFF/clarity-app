export type AccountType = 'perso' | 'pro';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  lastUpdated: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  label: string;
  amount: number;
  category: string;
}

export interface InstallmentPlan {
  id: string;
  accountId: string;
  label: string;
  totalAmount: number;
  monthlyAmount: number;
  startDate: string;
  totalMonths: number;
  paidMonths: number;
  nextDueDate: string;
  active: boolean;
}
