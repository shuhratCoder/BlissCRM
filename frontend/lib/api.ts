import { tStatic, useLangStore } from '@/lib/i18n'
import { useAuthStore } from '@/store'

// ─────────────────────────────────────────────────────────────
// BASE URLS
// ─────────────────────────────────────────────────────────────

// ONLINE AUTH SERVER
// Birinchi kirishda username/password va license tekshirish uchun
const AUTH_BASE =
  process.env.NEXT_PUBLIC_AUTH_API_URL ??
  'http://192.168.8.222:4000/auth'

// LOCAL DESKTOP CRM BACKEND
// Product, Client, Order, Payment va boshqa lokal ma'lumotlar
const CRM_BASE =
  process.env.NEXT_PUBLIC_CRM_API_URL ??
  '/crm'


// ─────────────────────────────────────────────────────────────
// CORE FETCH TYPES
// ─────────────────────────────────────────────────────────────

interface CoreFetchOptions extends Omit<RequestInit, 'body'> {
  authed?: boolean
  body?: BodyInit | object | null
}


// ─────────────────────────────────────────────────────────────
// CORE FETCH
// ─────────────────────────────────────────────────────────────

async function coreFetch<T>(
  baseUrl: string,
  path: string,
  options: CoreFetchOptions = {},
): Promise<T> {
  const {
    authed = false,
    body,
    headers,
    ...rest
  } = options

  const token = authed
    ? useAuthStore.getState().token
    : null

  let serializedBody:
    | BodyInit
    | null
    | undefined

  let autoJson = false

  if (body == null) {
    serializedBody = undefined
  } else if (
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  ) {
    serializedBody = body as BodyInit
  } else {
    serializedBody = JSON.stringify(body)
    autoJson = true
  }

  const response = await fetch(
    `${baseUrl}${path}`,
    {
      ...rest,

      body: serializedBody,

      headers: {
        ...(autoJson
          ? {
              'Content-Type':
                'application/json',
            }
          : {}),

        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),

        ...headers,
      },
    },
  )


  // TOKEN INVALID / EXPIRED
  if (
    response.status === 401 &&
    authed
  ) {
    useAuthStore
      .getState()
      .logout()

    throw new Error(
      tStatic('errors.sessionExpired'),
    )
  }


  // API ERROR
  if (!response.ok) {
    let message = tStatic(
      'errors.code',
      {
        code: response.status,
      },
    )

    try {
      const errorBody =
        await response.json()

      if (errorBody?.message) {
        message = errorBody.message
      } else if (errorBody?.error) {
        message = errorBody.error
      }
    } catch {
      // JSON bo'lmasa default message qoladi
    }

    throw new Error(message)
  }


  // NO CONTENT
  if (response.status === 204) {
    return undefined as T
  }


  return response.json() as Promise<T>
}


// ─────────────────────────────────────────────────────────────
// API CLIENT FACTORY
// ─────────────────────────────────────────────────────────────

function makeClient(
  baseUrl: string,
  options: {
    authed: boolean
  },
) {
  const call = <T>(
    path: string,
    init: CoreFetchOptions = {},
  ) =>
    coreFetch<T>(
      baseUrl,
      path,
      {
        ...options,
        ...init,
      },
    )

  return {
    get: <T>(
      path: string,
    ) =>
      call<T>(path),


    post: <T>(
      path: string,
      body: unknown,
    ) =>
      call<T>(
        path,
        {
          method: 'POST',
          body: body as object,
        },
      ),


    put: <T>(
      path: string,
      body: unknown,
    ) =>
      call<T>(
        path,
        {
          method: 'PUT',
          body: body as object,
        },
      ),


    patch: <T>(
      path: string,
      body: unknown,
    ) =>
      call<T>(
        path,
        {
          method: 'PATCH',
          body: body as object,
        },
      ),


    delete: <T>(
      path: string,
    ) =>
      call<T>(
        path,
        {
          method: 'DELETE',
        },
      ),
  }
}


// ─────────────────────────────────────────────────────────────
// LOCAL CRM API
// ─────────────────────────────────────────────────────────────

// Barcha lokal endpointlar uchun:
//
// crmApi.get('/products')
// crmApi.post('/createProduct', data)
// crmApi.get('/getClients')
// crmApi.post('/createOrder', data)

export const crmApi = makeClient(
  CRM_BASE,
  {
    authed: true,
  },
)


// ─────────────────────────────────────────────────────────────
// ONLINE LOGIN TYPES
// ─────────────────────────────────────────────────────────────

export interface OnlineOwner {
  id: string
  companyName: string
  username: string
  phone?: string | null
}


export interface OnlineLicense {
  id: string
  startsAt: string
  expiresAt: string

