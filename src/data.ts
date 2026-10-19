import type { Budget, Transaction } from './types'

const now = new Date()
const isoDay = (day: number) => {
  const d = new Date(now.getFullYear(), now.getMonth(), day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const initialTransactions: Transaction[] = [
  { id: 't1', title: 'Mercado semanal', category: 'Alimentación', date: isoDay(2), amount: 148000, kind: 'Gasto', note: 'Compra de la semana' },
  { id: 't2', title: 'Pago de nómina', category: 'Salario', date: isoDay(3), amount: 2800000, kind: 'Ingreso' },
  { id: 't3', title: 'Transporte', category: 'Transporte', date: isoDay(5), amount: 56000, kind: 'Gasto' },
  { id: 't4', title: 'Servicio de internet', category: 'Servicios', date: isoDay(7), amount: 89000, kind: 'Gasto' },
  { id: 't5', title: 'Almuerzo con amigos', category: 'Restaurantes', date: isoDay(9), amount: 72000, kind: 'Gasto' },
  { id: 't6', title: 'Venta de un artículo', category: 'Otros ingresos', date: isoDay(11), amount: 125000, kind: 'Ingreso' },
  { id: 't7', title: 'Suscripción de música', category: 'Entretenimiento', date: isoDay(13), amount: 16900, kind: 'Gasto' },
  { id: 't8', title: 'Ahorro mensual', category: 'Ahorro', date: isoDay(15), amount: 250000, kind: 'Gasto' },
  { id: 't9', title: 'Farmacia', category: 'Salud', date: isoDay(16), amount: 38500, kind: 'Gasto' },
]
export const initialBudgets: Budget[] = [
  { category: 'Alimentación', limit: 450000 },
  { category: 'Transporte', limit: 180000 },
  { category: 'Servicios', limit: 300000 },
  { category: 'Restaurantes', limit: 180000 },
  { category: 'Entretenimiento', limit: 100000 },
]
export const categories = ['Alimentación', 'Transporte', 'Servicios', 'Restaurantes', 'Entretenimiento', 'Salud', 'Educación', 'Ahorro', 'Salario', 'Otros ingresos', 'Otros']
