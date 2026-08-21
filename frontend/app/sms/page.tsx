'use client'

import React from 'react'

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  Settings,
  Wallet,
  X,
} from 'lucide-react'

import { useClients } from '@/hooks'

import {
  useUIStore,
} from '@/store'

import {
  formatCurrency,
  formatPhone,

  getSmsSettings,
  saveSmsSettings,
  testEskiz,
  getSmsBalance,
  sendSmsMessages,

  type SendSmsMessage,
} from '@/lib/api'

import {
  Button,
  PageHeader,
  EmptyState,
  Skeleton,
} from '@/components/ui'

import type { Client } from '@/types'

import { cn } from '@/lib/utils'

// ============================================================
// HELPERS
// ============================================================

function formatCurrencyUz(
  amount: number,
): string {
  return new Intl.NumberFormat(
    'en-US',
    {
      maximumFractionDigits: 0,
    },
  )
    .format(amount)
    .replace(/,/g, ' ')
}

function normalizeUzPhone(
  input:
    | string
    | null
    | undefined,
): string | null {
  let digits = String(
    input ?? '',
  ).replace(/\D/g, '')

  if (
    digits.startsWith('998')
  ) {
    digits =
      digits.slice(3)
  }

  if (
    digits.length !== 9
  ) {
    return null
  }

  return `998${digits}`
}

function renderSmsText(
  template: string,
  client: Client,
): string {
  const debt =
    client.totalDebt ?? 0

  return template
    .replace(
      /\{name\}/g,
      client.name ?? '',
    )
    .replace(
      /\{duty\}/g,
      formatCurrencyUz(
        debt,
      ),
    )
}

// ============================================================
// TEMPLATE PREVIEW
// ============================================================

