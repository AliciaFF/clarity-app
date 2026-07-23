import type { Account, Transaction } from '../types';
import { Storage } from '../storage';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);

async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines = content.items.map((item: any) => item.str).join(' ');
    fullText += lines + '\n';
  }
  return fullText;
}

function guessCategory(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('amazon') || l.includes('cdiscount') || l.includes('fnac') || l.includes('shopping')) return '🛒 Shopping';
  if (l.includes('carrefour') || l.includes('lidl') || l.includes('aldi') || l.includes('intermarche') || l.includes('leclerc') || l.includes('monoprix') || l.includes('casino') || l.includes('franprix') || l.includes('sorodis')) return '🥖 Courses';
  if (l.includes('mc do') || l.includes('mcdonald') || l.includes('burger') || l.includes('pizz') || l.includes('restaurant') || l.includes('celini') || l.includes('restaur')) return '🍕 Restauration';
  if (l.includes('sncf') || l.includes('ratp') || l.includes('uber') || l.includes('blabla') || l.includes('chargemap') || l.includes('transport') || l.includes('dekra')) return '🚗 Transport';
  if (l.includes('loyer') || l.includes('logement') || l.includes('habitat') || l.includes('location') || l.includes('compagnie generale de locat')) return '🏠 Logement';
  if (l.includes('pharma') || l.includes('medic') || l.includes('doctolib') || l.includes('sante') || l.includes('hopital') || l.includes('clinique')) return '💊 Santé';
  if (l.includes('netflix') || l.includes('spotify') || l.includes('deezer') || l.includes('youtube') || l.includes('disney') || l.includes('loisir') || l.includes('tipeee') || l.includes('microsoft') || l.includes('google')) return '🎮 Loisirs';
  if (l.includes('impot') || l.includes('taxe') || l.includes('dgfip') || l.includes('direction generale des fina') || l.includes('prelevement a la source')) return '📋 Impôts';
  if (l.includes('mma') || l.includes('maif') || l.includes('matmut') || l.includes('assur')) return '🔒 Assurance';
  if (l.includes('kiabi') || l.includes('zara') || l.includes('h&m') || l.includes('vetmt') || l.includes('halle') || l.includes('vetement')) return '👔 Vêtements';
  if (l.includes('salaire') || l.includes('virement') && (l.includes('recu') || l.includes('entrant')) || l.includes('caf') || l.includes('france travail') || l.includes('bouygues') || (l.includes('vir sepa') && l.includes('fustinoni') && !l.includes('inst'))) return '💶 Revenus';
  if (l.includes('vir') || l.includes('virement')) return '🔄 Virement';
  if (l.includes('retrait') || l.includes('dab')) return '🏧 Retrait';
  if (l.includes('urssaf') || l.includes('cotis')) return '📦 Autres';
  if (l.includes('formule') || l.includes('frais bancaire') || l.includes('agios')) return '🏦 Frais bancaires';
  return '📦 Autres';
}

function parseCaisseEpargnePDFText(text: string, accountId: string): { transactions: Transaction[]; balance: number | null } {
  const transactions: Transaction[] = [];
  let balance: number | null = null;
  const catRules = Storage.getCatRules();
  const labelRules = Storage.getLabelRules();

  // Chercher le solde final
  const balanceMatch = text.match(/SOLDE CREDITEUR AU \d{2}\/\d{2}\/\d{4}\s*\+\s*([\d\s]+,\d{2})/i)
    || text.match(/SOLDE DEBITEUR AU \d{2}\/\d{2}\/\d{4}\s*-\s*([\d\s]+,\d{2})/i);
  if (balanceMatch) {
    const raw = balanceMatch[0];
    const sign = raw.toUpperCase().includes('DEBITEUR') ? -1 : 1;
    const val = parseFloat(balanceMatch[1].replace(/\s/g, '').replace(',', '.'));
    if (!isNaN(val)) balance = sign * val;
  }

  // Parser les transactions : pattern DD/MM/YYYY DD/MM/YYYY ... +/- montant
  const txRegex = /(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+(.*?)\s+([+-])\s*([\d\s]+,\d{2})(?=\s|$)/g;
  let match;
  while ((match = txRegex.exec(text)) !== null) {
    const dateStr = match[1];
    const rawLabel = match[2].trim().replace(/\s+/g, ' ');
    const sign = match[3] === '+' ? 1 : -1;
    const amountStr = match[4].replace(/\s/g, '').replace(',', '.');
    const amount = sign * parseFloat(amountStr);

    const date = dayjs(dateStr, 'DD/MM/YYYY', true);
    if (!date.isValid() || isNaN(amount) || amount === 0) continue;

    // Ignorer les lignes de solde
    if (rawLabel.toUpperCase().includes('SOLDE')) continue;

    const labelKey = rawLabel.toLowerCase().trim();
    const ruleLabel = Object.entries(labelRules).find(([key]) => labelKey.includes(key))?.[1];
    const label = ruleLabel ?? rawLabel;
    const ruleCategory = Object.entries(catRules).find(([key]) => labelKey.includes(key))?.[1];
    const category = ruleCategory ?? guessCategory(rawLabel);

    const id = `${accountId}_${date.format('YYYY-MM-DD')}_${amount}_${label.substring(0, 20)}`
      .replace(/\s/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 80);

    transactions.push({
      id,
      accountId,
      date: date.format('YYYY-MM-DD'),
      label: label.trim(),
      amount,
      category,
    });
  }

  return { transactions, balance };
}

export async function importPDF(
  file: File,
  accountId: string,
  currentAccounts: Account[],
): Promise<{ accounts: Account[]; transactions: Transaction[]; newCount: number }> {
  const text = await extractTextFromPDF(file);
  const { transactions: newTxs, balance: pdfBalance } = parseCaisseEpargnePDFText(text, accountId);

  if (newTxs.length === 0) throw new Error('Aucune transaction trouvée dans ce PDF.');

  const existingTxs = Storage.getTransactions();
  const existingIds = new Set(existingTxs.map(t => t.id));
  const onlyNew = newTxs.filter(t => !existingIds.has(t.id));
  const merged = [...existingTxs, ...onlyNew].sort((a, b) => b.date.localeCompare(a.date));
  Storage.saveTransactions(merged);

  const updatedAccounts = currentAccounts.map(a => {
    if (a.id !== accountId) return a;
    const newBalance = pdfBalance !== null
      ? pdfBalance
      : Math.round((a.balance + onlyNew.reduce((s, t) => s + t.amount, 0)) * 100) / 100;
    return { ...a, balance: newBalance, lastUpdated: new Date().toISOString() };
  });
  Storage.saveAccounts(updatedAccounts);

  return { accounts: updatedAccounts, transactions: merged, newCount: onlyNew.length };
}
