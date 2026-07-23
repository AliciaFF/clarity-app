import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let step = 'décodage du body';
  try {
    const buffer = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'binary');

    step = 'chargement pdfjs-dist';
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;

    step = 'extraction des éléments avec coordonnées';
    const allItems = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ('str' in item && item.str.trim())
          allItems.push({
            str: item.str.trim(),
            x: Math.round(item.transform[4]),
            y: Math.round(vp.height - item.transform[5]),
            page: p,
          });
      }
    }

    step = 'détection du format';
    const isTable = allItems.some(i => /^d[eé]bit$/i.test(i.str)) && allItems.some(i => /^cr[eé]dit$/i.test(i.str));

    let transactions, balance;
    if (isTable) {
      step = 'parsing tableau Débit/Crédit (coordonnées X)';
      ({ transactions, balance } = parseTable(allItems));
    } else {
      step = 'parsing relevé signé (+/-)';
      ({ transactions, balance } = parseSigned(allItems));
    }

    if (!transactions || transactions.length === 0) {
      throw new Error(`Aucune transaction trouvée. Format: ${isTable ? 'tableau' : 'signé'}. Items: ${allItems.length}`);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions, balance }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `[${step}] ${err.message}` }),
    };
  }
};

function groupByRow(items, tol = 4) {
  const rows = [];
  for (const item of items) {
    let row = rows.find(r => r.page === item.page && Math.abs(r.y - item.y) <= tol);
    if (!row) { row = { y: item.y, page: item.page, items: [] }; rows.push(row); }
    row.items.push(item);
  }
  return rows.sort((a, b) => a.page !== b.page ? a.page - b.page : a.y - b.y);
}

// Format 4 colonnes : Date | Libellé | Débit | Crédit
// Signe déterminé par la position X du montant par rapport aux en-têtes
function parseTable(allItems) {
  const debitH = allItems.find(i => /^d[eé]bit$/i.test(i.str));
  const creditH = allItems.find(i => /^cr[eé]dit$/i.test(i.str));
  if (!debitH || !creditH) return { transactions: [], balance: null };

  const debitX = debitH.x;
  const creditX = creditH.x;
  const dateRe = /^\d{2}\/\d{2}\/\d{4}$/;
  const amtRe = /^(\d[\d\s]*,\d{2})\s*(EUR)?$/i;
  const transactions = [];

  for (const row of groupByRow(allItems)) {
    const di = row.items.find(i => dateRe.test(i.str)); if (!di) continue;
    const ai = row.items.find(i => amtRe.test(i.str)); if (!ai) continue;
    const amount = parseFloat(ai.str.replace(/[^\d,]/g, '').replace(',', '.'));
    if (isNaN(amount) || amount === 0) continue;
    const lbl = row.items
      .filter(i => !dateRe.test(i.str) && !amtRe.test(i.str))
      .sort((a, b) => a.x - b.x).map(i => i.str).join(' ').trim().replace(/\s+/g, ' ');
    if (!lbl || /solde|libellé/i.test(lbl)) continue;
    const isDebit = Math.abs(ai.x - debitX) < Math.abs(ai.x - creditX);
    const signedAmount = Math.round((isDebit ? -amount : amount) * 100) / 100;
    transactions.push(makeTx(formatDate(di.str), lbl, signedAmount));
  }

  let balance = null;
  const soldeItem = allItems.find(i => /^Solde au \d{2}\/\d{2}\/\d{4}$/i.test(i.str));
  if (soldeItem) {
    const ba = allItems.find(i => i.page === soldeItem.page && Math.abs(i.y - soldeItem.y) <= 4 && amtRe.test(i.str));
    if (ba) balance = parseFloat(ba.str.replace(/[^\d,]/g, '').replace(',', '.'));
  }
  return { transactions, balance };
}