function renderTemplatePreview(
  template: string,
): React.ReactNode[] {
  const parts =
    template.split(
      /(\{name\}|\{duty\})/g,
    )

  return parts.map(
    (part, index) => {
      if (
        part === '{name}'
      ) {
        return (
          <strong
            key={index}
            className="font-semibold text-gray-900"
          >
            {'{mijozning ismi}'}
          </strong>
        )
      }

      if (
        part === '{duty}'
      ) {
        return (
          <strong
            key={index}
            className="font-semibold text-gray-900"
          >
            {'{qarz miqdori}'}
          </strong>
        )
      }

      return (
        <React.Fragment
          key={index}
        >
          {part}
        </React.Fragment>
      )
    },
  )
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function SmsPanelPage() {
  const addToast =
    useUIStore(
      (state) =>
        state.addToast,
    )

  const {
    data: clients,
    isLoading,
  } = useClients()

  // ----------------------------------------------------------
  // SMS SETTINGS
  // ----------------------------------------------------------

  const [
    settingsOpen,
    setSettingsOpen,
  ] = React.useState(false)

  const [
    settingsLoading,
    setSettingsLoading,
  ] = React.useState(false)

  const [
    settingsSaving,
    setSettingsSaving,
  ] = React.useState(false)

  const [
    testingEskiz,
    setTestingEskiz,
  ] = React.useState(false)

  const [
    eskizLogin,
    setEskizLogin,
  ] = React.useState('')

  const [
    eskizPassword,
    setEskizPassword,
  ] = React.useState('')

  const [
    hasSavedPassword,
    setHasSavedPassword,
  ] = React.useState(false)

  const [
    showPassword,
    setShowPassword,
  ] = React.useState(false)

  const [
    smsTemplate,
    setSmsTemplate,
  ] = React.useState(
    'Assalomu alaykum, {name}!\n\nSizning qarzingiz: {duty}.\n\nIltimos, to\'lovni amalga oshiring.',
  )

  // ----------------------------------------------------------
  // ESKIZ STATUS
  // ----------------------------------------------------------

  const [
    eskizConnected,
    setEskizConnected,
  ] = React.useState(false)

  const [
    balance,
    setBalance,
  ] = React.useState<
    number | null
  >(null)

  const [
    balanceLoading,
    setBalanceLoading,
  ] = React.useState(false)

  // ----------------------------------------------------------
  // SMS SEND
  // ----------------------------------------------------------

  const [
    sending,
    setSending,
  ] = React.useState(false)

  const [
    selectedIds,
    setSelectedIds,
  ] = React.useState<
    Set<string>
  >(new Set())

  // ==========================================================
  // DEBTORS
  // ==========================================================

  const debtors =
    React.useMemo(
      () =>
        (clients ?? []).filter(
          (client) =>
            (client.totalDebt ??
              0) > 0,
        ),
      [clients],
    )

  // ==========================================================
  // LOAD SMS SETTINGS
  // ==========================================================

  const loadSmsSettings =
    React.useCallback(
      async () => {
        setSettingsLoading(
          true,
        )

        try {
          const response =
            await getSmsSettings()

          setEskizLogin(
            response.settings
              .eskizLogin ?? '',
          )

          setHasSavedPassword(
            Boolean(
              response.settings
                .hasPassword,
            ),
          )

          setSmsTemplate(
            response.settings
              .smsTemplate ??
              '',
          )
        } catch (error) {
          console.error(
            'SMS SETTINGS LOAD ERROR:',
            error,
          )

          addToast({
            type: 'error',
            title:
              'SMS sozlamalarini olishda xatolik',
          })
        } finally {
          setSettingsLoading(
            false,
          )
        }
      },
      [addToast],
    )

  // ==========================================================
  // OPEN SETTINGS
  // ==========================================================

  async function openSettings() {
    setSettingsOpen(
      true,
    )

    setEskizPassword('')

    await loadSmsSettings()
  }

  // ==========================================================
  // TEST ESKIZ
  // ==========================================================

  async function handleTestEskiz() {
    if (
      !eskizLogin.trim()
    ) {
      addToast({
        type: 'warning',
        title:
          'Eskiz loginini kiriting',
      })

      return
    }

    if (
      !eskizPassword.trim() &&
      !hasSavedPassword
    ) {
      addToast({
        type: 'warning',
        title:
          'Eskiz parolini kiriting',
      })

      return
    }

    setTestingEskiz(
      true,
    )

    try {
      const response =
        await testEskiz(
          eskizLogin.trim(),
          eskizPassword.trim() ||
            undefined,
        )

      if (
        response.success
      ) {
        setEskizConnected(
          true,
        )

        addToast({
          type: 'success',
          title:
            'Eskiz akkaunti muvaffaqiyatli ulandi',
        })

        await loadBalance()
      }
    } catch (error) {
      console.error(
        'ESKIZ TEST ERROR:',
        error,
      )

      setEskizConnected(
        false,
      )

      addToast({
        type: 'error',
        title:
          error instanceof Error
            ? error.message
            : 'Eskiz akkauntini tekshirishda xatolik',
      })
    } finally {
      setTestingEskiz(
        false,
      )
    }
  }

  // ==========================================================
  // SAVE SETTINGS
  // ==========================================================

  async function handleSaveSettings() {
    if (
      !eskizLogin.trim()
    ) {
      addToast({
        type: 'warning',
        title:
          'Eskiz loginini kiriting',
      })

      return
    }

    if (
      !smsTemplate.trim()
    ) {
      addToast({
        type: 'warning',
        title:
          'SMS matnini kiriting',
      })

      return
    }

    if (
      !hasSavedPassword &&
      !eskizPassword.trim()
    ) {
      addToast({
        type: 'warning',
        title:
          'Eskiz parolini kiriting',
      })

      return
    }

    setSettingsSaving(
      true,
    )

    try {
      const response =
        await saveSmsSettings({
          eskizLogin:
            eskizLogin.trim(),

          ...(eskizPassword.trim()
            ? {
                eskizPassword:
                  eskizPassword.trim(),
              }
            : {}),

          smsTemplate:
            smsTemplate.trim(),
        })

      setHasSavedPassword(
        response.settings
          .hasPassword,
      )

      setEskizPassword('')

      addToast({
        type: 'success',
        title:
          'SMS sozlamalari saqlandi',
      })

      setSettingsOpen(
        false,
      )

      setEskizConnected(
        false,
      )

      await loadBalance()
    } catch (error) {
      console.error(
        'SAVE SMS SETTINGS ERROR:',
        error,
      )

      addToast({
        type: 'error',
        title:
          error instanceof Error
            ? error.message
            : 'SMS sozlamalarini saqlashda xatolik',
      })
    } finally {
      setSettingsSaving(
        false,
      )
    }
  }

  // ==========================================================
  // BALANCE
  // ==========================================================

  async function loadBalance() {
    setBalanceLoading(
      true,
    )

    try {
      const response =
        await getSmsBalance()

      setBalance(
        response.balance,
      )

      setEskizConnected(
        true,
      )
    } catch (error) {
      console.error(
        'SMS BALANCE ERROR:',
        error,
      )

      setEskizConnected(
        false,
      )

      setBalance(null)
    } finally {
      setBalanceLoading(
        false,
      )
    }
  }

  // ==========================================================
  // LOAD INITIAL SETTINGS
  // ==========================================================

  React.useEffect(() => {
    let cancelled =
      false

    async function bootstrap() {
      try {
        const response =
          await getSmsSettings()

        if (
          cancelled
        ) {
          return
        }

        setEskizLogin(
          response.settings
            .eskizLogin ?? '',
        )

        setHasSavedPassword(
          Boolean(
            response.settings
              .hasPassword,
          ),
        )

        setSmsTemplate(
          response.settings
            .smsTemplate ?? '',
        )

        if (
          response.settings
            .hasPassword &&
          response.settings
            .eskizLogin
        ) {
          loadBalance()
        }
      } catch (error) {
        console.error(
          'SMS BOOTSTRAP ERROR:',
          error,
        )
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  // ==========================================================
  // SELECT ALL
  // ==========================================================

  const allSelected =
    debtors.length > 0 &&
    selectedIds.size ===
      debtors.length

  function toggleAll() {
    if (
      allSelected
    ) {
      setSelectedIds(
        new Set(),
      )

      return
    }

    setSelectedIds(
      new Set(
        debtors.map(
          (client) =>
            client.id,
        ),
      ),
    )
  }

  // ==========================================================
  // SEND SMS
  // ==========================================================

  async function handleSendSms() {
    if (
      selectedIds.size === 0
    ) {
      addToast({
        type: 'warning',
        title:
          'Kamida bitta mijozni tanlang',
      })

      return
    }

    if (
      !hasSavedPassword
    ) {
      addToast({
        type: 'warning',
        title:
          'Avval Eskiz akkauntini sozlang',
      })

      setSettingsOpen(
        true,
      )

      return
    }

    if (
      !smsTemplate.trim()
    ) {
      addToast({
        type: 'warning',
        title:
          'SMS matni kiritilmagan',
      })

      return
    }

    const selected =
      debtors.filter(
        (client) =>
          selectedIds.has(
            client.id,
          ),
      )

    const messages: SendSmsMessage[] =
      []

    let skipped = 0

    selected.forEach(
      (
        client,
        index,
      ) => {
        const phone =
          normalizeUzPhone(
            client.phone,
          )

        if (!phone) {
          skipped++
          return
        }

        messages.push({
  user_sms_id: `sms${index + 1}`,
  to: Number(phone),
  text: renderSmsText(smsTemplate, client),
})
      },
    )

    if (
      messages.length === 0
    ) {
      addToast({
        type: 'warning',
        title:
          'Yaroqli telefon raqamlari topilmadi',
      })

      return
    }

    if (
      skipped > 0
    ) {
      addToast({
        type: 'warning',
        title:
          `${skipped} ta mijozda telefon raqami noto'g'ri`,
      })
    }

    setSending(true)

    try {
      await sendSmsMessages(
        messages,
      )

      addToast({
        type: 'success',
        title:
          `${messages.length} ta SMS yuborildi`,
      })

      setSelectedIds(
        new Set(),
      )

      await loadBalance()
    } catch (error) {
      console.error(
        'SEND SMS ERROR:',
        error,
      )

      addToast({
        type: 'error',
        title:
          error instanceof Error
            ? error.message
            : 'SMS yuborishda xatolik',
      })
    } finally {
      setSending(false)
    }
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <>
      <div className="space-y-5 max-w-6xl">
        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <PageHeader
          title="SMS"
          description="Mijozlarga SMS xabar yuborish"
          actions={
            <div className="flex items-center gap-2">
              {hasSavedPassword && (
                <div
                  className={cn(
                    'inline-flex items-center gap-1.5',
                    'rounded-md border px-2.5 py-1.5',
                    'text-xs',
                    eskizConnected
                      ? 'border-green-100 bg-green-50 text-green-700'
                      : 'border-gray-100 bg-gray-50 text-gray-500',
                  )}
                >
                  {eskizConnected ? (
                    <>
                      <CheckCircle2
                        size={13}
                      />
                      Eskiz ulangan
                    </>
                  ) : (
                    <>
                      <AlertTriangle
                        size={13}
                      />
                      Eskiz tekshirilmagan
                    </>
                  )}
                </div>
              )}

              {balance !==
                null && (
                <div className="inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
                  <Wallet
                    size={13}
                  />

                  Balans:{' '}

                  <strong>
                    {formatCurrency(
                      balance,
                    )}
                  </strong>
                </div>
              )}

              <Button
                variant="secondary"
                onClick={
                  openSettings
                }
              >
                <Settings
                  size={15}
                />

                SMS sozlamalari
              </Button>
            </div>
          }
        />

        {/* ================================================== */}
        {/* SMS PANEL */}
        {/* ================================================== */}

        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
          <div className="p-5">
            <div className="grid gap-5 md:grid-cols-2">
              {/* ============================================ */}
              {/* CLIENTS */}
              {/* ============================================ */}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    Qarzdor mijozlar
                    {' '}
                    <span className="text-gray-400">
                      ({debtors.length})
                    </span>
                  </h3>

                  {debtors.length >
                    0 && (
                    <button
                      type="button"
                      onClick={
                        toggleAll
                      }
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {allSelected
                        ? 'Barchasini bekor qilish'
                        : 'Barchasini tanlash'}
                    </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
                  {isLoading && (
                    <div className="space-y-2 p-3">
                      {Array.from(
                        {
                          length: 5,
                        },
                      ).map(
                        (
                          _,
                          index,
                        ) => (
                          <Skeleton
                            key={
                              index
                            }
                            className="h-11"
                          />
                        ),
                      )}
                    </div>
                  )}

                  {!isLoading &&
                    debtors.length ===
                      0 && (
                      <EmptyState
                        icon={
                          <MessageSquare
                            size={
                              28
                            }
                          />
                        }
                        title="Qarzdor mijozlar yo'q"
                        description="Hozircha SMS yuborish uchun qarzdor mijoz mavjud emas."
                      />
                    )}

                  {!isLoading &&
                    debtors.map(
                      (
                        client,
                      ) => {
                        const checked =
                          selectedIds.has(
                            client.id,
                          )

                        return (
                          <label
                            key={
                              client.id
                            }
                            className={cn(
                              'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors',
                              'hover:bg-gray-50',
                              checked &&
                                'bg-blue-50',
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={
                                checked
                              }
                              onChange={(
                                event,
                              ) => {
                                setSelectedIds(
                                  (
                                    previous,
                                  ) => {
                                    const next =
                                      new Set(
                                        previous,
                                      )

                                    if (
                                      event
                                        .target
                                        .checked
                                    ) {
                                      next.add(
                                        client.id,
                                      )
                                    } else {
                                      next.delete(
                                        client.id,
                                      )
                                    }

                                    return next
                                  },
                                )
                              }}
                              className="rounded"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-gray-800">
                                {
                                  client.name
                                }
                              </p>

                              <p className="text-[11px] text-gray-400">
                                {formatPhone(
                                  client.phone,
                                )}
                              </p>
                            </div>

                            <span className="shrink-0 text-xs font-semibold text-red-500">
                              {formatCurrency(
                                client.totalDebt ??
                                  0,
                              )}
                            </span>
                          </label>
                        )
                      },
                    )}
                </div>

                <p className="text-xs text-gray-500">
                  Tanlangan:
                  {' '}
                  <strong>
                    {
                      selectedIds.size
                    }
                  </strong>
                </p>
              </div>

              {/* ============================================ */}
              {/* MESSAGE */}
              {/* ============================================ */}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">
                    SMS matni
                  </h3>

                  <button
                    type="button"
                    onClick={
                      openSettings
                    }
                    className="text-xs text-blue-600 hover:underline"
                  >
                    O'zgartirish
                  </button>
                </div>

                <div className="min-h-36 whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                  {smsTemplate ? (
                    renderTemplatePreview(
                      smsTemplate,
                    )
                  ) : (
                    <span className="text-gray-400">
                      SMS matni
                      sozlanmagan
                    </span>
                  )}
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                  <p className="font-semibold mb-1">
                    Avtomatik almashtiriladi:
                  </p>

                  <p>
                    <strong>
                      {'{name}'}
                    </strong>
                    {' '}
                    → mijozning
                    ismi
                  </p>

                  <p>
                    <strong>
                      {'{duty}'}
                    </strong>
                    {' '}
                    → mijozning
                    qarzi
                  </p>
                </div>

                <Button
                  onClick={
                    handleSendSms
                  }
                  className="w-full"
                  disabled={
                    selectedIds.size ===
                      0 ||
                    sending ||
                    !hasSavedPassword
                  }
                  loading={
                    sending
                  }
                >
                  <Send
                    size={15}
                  />

                  SMS yuborish
                  {' '}
                  {selectedIds.size >
                    0 &&
                    `(${selectedIds.size})`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* SETTINGS MODAL */}
      {/* ==================================================== */}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl">
            {/* ============================================== */}
            {/* MODAL HEADER */}
            {/* ============================================== */}

            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  SMS sozlamalari
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  Eskiz akkaunti va SMS
                  matnini sozlang
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSettingsOpen(
                    false,
                  )
                }
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X
                  size={18}
                />
              </button>
            </div>

            {/* ============================================== */}
            {/* MODAL BODY */}
            {/* ============================================== */}

            <div className="space-y-5 p-5">
              {settingsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-32" />
                </div>
              ) : (
                <>
                  {/* ======================================== */}
                  {/* ESKIZ LOGIN */}
                  {/* ======================================== */}

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                      Eskiz login
                    </label>

                    <input
                      type="email"
                      value={
                        eskizLogin
                      }
                      onChange={(
                        event,
                      ) =>
                        setEskizLogin(
                          event
                            .target
                            .value,
                        )
                      }
                      placeholder="Eskiz login / email"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* ======================================== */}
                  {/* ESKIZ PASSWORD */}
                  {/* ======================================== */}

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                      Eskiz parol
                    </label>

                    <div className="relative">
                      <input
                        type={
                          showPassword
                            ? 'text'
                            : 'password'
                        }
                        value={
                          eskizPassword
                        }
                        onChange={(
                          event,
                        ) =>
                          setEskizPassword(
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder={
                          hasSavedPassword
                            ? 'Saqlangan parolni o‘zgartirish uchun kiriting'
                            : 'Eskiz paroli'
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 pr-10 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (
                              value,
                            ) =>
                              !value,
                          )
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        {showPassword ? (
                          <EyeOff
                            size={
                              16
                            }
                          />
                        ) : (
                          <Eye
                            size={
                              16
                            }
                          />
                        )}
                      </button>
                    </div>

                    {hasSavedPassword && (
                      <p className="mt-1.5 text-[11px] text-green-600">
                        ✓ Eskiz paroli
                        saqlangan
                      </p>
                    )}
                  </div>

                  {/* ======================================== */}
                  {/* SMS TEMPLATE */}
                  {/* ======================================== */}

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">
                        SMS matni
                      </label>

                      <span className="text-[11px] text-gray-400">
                        {smsTemplate.length}{' '}
                        belgi
                      </span>
                    </div>

                    <textarea
                      value={
                        smsTemplate
                      }
                      onChange={(
                        event,
                      ) =>
                        setSmsTemplate(
                          event
                            .target
                            .value,
                        )
                      }
                      rows={6}
                      placeholder={`Masalan:

Assalomu alaykum, {name}!

Sizning qarzingiz: {duty}.

Iltimos, to'lovni amalga oshiring.`}
                      className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm leading-relaxed outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    <div className="mt-2 rounded-lg bg-gray-50 p-3 text-[11px] text-gray-600">
                      <p className="font-semibold text-gray-700">
                        Placeholderlar:
                      </p>

                      <p>
                        <code className="rounded bg-white px-1 py-0.5">
                          {'{name}'}
                        </code>
                        {' '}
                        — mijoz
                        ismi
                      </p>

                      <p>
                        <code className="rounded bg-white px-1 py-0.5">
                          {'{duty}'}
                        </code>
                        {' '}
                        — qarz
                        miqdori
                      </p>
                    </div>
                  </div>

                  {/* ======================================== */}
                  {/* TEST */}
                  {/* ======================================== */}

                  <button
                    type="button"
                    onClick={
                      handleTestEskiz
                    }
                    disabled={
                      testingEskiz ||
                      !eskizLogin.trim()
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw
                      size={15}
                      className={
                        testingEskiz
                          ? 'animate-spin'
                          : ''
                      }
                    />

                    {testingEskiz
                      ? 'Tekshirilmoqda...'
                      : 'Eskiz akkauntini tekshirish'}
                  </button>

                  {eskizConnected && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2.5 text-xs text-green-700">
                      <CheckCircle2
                        size={15}
                      />

                      Eskiz akkaunti
                      muvaffaqiyatli
                      ulandi
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ============================================== */}
            {/* MODAL FOOTER */}
            {/* ============================================== */}

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <Button
                variant="secondary"
                onClick={() =>
                  setSettingsOpen(
                    false,
                  )
                }
                disabled={
                  settingsSaving
                }
              >
                Bekor qilish
              </Button>

              <Button
                onClick={
                  handleSaveSettings
                }
                disabled={
                  settingsLoading ||
                  settingsSaving
                }
                loading={
                  settingsSaving
                }
              >
                <Save
                  size={15}
                />

                Saqlash
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}