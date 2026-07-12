'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate, EXPENSE_CATEGORY_KEY } from '@/lib/utils'
import { ExpenseForm } from '@/components/admin/expense-form'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { deleteExpense } from '@/lib/supabase/actions'
import { Expense, BudgetItem } from '@/types'
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Printer } from 'lucide-react'

type SortField = 'siraNo' | 'date' | 'title' | 'amount'
type SortDir = 'asc' | 'desc'

const SIRA_RE = /Defter S[ıi]ra No:\s*(\S+)/i

function extractSiraNo(description: string | null): { siraNo: string; numeric: number; cleanDesc: string } {
  if (!description) return { siraNo: '', numeric: Infinity, cleanDesc: '' }
  const m = description.match(SIRA_RE)
  if (m) {
    const n = parseInt(m[1], 10)
    const cleanDesc = description
      .replace(m[0], '')
      .replace(/^\s*[·\-]+\s*|\s*[·\-]+\s*$/g, '')
      .trim()
    return { siraNo: m[1], numeric: isNaN(n) ? Infinity : n, cleanDesc }
  }
  return { siraNo: '', numeric: Infinity, cleanDesc: description }
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown className="inline h-3.5 w-3.5 ml-1 text-gray-300" />
  return dir === 'asc'
    ? <ChevronUp className="inline h-3.5 w-3.5 ml-1 text-gray-600" />
    : <ChevronDown className="inline h-3.5 w-3.5 ml-1 text-gray-600" />
}

