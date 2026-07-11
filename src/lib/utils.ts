import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export function getMonthName(month: number, locale: string, short = false): string {
  const date = new Date(2000, month - 1, 1)
  return new Intl.DateTimeFormat(locale, { month: short ? 'short' : 'long' }).format(date)
}

export const MONTHS: Record<number, string> = {
  1: 'Ocak',
  2: 'Şubat',
  3: 'Mart',
  4: 'Nisan',
  5: 'Mayıs',
  6: 'Haziran',
  7: 'Temmuz',
  8: 'Ağustos',
  9: 'Eylül',
  10: 'Ekim',
  11: 'Kasım',
  12: 'Aralık',
}

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Ödendi',
  unpaid: 'Ödenmedi',
  partial: 'Kısmi',
}

export const INCOME_CATEGORIES = [
  'Aidat',
  'Geçen Yıldan Devir',
  'Kasa Ödemesi',
  'Kira Geliri',
  'Bağış',
  'Diğer',
]

export const EXPENSE_CATEGORIES = [
  'Personel Maaşı',
  'SGK',
  'Elektrik',
  'Havuz Bakımı',
  'Kanalizasyon',
  'Vergi',
  'Banka Masrafları',
  'Bahçe / Tarım',
  'Tamirat / Tadilat',
  'Güvenlik',
  'Demir / Metal İşleri',
  'Donanım / Malzeme',
  'Genel Bakım',
  'Diğer',
]

export const INCOME_CATEGORY_KEY: Record<string, string> = {
  'Aidat': 'aidat',
  'Geçen Yıldan Devir': 'deferred',
  'Kasa Ödemesi': 'kasa',
  'Kira Geliri': 'rental',
  'Bağış': 'donation',
  'Diğer': 'other',
}

export const EXPENSE_CATEGORY_KEY: Record<string, string> = {
  'Personel Maaşı': 'salary',
  'SGK': 'sgk',
  'Elektrik': 'electric',
  'Havuz Bakımı': 'pool',
  'Kanalizasyon': 'sewage',
  'Vergi': 'tax',
  'Banka Masrafları': 'bank',
  'Bahçe / Tarım': 'garden',
  'Tamirat / Tadilat': 'paint',
  'Boya / Tadilat': 'paint', // legacy — eski kayıtlar için geriye dönük eşleme
  'Güvenlik': 'security',
  'Demir / Metal İşleri': 'metal',
  'Donanım / Malzeme': 'hardware',
  'Genel Bakım': 'maintenance',
  'Diğer': 'other',
}

export const ANNUAL_WORK_STATUSES: Record<string, string> = {
  planned: 'Planlandı',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
}

// Auto-categorize expense based on description text
export function categorizeExpense(desc: string): string {
  const u = desc.toUpperCase()
  if (/SGK/.test(u)) return 'SGK'
  if (/PERSONEL.*MAA|MAA.*PERSONEL|PERSONEL MAA/.test(u)) return 'Personel Maaşı'
  if (/\bMAA[ŞS]\b/.test(u) && !/MERD[İI]VEN|DEMIR|AVANS.*DEMİR/.test(u)) return 'Personel Maaşı'
  if (/AYDEM|ELEKTRİK|ELEKTRIK|ELEKTR[İI]K/.test(u)) return 'Elektrik'
  if (/HAVUZ|DOLPHIN/.test(u)) return 'Havuz Bakımı'
  if (/FOSEPTIK|FOSEPTİK|VİDANJÖR|VIDANJO|ASKI FOS/.test(u)) return 'Kanalizasyon'
  if (/DAMGA VERG/.test(u)) return 'Vergi'
  if (/BANKA|HESAP İŞLETİM|HESAP ISLETIM|BANKA İŞLEM/.test(u)) return 'Banka Masrafları'
  if (/GÜBRE|GUBRE|TARIM|ZEYTİN|ZEYTIN|ÇİM|CIM\b|SULAMA|İLAÇ\b|ILAÇ\b|BUDAMA|BAHÇE|BAHCE/.test(u)) return 'Bahçe / Tarım'
  if (/BOYA|TİNER|TINER|TAM[İI]RAT|TADİLAT|TADILAT/.test(u)) return 'Tamirat / Tadilat'
  if (/GÜVENLİK|GUVENLIK|KAMERA|PROTECH/.test(u)) return 'Güvenlik'
  if (/DEMİR|DEMIR|FERFORJE|KORKULUK/.test(u)) return 'Demir / Metal İşleri'
  if (/NOTER/.test(u)) return 'Noter'
  if (/HIRDAVAT|KIRTASİYE|KIRTASIYE|KİLİT|KILIT/.test(u)) return 'Donanım / Malzeme'
  return 'Genel Bakım'
}

export function categorizeIncome(desc: string): string {
  const u = desc.toUpperCase()
  if (/AİDAT|AIDAT/.test(u)) return 'Aidat'
  if (/KASA/.test(u)) return 'Kasa Ödemesi'
  if (/DEVİR|DEVIR/.test(u)) return 'Geçen Yıldan Devir'
  return 'Diğer'
}

// Parse Turkish number format: 57.765,84 -> 57765.84
export function parseTurkishNumber(str: string): number | null {
  if (!str || !str.trim()) return null
  const cleaned = str.trim().replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFileTypeInfo(fileType: string | null, fileName: string): { label: string; colorClass: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const type = fileType ?? ''
  if (type.includes('pdf') || ext === 'pdf')
    return { label: 'PDF', colorClass: 'bg-red-100 text-red-700' }
  if (type.includes('spreadsheet') || type.includes('excel') || ['xlsx', 'xls'].includes(ext))
    return { label: 'XLSX', colorClass: 'bg-green-100 text-green-700' }
  if (type.includes('wordprocessing') || type.includes('msword') || ['doc', 'docx'].includes(ext))
    return { label: 'DOC', colorClass: 'bg-blue-100 text-blue-700' }
  if (type.includes('presentation') || type.includes('powerpoint') || ['ppt', 'pptx'].includes(ext))
    return { label: 'PPT', colorClass: 'bg-orange-100 text-orange-700' }
  if (ext === 'csv') return { label: 'CSV', colorClass: 'bg-teal-100 text-teal-700' }
  return { label: ext.toUpperCase() || 'FILE', colorClass: 'bg-gray-100 text-gray-600' }
}

// Parse Turkish date format: 29.09.2025 -> "2025-09-29"
export function parseTurkishDate(str: string): string | null {
  if (!str || !str.trim()) return null
  const parts = str.trim().split('.')
  if (parts.length !== 3) return null
  const day = parts[0].padStart(2, '0')
  const month = parts[1].padStart(2, '0')
  const year = parts[2]
  if (year.length !== 4) return null
  const d = parseInt(day), m = parseInt(month), y = parseInt(year)
  if (d < 1 || d > 31 || m < 1 || m > 12 || y < 2000 || y > 2100) return null
  return `${year}-${month}-${day}`
}
