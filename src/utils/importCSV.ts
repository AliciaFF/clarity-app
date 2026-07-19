import type { Account, Transaction } from '../types';
import { parseCaisseEpargneCSV } from './csvParser';
import { Storage } from '../storage';

async function readFileContent(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('iso-8859-1').decode(buffer);
  }
}

export async function importCSV(
  file: File,
  accountId: string,
  currentAccounts: Account[],
): Promise<{ accounts: Account[]; transactions: Transaction[]; newCount: number }> {
  const content = await readFileContent(file);
  const { transactions: newTxs, balance: csvBalance } = parseCaisseEpargneCSV(content, accountId);
  const existingTxs = Storage.getTransactions();
  const existingIds = new Set(existingTxs.map(t => t.id));
  const onlyNew = newTxs.filter(t => !existingIds.has(t.id));
  const merged = [...existingTxs, ...onlyNew].sort((a, b) => b.date.localeCompare(a.date));
  Storage.saveTransactions(merged);
  const updatedAccounts = currentAccounts.map(a => {
    if (a.id !== accountId) return a;
    const newBalance = csvBalance !== null
      ? csvBalance
      : Math.round((a.balance + onlyNew.reduce((s, t) => s + t.amount, 0)) * 100) / 100;
    return { ...a, balance: newBalance, lastUpdated: new Date().toISOString() };
  });
  Storage.saveAccounts(updatedAccounts);
  return { accounts: updatedAccounts, transactions: merged, newCount: onlyNew.length };
}
