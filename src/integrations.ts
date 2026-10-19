import type { Budget, Transaction } from './types'

const endpoint = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined

export async function syncToGoogleSheets(transactions: Transaction[], budgets: Budget[]) {
  if (!endpoint) return { ok: false, message: 'Sin conexión configurada: los datos permanecen guardados en este navegador.' }
  try {
    await fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'sync', transactions, budgets }),
    })
    return { ok: true, message: 'Solicitud de sincronización enviada a Google Apps Script.' }
  } catch {
    return { ok: false, message: 'No se pudo enviar la sincronización. Revisa la URL y los permisos del script.' }
  }
}

export async function getAiAdvice(transactions: Transaction[]) {
  if (!endpoint) {
    const expenses = transactions.filter(t => t.kind === 'Gasto').reduce((s, t) => s + t.amount, 0)
    const income = transactions.filter(t => t.kind === 'Ingreso').reduce((s, t) => s + t.amount, 0)
    const ratio = income ? Math.round(expenses / income * 100) : 0
    return `Resumen orientativo: tus gastos registrados equivalen al ${ratio}% de tus ingresos registrados. Revisa primero los gastos recurrentes y define una meta de ahorro realista. Esta estimación usa solo los movimientos que aparecen en la aplicación.`
  }
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'advice', transactions }),
    })
    const data = await response.json() as { advice?: string; error?: string }
    if (!response.ok || data.error) throw new Error(data.error || 'No se pudo generar el consejo.')
    return data.advice || 'No se recibió una recomendación.'
  } catch {
    return 'No fue posible consultar la recomendación. Puedes seguir usando el registro y los reportes localmente.'
  }
}