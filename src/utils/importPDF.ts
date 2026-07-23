import type { Account, Transaction } from '../types';
import { Storage } from '../storage';

export async function importPDF(
  file: File,
  accountId: string,
  currentAccounts: Account[],
): Promise<{ accounts: Account[]; transactions: Transaction[]; newCount: number }> {
  const fnUrl = window.location.hostname === 'localhost' || window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)
    ? 'https://wonderful-muffin-ddc2c7.netlify.app/.netlify/functions/parse-pdf'
    : '/.netlify/functions/parse-pdf';

  // ÉTAPE 1 : lecture du fichier
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error(`ÉTAPE 1 ÉCHEC (FileReader) : ${reader.error?.message || 'erreur inconnue'}\nFichier : ${file.name} (${file.size} octets)`));
      reader.readAsArrayBuffer(file);
    });
  } catch (e: any) {
    throw new Error(`ÉTAPE 1 ÉCHEC (lecture fichier) : ${e.message}`);
  }

  // ÉTAPE 2 : envoi à la fonction
  let response: Response;
  try {
    response = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: arrayBuffer,
    });
  } catch (e: any) {
    throw new Error(`ÉTAPE 2 ÉCHEC (fetch réseau)\nURL : ${fnUrl}\nErreur : ${e.message}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '(impossible de lire la réponse)');
    throw new Error(
      `ÉTAPE 2 ÉCHEC (réponse serveur)\nURL : ${response.url}\nStatut HTTP : ${response.status} ${response.statusText}\nRéponse :\n${text.substring(0, 600)}`
    );
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