  status:
    | 'active'
    | 'expired'
    | 'blocked'
}


export interface LoginResponse {
  success: boolean
  message: string

  owner: OnlineOwner

  license: OnlineLicense

  token?: string
  licenseToken?: string
}


// ─────────────────────────────────────────────────────────────
// ONLINE LOGIN
// ─────────────────────────────────────────────────────────────

export async function loginRequest(
  username: string,
  password: string,
): Promise<LoginResponse> {

  const response = await fetch(
    `${AUTH_BASE}/login`,
    {
      method: 'POST',

      headers: {
        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        username,
        password,
      }),
    },
  )


  const data = await response
    .json()
    .catch(() => null)


  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      tStatic('login.invalid'),
    )
  }


  return data as LoginResponse
}

// ─────────────────────────────────────────────────────────────
// LOCAL PIN SETUP
// ─────────────────────────────────────────────────────────────

export interface SetupPinRequest {
  pin: string

  owner: {
    id: string
    companyName: string
    username: string
    phone?: string | null
  }

  license: {
    id: string
    startsAt: string
    expiresAt: string
    status: 'active' | 'expired' | 'blocked'
  }
}

export interface SetupPinResponse {
  success: boolean
  message: string
}
export interface LocalStatusResponse {
  success: boolean
  initialized: boolean

  user?: {
    id: string
    ownerId: string
    companyName: string
    username: string
  }

  license?: {
    id: string
    startsAt: string
    expiresAt: string
    status: string
    expired: boolean
  }
}

export async function getLocalStatus(): Promise<LocalStatusResponse> {
  const response = await fetch(
    `${CRM_BASE}/local-status`,
    {
      method: 'GET',
      cache: 'no-store',
    },
  )

  const result = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    throw new Error(
      result?.message ||
      'Lokal holatni tekshirishda xatolik',
    )
  }

  return result as LocalStatusResponse
}


export interface PinLoginResponse {
  success: boolean
  message: string
  token: string

  user: {
    id: string
    ownerId: string
    companyName: string
    username: string
  }

  license: {
    id: string
    startsAt: string
    expiresAt: string
    status: string
  }
}

export async function loginWithPin(
  pin: string,
): Promise<PinLoginResponse> {
  const response = await fetch(
    `${CRM_BASE}/login-pin`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        pin,
      }),
    },
  )

  const result = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    throw new Error(
      result?.message ||
      'PIN kod noto‘g‘ri',
    )
  }

  return result as PinLoginResponse
}
// ─────────────────────────────────────────────────────────────
// LICENSE CHECK
// ─────────────────────────────────────────────────────────────

export interface LicenseCheckResponse {
  success: boolean
  initialized: boolean
  allowed: boolean
  online: boolean

  code?: string
  message?: string

  license?: {
    id: string
    startsAt: string
    expiresAt: string
    status:
      | 'active'
      | 'expired'
      | 'blocked'
  }
}

export class LicenseCheckError extends Error {
  code?: string
  status?: number
  online?: boolean

  constructor(
    message: string,
    options?: {
      code?: string
      status?: number
      online?: boolean
    },
  ) {
    super(message)

    this.name = 'LicenseCheckError'
    this.code = options?.code
    this.status = options?.status
    this.online = options?.online
  }
}

export async function checkLicenseRequest(): Promise<LicenseCheckResponse> {
  const response = await fetch(
    `${CRM_BASE}/check-license`,
    {
      method: 'GET',
      cache: 'no-store',
    },
  )

  const result = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    throw new LicenseCheckError(
      result?.message ||
        'Litsenziya tekshirilmadi',
      {
        code: result?.code,
        status: response.status,
        online: result?.online,
      },
    )
  }

  return result as LicenseCheckResponse
}
export async function setupPinRequest(
  data: SetupPinRequest,
): Promise<SetupPinResponse> {
  const response = await fetch(
    `${CRM_BASE}/setup-pin`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
  )

  const result = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    throw new Error(
      result?.message ||
      'PIN saqlashda xatolik',
    )
  }

  return result as SetupPinResponse
}

// ─────────────────────────────────────────────────────────────
// QUERY KEYS
// ─────────────────────────────────────────────────────────────

export const queryKeys = {

  products: {
    all:
      ['products'] as const,

    list: (
      filter: object,
    ) =>
      [
        'products',
        'list',
        filter,
      ] as const,

    detail: (
      id: string,
    ) =>
      [
        'products',
        'detail',
        id,
      ] as const,
  },


  clients: {
    all:
      ['clients'] as const,

    detail: (
      id: string,
    ) =>
      [
        'clients',
        'detail',
        id,
      ] as const,
  },


  orders: {
    all:
      ['orders'] as const,

    detail: (
      id: string,
    ) =>
      [
        'orders',
        'detail',
        id,
      ] as const,
  },


  payments: {
    all:
      ['payments'] as const,

    byOrder: (
      orderId: string,
    ) =>
      [
        'payments',
        'order',
        orderId,
      ] as const,
  },
}

