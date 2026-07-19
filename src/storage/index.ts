import type { Account, Transaction, InstallmentPlan } from '../types';

const KEYS = {
  accounts: 'bt_accounts',
  transactions: 'bt_transactions',
  installments: 'bt_installments',
  catRules: 'bt_cat_rules',
  labelRules: 'bt_label_rules',
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
  getCatRules: (): Record<string, string> => {
    try { return JSON.parse(localStorage.getItem(KEYS.catRules) || '{}'); } catch { return {}; }
  },
  saveCatRule: (label: string, category: string) => {
    const rules = Storage.getCatRules();
    rules[label.toLowerCase().trim()] = category;
    localStorage.setItem(KEYS.catRules, JSON.stringify(rules));
  },
  getLabelRules: (): Record<string, string> => {
    try { return JSON.parse(localStorage.getItem(KEYS.labelRules) || '{}'); } catch { return {}; }
  },
  saveLabelRule: (originalLabel: string, newLabel: string) => {
    const rules = Storage.getLabelRules();
    rules[originalLabel.toLowerCase().trim()] = newLabel;
    localStorage.setItem(KEYS.labelRules, JSON.stringify(rules));
  },
};
