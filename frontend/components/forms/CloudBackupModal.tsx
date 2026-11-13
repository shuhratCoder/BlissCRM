'use client'

// Serverdagi (Admin CRM) zaxira nusxa: holat, hozir yuborish, tiklash.
// RestoreOffer — yangi o'rnatilgan (bo'sh) dasturda serverda nusxa
// topilsa, tiklashni taklif qiladi.

import React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  CloudUpload,
  CloudDownload,
  FileUp,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import {
  getCloudBackupStatus,
  linkCloudBackup,
  uploadCloudBackup,
  restoreCloudBackup,
  restoreCloudBackupFromFile,
  formatDateTime,
  type CloudBackupStatus,
} from '@/lib/api'
import { useUIStore, useAuthStore } from '@/store'
import {
  Button,
  Input,
  Modal,
  Skeleton,
  ConfirmDialog,
} from '@/components/ui'

function formatSize(bytes?: number | null): string {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value} Б`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`
  return `${(value / 1024 / 1024).toFixed(1)} МБ`
}

function errorText(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback
}

// ============================================================
// ASOSIY OYNA
// ============================================================

export function CloudBackupModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const addToast = useUIStore((s) => s.addToast)
  const queryClient = useQueryClient()

  const [status, setStatus] = React.useState<CloudBackupStatus | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [loadError, setLoadError] = React.useState('')

  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [linking, setLinking] = React.useState(false)
  const [linkError, setLinkError] = React.useState('')

  const [uploading, setUploading] = React.useState(false)
  const [restoring, setRestoring] = React.useState(false)
  const [confirmRestore, setConfirmRestore] = React.useState(false)

  // Файлдан тиклаш (админ панелдан олинган .blissbak)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = React.useState<File | null>(null)
  const [restoringFile, setRestoringFile] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setLoadError('')

    try {
      setStatus(await getCloudBackupStatus())
    } catch (e) {
      setLoadError(errorText(e, 'Ҳолатни олишда хатолик'))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      setPassword('')
      setLinkError('')
      load()
    }
  }, [open, load])

  async function onLink(event: React.FormEvent) {
    event.preventDefault()
    event.stopPropagation()
    setLinkError('')

    if (!username.trim() || !password) {
      setLinkError('Логин ва паролни киритинг')
      return
    }

    setLinking(true)

    try {
      await linkCloudBackup(username.trim(), password)
      setPassword('')
      addToast({ type: 'success', title: 'Захира нусха сервери уланди' })
      await load()
    } catch (e) {
      setLinkError(errorText(e, 'Улашда хатолик'))
    } finally {
      setLinking(false)
    }
  }

  async function onUpload() {
    setUploading(true)

    try {
      await uploadCloudBackup()
      addToast({ type: 'success', title: 'Захира нусха серверга юборилди' })
      await load()
    } catch (e) {
      addToast({ type: 'error', title: errorText(e, 'Юборишда хатолик') })
      await load()
    } finally {
      setUploading(false)
    }
  }

  async function onRestore() {
    setConfirmRestore(false)
    setRestoring(true)

    try {
      const result = await restoreCloudBackup()

      // Barcha ro'yxatlar yangi ma'lumot bilan qayta yuklanadi
      await queryClient.invalidateQueries()

      addToast({
        type: 'success',
        title: `Тикланди: ${result.counts?.clients ?? 0} мижоз, ${result.counts?.orders ?? 0} буюртма`,
      })

      await load()
    } catch (e) {
      addToast({ type: 'error', title: errorText(e, 'Тиклашда хатолик') })
    } finally {
      setRestoring(false)
    }
  }

  async function onRestoreFile() {
    const file = pendingFile

    setPendingFile(null)

    if (!file) return

    setRestoringFile(true)

    try {
      const result = await restoreCloudBackupFromFile(
        file,
        useAuthStore.getState().token ?? null,
      )

      await queryClient.invalidateQueries()

      addToast({
        type: 'success',
        title: `Файлдан тикланди: ${result.counts?.clients ?? 0} мижоз, ${result.counts?.orders ?? 0} буюртма`,
      })

      await load()
    } catch (e) {
      addToast({ type: 'error', title: errorText(e, 'Файлдан тиклашда хатолик') })
    } finally {
      setRestoringFile(false)
    }
  }

  const latest = status?.server?.latest ?? null
  const needsRelink =
    status?.serverErrorCode === 'BACKUP_TOKEN_INVALID' ||
    status?.serverErrorCode === 'BACKUP_TOKEN_REQUIRED'
  const showLinkForm = Boolean(status) && (!status?.linked || needsRelink)

  return (
    <>
      <Modal open={open} onClose={onClose} title="Захира нусха" size="md">
        {open && (
          <div className="space-y-4">
            <p className="text-xs leading-relaxed text-gray-500">
              Мижозлар, буюртмалар ва тўловлар сиқилган ҳолда серверга
              юборилади. Компьютер ишдан чиқса, янги компьютерда логин ва
              парол билан кириб, шу нусхадан тикланади.
            </p>

            {loading && !status ? (
              <Skeleton className="h-28" />
            ) : loadError ? (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {loadError}
              </div>
            ) : status ? (
              <>
                {/* ULANISH */}
                {showLinkForm ? (
                  <form
                    onSubmit={onLink}
                    className="space-y-3 rounded-lg border border-amber-100 bg-amber-50/50 p-4"
                  >
                    <div className="flex items-start gap-2 text-xs text-amber-900">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <span>
                        {needsRelink
                          ? 'Серверга уланиш эскирган (парол ўзгарган бўлиши мумкин). Логин ва парол билан қайта уланг.'
                          : 'Захира нусха сервери ҳали уланмаган. Дастурни биринчи марта ўрнатгандаги логин ва паролни киритинг.'}
                      </span>
                    </div>

                    <Input
                      label="Логин"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />

                    <Input
                      label="Парол"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />

                    {linkError && (
                      <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        {linkError}
                      </div>
                    )}

                    <Button type="submit" className="w-full" loading={linking}>
                      Улаш
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2.5 text-xs text-green-700">
                    <CheckCircle2 size={15} />
                    Сервер уланган. Ўзгаришлар ҳар 30 дақиқада автоматик
                    юборилади.
                  </div>
                )}

                {/* HOLAT */}
                <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-4 space-y-2 text-sm">
                  <InfoRow
                    label="Бу компьютерда"
                    value={`${status.local.clients} мижоз, ${status.local.orders} буюртма`}
                  />
                  <InfoRow
                    label="Сервердаги охирги нусха"
                    value={
                      latest
                        ? `${formatDateTime(latest.createdAt)} · ${latest.clientsCount} мижоз, ${latest.ordersCount} буюртма · ${formatSize(latest.sizeBytes)}`
                        : status.linked && !status.serverError
                          ? 'Ҳали йўқ'
                          : '—'
                    }
                  />
                  <InfoRow
                    label="Охирги юбориш"
                    value={
                      status.lastBackupAt
                        ? formatDateTime(status.lastBackupAt)
                        : '—'
                    }
                  />
                </div>

                {status.linked && status.serverError && !needsRelink && (
                  <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {status.serverError}
                  </div>
                )}

                {status.linked && !needsRelink && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      type="button"
                      onClick={onUpload}
                      loading={uploading}
                      disabled={restoring}
                    >
                      <CloudUpload size={15} /> Ҳозир юбориш
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setConfirmRestore(true)}
                      loading={restoring}
                      disabled={uploading || !latest}
                    >
                      <CloudDownload size={15} /> Сервердан тиклаш
                    </Button>
                  </div>
                )}
                {/* FAYLDAN TIKLASH */}
                <div className="border-t border-gray-100 pt-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".blissbak,application/octet-stream"
                    className="hidden"
                    onChange={(e) => {
                      setPendingFile(e.target.files?.[0] ?? null)
                      e.target.value = ''
                    }}
                  />

                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    loading={restoringFile}
                    disabled={uploading || restoring}
                  >
                    <FileUp size={15} /> Файлдан тиклаш
                  </Button>

                  <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                    Администратор берган захира нусха файли
                    (.blissbak) учун.
                  </p>
                </div>
              </>
            ) : null}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingFile)}
        onClose={() => setPendingFile(null)}
        onConfirm={onRestoreFile}
        title="Файлдан тиклансинми?"
        description={
          pendingFile
            ? `Бу компьютердаги мижозлар, буюртмалар ва тўловлар «${pendingFile.name}» файлидаги маълумотлар билан алмаштирилади. Файлдаги санадан кейин киритилган маълумотлар йўқолади.`
            : ''
        }
        confirmLabel="Тиклаш"
      />

      <ConfirmDialog
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        onConfirm={onRestore}
        title="Сервердаги нусхадан тиклансинми?"
        description={
          latest
            ? `Бу компьютердаги мижозлар, буюртмалар ва тўловлар сервердаги нусха билан алмаштирилади (${formatDateTime(latest.createdAt)}: ${latest.clientsCount} мижоз, ${latest.ordersCount} буюртма). Шу санадан кейин киритилган маълумотлар йўқолади.`
            : ''
        }
        confirmLabel="Тиклаш"
      />
    </>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-right text-gray-900">{value}</span>
    </div>
  )
}