// Format relevé mensuel : colonne MONTANT avec + ou -
function parseSigned(allItems) {
  const dateRe = /^\d{2}\/\d{2}\/\d{4}$/;
  const signRe = /^([+-])\s*([\d\s]+,\d{2})$/;
  const transactions = [];

  for (const row of groupByRow(allItems)) {
    const dis = row.items.filter(i => dateRe.test(i.str)); if (dis.length === 0) continue;
    const di = dis.reduce((a, b) => a.x < b.x ? a : b);
    const ai = row.items.find(i => signRe.test(i.str)); if (!ai) continue;
    const m = ai.str.match(signRe);
    const amount = Math.round((m[1] === '+' ? 1 : -1) * parseFloat(m[2].replace(/\s/g, '').replace(',', '.')) * 100) / 100;
    if (isNaN(amount) || amount === 0) continue;
    const lbl = row.items.filter(i => !dateRe.test(i.str) && !signRe.test(i.str) && i.x > di.x)
      .sort((a, b) => a.x - b.x).map(i => i.str).join(' ').trim().replace(/^\*\s*/, '').replace(/\s+/g, ' ');
    if (!lbl || /solde/i.test(lbl)) continue;
    transactions.push(makeTx(formatDate(di.str), lbl, amount));
  }

  let balance = null;
  const soldeItems = allItems.filter(i => /SOLDE (CREDITEUR|DEBITEUR)/i.test(i.str));
  if (soldeItems.length > 0) {
    const last = soldeItems[soldeItems.length - 1];
    const ba = allItems.find(i => i.page === last.page && Math.abs(i.y - last.y) <= 4 && signRe.test(i.str));
    if (ba) {
      const m2 = ba.str.match(signRe);
      if (m2) balance = Math.round((m2[1] === '+' ? 1 : -1) * parseFloat(m2[2].replace(/\s/g, '').replace(',', '.')) * 100) / 100;
    }
  }
  return { transactions, balance };
}

function makeTx(date, rawLabel, amount) {
  const id = `pdf_${date}_${amount}_${rawLabel.substring(0, 20)}`
    .replace(/\s/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 80);
  return { id, date, label: rawLabel, amount, category: guessCategory(rawLabel) };
}

function formatDate(s) { const [d, m, y] = s.split('/'); return `${y}-${m}-${d}`; }

function guessCategory(label) {
  const l = label.toLowerCase();
  if (l.includes('amazon') || l.includes('cdiscount') || l.includes('fnac')) return '🛒 Shopping';
  if (l.includes('carrefour') || l.includes('lidl') || l.includes('aldi') || l.includes('intermarche') || l.includes('leclerc') || l.includes('monoprix') || l.includes('casino') || l.includes('franprix') || l.includes('sorodis') || l.includes('utile')) return '🥖 Courses';
  if (l.includes('mc do') || l.includes('mcdonald') || l.includes('burger') || l.includes('pizz') || l.includes('celini') || l.includes('restaur')) return '🍕 Restauration';
  if (l.includes('sncf') || l.includes('ratp') || l.includes('uber') || l.includes('blabla') || l.includes('chargemap') || l.includes('dekra') || l.includes('amende') || l.includes('onepark') || l.includes('parking')) return '🚗 Transport';
  if (l.includes('loyer') || l.includes('logement') || l.includes('compagnie generale de locat')) return '🏠 Logement';
  if (l.includes('pharma') || l.includes('medic') || l.includes('doctolib')) return '💊 Santé';
  if (l.includes('netflix') || l.includes('spotify') || l.includes('youtube') || l.includes('disney') || l.includes('tipeee') || l.includes('microsoft') || l.includes('google') || l.includes('apple') || l.includes('ionos')) return '🎮 Loisirs';
  if (l.includes('impot') || l.includes('dgfip') || l.includes('direction generale des fina')) return '📋 Impôts';
  if (l.includes('mma') || l.includes('maif') || l.includes('matmut') || l.includes('assur')) return '🔒 Assurance';
  if (l.includes('kiabi') || l.includes('zara') || l.includes('h&m') || l.includes('halle') || l.includes('vetmt') || l.includes('passion beaute')) return '👔 Vêtements';
  if (l.includes('caf ') || l.includes('france travail') || l.includes('sepa') || l.includes('vir sepa')) return '💶 Revenus';
  if (l.includes('vir') || l.includes('virement')) return '🔄 Virement';
  if (l.includes('retrait') || l.includes('dab')) return '🏧 Retrait';
  if (l.includes('formule') || l.includes('frais bancaire') || l.includes('agios') || l.includes('cotisations bancaires')) return '🏦 Frais bancaires';
  if (l.includes('cofidis') || l.includes('credit')) return '💳 Crédit';
  return '📦 Autres';
}
