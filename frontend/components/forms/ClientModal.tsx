'use client'

// Mijoz qo'shish / tahrirlash oynasi. Mijozlar sahifasida ham,
// buyurtma formasida ham (yangi mijozni joyida qo'shish) ishlatiladi.

import React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateClient, useUpdateClient } from '@/hooks'
import { localPhoneDigits } from '@/lib/api'
import { useT } from '@/lib/i18n'
import {
  buildClientSchema,
  type ClientFormData,
} from '@/lib/validations'
import {
  Button,
  Input,
  Textarea,
  Modal,
  PhoneInput,
} from '@/components/ui'
import type { Client } from '@/types'

export function ClientModal({
  open,
  onClose,
  mode,
  client,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  client?: Client
  onCreated?: (client: Client) => void
}) {
  const { t } = useT()
  const isEdit = mode === 'edit'
  const title = isEdit
    ? t('customerForm.editTitle')
    : t('customerForm.newTitle')

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      {open && (
        <ClientFormBody
          key={client?.id ?? 'new'}
          mode={mode}
          client={client}
          onDone={onClose}
          onCreated={onCreated}
        />
      )}
    </Modal>
  )
}

// Build a +998XXXXXXXXX value out of whatever shape the API stores
// ("934317272", "+998934317272", "998 93 431 72 72", ...).
function toCanonicalPhone(raw: string | null | undefined): string {
  const local = localPhoneDigits(raw)
  return local ? `+998${local}` : '+998'
}

function ClientFormBody({
  mode,
  client,
  onDone,
  onCreated,
}: {
  mode: 'create' | 'edit'
  client?: Client
  onDone: () => void
  onCreated?: (client: Client) => void
}) {
  const { t } = useT()
  const isEdit = mode === 'edit'

  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()

  const schema = React.useMemo(() => buildClientSchema(t), [t])

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(schema),
    defaultValues: client
      ? {
          name: client.name ?? '',
          phone: toCanonicalPhone(client.phone),
          description: client.description ?? '',
        }
      : { name: '', phone: '+998', description: '' },
  })

  const onSubmit = async (data: ClientFormData) => {
    // Send phone as local 9-digit string to match getClients shape.
    const phoneLocal = localPhoneDigits(data.phone)
    if (isEdit) {
      if (!client) return
      await updateMutation.mutateAsync({
        id: client.id,
        name: data.name,
        phone: phoneLocal,
        description: data.description ?? '',
      })
    } else {
      const created = await createMutation.mutateAsync({
        name: data.name,
        phone: phoneLocal,
        description: data.description ?? '',
      })
      if (created?.id) onCreated?.(created)
    }
    onDone()
  }

  return (
    <form
      onSubmit={(event) => {
        // Buyurtma formasi ichida ochilganda tashqi forma yuborilib ketmasin
        event.stopPropagation()
        void handleSubmit(onSubmit)(event)
      }}
      className="space-y-4"
    >
      <Input
        label={t('customerForm.fullName')}
        placeholder={t('customerForm.namePh')}
        error={errors.name?.message}
        {...register('name')}
      />
      <Controller
        control={control}
        name="phone"
        render={({ field }) => (
          <PhoneInput
            label={t('customerForm.phone')}
            placeholder={t('customerForm.phonePh')}
            error={errors.phone?.message}
            value={field.value ?? '+998'}
            onChange={field.onChange}
          />
        )}
      />
      <Textarea
        label={t('customerForm.note')}
        placeholder={t('customerForm.notePh')}
        rows={3}
        error={errors.description?.message}
        {...register('description')}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          loading={createMutation.isPending || updateMutation.isPending}
        >
          {isEdit ? t('common.saveChanges') : t('customerForm.submitNew')}
        </Button>
      </div>
    </form>
  )
}
