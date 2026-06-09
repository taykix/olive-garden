'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { useLocale } from 'next-intl'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate, EXPENSE_CATEGORY_KEY } from '@/lib/utils'
import { ExpenseForm } from '@/components/admin/expense-form'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { deleteExpense } from '@/lib/supabase/actions'
import { Expense, BudgetItem } from '@/types'
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink, Search } from 'lucide-react'

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
      if (!q) return true
      const { siraNo, cleanDesc } = extractSiraNo(expense.description)
      return (
        expense.title.toLowerCase().includes(q) ||
        cleanDesc.toLowerCase().includes(q) ||
        siraNo.toLowerCase().includes(q)
      )
    })
  }, [sorted, search, filterCategory])

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

  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <div className="relative flex-1 max-w-xs">
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
        {(search || filterCategory !== '__all__') && (
          <span className="text-xs text-gray-400">{filtered.length} sonuç</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <Th field="siraNo" className="w-20">{t('col_sno')}</Th>
              <Th field="date">{t('col_date')}</Th>
              <Th field="title">{t('col_title')}</Th>
              <TableHead>{t('col_category')}</TableHead>
              <TableHead>{t('col_description')}</TableHead>
              <Th field="amount" className="text-right">{t('col_amount')}</Th>
              <TableHead>{t('col_document')}</TableHead>
              <TableHead>{t('col_budget_item')}</TableHead>
              {!readOnly && <TableHead className="w-20 sticky right-0 bg-white" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((expense) => {
              const { siraNo, cleanDesc } = extractSiraNo(expense.description)
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
                  <TableCell className="font-medium">{expense.title}</TableCell>
                  <TableCell>
                    {expense.category
                      ? <Badge variant="secondary" className="text-xs">{catLabel(expense.category)}</Badge>
                      : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 w-24">
                    {cleanDesc
                      ? <span
                          className="block truncate cursor-default"
                          title={cleanDesc}
                        >
                          {cleanDesc.includes(' ')
                            ? `${cleanDesc.split(' ')[0]}…`
                            : cleanDesc.slice(0, 10) + (cleanDesc.length > 10 ? '…' : '')}
                        </span>
                      : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-600 whitespace-nowrap">
                    {formatCurrency(Number(expense.amount))}
                  </TableCell>
                  <TableCell>
                    {expense.document_url ? (
                      <a href={expense.document_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1 text-xs">
                        <ExternalLink className="h-3 w-3" /> {t('view')}
                      </a>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
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
    </div>
  )
}
