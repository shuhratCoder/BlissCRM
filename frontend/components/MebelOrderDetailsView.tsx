'use client'
// components/MebelOrderDetailsView.tsx — Drawer body for a single order from
// the new mebel backend (GET /getOrders, GET /getClients-embedded).

import React from 'react'
import { useProducts } from '@/hooks'
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from '@/lib/api'
import { useT } from '@/lib/i18n'
import type { ClientOrder, ClientPayment, Product, ProductUnit } from '@/types'
import { cn } from '@/lib/utils'

export function orderTotal(o: ClientOrder): number {
  return (o.serviceFee ?? 0) + (o.productsPrice ?? 0)
}

export function orderPaid(o: ClientOrder): number {
  return (o.Payments ?? []).reduce(
    (s, p) => s + (Number(p.receivedAmount) || 0),
    0,
  )
}

export function orderDebt(o: ClientOrder): number {
  return Math.max(0, orderTotal(o) - orderPaid(o))
}

function paymentMethodLabel(
  t: (k: string) => string,
  type: ClientPayment['typeGet'],
): string {
  switch (type) {
    case 'cash':
      return t('payments.methodCash')
    case 'card':
      return t('payments.methodCard')
    case 'transfer':
      return t('payments.methodTransfer')
    default:
      return type ?? ''
  }
}

function unitLabel(t: (k: string) => string, u?: ProductUnit): string {
  if (!u) return ''
  return t(`inventory.unit.${u}`)
}

export interface MebelOrderDetailsViewProps {
  order: ClientOrder
}

