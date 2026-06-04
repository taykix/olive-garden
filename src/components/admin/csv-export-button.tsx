'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

interface CSVExportButtonProps {
  data: Record<string, string | number | boolean | null>[]
  filename: string
  label?: string
}

function toCSV(data: Record<string, string | number | boolean | null>[]): string {
  if (data.length === 0) return ''
  const headers = Object.keys(data[0])
  const rows = data.map((row) =>
    headers.map((h) => {
      const val = row[h]
      if (val === null || val === undefined) return ''
      const str = String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )
  return [headers.join(','), ...rows].join('\n')
}

export function CSVExportButton({ data, filename, label = 'CSV İndir' }: CSVExportButtonProps) {
  function handleExport() {
    const csv = toCSV(data)
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} className="gap-1" disabled={data.length === 0}>
      <Download className="h-4 w-4" />
      {label}
    </Button>
  )
}
