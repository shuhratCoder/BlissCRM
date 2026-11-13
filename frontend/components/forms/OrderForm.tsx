'use client'
// components/forms/OrderForm.tsx
// Local CRM order creation form.
// Data source: local desktop CRM backend -> SQLite.
// Endpoint: POST /crm/createOrder

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ExternalLink,
  UserPlus,
} from 'lucide-react'

import { ClientModal } from '@/components/forms/ClientModal'

import {
  useClients,
  useCreateOrder,
  type OrderTypeGet,
} from '@/hooks'

import {
  formatCurrency,
  formatPhone,
} from '@/lib/api'

import { useUIStore } from '@/store'
import { useT } from '@/lib/i18n'

import {
  Button,
  Input,
  Textarea,
  Select,
  PageHeader,
  Combobox,
} from '@/components/ui'

import { cn } from '@/lib/utils'

// ============================================================
// TYPES
// ============================================================

type PaymentMode =
  | 'full'
  | 'partial'

interface FormErrors {
  client?: string
  amount?: string
  deadline?: string
  method?: string
  global?: string
}

// ============================================================
// HELPERS
// ============================================================

function todayIsoDate(): string {
  const date = new Date()

  const year =
    date.getFullYear()

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0')

  const day = String(
    date.getDate(),
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}

// ============================================================
// ORDER FORM
// ============================================================

export default function OrderForm() {
  const router = useRouter()

  const { t } = useT()

  const addToast =
    useUIStore(
      (state) => state.addToast,
    )

  // ----------------------------------------------------------
  // LOCAL CRM DATA
  // ----------------------------------------------------------

  const {
    data: clients,
  } = useClients()

  const createOrder =
    useCreateOrder()

  // ----------------------------------------------------------
  // FORM STATE
  // ----------------------------------------------------------

  const [
    servicePrice,
    setServicePrice,
  ] = React.useState<number>(0)

  const [
    clientId,
    setClientId,
  ] = React.useState<string>('')

  const [
    newClientOpen,
    setNewClientOpen,
  ] = React.useState(false)

  const [
    description,
    setDescription,
  ] = React.useState<string>('')

  const [
    paymentMode,
    setPaymentMode,
  ] = React.useState<PaymentMode>(
    'full',
  )

  const [
    paidNow,
    setPaidNow,
  ] = React.useState<number>(0)

  const [
    deadline,
    setDeadline,
  ] = React.useState<string>('')

  const [
    typeGet,
    setTypeGet,
  ] = React.useState<OrderTypeGet>(
    'cash',
  )

  const [
    errors,
    setErrors,
  ] = React.useState<FormErrors>({})

  const [
    submitting,
    setSubmitting,
  ] = React.useState(false)

  // ==========================================================
  // CALCULATIONS
  // ==========================================================

  const total =
    Number(servicePrice) || 0

  const effectivePaid =
    paymentMode === 'full'
      ? total
      : Number(paidNow) || 0

  const remainingDebt =
    Math.max(
      0,
      total - effectivePaid,
    )

  // ==========================================================
  // SELECTED CLIENT
  // ==========================================================

  const client =
    clients?.find(
      (item) =>
        item.id === clientId,
    )

  const clientExistingDebt =
    client?.totalDebt ?? 0

  // ==========================================================
  // SUBMIT
  // ==========================================================

  async function onSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault()

    const newErrors: FormErrors = {}

    // --------------------------------------------------------
    // CLIENT VALIDATION
    // --------------------------------------------------------

    if (!clientId) {
      newErrors.client =
        t('val.chooseClient')
    }

    // --------------------------------------------------------
    // PAYMENT METHOD VALIDATION
    // --------------------------------------------------------

    if (!typeGet) {
      newErrors.method =
        t('val.chooseMethod')
    }

    // --------------------------------------------------------
    // PRICE VALIDATION
    // --------------------------------------------------------

    if (
      !servicePrice ||
      servicePrice <= 0
    ) {
      newErrors.global =
        t('orderForm.emptyOrder')
    }

    // --------------------------------------------------------
    // PARTIAL PAYMENT VALIDATION
    // --------------------------------------------------------

    if (
      paymentMode === 'partial'
    ) {
      if (
        paidNow < 0 ||
        paidNow > total
      ) {
        newErrors.amount =
          t(
            'orderForm.paidGtTotal',
          )
      }

      // Муддат ихтиёрий; киритилган бўлса, ўтган сана бўлмаслиги керак
      if (
        remainingDebt > 0 &&
        deadline
      ) {
        if (
          deadline <
          todayIsoDate()
        ) {
          newErrors.deadline =
            t(
              'val.deadlinePast',
            )
        }
      }
    }

    // --------------------------------------------------------
    // STOP IF VALIDATION FAILED
    // --------------------------------------------------------

    if (
      Object.keys(
        newErrors,
      ).length > 0
    ) {
      setErrors(
        newErrors,
      )

      return
    }

    setErrors({})

    // --------------------------------------------------------
    // ORDER STATUS
    // --------------------------------------------------------

    const status:
      | 'debt'
      | 'existent' =
      remainingDebt > 0
        ? 'debt'
        : 'existent'

    // --------------------------------------------------------
    // CREATE LOCAL ORDER
    // --------------------------------------------------------

    setSubmitting(true)

    try {
      await createOrder.mutateAsync({
        clientId,

        serviceFee:
          Number(
            servicePrice,
          ) || 0,

        productsPrice: 0,

        description:
          description ?? '',

        products: [],
        status,

        receivedAmount:
          effectivePaid,

        typeGet,

        ...(
          status === 'debt' &&
          deadline
            ? {
                deadline,
              }
            : {}
        ),
      })

      router.push('/orders')
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t(
              'errors.generic',
            )

      addToast({
        type: 'error',
        title: message,
      })
    } finally {
      setSubmitting(false)
    }
  }

  // ==========================================================
  // CLIENT OPTIONS
  // ==========================================================

  const clientOptions =
    React.useMemo(() => {
      const list =
        (clients ?? [])
          .slice()
          .sort(
            (a, b) =>
              (
                a.name ?? ''
              ).localeCompare(
                b.name ?? '',
                undefined,
                {
                  sensitivity:
                    'base',
                },
              ),
          )

      return list.map(
        (clientItem) => {
          const debt =
            clientItem.totalDebt ?? 0

          const formattedPhone =
            formatPhone(
              clientItem.phone,
            )

          const hintParts =
            [
              formattedPhone,
            ].filter(
              Boolean,
            ) as string[]

          if (debt > 0) {
            hintParts.push(
              t(
                'orderForm.customerDebt',
                {
                  amount:
                    formatCurrency(
                      debt,
                    ),
                },
              ),
            )
          }

          return {
            value:
              clientItem.id,

            label:
              clientItem.name ?? '',

            hint:
              hintParts.join(
                '  •  ',
              ),
          }
        },
      )
    }, [
      clients,
      t,
    ])

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="max-w-5xl space-y-5">

      {/* ==================================================== */}
      {/* PAGE HEADER */}
      {/* ==================================================== */}

      <PageHeader
        title={t(
          'orderForm.newTitle',
        )}
        description={t(
          'orderForm.desc',
        )}
      />

      <form
        onSubmit={onSubmit}
        className="space-y-5"
      >

        {/* ================================================== */}
        {/* PRICE */}
        {/* ================================================== */}

        <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-2">

          <Input
            label={t(
              'orderForm.servicePrice',
            )}
            type="number"
            step="0.01"
            min={0}
            placeholder="0"
            hint={t(
              'orderForm.servicePriceHint',
            )}
            value={
              servicePrice || ''
            }
            onChange={(
              event,
            ) =>
              setServicePrice(
                Number(
                  event.target.value,
                ) || 0,
              )
            }
          />

          {errors.global && (
            <p className="text-xs text-red-600">
              {errors.global}
            </p>
          )}
        </section>

        {/* ================================================== */}
        {/* CLIENT */}
        {/* ================================================== */}

        <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">

          <h3 className="text-sm font-semibold text-gray-700">
            {t(
              'orderForm.client',
            ).replace(
              ' *',
              '',
            )}
          </h3>

          <Combobox
            label={t(
              'orderForm.client',
            )}
            placeholder={t(
              'orderForm.clientPh',
            )}
            emptyText={t(
              'payments.searchEmpty',
            )}
            options={
              clientOptions
            }
            value={clientId}
            onChange={(
              value,
            ) =>
              setClientId(
                value,
              )
            }
            error={
              errors.client
            }
          />

          <button
            type="button"
            onClick={() =>
              setNewClientOpen(true)
            }
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <UserPlus size={15} />
            {t(
              'customerForm.newTitle',
            )}
          </button>

          <ClientModal
            open={newClientOpen}
            onClose={() =>
              setNewClientOpen(false)
            }
            mode="create"
            onCreated={(created) =>
              setClientId(created.id)
            }
          />

          {client &&
            clientExistingDebt > 0 && (
              <Link
                href={`/customers/${client.id}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100/70 transition-colors"
              >

                <span className="text-sm">
                  {t(
                    'orderForm.customerDebt',
                    {
                      amount:
                        formatCurrency(
                          clientExistingDebt,
                        ),
                    },
                  )}
                </span>

                <span className="inline-flex items-center gap-1 text-xs font-medium">
                  {t(
                    'orderForm.viewCustomer',
                  )}

                  <ExternalLink
                    size={12}
                  />
                </span>
              </Link>
            )}

          <Textarea
            label={t(
              'orderForm.comment',
            )}
            placeholder={t(
              'orderForm.commentPh',
            )}
            rows={3}
            value={
              description
            }
            onChange={(
              event,
            ) =>
              setDescription(
                event.target.value,
              )
            }
          />
        </section>

        {/* ================================================== */}
        {/* PAYMENT */}
        {/* ================================================== */}

        <section className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">

          <h3 className="text-sm font-semibold text-gray-700">
            {t(
              'orderForm.payment',
            )}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-stretch">

            <ModeButton
              active={
                paymentMode ===
                'full'
              }
              label={t(
                'orderForm.paymentModeFull',
              )}
              onClick={() => {
                setPaymentMode(
                  'full',
                )

                setPaidNow(
                  total,
                )
              }}
            />

            <ModeButton
              active={
                paymentMode ===
                'partial'
              }
              label={t(
                'orderForm.paymentModePartial',
              )}
              onClick={() =>
                setPaymentMode(
                  'partial',
                )
              }
            />

            {paymentMode ===
              'full' && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2 flex items-center justify-between gap-4 min-w-[180px]">

                <span className="text-[11px] uppercase tracking-wide text-emerald-700/80 font-medium">
                  {t(
                    'orderForm.paidNow',
                  ).replace(
                    ' *',
                    '',
                  )}
                </span>

                <span className="text-lg font-bold text-emerald-700 whitespace-nowrap">
                  {formatCurrency(
                    total,
                  )}
                </span>
              </div>
            )}
          </div>

          {paymentMode ===
            'partial' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <Input
                label={t(
                  'orderForm.paidNow',
                )}
                type="number"
                step={1}
                min={0}
                max={total}
                inputMode="numeric"
                placeholder="0"
                value={
                  paidNow
                }
                onFocus={(
                  event,
                ) =>
                  event.target.select()
                }
                onChange={(
                  event,
                ) =>
                  setPaidNow(
                    Number(
                      event.target.value,
                    ) || 0,
                  )
                }
                onKeyDown={(
                  event,
                ) => {
                  if (
                    event.key ===
                      '.' ||
                    event.key ===
                      ',' ||
                    event.key ===
                      'e' ||
                    event.key ===
                      '-'
                  ) {
                    event.preventDefault()
                  }
                }}
                error={
                  errors.amount
                }
              />

              <div className="bg-red-50/60 border border-red-100 rounded-lg p-3 text-sm flex flex-col justify-center">

                <span className="text-[11px] uppercase tracking-wide text-red-700/80">
                  {t(
                    'orderForm.remainingDebt',
                  )}
                </span>

                <span className="text-lg font-semibold text-red-700">
                  {formatCurrency(
                    remainingDebt,
                  )}
                </span>
              </div>

              {remainingDebt >
                0 && (
                <Input
                  label={t(
                    'orderForm.deadline',
                  )}
                  type="date"
                  min={
                    todayIsoDate()
                  }
                  value={
                    deadline
                  }
                  onChange={(
                    event,
                  ) =>
                    setDeadline(
                      event.target.value,
                    )
                  }
                  error={
                    errors.deadline
                  }
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <Select
              label={t(
                'orderForm.method',
              )}
              options={[
                {
                  value: 'cash',
                  label:
                    t(
                      'payments.methodCash',
                    ),
                },
                {
                  value: 'card',
                  label:
                    t(
                      'payments.methodCard',
                    ),
                },
                {
                  value:
                    'transfer',
                  label:
                    t(
                      'payments.methodTransfer',
                    ),
                },
              ]}
              value={typeGet}
              onChange={(
                event,
              ) =>
                setTypeGet(
                  event.target
                    .value as OrderTypeGet,
                )
              }
              error={
                errors.method
              }
            />
          </div>
        </section>

        {/* ================================================== */}
        {/* ACTIONS */}
        {/* ================================================== */}

        <div className="flex items-center gap-3">

          <Button
            type="submit"
            loading={
              submitting
            }
          >
            {t(
              'orderForm.submitNew',
            )}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              router.push(
                '/orders',
              )
            }
          >
            {t(
              'common.cancel',
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

// ============================================================
// MODE BUTTON
// ============================================================

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors',

        active
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50',
      )}
    >
      {label}
    </button>
  )
}
