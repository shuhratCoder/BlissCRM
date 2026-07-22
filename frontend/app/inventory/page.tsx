'use client'

import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { buildProductSchema } from '@/lib/validations'
import { 
  useProducts, 
  useCreateProduct, 
  useUpdateProduct, 
  useDeleteProduct, 
  usePurchaseProducts 
} from '@/hooks'
import { useT } from '@/lib/i18n'
import { formatCurrency } from '@/lib/api'
import { Button, Input, Select, PageHeader, Modal } from '@/components/ui'
import type { Product, ProductUnit, ProductType } from '@/types'
import { PRODUCT_UNITS } from '@/types'
import { cn } from '@/lib/utils'
import { Plus, Trash2, Pencil, PackagePlus, Search } from 'lucide-react'

export default function InventoryPage() {
  const { t } = useT()
  const { data: products = [], isLoading } = useProducts()

  const [searchQuery, setSearchSearchQuery] = React.useState('')
  const [productModal, setProductModal] = React.useState<{ open: boolean; mode: 'create' | 'edit'; product?: Product }>({
    open: false,
    mode: 'create',
  })
  const [purchaseModalOpen, setPurchaseModalOpen] = React.useState(false)

  const deleteMutation = useDeleteProduct()

  // Qidiruv mantiqi
  const filteredProducts = React.useMemo(() => {
    if (!searchQuery) return products
    const q = searchQuery.toLowerCase()
    return products.filter((p) => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
  }, [products, searchQuery])

  // Ombor statistikalari
  const stats = React.useMemo(() => {
    return {
      totalItems: products.length,
      totalQty: products.reduce((s, p) => s + (p.amount || 0), 0),
    }
  }, [products])

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <PageHeader title="Omborxona (Inventar)" description="Mebel xom-ashyolar va tayyor mahsulotlar balansi" />
        <div className="flex items-center gap-2">
          {/* 💡 TARJIMA FIX: Kalit buzilsa ham, toza matn chiqishi uchun zaxira matnlar qo'shildi */}
          <Button variant="secondary" onClick={() => setPurchaseModalOpen(true)} className="flex items-center gap-2">
            <PackagePlus size={16} /> {t('inventory.purchaseBtn') === 'inventory.purchaseBtn' ? 'Xarid' : (t('inventory.purchaseBtn') || 'Xarid')}
          </Button>
          <Button onClick={() => setProductModal({ open: true, mode: 'create' })} className="flex items-center gap-2">
            <Plus size={16} /> {t('inventory.addModalTitle') === 'inventory.addModalTitle' ? 'Mahsulot yaratish' : (t('inventory.addModalTitle') || 'Mahsulot yaratish')}
          </Button>
        </div>
      </div>

      {/* STATISTIKA PANЕLI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border p-4 rounded-xl shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase">Mahsulot turlari</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalItems}</p>
        </div>
        <div className="bg-white border p-4 rounded-xl shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase">Umumiy miqdori</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalQty.toLocaleString('uz-UZ')}</p>
        </div>
      </div>

      {/* QIDIRUV INPUTI */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Mahsulotlardan qidirish..."
          value={searchQuery}
          onChange={(e) => setSearchSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {/* JADVAL */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className="p-4">Mahsulot nomi</th>
              <th className="p-4">Miqdori</th>
              <th className="p-4">Birligi</th>
              <th className="p-4">Narxi (Baza)</th>
              <th className="p-4">Tavsif</th>
              <th className="p-4 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y text-sm text-gray-700">
            {isLoading ? (
              <tr><td colSpan={6} className="p-4 text-center text-gray-400">Yuklanmoqda...</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={6} className="p-4 text-center text-gray-400">Mahsulotlar topilmadi</td></tr>
            ) : (
              filteredProducts.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50/40 transition-colors">
                  <td className="p-4 font-medium text-gray-900">{p.name}</td>
                  <td className="p-4 font-semibold text-blue-600">{p.amount}</td>
                  <td className="p-4 text-gray-500">{t(`inventory.unit.${p.unit}`) || p.unit}</td>
                  <td className="p-4">
  {p.priceGet || p.price || (p as any).priceget ? (
    `${Number(p.priceGet || p.price || (p as any).priceget).toLocaleString('uz-UZ')} UZS`
  ) : (
    <span className="text-gray-400 italic">Kiritilmagan</span>
  )}
</td>

                  <td className="p-4 text-gray-400 max-w-xs truncate">{p.description || '-'}</td>
                  <td className="p-4 text-right space-x-1">
                    <button onClick={() => setProductModal({ open: true, mode: 'edit', product: p })} className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-blue-50">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => { if (confirm("O'chirilsinmi?")) deleteMutation.mutate(p.id) }} className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 1-MODAL: MAHSULOT YARATISH VA TAHRIRLASH */}
      <ProductModal
        open={productModal.open}
        onClose={() => setProductModal({ open: false, mode: 'create' })}
        mode={productModal.mode}
        product={productModal.product}
      />

      {/* 2-MODAL: OMBORNI TO'LDIRISH (XARID) */}
      <PurchaseModal
        open={purchaseModalOpen}
        onClose={() => setPurchaseModalOpen(false)}
        products={products}
      />
    </div>
  )
}

// ─── Product Modal Component ─────────────────────────────────────
function ProductModal({ open, onClose, mode, product }: { open: boolean; onClose: () => void; mode: 'create' | 'edit'; product?: Product }) {
  const { t } = useT()
  const isEdit = mode === 'edit'
  
  let title = "Mahsulot yaratish";
  if (isEdit) {
    title = t('inventory.editModalTitle') === 'inventory.editModalTitle' ? "Mahsulotni tahrirlash" : (t('inventory.editModalTitle') || "Mahsulotni tahrirlash");
  } else {
    title = t('inventory.addModalTitle') === 'inventory.addModalTitle' ? "Mahsulot yaratish" : (t('inventory.addModalTitle') || "Mahsulot yaratish");
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      {open && <ProductFormBody key={product?.id ?? 'new'} mode={mode} product={product} onDone={onClose} />}
    </Modal>
  )
}

function ProductFormBody({ mode, product, onDone }: { mode: 'create' | 'edit'; product?: Product; onDone: () => void }) {
  const { t } = useT()
  const isEdit = mode === 'edit'

  const createMutation = useCreateProduct()
  const updateMutation = useUpdateProduct(product?.id ?? '')

  const schema = React.useMemo(() => buildProductSchema(t), [t])

  const { register, handleSubmit, control, formState: { errors } } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: product
      ? {
          name: product.name ?? '',
          amount: product.amount ?? 0,
          unit: (product.unit ?? 'dona') as ProductUnit,
          type: (product.type ?? 'whole') as ProductType,
          description: product.description ?? '',
          priceGet: (product as any).priceGet ?? (product as any).price ?? '', // 💡 Baza field nomi priceGet
        }
      : {
          name: '',
          amount: 0,
          unit: 'dona',
          type: 'whole',
          description: '',
          priceGet: '', 
        },
  })

  const onSubmit = async (data: any) => {
    const payload = {
      name: data.name,
      amount: data.amount,
      unit: data.unit as any,
      type: (data.type || 'whole') as any,
      description: data.description || undefined,
      priceGet: data.priceGet ? Number(data.priceGet) : undefined, // 💡 Baza uchun priceGet ustuni yangilandi
    }
    if (isEdit) {
      await updateMutation.mutateAsync(payload)
    } else {
      await createMutation.mutateAsync(payload)
    }
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
      <Input
        label={t('inventory.nameLabel') === 'inventory.nameLabel' ? "Mahsulot nomi *" : (t('inventory.nameLabel') || "Mahsulot nomi *")}
        placeholder={t('inventory.namePh') === 'inventory.namePh' ? "Mahsulot nomi" : (t('inventory.namePh') || "Mahsulot nomi")}
        error={errors.name?.message ? String(errors.name.message) : undefined}
        {...register('name')}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label={t('inventory.qtyLabel') === 'inventory.qtyLabel' ? "Miqdori *" : (t('inventory.qtyLabel') || "Miqdori *")}
          type="number"
          step={1}
          min={0}
          placeholder="0"
          onKeyDown={(e) => { if (['.', ',', 'e', '-'].includes(e.key)) e.preventDefault() }}
          error={errors.amount?.message ? String(errors.amount.message) : undefined}
          {...register('amount', { valueAsNumber: true })}
        />
        <Select
          label={t('inventory.unitLabel') === 'inventory.unitLabel' ? "O'lchov birligi *" : (t('inventory.unitLabel') || "O'lchov birligi *")}
          placeholder={t('inventory.unitPh') === 'inventory.unitPh' ? "Birlikni tanlang" : (t('inventory.unitPh') || "Birlikni tanlang")}
          error={errors.unit?.message ? String(errors.unit.message) : undefined}
          options={PRODUCT_UNITS.map((u) => ({ value: u, label: t(`inventory.unit.${u}`) === `inventory.unit.${u}` ? u.toUpperCase() : (t(`inventory.unit.${u}`) || u) }))}
          {...register('unit')}
        />
      </div>

      <Input
        label={t('inventory.priceLabel') === 'inventory.priceLabel' ? "Narxi (Ixtiyoriy)" : (t('inventory.priceLabel') || "Narxi (Ixtiyoriy)")}
        placeholder={t('inventory.pricePh') === 'inventory.pricePh' ? "Mahsulot narxi (so'mda)" : (t('inventory.pricePh') || "Mahsulot narxi (so'mda)")}
        type="number"
        min={0}
        error={(errors as any).priceGet?.message ? String((errors as any).priceGet.message) : undefined}
        {...register('priceGet')}
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('inventory.descLabel') === 'inventory.descLabel' ? "Tavsif" : (t('inventory.descLabel') || "Tavsif")}
        </label>
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <textarea
              {...field}
              rows={2}
              placeholder={t('inventory.descPh') === 'inventory.descPh' ? "Mahsulot haqida qo'shimcha ma'lumot..." : (t('inventory.descPh') || "Mahsulot haqida qo'shimcha ma'lumot...")}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
            />
          )}
        />
        {errors.description?.message && (
          <p className="text-xs text-red-500 mt-1">{String(errors.description.message)}</p>
        )}
      </div>

      <input type="hidden" value="whole" {...register('type')} />

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel') || "Bekor qilish"}
        </Button>
        <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
          {isEdit ? (t('common.saveChanges') || "Saqlash") : (t('common.create') || "Yaratish")}
        </Button>
      </div>
    </form>
  )
}

