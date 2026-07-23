const pdfParse = require('pdf-parse');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : Buffer.from(event.body, 'binary');

    const data = await pdfParse(body);
    const text = data.text;

    const transactions = parseCaisseEpargneText(text);
    const balance = extractBalance(text);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions, balance }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function extractBalance(text) {
  const creditMatch = text.match(/SOLDE CREDITEUR AU \d{2}\/\d{2}\/\d{4}\s*\+\s*([\d\s]+,\d{2})/i);
  if (creditMatch) {
    const val = parseFloat(creditMatch[1].replace(/\s/g, '').replace(',', '.'));
    if (!isNaN(val)) return val;
  }
  const debitMatch = text.match(/SOLDE DEBITEUR AU \d{2}\/\d{2}\/\d{4}\s*-\s*([\d\s]+,\d{2})/i);
  if (debitMatch) {
    const val = parseFloat(debitMatch[1].replace(/\s/g, '').replace(',', '.'));
    if (!isNaN(val)) return -val;
  }
  return null;
}

function guessCategory(label) {
  const l = label.toLowerCase();
  if (l.includes('amazon') || l.includes('cdiscount') || l.includes('fnac')) return '🛒 Shopping';
  if (l.includes('carrefour') || l.includes('lidl') || l.includes('aldi') || l.includes('intermarche') || l.includes('leclerc') || l.includes('monoprix') || l.includes('casino') || l.includes('franprix') || l.includes('sorodis')) return '🥖 Courses';
  if (l.includes('mc do') || l.includes('mcdonald') || l.includes('burger') || l.includes('pizz') || l.includes('celini') || l.includes('restaur')) return '🍕 Restauration';
  if (l.includes('sncf') || l.includes('ratp') || l.includes('uber') || l.includes('blabla') || l.includes('chargemap') || l.includes('dekra')) return '🚗 Transport';
  if (l.includes('loyer') || l.includes('logement') || l.includes('compagnie generale de locat')) return '🏠 Logement';
  if (l.includes('pharma') || l.includes('medic') || l.includes('doctolib')) return '💊 Santé';
  if (l.includes('netflix') || l.includes('spotify') || l.includes('youtube') || l.includes('disney') || l.includes('tipeee') || l.includes('microsoft') || l.includes('google')) return '🎮 Loisirs';
  if (l.includes('impot') || l.includes('dgfip') || l.includes('prelevement a la source') || l.includes('direction generale des fina')) return '📋 Impôts';
  if (l.includes('mma') || l.includes('maif') || l.includes('matmut') || l.includes('assur')) return '🔒 Assurance';
  if (l.includes('kiabi') || l.includes('zara') || l.includes('h&m') || l.includes('halle') || l.includes('vetmt')) return '👔 Vêtements';
  if (l.includes('caf ') || l.includes('france travail') || l.includes('bouygues') || l.includes('urssaf')) return '💶 Revenus';
  if (l.includes('vir') || l.includes('virement')) return '🔄 Virement';
  if (l.includes('retrait') || l.includes('dab')) return '🏧 Retrait';
  if (l.includes('formule') || l.includes('frais bancaire') || l.includes('agios')) return '🏦 Frais bancaires';
  return '📦 Autres';
}

function formatDate(dateStr) {
  const [d, m, y] = dateStr.split('/');
  return `${y}-${m}-${d}`;
}

function parseCaisseEpargneText(text) {
  const transactions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Pattern : ligne qui commence par une date DD/MM/YYYY
  const datePattern = /^(\d{2}\/\d{2}\/\d{4})/;
  // Montant en fin de ligne : + ou - suivi d'un montant
  const amountPattern = /([+-])\s*([\d\s]+,\d{2})\s*$/;

  for (const line of lines) {
    if (!datePattern.test(line)) continue;

    const dateMatch = line.match(datePattern);
    const amountMatch = line.match(amountPattern);
    if (!dateMatch || !amountMatch) continue;

    const dateStr = dateMatch[1];
    const sign = amountMatch[1] === '+' ? 1 : -1;
    const amount = sign * parseFloat(amountMatch[2].replace(/\s/g, '').replace(',', '.'));

    if (isNaN(amount) || amount === 0) continue;

    // Extraire le libellé : entre la 2e date et le montant
    const afterDates = line.replace(/^\d{2}\/\d{2}\/\d{4}\s+\d{2}\/\d{2}\/\d{4}\s+/, '');
    const rawLabel = afterDates.replace(amountPattern, '').trim().replace(/\s+/g, ' ');

    if (!rawLabel || rawLabel.toUpperCase().includes('SOLDE')) continue;

    const date = formatDate(dateStr);
    const category = guessCategory(rawLabel);
    const id = `pdf_${date}_${amount}_${rawLabel.substring(0, 20)}`
      .replace(/\s/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 80);

    transactions.push({ id, date, label: rawLabel, amount, category });
  }

  return transactions;
}
