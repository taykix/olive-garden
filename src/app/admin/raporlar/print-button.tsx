'use client'
import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md text-gray-600 hover:bg-gray-50"
    >
      <Printer className="h-4 w-4" /> Yazdır
    </button>
  )
}
