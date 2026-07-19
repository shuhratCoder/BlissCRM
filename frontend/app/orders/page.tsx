'use client'
// app/orders/page.tsx
// Local CRM orders list.
// Data source: local desktop CRM backend -> SQLite.

import React from 'react'
import Link from 'next/link'
import { Plus, ShoppingCart } from 'lucide-react'

import { useOrders } from '@/hooks'
import { useOrderFilter } from '@/store'
import { formatCurrency, formatDate } from '@/lib/api'
import { useT } from '@/lib/i18n'

import {
  Button,
  Input,
  Select,
  PageHeader,
  Pagination,
  EmptyState,
  Skeleton,
  Drawer,
} from '@/components/ui'

import {
  MebelOrderDetailsView,
  orderDebt,
  orderPaid,
  orderTotal,
} from '@/components/MebelOrderDetailsView'

import type { ClientOrder } from '@/types'

export default function OrdersPage() {
  const { t } = useT()

  const {
    filter,
    setFilter,
  } = useOrderFilter()

  const {
    data: orders,
    isLoading,
  } = useOrders()

  const [
    selectedOrder,
    setSelectedOrder,
  ] = React.useState<ClientOrder | null>(
    null,
  )

  // ==========================================================
  // ORDER NUMBER
  //
  // Buyurtmalar eski -> yangi tartibda raqamlanadi.
  //
  // Masalan:
  // birinchi order  -> #1
  // ikkinchi order -> #2
  // ==========================================================

  const ordinalById = React.useMemo(() => {
    const sorted = [...(orders ?? [])].sort(
      (a, b) => {
        const ta = a.createdAt
          ? new Date(a.createdAt).getTime()
          : 0

        const tb = b.createdAt
          ? new Date(b.createdAt).getTime()
          : 0

        return ta - tb
      },
    )

    const map = new Map<string, number>()

    sorted.forEach((order, index) => {
      map.set(order.id, index + 1)
    })

    return map
  }, [orders])

  // ==========================================================
  // FILTER
  // ==========================================================

  const filtered = React.useMemo(() => {
    if (!orders) {
      return []
    }

    // "#1" yoki "1" bilan qidirish mumkin.
    const query = (
      filter.search ?? ''
    )
      .trim()
      .toLowerCase()
      .replace(/^#/, '')

    const list = orders.filter((order) => {
      // ------------------------------------------------------
      // PAYMENT FILTER
      // ------------------------------------------------------

      const paymentFilter =
        filter.payment ?? 'all'

      if (paymentFilter !== 'all') {
        const isDebtor =
          orderDebt(order) > 0

        if (
          paymentFilter === 'debtor' &&
          !isDebtor
        ) {
          return false
        }

        if (
          paymentFilter === 'paid' &&
          isDebtor
        ) {
          return false
        }
      }

      // ------------------------------------------------------
      // SEARCH FILTER
      // ------------------------------------------------------

      if (query) {
        const ordinal =
          ordinalById.get(order.id)

        const clientName =
          order.Client?.name ?? ''

        const searchableText =
          `${ordinal ?? ''} ${clientName}`
            .toLowerCase()

        if (
          !searchableText.includes(query)
        ) {
          return false
        }
      }

      return true
    })

    // Yangi orderlar tepada.
    return list.slice().sort((a, b) => {
      const ta = a.createdAt
        ? new Date(a.createdAt).getTime()
        : 0

      const tb = b.createdAt
        ? new Date(b.createdAt).getTime()
        : 0

      return tb - ta
    })
  }, [
    orders,
    filter.search,
    filter.payment,
    ordinalById,
  ])

  // ==========================================================
  // PAGINATION
  // ==========================================================

  const pageSize =
    filter.pageSize ?? 10

  const page =
    filter.page ?? 1

  const totalPages = Math.max(
    1,
    Math.ceil(
      filtered.length / pageSize,
    ),
  )

  const visible = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize,
  )

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="space-y-5">

      {/* ==================================================== */}
      {/* PAGE HEADER */}
      {/* ==================================================== */}

      <PageHeader
        title={t('orders.title')}
        description={t(
          'orders.count',
          {
            n: filtered.length,
          },
        )}
        actions={
          <Link href="/orders/new">
            <Button size="sm">
              <Plus size={14} />

              {t('orders.addBtn')}
            </Button>
          </Link>
        }
      />

      {/* ==================================================== */}
      {/* FILTERS */}
      {/* ==================================================== */}

      <div className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 sm:items-end">

        {/* SEARCH */}

        <div className="flex-1 sm:min-w-56">
          <Input
            placeholder={t(
              'orders.searchPh',
            )}
            value={
              filter.search ?? ''
            }
            onChange={(event) =>
              setFilter({
                search:
                  event.target.value,

                page: 1,
              })
            }
          />
        </div>

        {/* PAYMENT FILTER */}

        <div className="w-full sm:w-56">
          <Select
            value={
              filter.payment ?? 'all'
            }
            options={[
              {
                value: 'all',
                label: t(
                  'orders.filterAll',
                ),
              },
              {
                value: 'debtor',
                label: t(
                  'orders.filterDebtors',
                ),
              },
              {
                value: 'paid',
                label: t(
                  'orders.filterPaid',
                ),
              },
            ]}
            onChange={(event) =>
              setFilter({
                payment:
                  event.target.value as
                    | 'all'
                    | 'debtor'
                    | 'paid',

                page: 1,
              })
            }
          />
        </div>
      </div>

      {/* ==================================================== */}
      {/* ORDERS TABLE */}
      {/* ==================================================== */}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">

        <div className="overflow-x-auto">

          <table className="w-full text-sm">

            {/* ============================================== */}
            {/* TABLE HEADER */}
            {/* ============================================== */}

            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">

                <th className="px-4 py-3 text-left">
                  {t(
                    'orders.colNumber',
                  )}
                </th>

                <th className="px-4 py-3 text-left">
                  {t(
                    'orders.colDate',
                  )}
                </th>

                <th className="px-4 py-3 text-left">
                  {t(
                    'orders.colClient',
                  )}
                </th>

                <th className="px-4 py-3 text-right">
                  {t(
                    'orders.colTotal',
                  )}
                </th>

                <th className="px-4 py-3 text-right">
                  {t(
                    'orders.colPaid',
                  )}
                </th>

                <th className="px-4 py-3 text-right">
                  {t(
                    'orders.colDebt',
                  )}
                </th>

                <th className="px-4 py-3 text-left">
                  {t(
                    'orders.colDeadline',
                  )}
                </th>

                <th className="px-4 py-3 text-left">
                  {t(
                    'orders.colComment',
                  )}
                </th>
              </tr>
            </thead>

            {/* ============================================== */}
            {/* TABLE BODY */}
            {/* ============================================== */}

            <tbody className="divide-y divide-gray-50">

              {/* ============================================ */}
              {/* LOADING */}
              {/* ============================================ */}

              {isLoading &&
                Array.from({
                  length: 8,
                }).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array.from({
                      length: 8,
                    }).map(
                      (
                        __,
                        columnIndex,
                      ) => (
                        <td
                          key={
                            columnIndex
                          }
                          className="px-4 py-3"
                        >
                          <Skeleton className="h-4" />
                        </td>
                      ),
                    )}
                  </tr>
                ))}

              {/* ============================================ */}
              {/* EMPTY STATE */}
              {/* ============================================ */}

              {!isLoading &&
                visible.length === 0 && (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        icon={
                          <ShoppingCart
                            size={36}
                          />
                        }
                        title={t(
                          'orders.empty',
                        )}
                        action={
                          <Link href="/orders/new">
                            <Button size="sm">
                              <Plus
                                size={14}
                              />

                              {t(
                                'orders.addBtn',
                              )}
                            </Button>
                          </Link>
                        }
                      />
                    </td>
                  </tr>
                )}

              {/* ============================================ */}
              {/* ORDERS */}
              {/* ============================================ */}

              {!isLoading &&
                visible.map((order) => {

                  const total =
                    orderTotal(order)

                  const paid =
                    orderPaid(order)

                  const debt =
                    Math.max(
                      0,
                      total - paid,
                    )

                  const ordinal =
                    ordinalById.get(
                      order.id,
                    ) ?? 0

                  const client =
                    order.Client

                  const deadline =
                    order.Deadline
                      ?.deadline

                  return (
                    <tr
                      key={order.id}
                      onClick={() =>
                        setSelectedOrder(
                          order,
                        )
                      }
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    >

                      {/* ORDER NUMBER */}

                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        #{ordinal}
                      </td>

                      {/* CREATED DATE */}

                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {order.createdAt
                          ? formatDate(
                              order.createdAt,
                            )
                          : t(
                              'common.dash',
                            )}
                      </td>

                      {/* CLIENT */}

                      <td
                        className="px-4 py-3"
                        onClick={(event) =>
                          event.stopPropagation()
                        }
                      >
                        {client ? (
                          <Link
                            href={`/customers/${client.id}`}
                            className="text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {
                              client.name
                            }
                          </Link>
                        ) : (
                          <span className="text-gray-400">
                            {t(
                              'common.dash',
                            )}
                          </span>
                        )}
                      </td>

                      {/* TOTAL */}

                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatCurrency(
                          total,
                        )}
                      </td>

                      {/* PAID */}

                      <td className="px-4 py-3 text-right text-emerald-600">
                        {formatCurrency(
                          paid,
                        )}
                      </td>

                      {/* DEBT */}

                      <td className="px-4 py-3 text-right">
                        {debt > 0 ? (
                          <span className="text-red-600 font-medium">
                            {formatCurrency(
                              debt,
                            )}
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            0
                          </span>
                        )}
                      </td>

                      {/* DEADLINE */}

                      <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                        {debt > 0 &&
                        deadline ? (
                          formatDate(
                            deadline,
                          )
                        ) : (
                          <span className="text-gray-400">
                            {t(
                              'common.dash',
                            )}
                          </span>
                        )}
                      </td>

                      {/* COMMENT */}

                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[14rem]">
                        {order.description ? (
                          <span
                            className="block truncate"
                            title={
                              order.description
                            }
                          >
                            {
                              order.description
                            }
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            {t(
                              'common.dash',
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        {/* ================================================== */}
        {/* PAGINATION */}
        {/* ================================================== */}

        {filtered.length > 0 && (
          <div className="border-t border-gray-100 px-4">
            <Pagination
              page={page}
              totalPages={
                totalPages
              }
              total={
                filtered.length
              }
              pageSize={
                pageSize
              }
              onPageChange={(
                newPage,
              ) =>
                setFilter({
                  page: newPage,
                })
              }
              onPageSizeChange={(
                newPageSize,
              ) =>
                setFilter({
                  pageSize:
                    newPageSize,

                  page: 1,
                })
              }
            />
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* ORDER DETAILS DRAWER */}
      {/* ==================================================== */}

      <Drawer
        open={
          !!selectedOrder
        }
        onClose={() =>
          setSelectedOrder(null)
        }
        title={
          selectedOrder
            ? `${t(
                'orderDetails.title',
              )} #${
                ordinalById.get(
                  selectedOrder.id,
                ) ?? ''
              }`
            : t(
                'orderDetails.title',
              )
        }
        width="md"
      >
        {selectedOrder && (
          <MebelOrderDetailsView
            order={selectedOrder}
          />
        )}
      </Drawer>
    </div>
  )
}