export type Kind = 'Gasto' | 'Ingreso'
export type Transaction = {
  id: string
  title: string
  category: string
  date: string
  amount: number
  kind: Kind
  note?: string
}
export type Budget = { category: string; limit: number }
