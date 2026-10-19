import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, CalendarDays, Check,
  CircleHelp, CreditCard, Download, FileSpreadsheet, LayoutDashboard, Lightbulb,
  Menu, Plus, Search, Settings2, Sparkles, Target, Trash2, Wallet, X,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { categories, initialBudgets, initialTransactions } from './data'
import { getAiAdvice, syncToGoogleSheets } from './integrations'
import type { Budget, Kind, Transaction } from './types'

type View = 'Resumen' | 'Movimientos' | 'Presupuestos' | 'Reportes'
const money = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const today = () => dateKey(new Date())
const monthLabel = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(new Date())
const palette = ['#7467f0', '#29b6a6', '#f2a65a', '#ec6d8c', '#6b9be8', '#9b8afb', '#7d8b9c']

function readStorage<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}

export default function App() {
  const [view, setView] = useState<View>('Resumen')
  const [transactions, setTransactions] = useState<Transaction[]>(() => readStorage('finansmart-transactions', initialTransactions))
  const [budgets, setBudgets] = useState<Budget[]>(() => readStorage('finansmart-budgets', initialBudgets))
  const [query, setQuery] = useState('')
  const [kindFilter, setKindFilter] = useState('Todos')
  const [showForm, setShowForm] = useState(false)
  const [showBudgetForm, setShowBudgetForm] = useState(false)
  const [notice, setNotice] = useState('')
  const [advice, setAdvice] = useState('')
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [form, setForm] = useState({ title: '', amount: '', category: 'Alimentación', date: today(), kind: 'Gasto' as Kind, note: '' })
  const [budgetForm, setBudgetForm] = useState({ category: 'Alimentación', limit: '' })

  useEffect(() => { localStorage.setItem('finansmart-transactions', JSON.stringify(transactions)) }, [transactions])
  useEffect(() => { localStorage.setItem('finansmart-budgets', JSON.stringify(budgets)) }, [budgets])

  const income = useMemo(() => transactions.filter(t => t.kind === 'Ingreso').reduce((s, t) => s + t.amount, 0), [transactions])
  const expenses = useMemo(() => transactions.filter(t => t.kind === 'Gasto').reduce((s, t) => s + t.amount, 0), [transactions])
  const balance = income - expenses
  const visibleTransactions = useMemo(() => transactions.filter(t =>
    (t.title.toLowerCase().includes(query.toLowerCase()) || t.category.toLowerCase().includes(query.toLowerCase())) &&
    (kindFilter === 'Todos' || t.kind === kindFilter)
  ).sort((a, b) => b.date.localeCompare(a.date)), [transactions, query, kindFilter])
  const expenseByCategory = useMemo(() => categories.map(category => ({
    name: category,
    value: transactions.filter(t => t.kind === 'Gasto' && t.category === category).reduce((s, t) => s + t.amount, 0),
  })).filter(c => c.value > 0).sort((a, b) => b.value - a.value), [transactions])
  const chartData = useMemo(() => {
    const days = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (5 - i))
      const key = dateKey(d)
      return { day: new Intl.DateTimeFormat('es-CO', { weekday: 'short' }).format(d), ingresos: 0, gastos: 0, key }
    })
    transactions.forEach(t => {
      const found = days.find(d => d.key === t.date)
      if (found) { if (t.kind === 'Ingreso') found.ingresos += t.amount; else found.gastos += t.amount }
    })
    return days
  }, [transactions])
  const budgetRows = budgets.map(b => {
    const currentMonth = dateKey(new Date()).slice(0, 7)
    const spent = transactions.filter(t => t.kind === 'Gasto' && t.category === b.category && t.date.slice(0, 7) === currentMonth).reduce((s, t) => s + t.amount, 0)
    return { ...b, spent, pct: b.limit ? Math.min(100, spent / b.limit * 100) : 0, over: spent > b.limit }
  })

  function addTransaction(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!form.title.trim() || !Number.isFinite(amount) || amount <= 0) { setNotice('Escribe una descripción y un monto mayor que cero.'); return }
    setTransactions(prev => [{ ...form, id: crypto.randomUUID(), title: form.title.trim(), amount }, ...prev])
    setForm({ title: '', amount: '', category: 'Alimentación', date: today(), kind: 'Gasto', note: '' })
    setShowForm(false); setNotice('Movimiento guardado correctamente.')
  }
  function addBudget(e: React.FormEvent) {
    e.preventDefault()
    const limit = Number(budgetForm.limit)
    if (!Number.isFinite(limit) || limit <= 0) { setNotice('El presupuesto debe ser mayor que cero.'); return }
    setBudgets(prev => [...prev.filter(b => b.category !== budgetForm.category), { category: budgetForm.category, limit }])
    setShowBudgetForm(false); setNotice('Presupuesto actualizado.')
  }
  function exportCsv() {
    const rows = [['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Monto', 'Nota'], ...visibleTransactions.map(t => [t.date, t.kind, t.title, t.category, String(t.amount), t.note || ''])]
    const csv = rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'finansmart-movimientos.csv'; a.click(); URL.revokeObjectURL(url)
    setNotice('Archivo CSV exportado.')
  }
  async function sync() { const r = await syncToGoogleSheets(transactions, budgets); setNotice(r.message) }
  async function askAi() { setAdviceLoading(true); setAdvice(''); const result = await getAiAdvice(transactions); setAdvice(result); setAdviceLoading(false) }

  const navItems: { label: View; icon: typeof LayoutDashboard }[] = [
    { label: 'Resumen', icon: LayoutDashboard }, { label: 'Movimientos', icon: Activity },
    { label: 'Presupuestos', icon: Target }, { label: 'Reportes', icon: FileSpreadsheet },
  ]

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Wallet size={22} /></div><div><b>FinanSmart</b><small>FINANZAS PERSONALES</small></div><button className="icon-button close-nav" onClick={() => setMobileNav(false)} aria-label="Cerrar menú"><X size={18}/></button></div>
      <div className="workspace-label">MENÚ PRINCIPAL</div>
      <nav>{navItems.map(item => <button key={item.label} className={`nav-item ${view === item.label ? 'active' : ''}`} onClick={() => { setView(item.label); setMobileNav(false) }}><item.icon size={19}/><span>{item.label}</span>{view === item.label && <span className="nav-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="help-card"><div className="help-icon"><Lightbulb size={18}/></div><b>Pequeños hábitos,<br/>grandes metas.</b><p>Un paso a la vez hacia tu tranquilidad financiera.</p></div>
        <button className="nav-item" onClick={sync}><FileSpreadsheet size={19}/><span>Sincronizar con Sheets</span></button>
        <button className="nav-item" onClick={() => setNotice('FinanSmart es una herramienta educativa. Verifica tus datos antes de tomar decisiones financieras.')}><CircleHelp size={19}/><span>Ayuda y consejos</span></button>
        <div className="profile"><div className="avatar">FS</div><div className="profile-text"><b>Mi espacio</b><small>Cuenta personal</small></div><Settings2 size={17} className="profile-settings"/></div>
      </div>
    </aside>
    {mobileNav && <button className="nav-backdrop" aria-label="Cerrar menú" onClick={() => setMobileNav(false)}/>}
    <main className="main-content">
      <header className="topbar"><div className="top-left"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menú"><Menu size={20}/></button><div><div className="eyebrow">TU CENTRO FINANCIERO</div><h1>{view === 'Resumen' ? 'Resumen general' : view}</h1></div></div><div className="top-actions"><span className="date-chip"><CalendarDays size={16}/>{monthLabel}</span><button className="icon-button notification" aria-label="Notificaciones" onClick={() => setNotice('No tienes notificaciones pendientes.')}><Bell size={19}/><i/></button><div className="avatar avatar-small">FS</div></div></header>
      {notice && <div className="toast" role="status"><Check size={17}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={16}/></button></div>}
      {view === 'Resumen' && <><section className="welcome-row"><div><h2>¡Hola! Qué bueno verte 👋</h2><p>Este es el estado de tus finanzas registradas.</p></div><button className="primary-button" onClick={() => setShowForm(true)}><Plus size={18}/> Nuevo movimiento</button></section>
        <section className="metric-grid">
          <Metric title="Balance disponible" amount={balance} icon={<Wallet size={19}/>} tone="purple" subtitle="Ingresos menos gastos" />
          <Metric title="Ingresos registrados" amount={income} icon={<ArrowDownLeft size={20}/>} tone="green" subtitle="Total de movimientos" />
          <Metric title="Gastos registrados" amount={expenses} icon={<ArrowUpRight size={20}/>} tone="orange" subtitle="Total de movimientos" />
          <Metric title="Tasa de gasto" amount={income ? Math.round(expenses / income * 100) : 0} percent icon={<CreditCard size={19}/>} tone="blue" subtitle="De los ingresos registrados" />
        </section>
        <section className="dashboard-grid"><div className="panel chart-panel"><div className="panel-heading"><div><h3>Actividad reciente</h3><p>Ingresos y gastos de los últimos 6 días</p></div><span className="mini-badge"><span/> Actualizado</span></div><div className="chart-legend"><span><i className="legend-income"/> Ingresos</span><span><i className="legend-expense"/> Gastos</span></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 5, left: -16, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#29b6a6" stopOpacity={0.2}/><stop offset="100%" stopColor="#29b6a6" stopOpacity={0}/></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7467f0" stopOpacity={0.18}/><stop offset="100%" stopColor="#7467f0" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5"/><XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#8992a5', fontSize: 12 }}/><YAxis tickLine={false} axisLine={false} tick={{ fill: '#8992a5', fontSize: 11 }} tickFormatter={v => v >= 1000000 ? `${v / 1000000}M` : `${v / 1000}k`}/><Tooltip formatter={(v) => money(Number(v))}/><Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#29b6a6" strokeWidth={2.5} fill="url(#incomeFill)"/><Area type="monotone" dataKey="gastos" name="Gastos" stroke="#7467f0" strokeWidth={2.5} fill="url(#expenseFill)"/></AreaChart></ResponsiveContainer></div></div>
          <div className="panel category-panel"><div className="panel-heading"><div><h3>En qué gastas</h3><p>Distribución por categoría</p></div><button className="text-button" onClick={() => setView('Reportes')}>Ver reporte</button></div>{expenseByCategory.length ? <><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseByCategory} dataKey="value" nameKey="name" innerRadius={57} outerRadius={78} paddingAngle={3} stroke="none">{expenseByCategory.map((e, i) => <Cell key={e.name} fill={palette[i % palette.length]}/>)}</Pie><Tooltip formatter={v => money(Number(v))}/></PieChart></ResponsiveContainer><div className="donut-center"><b>{money(expenses)}</b><small>Total gastado</small></div></div><div className="category-legend">{expenseByCategory.slice(0, 4).map((e, i) => <div key={e.name}><span><i style={{ background: palette[i % palette.length] }}/>{e.name}</span><b>{money(e.value)}</b></div>)}</div></> : <Empty text="Agrega gastos para ver tus categorías."/>}</div></section>
        <section className="panel transactions-panel"><div className="panel-heading"><div><h3>Últimos movimientos</h3><p>Consulta rápida de tu actividad</p></div><button className="text-button" onClick={() => setView('Movimientos')}>Ver todos <ArrowUpRight size={15}/></button></div><TransactionTable transactions={[...transactions].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5)} onDelete={id => setTransactions(prev => prev.filter(t => t.id !== id) )}/></section>
      </>}
      {view === 'Movimientos' && <section className="panel page-panel"><div className="panel-heading"><div><h3>Todos los movimientos</h3><p>Administra tus ingresos y gastos registrados.</p></div><button className="primary-button" onClick={() => setShowForm(true)}><Plus size={18}/> Añadir</button></div><div className="table-tools"><div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por descripción o categoría..."/></div><select value={kindFilter} onChange={e => setKindFilter(e.target.value)}><option>Todos</option><option>Ingreso</option><option>Gasto</option></select><button className="secondary-button" onClick={exportCsv}><Download size={16}/> Exportar CSV</button></div><TransactionTable transactions={visibleTransactions} onDelete={id => setTransactions(prev => prev.filter(t => t.id !== id))}/></section>}
      {view === 'Presupuestos' && <section className="panel page-panel"><div className="panel-heading"><div><h3>Presupuestos por categoría</h3><p>Define límites y revisa tu consumo registrado.</p></div><button className="primary-button" onClick={() => setShowBudgetForm(true)}><Plus size={18}/> Nuevo presupuesto</button></div><div className="budget-grid">{budgetRows.map((b, i) => <div className="budget-card" key={b.category}><div className="budget-top"><div className="budget-icon" style={{ color: palette[i % palette.length], background: `${palette[i % palette.length]}18`}}><Target size={19}/></div><button className="icon-button" onClick={() => setBudgets(prev => prev.filter(x => x.category !== b.category))} title="Eliminar presupuesto"><Trash2 size={16}/></button></div><h4>{b.category}</h4><div className="budget-amount">{money(b.spent)} <small>/ {money(b.limit)}</small></div><div className="progress"><span className={b.over ? 'over' : ''} style={{ width: `${b.pct}%`, background: b.over ? '#e76d79' : palette[i % palette.length] }}/></div><div className="budget-foot"><span>{Math.round(b.spent / b.limit * 100)}% utilizado</span><span className={b.over ? 'over-text' : ''}>{b.over ? `Excedido ${money(b.spent - b.limit)}` : `Restan ${money(b.limit - b.spent)}`}</span></div></div>)}</div>{!budgetRows.length && <Empty text="Todavía no tienes presupuestos. Crea uno para comenzar."/>}</section>}
      {view === 'Reportes' && <div className="report-grid"><section className="panel report-panel"><div className="panel-heading"><div><h3>Resumen de gastos</h3><p>Distribución de los movimientos guardados</p></div></div>{expenseByCategory.length ? <div className="report-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseByCategory} dataKey="value" nameKey="name" outerRadius={110} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}>{expenseByCategory.map((e,i) => <Cell key={e.name} fill={palette[i % palette.length]}/>)}</Pie><Tooltip formatter={v => money(Number(v))}/></PieChart></ResponsiveContainer></div> : <Empty text="No hay gastos para analizar."/>}</section><section className="panel report-panel"><div className="panel-heading"><div><h3>Resumen numérico</h3><p>Según los datos registrados</p></div></div><div className="report-stats"><div><span>Ingresos</span><b className="positive">{money(income)}</b></div><div><span>Gastos</span><b className="negative">{money(expenses)}</b></div><div><span>Balance</span><b>{money(balance)}</b></div><div><span>Movimientos</span><b>{transactions.length}</b></div><div><span>Promedio por gasto</span><b>{money(transactions.filter(t => t.kind === 'Gasto').length ? expenses / transactions.filter(t => t.kind === 'Gasto').length : 0)}</b></div></div><button className="secondary-button full-button" onClick={exportCsv}><Download size={16}/> Descargar datos CSV</button></section><section className="panel advice-panel"><div className="ai-icon"><Sparkles size={21}/></div><div className="advice-content"><h3>Consejo financiero inteligente</h3><p>Obtén una orientación basada en los movimientos que has registrado.</p>{advice && <div className="advice-result">{advice}</div>}<button className="primary-button" onClick={askAi} disabled={adviceLoading}><Sparkles size={17}/>{adviceLoading ? 'Preparando consejo...' : 'Generar recomendación'}</button><small>Orientación educativa; no sustituye asesoría financiera profesional.</small></div></section></div>}
    </main>
    {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="transaction-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><h2 id="transaction-title">Nuevo movimiento</h2><p>Registra un ingreso o un gasto.</p></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Cerrar"><X size={20}/></button></div><form onSubmit={addTransaction} className="form-stack"><label>Tipo de movimiento<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as Kind, category: e.target.value === 'Ingreso' ? 'Salario' : 'Alimentación' })}><option>Gasto</option><option>Ingreso</option></select></label><label>Descripción<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ej. Compra del mercado"/></label><div className="form-row"><label>Monto (COP)<input required type="number" min="1" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="50000"/></label><label>Fecha<input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}/></label></div><label>Categoría<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.filter(c => form.kind === 'Ingreso' ? ['Salario', 'Otros ingresos', 'Otros'].includes(c) : !['Salario', 'Otros ingresos'].includes(c)).map(c => <option key={c}>{c}</option>)}</select></label><label>Nota (opcional)<textarea rows={2} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Añade un detalle si lo necesitas"/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancelar</button><button type="submit" className="primary-button"><Check size={17}/> Guardar movimiento</button></div></form></section></div>}
    {showBudgetForm && <div className="modal-backdrop" onClick={() => setShowBudgetForm(false)}><section className="modal modal-small" role="dialog" aria-modal="true" aria-labelledby="budget-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><h2 id="budget-title">Nuevo presupuesto</h2><p>Define un límite para una categoría.</p></div><button className="icon-button" onClick={() => setShowBudgetForm(false)} aria-label="Cerrar"><X size={20}/></button></div><form className="form-stack" onSubmit={addBudget}><label>Categoría<select value={budgetForm.category} onChange={e => setBudgetForm({ ...budgetForm, category: e.target.value })}>{categories.filter(c => !['Salario', 'Otros ingresos'].includes(c)).map(c => <option key={c}>{c}</option>)}</select></label><label>Límite mensual (COP)<input required type="number" min="1" value={budgetForm.limit} onChange={e => setBudgetForm({ ...budgetForm, limit: e.target.value })} placeholder="300000"/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowBudgetForm(false)}>Cancelar</button><button className="primary-button" type="submit"><Check size={17}/> Guardar</button></div></form></section></div>}
    <footer className="app-footer"><span>© {new Date().getFullYear()} FinanSmart</span><span>Construido para tomar decisiones con más claridad.</span></footer>
  </div>
}

function Metric({ title, amount, icon, tone, subtitle, percent = false }: { title: string; amount: number; icon: React.ReactNode; tone: string; subtitle: string; percent?: boolean }) {
  return <div className="metric-card"><div className="metric-top"><span>{title}</span><span className={`metric-icon ${tone}`}>{icon}</span></div><div className="metric-value">{percent ? `${amount}%` : money(amount)}</div><div className="metric-subtitle">{subtitle}</div><div className="metric-bottom"><span className={`metric-trend ${tone}`}><Activity size={13}/> {percent ? (amount <= 70 ? 'En rango orientativo' : 'Revisa tus gastos') : 'Datos registrados'}</span></div></div>
}
function TransactionTable({ transactions, onDelete }: { transactions: Transaction[]; onDelete: (id: string) => void }) {
  if (!transactions.length) return <Empty text="No hay movimientos que coincidan con tu búsqueda."/>
  return <div className="table-scroll"><table><thead><tr><th>Movimiento</th><th>Categoría</th><th>Fecha</th><th>Monto</th><th aria-label="Acciones"/></tr></thead><tbody>{transactions.map(t => <tr key={t.id}><td><div className="transaction-name"><span className={`transaction-symbol ${t.kind === 'Ingreso' ? 'symbol-income' : 'symbol-expense'}`}>{t.kind === 'Ingreso' ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}</span><span><b>{t.title}</b><small>{t.note || t.kind}</small></span></div></td><td><span className="category-pill">{t.category}</span></td><td className="date-cell">{t.date}</td><td className={`amount-cell ${t.kind === 'Ingreso' ? 'positive' : 'negative'}`}>{t.kind === 'Ingreso' ? '+' : '−'}{money(t.amount)}</td><td><button className="icon-button delete-button" title="Eliminar movimiento" aria-label={`Eliminar ${t.title}`} onClick={() => onDelete(t.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>
}
function Empty({ text }: { text: string }) { return <div className="empty-state"><div><Search size={20}/></div><p>{text}</p></div> }
