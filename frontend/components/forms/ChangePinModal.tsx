'use client'

// Dastur ichida PIN kodni o'zgartirish (joriy PIN bilan).

import React from 'react'
import { changePinRequest } from '@/lib/api'
import { useUIStore } from '@/store'
import { Button, Input, Modal } from '@/components/ui'

const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 4)

export function ChangePinModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const addToast = useUIStore((s) => s.addToast)

  const [currentPin, setCurrentPin] = React.useState('')
  const [newPin, setNewPin] = React.useState('')
  const [confirmPin, setConfirmPin] = React.useState('')
  const [error, setError] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  // Har ochilganda maydonlar tozalanadi
  React.useEffect(() => {
    if (open) {
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      setError('')
    }
  }, [open])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    event.stopPropagation()
    setError('')

    if (!/^\d{4}$/.test(currentPin)) {
      setError('Жорий ПИН кодни киритинг')
      return
    }

    if (!/^\d{4}$/.test(newPin)) {
      setError('Янги ПИН айнан 4 хонали сон бўлиши керак')
      return
    }

    if (newPin !== confirmPin) {
      setError('ПИН кодлар бир хил эмас')
      return
    }

    setSaving(true)

    try {
      await changePinRequest(currentPin, newPin)

      addToast({
        type: 'success',
        title: 'ПИН код ўзгартирилди',
      })

      onClose()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'ПИН кодни ўзгартиришда хатолик',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ПИН кодни ўзгартириш"
      size="sm"
    >
      {open && (
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Жорий ПИН"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="••••"
            value={currentPin}
            onChange={(e) => setCurrentPin(onlyDigits(e.target.value))}
            autoFocus
          />

          <Input
            label="Янги ПИН"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            placeholder="••••"
            value={newPin}
            onChange={(e) => setNewPin(onlyDigits(e.target.value))}
          />

          <Input
            label="Янги ПИНни такрорланг"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            placeholder="••••"
            value={confirmPin}
            onChange={(e) => setConfirmPin(onlyDigits(e.target.value))}
          />

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Бекор қилиш
            </Button>

            <Button type="submit" loading={saving}>
              Сақлаш
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
