'use client'

import { useActionState, useState } from 'react'
import { useTranslations } from 'next-intl'
import { changePassword, signOut } from '@/lib/supabase/actions'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronDown, Home, KeyRound, LogOut, Mail, User } from 'lucide-react'

interface ProfileDropdownProps {
  userName: string | null
  userEmail: string | null
  apartmentNo: string | null
  role: 'admin' | 'resident'
}

const initialState = { error: undefined as string | undefined, success: undefined as boolean | undefined }

export function ProfileDropdown({ userName, userEmail, apartmentNo, role }: ProfileDropdownProps) {
  const t = useTranslations('profile')
  const [pwOpen, setPwOpen] = useState(false)
  const [state, action, pending] = useActionState(changePassword, initialState)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors rounded-lg px-2 py-1 hover:bg-gray-100 outline-none">
          <span className="max-w-[140px] truncate">{userName || t('my_account')}</span>
          <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-64 p-0">
          <div className="px-4 py-3 space-y-2">
            {userName && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="font-medium text-gray-900 truncate">{userName}</span>
              </div>
            )}
            {userEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="text-gray-600 truncate">{userEmail}</span>
              </div>
            )}
            {apartmentNo && (
              <div className="flex items-center gap-2 text-sm">
                <Home className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="text-gray-600">{t('apartment')} <span className="font-mono font-semibold text-green-700">{apartmentNo}</span></span>
              </div>
            )}
            <div className="pt-0.5">
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {role === 'admin' ? t('role_admin') : t('role_resident')}
              </span>
            </div>
          </div>

          <DropdownMenuSeparator />

          <button
            onClick={() => setPwOpen(true)}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <KeyRound className="h-3.5 w-3.5 text-gray-400" />
            {t('change_password')}
          </button>

          <DropdownMenuSeparator />

          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-md"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t('logout')}
            </button>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-green-700" />
              {t('pw_title')}
            </DialogTitle>
          </DialogHeader>

          {state.success ? (
            <div className="py-4 text-center space-y-3">
              <p className="text-green-700 font-medium text-sm">{t('pw_success')}</p>
              <Button size="sm" variant="outline" onClick={() => setPwOpen(false)}>{t('pw_close')}</Button>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">{t('pw_new')}</Label>
                <Input name="new_password" type="password" placeholder={t('pw_new_placeholder')} minLength={6} required className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{t('pw_confirm')}</Label>
                <Input name="confirm_password" type="password" placeholder={t('pw_confirm_placeholder')} required className="h-10" />
              </div>
              {state.error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{state.error}</p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setPwOpen(false)}>{t('pw_cancel')}</Button>
                <Button type="submit" size="sm" disabled={pending}>{pending ? t('pw_saving') : t('pw_save')}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