// ============================================================
// BACKUP
// ============================================================

export interface BackupItem {
  name: string
  size: number
  createdAt: string
}

export interface CreateBackupResponse {
  success: boolean
  message: string
  backup: BackupItem
}

export async function getBackups(): Promise<BackupItem[]> {
  return crmApi.get<BackupItem[]>('/backups')
}

export async function createBackupRequest(): Promise<CreateBackupResponse> {
  return crmApi.post<CreateBackupResponse>(
    '/backups/create',
    {},
  )
}export interface RestoreBackupResponse {
  success: boolean
  message: string
  restartRequired: boolean
}

export async function restoreBackupRequest(
  name: string,
): Promise<RestoreBackupResponse> {
  return crmApi.post<RestoreBackupResponse>(
    '/backups/restore',
    { name },
  )
}
// ─────────────────────────────────────────────────────────────
// PHONE HELPERS
// ─────────────────────────────────────────────────────────────

export function localPhoneDigits(
  input:
    | string
    | null
    | undefined,
): string {

  if (!input) {
    return ''
  }

  let digits = String(input)
    .replace(/\D/g, '')

  if (
    digits.startsWith('998')
  ) {
    digits = digits.slice(3)
  }

  return digits.slice(0, 9)
}


// ─────────────────────────────────────────────────────────────
// FORMAT PHONE
// ─────────────────────────────────────────────────────────────

export function formatPhone(
  input:
    | string
    | null
    | undefined,
): string {

  const digits =
    localPhoneDigits(input)

  if (digits.length === 0) {
    return ''
  }

  const parts: string[] = [
    '+998',
  ]

  if (digits.length > 0) {
    parts.push(
      digits.slice(0, 2),
    )
  }

  if (digits.length > 2) {
    parts.push(
      digits.slice(2, 5),
    )
  }

  if (digits.length > 5) {
    parts.push(
      digits.slice(5, 7),
    )
  }

  if (digits.length > 7) {
    parts.push(
      digits.slice(7, 9),
    )
  }

  return parts.join(' ')
}


// ─────────────────────────────────────────────────────────────
// FORMAT CURRENCY
// ─────────────────────────────────────────────────────────────

export function formatCurrency(
  amount: number,
): string {

  const lang =
    useLangStore
      .getState()
      .lang

  const locale =
    lang === 'uz'
      ? 'uz-UZ'
      : 'ru-UZ'

  return (
    new Intl.NumberFormat(
      locale,
      {
        style: 'decimal',
        maximumFractionDigits: 0,
      },
    ).format(amount)
    +
    ' '
    +
    tStatic('common.currency')
  )
}


// ─────────────────────────────────────────────────────────────
// FORMAT DATE
// ─────────────────────────────────────────────────────────────

export function formatDate(
  date: string | Date,
): string {

  const value =
    new Date(date)

  if (
    Number.isNaN(
      value.getTime(),
    )
  ) {
    return ''
  }

  const dd =
    String(
      value.getDate(),
    ).padStart(2, '0')

  const mm =
    String(
      value.getMonth() + 1,
    ).padStart(2, '0')

  const yyyy =
    value.getFullYear()

  return `${dd}.${mm}.${yyyy}`
}


// ─────────────────────────────────────────────────────────────
// FORMAT DATE TIME
// ─────────────────────────────────────────────────────────────

export function formatDateTime(
  date: string | Date,
): string {

  const value =
    new Date(date)

  if (
    Number.isNaN(
      value.getTime(),
    )
  ) {
    return ''
  }

  const dd =
    String(
      value.getDate(),
    ).padStart(2, '0')

  const mm =
    String(
      value.getMonth() + 1,
    ).padStart(2, '0')

  const yyyy =
    value.getFullYear()

  const hh =
    String(
      value.getHours(),
    ).padStart(2, '0')

  const min =
    String(
      value.getMinutes(),
    ).padStart(2, '0')

  return (
    `${dd}.${mm}.${yyyy} ` +
    `${hh}:${min}`
  )
}


// ─────────────────────────────────────────────────────────────
// SAFE FORMAT DATE TIME
// ─────────────────────────────────────────────────────────────

export function safeFormatDateTime(
  value?: string,
): string {

  if (!value) {
    return '—'
  }

  const date =
    new Date(value)

  return Number.isNaN(
    date.getTime(),
  )
    ? value
    : formatDateTime(date)
}