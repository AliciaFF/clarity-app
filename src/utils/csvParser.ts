import type { Transaction } from '../types';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
dayjs.extend(customParseFormat);

// Format Caisse d'Épargne :
// Date;Libelle simplifie;Libelle operation;Reference;Infos;Type;Categorie;Sous-categorie;Debit;Credit;Date op;Date valeur;Pointage
export function parseCaisseEpargneCSV(content: string, accountId: string): Transaction[] {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const transactions: Transaction[] = [];

  for (const line of lines) {
    const cols = line.split(';').map(c => c.replace(/"/g, '').trim());
    if (cols.length < 10) continue;
    // Ignorer l'en-tête
    if (cols[0].toLowerCase().includes('date')) continue;

    const date = dayjs(cols[0], 'DD/MM/YYYY', true);
    if (!date.isValid()) continue;

    const label = cols[1] || cols[2] || '';
    const category = mapCategory(cols[6] || '', cols[7] || '');

    // Débit (col 8) ou Crédit (col 9)
    const debitStr = (cols[8] || '').replace(/\s/g, '').replace(',', '.');
    const creditStr = (cols[9] || '').replace(/\s/g, '').replace(',', '.');
    const debit = parseFloat(debitStr) || 0;
    const credit = parseFloat(creditStr) || 0;

    const amount = credit !== 0 ? credit : debit; // débit déjà négatif dans le fichier
    if (amount === 0) continue;

    transactions.push({
      id: `${accountId}_${cols[0]}_${cols[3] || label}_${amount}`.replace(/\s/g, '_').substring(0, 80),
      accountId,
      date: date.format('YYYY-MM-DD'),
      label: label.trim(),
      amount,
      category,
    });
  }
  return transactions;
}

function mapCategory(cat: string, subCat: string): string {
  const c = (cat + ' ' + subCat).toLowerCase();
  if (c.includes('alimentation') || c.includes('course')) return '🛒 Courses';
  if (c.includes('restaur') || c.includes('rapide')) return '🍽️ Restauration';
  if (c.includes('shopping')) return '🛍️ Shopping';
  if (c.includes('transport') || c.includes('carburant') || c.includes('train')) return '🚗 Transport';
  if (c.includes('logement') || c.includes('loyer')) return '🏠 Logement';
  if (c.includes('sante') || c.includes('santé') || c.includes('medic')) return '🏥 Santé';
  if (c.includes('loisir') || c.includes('vacance') || c.includes('musique') || c.includes('video')) return '🎬 Loisirs';
  if (c.includes('impot') || c.includes('taxe') || c.includes('contribution')) return '🏛️ Impôts';
  if (c.includes('banque') || c.includes('assurance')) return '🛡️ Assurance';
  if (c.includes('vetement') || c.includes('chaussure')) return '👗 Vêtements';
  if (c.includes('revenu') || c.includes('salaire') || c.includes('rentree')) return '💰 Revenus';
  if (c.includes('virement')) return '🔄 Virement';
  if (c.includes('retrait')) return '💵 Retrait';
  if (c.includes('frais bancaire')) return '🏦 Frais bancaires';
  return '📦 Autres';
}
