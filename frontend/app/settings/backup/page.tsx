'use client'

import React from 'react'
import {
  Archive,
  DatabaseBackup,
  Loader2,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'

import {
  BackupItem,
  createBackupRequest,
  getBackups,
  restoreBackupRequest,
} from '@/lib/api'

export default function BackupPage() {
  const [backups, setBackups] =
    React.useState<BackupItem[]>([])

  const [loading, setLoading] =
    React.useState(true)

  const [creating, setCreating] =
    React.useState(false)

  const [restoring, setRestoring] =
    React.useState<string | null>(null)

  const [error, setError] =
    React.useState('')

  const loadBackups = React.useCallback(
    async () => {
      setLoading(true)
      setError('')

      try {
        const result = await getBackups()
        setBackups(result)
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : 'Backup ro‘yxatini olishda xatolik',
        )
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  React.useEffect(() => {
    loadBackups()
  }, [loadBackups])

  const handleCreateBackup = async () => {
    setCreating(true)
    setError('')

    try {
      await createBackupRequest()
      await loadBackups()
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Backup yaratishda xatolik',
      )
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async (
    backup: BackupItem,
  ) => {
    const confirmed = window.confirm(
      `Ushbu backupdan ma'lumotlarni tiklamoqchimisiz?\n\n${backup.name}\n\nHozirgi ma'lumotlar almashtiriladi.`,
    )

    if (!confirmed) {
      return
    }

    setRestoring(backup.name)
    setError('')

    try {
      const result =
        await restoreBackupRequest(
          backup.name,
        )

      if (result.restartRequired) {
  window.alert(result.message)

  await new Promise((resolve) =>
    setTimeout(resolve, 2500),
  )

  window.location.href = '/dashboard'
}
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Backupni tiklashda xatolik',
      )
    } finally {
      setRestoring(null)
    }
  }



  const formatSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`
    }

    if (bytes < 1024 * 1024) {
      return `${(
        bytes / 1024
      ).toFixed(1)} KB`
    }

    return `${(
      bytes /
      1024 /
      1024
    ).toFixed(1)} MB`
  }

  const formatDate = (value: string) => {
    return new Intl.DateTimeFormat(
      'uz-UZ',
      {
        dateStyle: 'medium',
        timeStyle: 'short',
      },
    ).format(new Date(value))
  }

  return (
    <div className="p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Backup
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Lokal ma&apos;lumotlar bazasi
              zaxira nusxalari
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={
              creating || restoring !== null
            }
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
          >
            {creating ? (
              <Loader2
                size={17}
                className="animate-spin"
              />
            ) : (
              <DatabaseBackup size={17} />
            )}

            Backup yaratish
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Archive
                size={18}
                className="text-gray-500"
              />

              <span className="font-medium text-gray-900">
                Zaxira nusxalari
              </span>
            </div>

            <button
              type="button"
              onClick={loadBackups}
              disabled={restoring !== null}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <RefreshCw size={17} />
            </button>
          </div>

          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2
                size={22}
                className="animate-spin text-blue-600"
              />
            </div>
          ) : backups.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <DatabaseBackup
                size={30}
                className="text-gray-300"
              />

              <p className="text-sm text-gray-500 mt-3">
                Backup mavjud emas
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {backups.map((backup) => (
                <div
                  key={backup.name}
                  className="px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {backup.name}
                    </p>

                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(
                        backup.createdAt,
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">
                      {formatSize(
                        backup.size,
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        handleRestore(backup)
                      }
                      disabled={
                        restoring !== null ||
                        creating
                      }
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {restoring ===
                      backup.name ? (
                        <Loader2
                          size={15}
                          className="animate-spin"
                        />
                      ) : (
                        <RotateCcw size={15} />
                      )}

                      Tiklash
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}