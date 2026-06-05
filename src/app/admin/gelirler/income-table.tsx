'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { IncomeForm } from '@/components/admin/income-form'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { deleteIncome } from '@/lib/supabase/actions'
import { Income } from '@/types'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

type SortField = 'siraNo' | 'date' | 'title' | 'amount'
type SortDir = 'asc' | 'desc'

const SIRA_RE = /^Defter S[ıi]ra No:\s*(\S+)$/i

function extractSiraNo(description: string | null): { siraNo: string; numeric: number; cleanDesc: string } {
  if (!description) return { siraNo: '', numeric: Infinity, cleanDesc: '' }
  const m = description.match(SIRA_RE)
  if (m) {
    const n = parseInt(m[1], 10)
    return { siraNo: m[1], numeric: isNaN(n) ? Infinity : n, cleanDesc: '' }
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
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'siraNo' ? 'asc' : 'desc')
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
            {!readOnly && <TableHead className="w-20" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((income) => {
            const { siraNo, cleanDesc } = extractSiraNo(income.description)
            return (
              <TableRow key={income.id}>
                <TableCell className="text-sm text-gray-500 font-mono">
                  {siraNo || <span className="text-gray-300">—</span>}
                </TableCell>
                <TableCell className="text-sm text-gray-600 whitespace-nowrap">
                  {formatDate(income.date)}
                </TableCell>
                <TableCell className="font-medium">{income.title}</TableCell>
                <TableCell>
                  {income.category
                    ? <Badge variant="secondary" className="text-xs">{income.category}</Badge>
                    : <span className="text-gray-300">—</span>}
                </TableCell>
                <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                  {cleanDesc || <span className="text-gray-300">—</span>}
                </TableCell>
                <TableCell className="text-right font-semibold text-green-600 whitespace-nowrap">
                  {formatCurrency(Number(income.amount))}
                </TableCell>
                {!readOnly && (
                  <TableCell>
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
  )
}
