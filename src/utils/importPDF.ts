import type { Account, Transaction } from '../types';
import { Storage } from '../storage';

export async function importPDF(
  file: File,
  accountId: string,
  currentAccounts: Account[],
): Promise<{ accounts: Account[]; transactions: Transaction[]; newCount: number }> {
  // Envoyer le PDF à la Netlify Function pour parsing serveur
  const arrayBuffer = await file.arrayBuffer();
  const fnUrl = window.location.hostname === 'localhost' || window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)
    ? 'https://wonderful-muffin-ddc2c7.netlify.app/.netlify/functions/parse-pdf'
    : '/.netlify/functions/parse-pdf';
  const response = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf' },
    body: arrayBuffer,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '(impossible de lire la réponse)');
    throw new Error(
      `URL appelée : ${response.url}\n` +
      `Statut HTTP : ${response.status} ${response.statusText}\n` +
      `Réponse serveur :\n${text.substring(0, 500)}`
    );
  }

  const json = await response.json();
  const { transactions: parsed, balance: pdfBalance, _diag } = json;

  if (!parsed || parsed.length === 0) {
    const d = _diag;
    if (!d) throw new Error('Aucune transaction trouvée dans ce PDF.');
    const caseDesc = !d.chars
      ? '❌ CAS 1 : Aucun texte extrait (PDF scanné/image ?)'
      : d.candidateLines.length === 0
        ? '❌ CAS 2 : Texte extrait mais aucune date ni montant détecté'
        : d.candidateLines.every((c: any) => !c.reason.startsWith('OK'))
          ? '❌ CAS 3/4 : Dates ou montants détectés mais structure non reconnue'
          : '❌ CAS 5 : Transactions reconnues mais rejetées';
    const candSummary = d.candidateLines.slice(0, 10)
      .map((c: any) => `[${c.reason}]\n${c.line}`)
      .join('\n---\n');
    throw new Error(
      `${caseDesc}\n\n` +
      `Pages : ${d.pages} | Caractères : ${d.chars} | Lignes : ${d.totalLines}\n\n` +
      `--- 2000 premiers caractères ---\n${d.extract}\n\n` +
      `--- Lignes candidates (${d.candidateLines.length}) ---\n${candSummary || '(aucune)'}`
    );
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