// ─── Purchase Modal Component ─────────────────────────────────────
function PurchaseModal({ open, onClose, products }: { open: boolean; onClose: () => void; products: Product[] }) {
  const { t } = useT()
  const title = t('inventory.purchaseTitle') === 'inventory.purchaseTitle' ? "Mahsulot xaridi" : (t('inventory.purchaseTitle') || "Mahsulot xaridi");
  return (
    <Modal open={open} onClose={onClose} title={title} size="xl">
      {open && <PurchaseFormBody products={products} onDone={onClose} />}
    </Modal>
  )
}

interface PurchaseLine { productId: string; amount: number }

function PurchaseFormBody({ products, onDone }: { products: Product[]; onDone: () => void }) {
  const { t } = useT()
  const purchase = usePurchaseProducts()

  const [lines, setLines] = React.useState<PurchaseLine[]>([{ productId: '', amount: 0 }])
  const [formError, setFormError] = React.useState<string | null>(null)

  function patchLine(idx: number, patch: Partial<PurchaseLine>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  function addLine() { setLines((prev) => [...prev, { productId: '', amount: 0 }]) }
  function removeLine(idx: number) { setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx))) }

  function availableProductsFor(rowIndex: number): Product[] {
    return products.filter((p) => {
      const currentId = lines[rowIndex]?.productId
      if (p.id === currentId) return true
      return !lines.some((l, i) => i !== rowIndex && l.productId === p.id)
    })
  }

  async function handlePurchaseSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const valid = lines.filter((l) => l.productId && Number.isFinite(l.amount) && l.amount > 0)
    if (valid.length === 0) {
      setFormError(t('inventory.purchaseEmpty') === 'inventory.purchaseEmpty' ? "Kamida bitta mahsulot va miqdor qo'shing" : (t('inventory.purchaseEmpty') || "Kamida bitta mahsulot va miqdor qo'shing"))
      return
    }
    await purchase.mutateAsync(valid.map((l) => ({ productId: l.productId, amount: l.amount })))
    onDone()
  }

  return (
    <form onSubmit={handlePurchaseSubmit} className="space-y-4 pt-2">
      <div className="space-y-3">
        {lines.map((line, idx) => {
          const selected = products.find((p) => p.id === line.productId)
          const projectedTotal = selected && Number.isFinite(line.amount) && line.amount > 0 ? (selected.amount ?? 0) + Number(line.amount) : null
          const opts = availableProductsFor(idx)
          
          // 💡 Zaxira matnlar qo'shildi
          const productLabel = t('inventory.purchaseProduct') === 'inventory.purchaseProduct' ? "Mahsulot *" : (t('inventory.purchaseProduct') || "Mahsulot *");
          const productPh = t('inventory.purchaseProductPh') === 'inventory.purchaseProductPh' ? "Ombordan tanlang" : (t('inventory.purchaseProductPh') || "Ombordan tanlang");
          const amountLabel = t('inventory.purchaseAmount') === 'inventory.purchaseAmount' ? "Qo'shiladigan miqdor *" : (t('inventory.purchaseAmount') || "Qo'shiladigan miqdor *");
          const addRowLabel = t('inventory.purchaseAddRow') === 'inventory.purchaseAddRow' ? "Mahsulot qo'shish" : (t('inventory.purchaseAddRow') || "Mahsulot qo'shish");

          return (
            <div key={idx} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-12 sm:col-span-7">
                <Select
                  label={idx === 0 ? productLabel : undefined}
                  placeholder={productPh}
                  value={line.productId}
                  onChange={(e) => patchLine(idx, { productId: e.target.value })}
                  options={opts.map((p) => ({ value: p.id, label: `${p.name} (${p.amount} ${t(`inventory.unit.${p.unit ?? 'dona'}`) || p.unit})` }))}
                />
              </div>
              <div className="col-span-10 sm:col-span-4">
                <Input
                  label={idx === 0 ? amountLabel : undefined}
                  type="number"
                  placeholder="0"
                  value={line.amount || ''}
                  onChange={(e) => patchLine(idx, { amount: Number(e.target.value) || 0 })}
                  onKeyDown={(e) => { if (['.', ',', 'e', '-'].includes(e.key)) e.preventDefault() }}
                  hint={selected ? (projectedTotal != null ? t('inventory.purchaseProjected', { current: selected.amount, total: projectedTotal }) : t('inventory.purchaseCurrent', { n: selected.amount })) : undefined}
                />
              </div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"

                                  className={cn(
                    'h-9 w-9 p-0 text-red-500 hover:bg-red-50',
                    lines.length === 1 && 'opacity-30 pointer-events-none',
                  )}
                  onClick={() => removeLine(idx)}
                  style={{ marginTop: idx === 0 ? '1.5rem' : 0 }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          )
        })}

        <Button 
          type="button" 
          variant="secondary" 
          size="sm" 
          onClick={addLine} 
          className="gap-1"
        >
          <Plus size={14} />
          {t('inventory.purchaseAddRow') === 'inventory.purchaseAddRow' ? "Mahsulot qo'shish" : (t('inventory.purchaseAddRow') || "Mahsulot qo'shish")}
        </Button>
      </div>

      {formError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel') || "Bekor qilish"}
        </Button>
        <Button type="submit" loading={purchase.isPending}>
          {t('inventory.purchaseSubmit') === 'inventory.purchaseSubmit' ? "Omborni to'ldirish" : (t('inventory.purchaseSubmit') || "Omborni to'ldirish")}
        </Button>
      </div>
    </form>
  )
}
