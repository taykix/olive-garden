'use client'

import { useState, useRef, useEffect } from 'react'

interface ApartmentComboboxProps {
  apartments: string[]
  value: string
  onChange: (val: string) => void
  required?: boolean
}

export function ApartmentCombobox({ apartments, value, onChange, required }: ApartmentComboboxProps) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState(value)
  const containerRef          = useRef<HTMLDivElement>(null)

  const filtered = query
    ? apartments.filter(a => a.toLowerCase().includes(query.toLowerCase()))
    : apartments

  // Dışarı tıklanınca kapat
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // Geçersiz değer girilmişse temizle
        if (!apartments.includes(query)) { setQuery(''); onChange('') }
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [apartments, query, onChange])

  function handleSelect(apt: string) {
    setQuery(apt)
    onChange(apt)
    setOpen(false)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.toUpperCase()
    setQuery(v)
    onChange('')       // seçim temizle, listeden seçilmesini zorla
    setOpen(true)
  }

  const isValid = apartments.includes(query)

  return (
    <div ref={containerRef} className="relative">
      {/* Gerçek form değeri */}
      <input type="hidden" name="apartment_no" value={isValid ? query : ''} />

      <input
        type="text"
        autoComplete="off"
        placeholder="örn: A-5"
        required={required}
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        className="w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-colors uppercase"
      />

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-52 overflow-y-auto text-sm">
          {filtered.map(apt => (
            <li
              key={apt}
              onMouseDown={() => handleSelect(apt)}
              className={`px-3 py-2 cursor-pointer hover:bg-green-50 hover:text-green-800 ${apt === query ? 'bg-green-50 text-green-800 font-medium' : 'text-gray-700'}`}
            >
              {apt}
            </li>
          ))}
        </ul>
      )}

      {query && !isValid && (
        <p className="text-xs text-red-500 mt-1">Lütfen listeden bir daire seçin.</p>
      )}
    </div>
  )
}