export function ExpenseTable({ data, budgetItems = [], readOnly = false }: { data: Expense[]; budgetItems?: BudgetItem[]; readOnly?: boolean }) {
  const t = useTranslations('table')
  const tCat = useTranslations('expense_cat')
  const locale = useLocale()
  const [sortField, setSortField] = useState<SortField>('siraNo')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('__all__')
  const [filterBudget, setFilterBudget] = useState<string>('__all__')

  const catLabel = (c: string) => {
    const key = EXPENSE_CATEGORY_KEY[c]
    return key ? tCat(key) : c
  }

  const budgetLabel = (item: BudgetItem) =>
    locale === 'en' && item.category_en ? item.category_en : item.category

  const categories = useMemo(() => {
    const cats = new Set(data.map(e => e.category).filter(Boolean) as string[])
    return [...cats].sort((a, b) => a.localeCompare(b, 'tr'))
  }, [data])

  // Sadece veride gideri olan işletme planı kalemleri (filtre için)
  const budgetOptions = useMemo(() => {
    const ids = new Set(data.map(e => e.budget_item_id).filter(Boolean))
    return budgetItems.filter(b => ids.has(b.id)).sort((a, b) => a.sort_order - b.sort_order)
  }, [data, budgetItems])
  const hasUnlinked = useMemo(() => data.some(e => !e.budget_item_id), [data])

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const { numeric: aN } = extractSiraNo(a.description)
      const { numeric: bN } = extractSiraNo(b.description)
      let cmp = 0
      if (sortField === 'siraNo') cmp = aN - bN
      else if (sortField === 'date') cmp = a.date.localeCompare(b.date)
      else if (sortField === 'title') cmp = a.title.localeCompare(b.title, 'tr')
      else if (sortField === 'amount') cmp = Number(a.amount) - Number(b.amount)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [data, sortField, sortDir])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sorted.filter(expense => {
      if (filterCategory !== '__all__' && expense.category !== filterCategory) return false
      if (filterBudget === '__none__') { if (expense.budget_item_id) return false }
      else if (filterBudget !== '__all__' && expense.budget_item_id !== filterBudget) return false
      if (!q) return true
      const { siraNo, cleanDesc } = extractSiraNo(expense.description)
      return (
        expense.title.toLowerCase().includes(q) ||
        cleanDesc.toLowerCase().includes(q) ||
        siraNo.toLowerCase().includes(q)
      )
    })
  }, [sorted, search, filterCategory, filterBudget])

  // İşletme planına göre gruplanmış rapor (yazdırma için) — S.No küçükten büyüğe
  const report = useMemo(() => {
    const bySira = (a: Expense, b: Expense) =>
      extractSiraNo(a.description).numeric - extractSiraNo(b.description).numeric
    const groups = budgetItems
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(item => {
        const rows = filtered.filter(e => e.budget_item_id === item.id).sort(bySira)
        return { item, rows, total: rows.reduce((s, e) => s + Number(e.amount), 0) }
      })
      .filter(g => g.rows.length > 0)
    const unlinked = filtered.filter(e => !e.budget_item_id).sort(bySira)
    const unlinkedTotal = unlinked.reduce((s, e) => s + Number(e.amount), 0)
    const grand = filtered.reduce((s, e) => s + Number(e.amount), 0)
    return { groups, unlinked, unlinkedTotal, grand }
  }, [filtered, budgetItems])

  const budgetFilterLabel =
    filterBudget === '__all__' ? t('budget_all')
    : filterBudget === '__none__' ? t('unlinked')
    : (() => { const b = budgetOptions.find(x => x.id === filterBudget); return b ? budgetLabel(b) : t('budget_all') })()

  function Th({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) {
    return (
      <TableHead
        className={`cursor-pointer select-none hover:bg-gray-100 transition-colors ${className ?? ''}`}
        onClick={() => handleSort(field)}
      >
        {children}
        <SortIndicator active={sortField === field} dir={sortDir} />
      </TableHead>
    )
  }

  // Rapordaki tek grup tablosu
  function ReportGroup({ heading, rows, total }: { heading: string; rows: Expense[]; total: number }) {
    return (
      <div className="mb-4 break-inside-avoid">
        <div className="flex items-center justify-between bg-gray-100 border border-gray-300 px-2 py-1 font-semibold text-[11px]">
          <span>{heading}</span>
          <span className="font-mono">{formatCurrency(total)}</span>
        </div>
        <table className="w-full text-[10px] border border-t-0 border-gray-300">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500">
              <th className="text-left px-2 py-0.5 w-12">{t('col_sno')}</th>
              <th className="text-left px-2 py-0.5 w-20 whitespace-nowrap">{t('col_date')}</th>
              <th className="text-left px-2 py-0.5">{t('col_title')}</th>
              <th className="text-left px-2 py-0.5 w-32">{t('col_category')}</th>
              <th className="text-right px-2 py-0.5 w-24">{t('col_amount')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(e => {
              const { siraNo } = extractSiraNo(e.description)
              return (
                <tr key={e.id} className="border-b border-gray-100">
                  <td className="px-2 py-0.5 font-mono text-gray-500">{siraNo || '—'}</td>
                  <td className="px-2 py-0.5 whitespace-nowrap text-gray-600">{formatDate(e.date)}</td>
                  <td className="px-2 py-0.5">{e.title}</td>
                  <td className="px-2 py-0.5 text-gray-500">{e.category ? catLabel(e.category) : '—'}</td>
                  <td className="px-2 py-0.5 text-right font-mono text-red-700">{formatCurrency(Number(e.amount))}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300 bg-gray-50 font-semibold">
              <td colSpan={4} className="px-2 py-0.5 text-right">{t('total')}</td>
              <td className="px-2 py-0.5 text-right font-mono text-red-700">{formatCurrency(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  return (
    <div>
      {/* Filtre çubuğu (yazdırmada gizli) */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100 print:hidden">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
          <Input
            placeholder="Başlık, açıklama veya S.No..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={filterCategory} onValueChange={v => setFilterCategory(v ?? '__all__')}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue>
              {filterCategory === '__all__' ? tCat('all') : catLabel(filterCategory)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{tCat('all')}</SelectItem>
            {categories.map(c => (
              <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterBudget} onValueChange={v => setFilterBudget(v ?? '__all__')}>
          <SelectTrigger className="w-56 h-8 text-sm">
            <SelectValue>{budgetFilterLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('budget_all')}</SelectItem>
            {budgetOptions.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.sort_order}. {budgetLabel(b)}</SelectItem>
            ))}
            {hasUnlinked && <SelectItem value="__none__">{t('unlinked')}</SelectItem>}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 h-8">
          <Printer className="h-3.5 w-3.5" /> {t('print')}
        </Button>
        {(search || filterCategory !== '__all__' || filterBudget !== '__all__') && (
          <span className="text-xs text-gray-400">{filtered.length} sonuç</span>
        )}
      </div>

      {/* Ekran tablosu (yazdırmada gizli) */}
      <div className="overflow-x-auto print:hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <Th field="siraNo" className="w-20">{t('col_sno')}</Th>
              <Th field="date">{t('col_date')}</Th>
              <Th field="title" className="max-w-[200px]">{t('col_title')}</Th>
              <TableHead>{t('col_category')}</TableHead>
              <Th field="amount" className="text-right">{t('col_amount')}</Th>
              <TableHead>{t('col_budget_item')}</TableHead>
              {!readOnly && <TableHead className="w-20 sticky right-0 bg-white" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((expense) => {
              const { siraNo } = extractSiraNo(expense.description)
              const linkedItem = expense.budget_item_id
                ? budgetItems.find(b => b.id === expense.budget_item_id)
                : null
              return (
                <TableRow key={expense.id}>
                  <TableCell className="text-sm text-gray-500 font-mono">
                    {siraNo || <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                    {formatDate(expense.date)}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px]">
                    <span className="block truncate" title={expense.title}>{expense.title}</span>
                  </TableCell>
                  <TableCell>
                    {expense.category
                      ? <Badge variant="secondary" className="text-xs">{catLabel(expense.category)}</Badge>
                      : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-600 whitespace-nowrap">
                    {formatCurrency(Number(expense.amount))}
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    {linkedItem ? (
                      <span className="text-xs text-blue-700 font-medium leading-tight block truncate" title={budgetLabel(linkedItem)}>
                        <span className="text-gray-400 mr-1">{linkedItem.sort_order}.</span>
                        {budgetLabel(linkedItem)}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="sticky right-0 bg-white">
                      <div className="flex items-center gap-1 justify-end">
                        <ExpenseForm expense={expense} budgetItems={budgetItems} />
                        <DeleteConfirmDialog onConfirm={deleteExpense.bind(null, expense.id)} />
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Yazdırma raporu — işletme planına göre gruplu (yalnızca yazdırmada) */}
      <div className="hidden print:block px-2 py-1">
        <style>{'@media print{@page{size:A4 portrait;margin:9mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'}</style>
        <h2 className="text-sm font-bold text-gray-900 mb-2">{t('report_title')}</h2>
        {report.groups.map(g => (
          <ReportGroup key={g.item.id} heading={`${g.item.sort_order}. ${budgetLabel(g.item)}`} rows={g.rows} total={g.total} />
        ))}
        {report.unlinked.length > 0 && (
          <ReportGroup heading={t('unlinked')} rows={report.unlinked} total={report.unlinkedTotal} />
        )}
        <div className="flex items-center justify-between border-t-2 border-gray-400 mt-1 px-2 py-1 font-bold text-xs">
          <span>{t('grand_total')}</span>
          <span className="font-mono text-red-700">{formatCurrency(report.grand)}</span>
        </div>
      </div>
    </div>
  )
}
