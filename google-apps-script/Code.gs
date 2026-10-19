/**
 * FinanSmart — Google Apps Script bridge
 * 1. Create a Google Sheet with tabs named Transactions and Budgets.
 * 2. In Extensions > Apps Script, paste this file.
 * 3. Set Script Properties: GEMINI_API_KEY (optional).
 * 4. Deploy as Web app; execute as you and choose access suitable for your class demo.
 *
 * Demo warning: this simple example does not implement user authentication.
 * Do not store sensitive real financial information in a publicly accessible deployment.
 */
const SPREADSHEET_ID = 'REEMPLAZA_CON_EL_ID_DE_TU_GOOGLE_SHEET';
const GEMINI_MODEL = 'gemini-2.5-flash';

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    if (payload.action === 'sync') {
      syncData(payload);
      return json({ ok: true, message: 'Datos sincronizados' });
    }
    if (payload.action === 'advice') {
      return json({ advice: createAdvice(payload.transactions || []) });
    }
    return json({ error: 'Acción no reconocida' });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function syncData(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tx = ss.getSheetByName('Transactions') || ss.insertSheet('Transactions');
  const budgets = ss.getSheetByName('Budgets') || ss.insertSheet('Budgets');
  tx.clearContents();
  tx.appendRow(['ID', 'Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto COP', 'Nota']);
  (payload.transactions || []).forEach(t => tx.appendRow([t.id, t.date, t.kind, t.title, t.category, t.amount, t.note || '']));
  budgets.clearContents();
  budgets.appendRow(['Categoría', 'Límite COP']);
  (payload.budgets || []).forEach(b => budgets.appendRow([b.category, b.limit]));
}

function createAdvice(transactions) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) return fallbackAdvice(transactions);
  const summary = transactions.map(t => ({
    kind: t.kind, category: t.category, amount: Number(t.amount), date: t.date
  }));
  const prompt = 'Eres un asistente educativo de finanzas personales. Usa este resumen de movimientos (COP): ' +
    JSON.stringify(summary) +
    '. Da 3 recomendaciones prácticas, prudentes y breves en español. No afirmes que eres asesor financiero, no inventes datos y no pidas datos sensibles.';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    muteHttpExceptions: true
  });
  const data = JSON.parse(response.getContentText());
  if (response.getResponseCode() >= 300) throw new Error('Gemini API respondió con un error.');
  const advice = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || fallbackAdvice(transactions);
  return advice;
}

function fallbackAdvice(transactions) {
  const income = transactions.filter(t => t.kind === 'Ingreso').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expenses = transactions.filter(t => t.kind === 'Gasto').reduce((s, t) => s + Number(t.amount || 0), 0);
  const rate = income ? Math.round(expenses / income * 100) : 0;
  return 'Tus gastos registrados equivalen al ' + rate +
    '% de tus ingresos registrados. Revisa gastos recurrentes, fija una meta de ahorro alcanzable y actualiza tus movimientos con regularidad.';
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}