'use client'

import { useState, useMemo } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ExpenseForm } from '@/components/admin/expense-form'
import { DeleteConfirmDialog } from '@/components/shared/delete-confirm-dialog'
import { deleteExpense } from '@/lib/supabase/actions'
import { Expense, BudgetItem } from '@/types'
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink } from 'lucide-react'

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

export function ExpenseTable({ data, budgetItems = [] }: { data: Expense[]; budgetItems?: BudgetItem[] }) {
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
            <Th field="siraNo" className="w-20">S.No</Th>
            <Th field="date">Tarih</Th>
            <Th field="title">Başlık</Th>
            <TableHead>Kategori</TableHead>
            <TableHead>Açıklama</TableHead>
            <Th field="amount" className="text-right">Tutar</Th>
            <TableHead>Belge</TableHead>
            <TableHead>İşletme Planı</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((expense) => {
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
                    ? <Badge variant="secondary" className="text-xs">{expense.category}</Badge>
                    : <span className="text-gray-300">—</span>}
                </TableCell>
                <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                  {cleanDesc || <span className="text-gray-300">—</span>}
                </TableCell>
                <TableCell className="text-right font-semibold text-red-600 whitespace-nowrap">
                  {formatCurrency(Number(expense.amount))}
                </TableCell>
                <TableCell>
                  {expense.document_url ? (
                    <a href={expense.document_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1 text-xs">
                      <ExternalLink className="h-3 w-3" /> Görüntüle
                    </a>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </TableCell>
                <TableCell className="max-w-[180px]">
                  {linkedItem ? (
                    <span className="text-xs text-blue-700 font-medium leading-tight block truncate" title={linkedItem.category}>
                      <span className="text-gray-400 mr-1">{linkedItem.sort_order}.</span>
                      {linkedItem.category}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <ExpenseForm expense={expense} budgetItems={budgetItems} />
                    <DeleteConfirmDialog onConfirm={deleteExpense.bind(null, expense.id)} />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
