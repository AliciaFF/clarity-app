import type { Transaction } from '../types';
import dayjs from 'dayjs';

export interface RecurringItem { label: string; amount: number; dayOfMonth: number; }

export const RECURRING_CATS = ['Assurance', 'Frais bancaires', 'Impôts', 'Crédit', 'Logement', 'Loisirs', 'Sport', 'Éducation', 'Bien-être', 'Enfants', 'Animaux'];

export function groupRecurring(txs: Transaction[]): RecurringItem[] {
  const groups: Record<string, Transaction[]> = {};
  for (const t of txs) {
    const key = `${Math.round(t.amount)}_${t.label.substring(0, 15)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return Object.values(groups).map(g => ({
    label: g[0].label,
    amount: g[0].amount,
    dayOfMonth: Math.round(g.reduce((s, t) => s + dayjs(t.date).date(), 0) / g.length),
  }));
}

export function detectRecurring(
  txs: Transaction[],
  accountIds: string[],
): { debits: RecurringItem[]; credits: RecurringItem[] } {
  const threeMonthsAgo = dayjs().subtract(3, 'month').format('YYYY-MM-DD');
  const filtered = txs.filter(t => accountIds.includes(t.accountId) && t.date >= threeMonthsAgo);
  const debits = groupRecurring(filtered.filter(t => t.amount < 0 && RECURRING_CATS.some(cat => t.category.includes(cat))));
  const credits = groupRecurring(filtered.filter(t => t.amount > 0 && t.category.includes('Revenus')));
  return { debits, credits };
}
