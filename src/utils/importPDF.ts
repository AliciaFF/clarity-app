import type { Account, Transaction } from '../types';
import { Storage } from '../storage';

export async function importPDF(
  file: File,
  accountId: string,
  currentAccounts: Account[],
): Promise<{ accounts: Account[]; transactions: Transaction[]; newCount: number }> {
  // Envoyer le PDF à la Netlify Function pour parsing serveur
  const arrayBuffer = await file.arrayBuffer();
  const response = await fetch('/.netlify/functions/parse-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: arrayBuffer,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Erreur lors du traitement du PDF.');
  }

  const { transactions: parsed, balance: pdfBalance } = await response.json();

  if (!parsed || parsed.length === 0) {
    throw new Error('Aucune transaction trouvée dans ce PDF.');
  }

  const catRules = Storage.getCatRules();
  const labelRules = Storage.getLabelRules();

  const newTxs: Transaction[] = parsed.map((t: any) => {
    const labelKey = t.label.toLowerCase().trim();
    const ruleLabel = Object.entries(labelRules).find(([key]) => labelKey.includes(key))?.[1] as string | undefined;
    const ruleCategory = Object.entries(catRules).find(([key]) => labelKey.includes(key))?.[1] as string | undefined;
    return {
      id: t.id,
      accountId,
      date: t.date,
      label: ruleLabel ?? t.label,
      amount: t.amount,
      category: ruleCategory ?? t.category,
    };
  });

  const existingTxs = Storage.getTransactions();
  const existingIds = new Set(existingTxs.map((t) => t.id));
  const onlyNew = newTxs.filter((t) => !existingIds.has(t.id));
  const merged = [...existingTxs, ...onlyNew].sort((a, b) => b.date.localeCompare(a.date));
  Storage.saveTransactions(merged);

  const updatedAccounts = currentAccounts.map((a) => {
    if (a.id !== accountId) return a;
    const newBalance =
      pdfBalance !== null
        ? pdfBalance
        : Math.round((a.balance + onlyNew.reduce((s, t) => s + t.amount, 0)) * 100) / 100;
    return { ...a, balance: newBalance, lastUpdated: new Date().toISOString() };
  });
  Storage.saveAccounts(updatedAccounts);

  return { accounts: updatedAccounts, transactions: merged, newCount: onlyNew.length };
}
