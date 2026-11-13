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
  type SmsProvider,
  type SmsSettingsData,
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
            {'{мижознинг исми}'}
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
            {'{қарз миқдори}'}
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

  // Юбориш усули: Эскиз ёки ўз Android телефони (SMSGate)
  const [
    provider,
    setProvider,
  ] = React.useState<SmsProvider>('eskiz')

  const [
    androidUrl,
    setAndroidUrl,
  ] = React.useState('')

  const [
    providerLogins,
    setProviderLogins,
  ] = React.useState<Record<SmsProvider, string>>({
    eskiz: '',
    android: '',
  })

  const [
    providerHasPasswords,
    setProviderHasPasswords,
  ] = React.useState<Record<SmsProvider, boolean>>({
    eskiz: false,
    android: false,
  })

  // Автоматик СМС
  const [
    orderSmsEnabled,
    setOrderSmsEnabled,
  ] = React.useState(false)

  const [
    orderSmsTemplate,
    setOrderSmsTemplate,
  ] = React.useState('')

  const [
    reminderEnabled,
    setReminderEnabled,
  ] = React.useState(false)

  const [
    reminderDays,
    setReminderDays,
  ] = React.useState(7)

  const isAndroid =
    provider === 'android'

  const providerName = isAndroid
    ? 'Телефон'
    : 'Эскиз'

  const [
    smsTemplate,
    setSmsTemplate,
  ] = React.useState(
    'Ассалому алайкум, {name}!\n\nСизнинг қарзингиз: {duty}.\n\nИлтимос, тўловни амалга оширинг.',
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

  const applySettings =
    React.useCallback(
      (settings: SmsSettingsData) => {
        const activeProvider: SmsProvider =
          settings.provider === 'android'
            ? 'android'
            : 'eskiz'

        setProvider(activeProvider)

        setAndroidUrl(
          settings.androidUrl ?? '',
        )

        setEskizLogin(
          settings.eskizLogin ?? '',
        )

        setHasSavedPassword(
          Boolean(settings.hasPassword),
        )

        setProviderLogins(
          settings.logins ?? {
            eskiz: settings.eskizLogin ?? '',
            android: '',
          },
        )

        setProviderHasPasswords(
          settings.hasPasswords ?? {
            eskiz: Boolean(settings.hasPassword),
            android: false,
          },
        )

        setSmsTemplate(
          settings.smsTemplate ?? '',
        )

        setOrderSmsEnabled(
          Boolean(settings.orderSmsEnabled),
        )

        setOrderSmsTemplate(
          settings.orderSmsTemplate ?? '',
        )

        setReminderEnabled(
          Boolean(settings.reminderEnabled),
        )

        setReminderDays(
          settings.reminderDays ?? 7,
        )
      },
      [],
    )

  // Созламалар ойнасида усул алмаштирилганда шу усулнинг
  // сақланган логини ва парол ҳолати кўрсатилади.
  function switchProvider(next: SmsProvider) {
    if (next === provider) return

    setProvider(next)
    setEskizLogin(providerLogins[next] ?? '')
    setHasSavedPassword(Boolean(providerHasPasswords[next]))
    setEskizPassword('')
    setEskizConnected(false)
  }

  const loadSmsSettings =
    React.useCallback(
      async () => {
        setSettingsLoading(
          true,
        )

        try {
          const response =
            await getSmsSettings()

          applySettings(
            response.settings,
          )
        } catch (error) {
          console.error(
            'SMS SETTINGS LOAD ERROR:',
            error,
          )

          addToast({
            type: 'error',
            title:
              'СМС созламаларини олишда хатолик',
          })
        } finally {
          setSettingsLoading(
            false,
          )
        }
      },
      [addToast, applySettings],
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
      isAndroid &&
      !androidUrl.trim()
    ) {
      addToast({
        type: 'warning',
        title:
          'Телефон манзилини киритинг',
      })

      return
    }

    if (
      !eskizLogin.trim()
    ) {
      addToast({
        type: 'warning',
        title:
          `${providerName} логинини киритинг`,
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
          `${providerName} паролини киритинг`,
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
          {
            provider,
            ...(isAndroid
              ? {
                  androidUrl:
                    androidUrl.trim(),
                }
              : {}),
          },
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
            response.message ||
            'Муваффақиятли уланди',
        })

        // Баланс фақат Эскизда бор
        if (!isAndroid) {
          await loadBalance()
        }
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
            : 'Уланишни текширишда хатолик',
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
      isAndroid &&
      !androidUrl.trim()
    ) {
      addToast({
        type: 'warning',
        title:
          'Телефон манзилини киритинг',
      })

      return
    }

    if (
      !eskizLogin.trim()
    ) {
      addToast({
        type: 'warning',
        title:
          `${providerName} логинини киритинг`,
      })

      return
    }

    if (
      !smsTemplate.trim()
    ) {
      addToast({
        type: 'warning',
        title:
          'СМС матнини киритинг',
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
          `${providerName} паролини киритинг`,
      })

      return
    }

    setSettingsSaving(
      true,
    )

    try {
      const response =
        await saveSmsSettings({
          provider,

          ...(isAndroid
            ? {
                androidUrl:
                  androidUrl.trim(),
              }
            : {}),

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

          orderSmsEnabled,

          orderSmsTemplate:
            orderSmsTemplate.trim(),

          reminderEnabled,

          reminderDays:
            Math.min(
              365,
              Math.max(
                1,
                Math.round(
                  Number(reminderDays) || 7,
                ),
              ),
            ),
        })

      applySettings(
        response.settings,
      )

      setEskizPassword('')

      addToast({
        type: 'success',
        title:
          'СМС созламалари сақланди',
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
            : 'СМС созламаларини сақлашда хатолик',
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

        applySettings(
          response.settings,
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
          'Камида битта мижозни танланг',
      })

      return
    }

    if (
      !hasSavedPassword
    ) {
      addToast({
        type: 'warning',
        title: isAndroid
          ? 'Аввал телефон манзили, логин ва паролини созланг'
          : 'Аввал Эскиз аккаунтини созланг',
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
          'СМС матни киритилмаган',
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
          'Яроқли телефон рақамлари топилмади',
      })

      return
    }

    if (
      skipped > 0
    ) {
      addToast({
        type: 'warning',
        title:
          `${skipped} та мижозда телефон рақами нотўғри`,
      })
    }

    setSending(true)

    try {
      const response =
        await sendSmsMessages(
          messages,
        )

      addToast({
        type:
          (response.failed ?? 0) > 0
            ? 'warning'
            : 'success',
        title:
          isAndroid && response.message
            ? response.message
            : `${messages.length} та СМС юборилди`,
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
            : 'СМС юборишда хатолик',
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
          title="СМС"
          description="Мижозларга СМС хабар юбориш"
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
                      {providerName} уланган
                    </>
                  ) : (
                    <>
                      <AlertTriangle
                        size={13}
                      />
                      {providerName} текширилмаган
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

                  Баланс:{' '}

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

                СМС созламалари
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
                    Қарздор мижозлар
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
                        ? 'Барчасини бекор қилиш'
                        : 'Барчасини танлаш'}
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
                        title="Қарздор мижозлар йўқ"
                        description="Ҳозирча СМС юбориш учун қарздор мижоз мавжуд эмас."
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
                  Танланган:
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
                    СМС матни
                  </h3>

                  <button
                    type="button"
                    onClick={
                      openSettings
                    }
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Ўзгартириш
                  </button>
                </div>

                <div className="min-h-36 whitespace-pre-wrap rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
                  {smsTemplate ? (
                    renderTemplatePreview(
                      smsTemplate,
                    )
                  ) : (
                    <span className="text-gray-400">
                      СМС матни
                      созланмаган
                    </span>
                  )}
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
                  <p className="font-semibold mb-1">
                    Автоматик алмаштирилади:
                  </p>

                  <p>
                    <strong>
                      {'{name}'}
                    </strong>
                    {' '}
                    → мижознинг
                    исми
                  </p>

                  <p>
                    <strong>
                      {'{duty}'}
                    </strong>
                    {' '}
                    → мижознинг
                    қарзи
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

                  СМС юбориш
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
          <div className="flex max-h-full w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl">
            {/* ============================================== */}
            {/* MODAL HEADER */}
            {/* ============================================== */}

            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  СМС созламалари
                </h2>

                <p className="mt-0.5 text-xs text-gray-500">
                  Юбориш усули ва СМС
                  матнини созланг
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

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {settingsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-32" />
                </div>
              ) : (
                <>
                  {/* ======================================== */}
                  {/* PROVIDER */}
                  {/* ======================================== */}

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                      Юбориш усули
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ['eskiz', 'Эскиз'],
                          ['android', 'Android телефон'],
                        ] as Array<[SmsProvider, string]>
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            switchProvider(value)
                          }
                          className={cn(
                            'rounded-lg border px-3 py-2.5 text-sm font-medium transition',
                            provider === value
                              ? 'border-blue-600 bg-blue-600 text-white'
                              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {isAndroid && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                        СМС ўз телефонингиздаги SIM-картадан
                        юборилади. Телефонда SMSGate иловаси ишлаб
                        туриши керак: «Локальный сервер» режимида
                        компьютер билан бир Wi-Fi тармоғида,
                        «Облачный сервер» режимида эса интернетда.
                      </p>
                    )}
                  </div>

                  {/* ======================================== */}
                  {/* ANDROID ADDRESS */}
                  {/* ======================================== */}

                  {isAndroid && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">
                        Телефон манзили
                      </label>

                      <input
                        type="text"
                        value={androidUrl}
                        onChange={(event) =>
                          setAndroidUrl(
                            event.target.value,
                          )
                        }
                        placeholder="192.168.1.50:8080 ёки api.sms-gate.app:443"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />

                      <p className="mt-1.5 text-[11px] text-gray-500">
                        SMSGate иловасидаги сервер манзили («Адрес сервера»)
                      </p>
                    </div>
                  )}

                  {/* ======================================== */}
                  {/* LOGIN */}
                  {/* ======================================== */}

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                      {isAndroid
                        ? 'Логин (Username)'
                        : 'Эскиз логин'}
                    </label>

                    <input
                      type={
                        isAndroid
                          ? 'text'
                          : 'email'
                      }
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
                      placeholder={
                        isAndroid
                          ? 'SMSGate иловасидаги Username'
                          : 'Эскиз логин / электрон почта'
                      }
                      className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* ======================================== */}
                  {/* ESKIZ PASSWORD */}
                  {/* ======================================== */}

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                      {isAndroid
                        ? 'Парол (Password)'
                        : 'Эскиз парол'}
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
                            ? 'Сақланган паролни ўзгартириш учун киритинг'
                            : isAndroid
                              ? 'SMSGate иловасидаги Password'
                              : 'Эскиз пароли'
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
                        ✓ {providerName} пароли
                        сақланган
                      </p>
                    )}
                  </div>

                  {/* ======================================== */}
                  {/* SMS TEMPLATE */}
                  {/* ======================================== */}

                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-700">
                        СМС матни
                      </label>

                      <span className="text-[11px] text-gray-400">
                        {smsTemplate.length}{' '}
                        белги
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
                        Ўзгарувчилар:
                      </p>

                      <p>
                        <code className="rounded bg-white px-1 py-0.5">
                          {'{name}'}
                        </code>
                        {' '}
                        — мижоз
                        исми
                      </p>

                      <p>
                        <code className="rounded bg-white px-1 py-0.5">
                          {'{duty}'}
                        </code>
                        {' '}
                        — қарз
                        миқдори
                      </p>
                    </div>
                  </div>

                  {/* ======================================== */}
                  {/* AUTO SMS */}
                  {/* ======================================== */}

                  <div className="space-y-4 rounded-lg border border-gray-100 p-4">
                    <div className="text-xs font-semibold text-gray-900">
                      Автоматик СМС
                    </div>

                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={orderSmsEnabled}
                        onChange={(event) =>
                          setOrderSmsEnabled(
                            event.target.checked,
                          )
                        }
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      />

                      <span>
                        <span className="block text-sm font-medium text-gray-800">
                          Буюртма яратилганда мижозга СМС юбориш
                        </span>

                        <span className="block text-[11px] text-gray-500">
                          Фақат қарзи қолган буюртмалар учун юборилади.
                        </span>
                      </span>
                    </label>

                    {orderSmsEnabled && (
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="text-xs font-medium text-gray-700">
                            Буюртма СМС матни
                          </label>

                          <span className="text-[11px] text-gray-400">
                            {orderSmsTemplate.length}{' '}
                            белги
                          </span>
                        </div>

                        <textarea
                          value={orderSmsTemplate}
                          onChange={(event) =>
                            setOrderSmsTemplate(
                              event.target.value,
                            )
                          }
                          rows={4}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />

                        <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500">
                          <code>{'{name}'}</code> — мижоз исми,{' '}
                          <code>{'{debt}'}</code> — шу буюртма
                          бўйича қарз,{' '}
                          <code>{'{total}'}</code> — мижознинг
                          умумий қарзи.
                        </p>
                      </div>
                    )}

                    <label className="flex cursor-pointer items-start gap-2.5 border-t border-gray-100 pt-4">
                      <input
                        type="checkbox"
                        checked={reminderEnabled}
                        onChange={(event) =>
                          setReminderEnabled(
                            event.target.checked,
                          )
                        }
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      />

                      <span>
                        <span className="block text-sm font-medium text-gray-800">
                          Қарздорларга даврий эслатма юбориш
                        </span>

                        <span className="block text-[11px] text-gray-500">
                          Юқоридаги «СМС матни» юборилади. Дастур
                          очиқ турганда, соат 9:00–20:00 оралиғида
                          ишлайди.
                        </span>
                      </span>
                    </label>

                    {reminderEnabled && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        Ҳар
                        <input
                          type="number"
                          min={1}
                          max={365}
                          step={1}
                          value={reminderDays}
                          onChange={(event) =>
                            setReminderDays(
                              Number(
                                event.target.value,
                              ) || 0,
                            )
                          }
                          className="w-20 rounded-lg border border-gray-200 px-3 py-2 text-center text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                        кунда бир марта
                      </div>
                    )}
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
                      ? 'Текширилмоқда...'
                      : isAndroid
                        ? 'Телефонга уланишни текшириш'
                        : 'Эскиз аккаунтини текшириш'}
                  </button>

                  {eskizConnected && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2.5 text-xs text-green-700">
                      <CheckCircle2
                        size={15}
                      />

                      {isAndroid
                        ? 'Телефон'
                        : 'Эскиз аккаунти'}{' '}
                      муваффақиятли
                      уланди
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
                Бекор қилиш
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

                Сақлаш
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}