export function MebelOrderDetailsView({ order }: MebelOrderDetailsViewProps) {
  const { t } = useT()
  const { data: products } = useProducts()
  const [isPrinting, setIsPrinting] = React.useState(false)

  const productById = React.useMemo(() => {
    const m = new Map<string, Product>()
    for (const p of products ?? []) m.set(p.id, p)
    return m
  }, [products])

  const total = orderTotal(order)
  const paid = orderPaid(order)
  const debt = Math.max(0, total - paid)

  const payments = React.useMemo(
    () =>
      [...(order.Payments ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [order.Payments],
  )

  // Remaining debt right after each payment (oldest → newest scan).
  const remainingAfter = React.useMemo(() => {
    const m = new Map<string, number>()
    let running = total
    for (let i = payments.length - 1; i >= 0; i--) {
      const p = payments[i]
      running = Math.max(0, running - (Number(p.receivedAmount) || 0))
      m.set(p.id, running)
    }
    return m
  }, [payments, total])

  // CHOP ETISH FUNKSIYASI (BACKEND API BILAN BOG'LANISH)
   const handlePrintReceipt = async () => {
    try {
      if (!order) {
        alert("Buyurtma ma'lumotlari topilmadi!");
        return;
      }

      // 1. Sozlamalar sahifasidagi localStorage kalitlari bilan 100% moslashtirilgan qism
      const savedPrinter = localStorage.getItem('selected_printer') || 'XP-80';
      const companyName = localStorage.getItem('printer_company_name') || 'BLISS MEBEL';
      const companyPhone = localStorage.getItem('printer_phone') || '';
      const companyDescription = localStorage.getItem('printer_company_description') || localStorage.getItem('company_description') || 'Sifatli mebellar maskani';
      const companyAddress = localStorage.getItem('printer_company_address') || localStorage.getItem('company_address') || '';
      const thanksMessage = localStorage.getItem('printer_thanks_message') || localStorage.getItem('thanks_message') || 'Xaridingiz uchun rahmat!';

      // 2. Mijoz ID raqami o'rniga uning to'liq ismini aniq o'qib olish
      const customerName = (order as any).Client?.name || (order as any).client?.name || order.clientId || "Mijoz ismi yo'q";

      let itemsHtml = "";
      order.products.forEach((it) => {
        const product = productById.get(it.productId);
        const name = product?.name || `Mahsulot #${it.productId.slice(0, 8)}`;
        const price = (Number(product?.price) || 0).toLocaleString('uz-UZ');
        const itemTotal = (Number(product?.price) || 0) * (Number(it.amount) || 1);
        
        itemsHtml += `
          <tr>
            <td style="padding: 4px 0; font-size: 11px; max-width: 140px; word-break: break-word;">
              <b>${name}</b><br>
              <small>${it.amount || 1} x ${price}</small>
            </td>
            <td style="text-align: right; vertical-align: bottom; font-size: 11px; white-space: nowrap; font-weight: bold;">
              ${itemTotal.toLocaleString('uz-UZ')} UZS
            </td>
          </tr>
        `;
      });

      // 3. 80mm Xprinter uchun mukammal sozlangan, pastki qismi kesilmaydigan HTML shablon
      const receiptHtml = `
        <html>
        <head>
          <style>
            @page { margin: 0; size: 80mm auto; }
            body { 
              width: 255px; 
              font-family: 'Courier New', Courier, monospace; 
              font-size: 11px; 
              margin: 0; 
              padding: 4px 8px 40px 4px; /* Yozuvlar pichoq ostida qolib xira bo'lmasligi uchun padding */
              color: #000;
              line-height: 1.2;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .line { border-top: 1px dashed #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; }
            .bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <h3 class="center" style="margin: 0 0 2px 0; font-size: 14px;">${companyName}</h3>
          ${companyDescription ? `<p class="center" style="margin: 0 0 2px 0; font-size: 10px;">${companyDescription}</p>` : ''}
          ${companyPhone ? `<p class="center" style="margin: 0 0 2px 0; font-size: 10px;">Tel: ${companyPhone}</p>` : ''}
          ${companyAddress ? `<p class="center" style="margin: 0 0 4px 0; font-size: 10px;">${companyAddress}</p>` : ''}
          
          <div class="line"></div>
          
          <div style="font-size: 10px;">
            <div><b>Sana:</b> ${new Date().toLocaleString('uz-UZ')}</div>
            <div><b>Chek №:</b> #${order.id ? order.id.slice(0, 8).toUpperCase() : 'NOMA\'LUM'}</div>
            <div style="word-break: break-all;"><b>Mijoz:</b> <span class="bold">${customerName}</span></div>
          </div>
          
          <div class="line"></div>
          <div class="center" style="font-size: 10px; margin: 4px 0;"><b>XARIDLAR RO'YXATI</b></div>
          
          <table>
            <tbody>${itemsHtml}</tbody>
          </table>
          
          <div class="line"></div>
          
          <table style="width: 100%; font-size: 11px;">
            <tr><td>Mahsulotlar:</td><td class="right">${(order.productsPrice || 0).toLocaleString('uz-UZ')} so'm</td></tr>
            <tr><td>Xizmat haqi:</td><td class="right">${(order.serviceFee || 0).toLocaleString('uz-UZ')} so'm</td></tr>
            <tr class="bold" style="font-size: 12px;"><td>UMUMIY SUMMA:</td><td class="right">${total.toLocaleString('uz-UZ')} so'm</td></tr>
          </table>
          
          <div class="line"></div>
          
          <table style="width: 100%; font-size: 10px;">
            <tr><td>To'langan:</td><td class="right">${paid.toLocaleString('uz-UZ')} so'm</td></tr>
            ${debt > 0 ? `<tr class="bold" style="color: red;"><td>QARZ MIQDORI:</td><td class="right">${debt.toLocaleString('uz-UZ')} so'm</td></tr>` : ''}
          </table>
          
          <div class="line"></div>
          
          <p class="center" style="font-size: 11px; margin: 8px 0 0 0; font-weight: bold;">${thanksMessage}</p>
          
          <!-- Printer avtomatik qirqqanda oxirgi satrlar xiralashib ichkarida qolmasligi uchun bo'shliq -->
          <br><br><br><br>
        </body>
        </html>
      `;

      // 4. Qat'iy Electron IPC oqimi (window.open zaxirasi butunlay olib tashlandi)
      const globalWindow = window as any;
      let ipc: any = null;

      try {
        if (globalWindow.electron && globalWindow.electron.ipcRenderer) {
          ipc = globalWindow.electron.ipcRenderer;
        } else if (globalWindow.ipcRenderer) {
          ipc = globalWindow.ipcRenderer;
        } else if (globalWindow.require) {
          ipc = globalWindow.require('electron').ipcRenderer;
        }
      } catch (e) {
        console.error("IPC yuklashda zanjirli xato:", e);
      }

      if (ipc && typeof ipc.send === 'function') {
        // Ma'lumotlarni jimgina (silent) asosiy jarayonga uzatamiz
        ipc.send('print-silent', receiptHtml, savedPrinter);
      } else {
        console.error("Electron drayveri aniqlanmadi!");
        alert("Printer ulanish drayveri xatosi! Ilovani o'chirib qayta yoqing.");
      }

    } catch (error) {
      console.error("Chop etishda kutilmagan xatolik:", error);
      alert("Xatolik yuz berdi!");
    }
  };




  return (
    <div className="space-y-5 text-sm">
      {/* CHOP ETISH TUGMASI (Oson ko'rinishi uchun eng tepaga joylashtirildi) */}
      <div className="flex justify-end pt-1">
        <button
          onClick={handlePrintReceipt}
          disabled={isPrinting}
          className={cn(
            "w-full py-2.5 px-4 rounded-lg font-medium text-white transition flex items-center justify-center gap-2",
            isPrinting 
              ? "bg-gray-400 cursor-not-allowed" 
              : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-sm"
          )}
        >
          {isPrinting ? "Chop etilmoqda..." : "Chekni Chop Etish 🖨️"}
        </button>
      </div>

      <DetailRow
        label={t('orderDetails.createdAt')}
        value={order.createdAt ? formatDateTime(order.createdAt) : t('common.dash')}
      />

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          {t('orderDetails.items')}
        </h4>
        {order.products.length === 0 ? (
          <p className="text-xs text-gray-400 italic">{t('orderDetails.noItems')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {order.products.map((it, i) => {
              const product = productById.get(it.productId)
              const unit = unitLabel(t, product?.unit)
              return (
                <li
                  key={i}
                  className="px-3 py-2 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {product?.name ?? `#${it.productId.slice(0, 8)}`}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {it.amount} {unit && <span>{unit}</span>}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="bg-gray-50/70 border border-gray-100 rounded-lg p-4 space-y-2">
        <DetailRow
          label={t('orderDetails.itemsSubtotal')}
          value={formatCurrency(order.productsPrice ?? 0)}
        />
        <DetailRow
          label={t('orderDetails.servicePrice')}
          value={formatCurrency(order.serviceFee ?? 0)}
        />
        <div className="border-t border-gray-200 my-1" />
        <DetailRow
          label={t('orderDetails.grandTotal')}
          value={formatCurrency(total)}
          bold
        />
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          {t('orderDetails.paymentHistory')}
        </h4>
        {payments.length === 0 ? (
          <p className="text-xs text-gray-400 italic">{t('orderDetails.noPayments')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            {payments.map((p) => {
              const remaining = remainingAfter.get(p.id) ?? 0
              return (
                <li key={p.id} className="px-3 py-2.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-emerald-700">
                        {formatCurrency(p.receivedAmount)}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {formatDateTime(p.createdAt)} · {paymentMethodLabel(t, p.typeGet)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400">
                        {t('orderDetails.remainingAfter')}
                      </p>
                      <p
                        className={cn(
                          'text-sm font-medium',
                          remaining > 0 ? 'text-red-600' : 'text-emerald-700',
                        )}
                      >
                        {formatCurrency(remaining)}
                      </p>
                    </div>
                  </div>
                  {p.description && (
                    <p className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded px-2 py-1.5">
                      {p.description}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-3 space-y-2">
          <DetailRow
            label={t('orderDetails.paid')}
            value={formatCurrency(paid)}
            tone={paid > 0 ? 'emerald' : 'gray'}
            bold
          />
          {debt > 0 && (
            <>
              <DetailRow
                label={t('orderDetails.debt')}
                value={formatCurrency(debt)}
                tone="red"
                bold
              />
              {order.Deadline?.deadline && (
                <DetailRow
                  label={t('orderDetails.deadline')}
                  value={formatDate(order.Deadline.deadline)}
                  tone="red"
                />
              )}
            </>
          )}
        </div>
      </section>

      {order.description && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            {t('orderDetails.comment')}
          </h4>
          <p className="text-sm text-gray-700 bg-amber-50/60 border border-amber-100 rounded-lg p-3 whitespace-pre-wrap">
            {order.description}
          </p>
        </section>
      )}
    </div>
  )
}

function DetailRow({
  label,
  value,
  tone = 'gray',
  bold,
}: {
  label: string
  value: string
  tone?: 'gray' | 'red' | 'emerald'
  bold?: boolean
}) {
  return (<label><span className={cn('text-sm', tone === 'red' && 'text-red-600', tone === 'emerald' && 'text-emerald-700', tone === 'gray' && 'text-gray-900', bold && 'font-semibold')}>{value}</span></label>)
}

