// Supabase (PostgREST) bir sorguda varsayılan olarak en fazla 1000 satır döndürür ve fazlasını
// SESSİZCE keser. Gelir/gider/ödeme listeleri bu sınırı aşınca toplamlar eksik çıkar
// (ör. daire no'ya göre sıralı ödemelerde sondaki F blok kaybolur). Bu yardımcı tüm sayfaları çeker.
//
// Kullanım: fetchAll((from, to) => supabase.from('income').select('*').order('date').order('id').range(from, to))
// Not: sayfalar arası tutarlılık için sorguda benzersiz bir sıralama (ör. .order('id')) bulunmalı.

const PAGE = 1000

export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) return { data: out, error }
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE) return { data: out, error: null }
  }
}
