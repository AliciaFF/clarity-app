import type { Account, Transaction, InstallmentPlan } from '../types';

const KEYS = {
  accounts: 'bt_accounts',
  transactions: 'bt_transactions',
  installments: 'bt_installments',
};

function get<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function set<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}

export const Storage = {
  getAccounts: (): Account[] => get(KEYS.accounts),
  saveAccounts: (d: Account[]) => set(KEYS.accounts, d),
  getTransactions: (): Transaction[] => get(KEYS.transactions),
  saveTransactions: (d: Transaction[]) => set(KEYS.transactions, d),
  getInstallments: (): InstallmentPlan[] => get(KEYS.installments),
  saveInstallments: (d: InstallmentPlan[]) => set(KEYS.installments, d),
};