// ============================================================
// YANGI KOMPYUTERDA TIKLASH TAKLIFI
// ============================================================

const OFFER_DISMISSED_KEY = 'bliss-restore-offer-dismissed'

export function RestoreOffer() {
  const addToast = useUIStore((s) => s.addToast)
  const queryClient = useQueryClient()

  const [status, setStatus] = React.useState<CloudBackupStatus | null>(null)
  const [open, setOpen] = React.useState(false)
  const [restoring, setRestoring] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        if (sessionStorage.getItem(OFFER_DISMISSED_KEY)) return
      } catch {
        // sessionStorage mavjud bo'lmasa ham taklif ko'rsatiladi
      }

      try {
        const result = await getCloudBackupStatus()

        if (cancelled) return

        // Faqat bo'sh dasturda va serverda nusxa bor bo'lsa
        if (
          result.linked &&
          result.server?.exists &&
          result.local.clients === 0 &&
          result.local.orders === 0
        ) {
          setStatus(result)
          setOpen(true)
        }
      } catch {
        // Internet yo'q yoki server javob bermadi: taklif ko'rsatilmaydi
      }
    }

    check()

    return () => {
      cancelled = true
    }
  }, [])

  function dismiss() {
    try {
      sessionStorage.setItem(OFFER_DISMISSED_KEY, '1')
    } catch {
      // e'tiborsiz
    }

    setOpen(false)
  }

  async function onRestore() {
    setRestoring(true)

    try {
      const result = await restoreCloudBackup()

      await queryClient.invalidateQueries()

      addToast({
        type: 'success',
        title: `Тикланди: ${result.counts?.clients ?? 0} мижоз, ${result.counts?.orders ?? 0} буюртма`,
      })

      setOpen(false)
    } catch (e) {
      addToast({ type: 'error', title: errorText(e, 'Тиклашда хатолик') })
    } finally {
      setRestoring(false)
    }
  }

  const latest = status?.server?.latest ?? null

  return (
    <Modal
      open={open}
      onClose={dismiss}
      title="Серверда захира нусха топилди"
      size="md"
    >
      {open && latest && (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Бу ҳисоб учун серверда сақланган маълумотлар бор. Уларни шу
            компьютерга тиклайсизми?
          </p>

          <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-4 space-y-2 text-sm">
            <InfoRow label="Сана" value={formatDateTime(latest.createdAt)} />
            <InfoRow label="Мижозлар" value={String(latest.clientsCount)} />
            <InfoRow label="Буюртмалар" value={String(latest.ordersCount)} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="secondary"
              onClick={dismiss}
              disabled={restoring}
            >
              Кейинроқ
            </Button>

            <Button type="button" onClick={onRestore} loading={restoring}>
              <CloudDownload size={15} /> Тиклаш
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
