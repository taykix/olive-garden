'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatCurrency, formatDate, INCOME_CATEGORY_KEY } from '@/lib/utils'
import { IncomeForm } from '@/components/admin/income-form'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { deleteIncome } from '@/lib/supabase/actions'
import { Income } from '@/types'
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react'

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

export function IncomeTable({ data, readOnly = false }: { data: Income[]; readOnly?: boolean }) {
  const t = useTranslations('table')
  const tCat = useTranslations('income_cat')
  const [sortField, setSortField] = useState<SortField>('siraNo')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('__all__')

  const catLabel = (c: string) => {
    const key = INCOME_CATEGORY_KEY[c]
    return key ? tCat(key) : c
  }

  const categories = useMemo(() => {
    const cats = new Set(data.map(i => i.category).filter(Boolean) as string[])
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
    return sorted.filter(income => {
      if (filterCategory !== '__all__' && income.category !== filterCategory) return false
      if (!q) return true
      const { siraNo, cleanDesc } = extractSiraNo(income.description)
      return (
        income.title.toLowerCase().includes(q) ||
        cleanDesc.toLowerCase().includes(q) ||
        siraNo.toLowerCase().includes(q)
      )
    })
  }, [sorted, search, filterCategory])

  function Th({ field, children, className, labelClassName }: { field: SortField; children: React.ReactNode; className?: string; labelClassName?: string }) {
    const label = typeof children === 'string' ? children : undefined
    return (
      <TableHead
        className={`cursor-pointer select-none hover:bg-gray-100 transition-colors ${className ?? ''}`}
        onClick={() => handleSort(field)}
        title={label}
      >
        <span className={`truncate inline-block align-middle ${labelClassName ?? 'max-w-[90px]'}`}>{children}</span>
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
              <Th field="siraNo" className="w-20" labelClassName="max-w-[64px]">{t('col_sno')}</Th>
              <Th field="date" labelClassName="max-w-[80px]">{t('col_date')}</Th>
              <Th field="title" className="max-w-[160px]" labelClassName="max-w-[140px]">{t('col_title')}</Th>
              <TableHead className="max-w-[120px]" title={t('col_category')}>
                <span className="truncate inline-block max-w-[100px] align-middle">{t('col_category')}</span>
              </TableHead>
              <TableHead className="max-w-[200px]" title={t('col_description')}>
                <span className="truncate inline-block max-w-[180px] align-middle">{t('col_description')}</span>
              </TableHead>
              <Th field="amount" className="text-right w-28" labelClassName="max-w-[100px]">{t('col_amount')}</Th>
              {!readOnly && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((income) => {
              const { siraNo, cleanDesc } = extractSiraNo(income.description)
              return (
                <TableRow key={income.id}>
                  <TableCell className="text-sm text-gray-500 font-mono">
                    {siraNo || <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                    {formatDate(income.date)}
                  </TableCell>
                  <TableCell className="font-medium max-w-[160px]" title={income.title}>
                    <span className="block truncate">{income.title}</span>
                  </TableCell>
                  <TableCell className="max-w-[120px]">
                    {income.category
                      ? <Badge variant="secondary" className="text-xs truncate max-w-full block" title={catLabel(income.category)}>{catLabel(income.category)}</Badge>
                      : <span className="text-gray-300">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500 max-w-[200px]" title={cleanDesc || undefined}>
                    <span className="block truncate">{cleanDesc || <span className="text-gray-300">—</span>}</span>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-green-600 whitespace-nowrap w-28 shrink-0">
                    {formatCurrency(Number(income.amount))}
                  </TableCell>
                  {!readOnly && (
                    <TableCell className="w-20 shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <IncomeForm income={income} />
                        <DeleteConfirmDialog onConfirm={deleteIncome.bind(null, income.id)} />
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
