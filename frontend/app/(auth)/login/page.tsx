"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, Loader2, ShieldX } from "lucide-react";

import { buildLoginSchema, type LoginFormData } from "@/lib/validations";

import { useAuthStore } from "@/store";
import { useT } from "@/lib/i18n";

import {
  loginRequest,
  setupPinRequest,
  getLocalStatus,
  loginWithPin,
  resetPinRequest,
  LicenseCheckError,
  type LoginResponse,
} from "@/lib/api";

import { Button, Input } from "@/components/ui";
import { useRouter } from "next/navigation";

type Step =
  | "checking"
  | "login"
  | "create-pin"
  | "pin-login"
  | "reset-pin";

const LICENSE_ERROR_CODES = [
  "LICENSE_BLOCKED",
  "LICENSE_INACTIVE",
  "OWNER_BLOCKED",
  "LICENSE_EXPIRED",
  "LICENSE_NOT_FOUND",
  "CLOCK_TAMPERED",
];

export default function LoginPage() {
  const router = useRouter();
  const {
  setAdmin,
  authError,
  authErrorCode,
  setAuthError,
  clearAuthError,
} = useAuthStore();

  const { t, lang, setLang } = useT();

  const [step, setStep] = React.useState<Step>("checking");

  const [error, setError] = React.useState("");

  const [showPassword, setShowPassword] = React.useState(false);

  const [loginData, setLoginData] = React.useState<LoginResponse | null>(null);

  const [pin, setPin] = React.useState("");

  const [confirmPin, setConfirmPin] = React.useState("");

  const [isSavingPin, setIsSavingPin] = React.useState(false);

  // ПИН унутилганда: логин ва парол билан тиклаш
  const [resetUsername, setResetUsername] = React.useState("");

  const [resetPassword, setResetPassword] = React.useState("");

  const schema = React.useMemo(() => buildLoginSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(schema),
  });

  const hasLicenseError =
    Boolean(authError) &&
    Boolean(authErrorCode) &&
    LICENSE_ERROR_CODES.includes(authErrorCode as string);

  // ==========================================================
  // LOCAL STATUS
  // ==========================================================

  React.useEffect(() => {
    let active = true;

    const checkLocalUser = async () => {
      if (hasLicenseError) {
        return;
      }

      setError("");
      setStep("checking");

      try {
        const status = await getLocalStatus();

        if (!active) {
          return;
        }

        if (status.initialized) {
          setStep("pin-login");
        } else {
          setStep("login");
        }
      } catch (e) {
        if (!active) {
          return;
        }

        console.error("LOCAL STATUS ERROR:", e);

        setError(
          e instanceof Error ? e.message : "Локал базани текширишда хатолик",
        );

        setStep("checking");
      }
    };

    checkLocalUser();

    return () => {
      active = false;
    };
  }, [hasLicenseError]);

  // ==========================================================
  // PIN NORMALIZER
  // ==========================================================

  const normalizePin = (value: string) => value.replace(/\D/g, "").slice(0, 4);

  // ==========================================================
  // ONLINE LOGIN
  // ==========================================================

  const onSubmit = async (data: LoginFormData) => {
    setError("");

    try {
      const response = await loginRequest(data.username, data.password);

      if (!response.owner) {
        throw new Error("Фойдаланувчи маълумотлари топилмади");
      }

      if (!response.license) {
        throw new Error("Лицензия топилмади");
      }

      if (response.license.status !== "active") {
        throw new Error("Лицензия фаол эмас");
      }

      const expiresAt = new Date(response.license.expiresAt);

      if (Number.isNaN(expiresAt.getTime())) {
        throw new Error("Лицензия муддати нотўғри");
      }

      if (expiresAt.getTime() <= Date.now()) {
        throw new Error("Лицензия муддати тугаган");
      }

      setLoginData(response);

      setPin("");
      setConfirmPin("");

      setStep("create-pin");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("login.invalid"));
    }
  };

  // ==========================================================
  // CREATE PIN
  // ==========================================================

  const handleCreatePin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");

    if (!loginData) {
      setError("Логин маълумотлари топилмади");

      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError("ПИН айнан 4 хонали сон бўлиши керак");

      return;
    }

    if (pin !== confirmPin) {
      setError("ПИН кодлар бир хил эмас");

      return;
    }

    setIsSavingPin(true);

    try {
      const setup = await setupPinRequest({
        pin,
        owner: loginData.owner,
        license: loginData.license,
        backupToken: loginData.backupToken,
      });

      // Lokal backend faqat o'zi bergan tokenni qabul qiladi.
      const token =
        setup.token ??
        loginData.token ??
        loginData.licenseToken ??
        `local-${loginData.owner.id}`;

      setAdmin(
        {
          id: loginData.owner.id,

          name: loginData.owner.companyName || loginData.owner.username,

          email: `${loginData.owner.username}@local.crm`,

          createdAt: new Date().toISOString(),
        },
        token,
      );

      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ПИН сақлашда хатолик");
    } finally {
      setIsSavingPin(false);
    }
  };

  // ==========================================================
  // PIN LOGIN
  // ==========================================================

const handlePinLogin = async (
  event: React.FormEvent<HTMLFormElement>
) => {
  event.preventDefault();

  setError("");
  clearAuthError();

  if (!/^\d{4}$/.test(pin)) {
    setError(
      "ПИН айнан 4 хонали сон бўлиши керак"
    );

    return;
  }

  setIsSavingPin(true);

  try {
    const response =
      await loginWithPin(pin);

    setAdmin(
      {
        id: response.user.id,

        name:
          response.user.companyName ||
          response.user.username,

        email:
          `${response.user.username}@local.crm`,

        createdAt:
          new Date().toISOString(),
      },

      response.token
    );

    setPin("");

    router.replace("/dashboard");
  } catch (e) {
    console.error(
      "PIN LOGIN ERROR:",
      e
    );

    // Фақат лицензия билан боғлиқ хатолар алоҳида экранда кўрсатилади;
    // нотўғри ПИН каби хатолар шу форманинг ўзида чиқади.
    if (
      e instanceof LicenseCheckError &&
      LICENSE_ERROR_CODES.includes(
        e.code ?? ""
      )
    ) {
      setAuthError(
        e.message ||
          "Лицензия билан боғлиқ муаммо мавжуд",

        e.code ||
          "LICENSE_INACTIVE"
      );

      setPin("");

      return;
    }

    setError(
      e instanceof Error
        ? e.message
        : "ПИН код нотўғри"
    );
  } finally {
    setIsSavingPin(false);
  }
};
  // ==========================================================
  // RESET PIN (ПИН эсдан чиққанда)
  // ==========================================================

  const handleResetPin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    clearAuthError();

    if (!resetUsername.trim() || !resetPassword) {
      setError("Логин ва паролни киритинг");

      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError("ПИН айнан 4 хонали сон бўлиши керак");

      return;
    }

    if (pin !== confirmPin) {
      setError("ПИН кодлар бир хил эмас");

      return;
    }

    setIsSavingPin(true);

    try {
      const response = await resetPinRequest(
        resetUsername.trim(),
        resetPassword,
        pin,
      );

      setAdmin(
        {
          id: response.user.id,

          name: response.user.companyName || response.user.username,

          email: `${response.user.username}@local.crm`,

          createdAt: new Date().toISOString(),
        },
        response.token,
      );

      setPin("");
      setConfirmPin("");
      setResetPassword("");

      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ПИН кодни тиклашда хатолик");
    } finally {
      setIsSavingPin(false);
    }
  };

  // ==========================================================
  // RETRY LICENSE
  // ==========================================================

  const handleRetryLicense = () => {
    clearAuthError();

    setError("");
    setPin("");
    setConfirmPin("");
    setStep("checking");
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-sm p-6 sm:p-8 relative">
        {/* LANGUAGE */}

        <div className="absolute top-4 right-4 flex border border-gray-100 rounded-lg p-0.5 bg-gray-50">
          {(["ru", "uz"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-2 py-0.5 text-[11px] font-semibold uppercase rounded transition-colors ${
                lang === l
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* BRAND */}

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {t("brand.short")}
            </span>
          </div>

          <div>
            <p className="font-semibold text-gray-900">{t("brand.title")}</p>

            <p className="text-xs text-gray-400">{t("brand.system")}</p>
          </div>
        </div>

        {/* ================================================== */}
        {/* LICENSE ERROR */}
        {/* ================================================== */}

        {hasLicenseError ? (
          <div className="py-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                <ShieldX size={26} className="text-red-600" />
              </div>

              <h1 className="text-lg font-semibold text-gray-900">
                {authErrorCode === "LICENSE_EXPIRED"
                  ? "Лицензия муддати тугаган"
                  : authErrorCode === "OWNER_BLOCKED"
                    ? "Ҳисоб блокланган"
                    : authErrorCode === "CLOCK_TAMPERED"
                      ? "Компьютер соати нотўғри"
                      : "Тизимга кириш блокланган"}
              </h1>

              <p className="text-sm text-gray-500 mt-2">{authError}</p>

              <p className="text-xs text-gray-400 mt-3">
                Администратор билан боғланинг
              </p>

              <button
                type="button"
                onClick={handleRetryLicense}
                className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                Қайта текшириш
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ============================================== */}
            {/* CHECKING */}
            {/* ============================================== */}

            {step === "checking" && (
              <div className="py-8">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                    <Loader2 size={22} className="text-blue-600 animate-spin" />
                  </div>

                  <h1 className="text-lg font-semibold text-gray-900">
                    Текширилмоқда
                  </h1>

                  <p className="text-xs text-gray-400 mt-2">
                    Локал маълумотлар текширилмоқда
                  </p>
                </div>

                {error && (
                  <div className="mt-5 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* ============================================== */}
            {/* ONLINE LOGIN */}
            {/* ============================================== */}

            {step === "login" && (
              <>
                <h1 className="text-lg font-semibold text-gray-900 mb-6">
                  {t("login.title")}
                </h1>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <Input
                    label={t("login.username")}
                    type="text"
                    autoComplete="username"
                    error={errors.username?.message}
                    {...register("username")}
                  />

                  <div className="relative">
                    <Input
                      label={t("login.password")}
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      error={errors.password?.message}
                      className="pr-10"
                      {...register("password")}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={
                        showPassword
                          ? t("login.hidePassword")
                          : t("login.showPassword")
                      }
                      className="absolute right-2 top-7 inline-flex items-center justify-center h-9 w-9 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    loading={isSubmitting}
                  >
                    {t("login.submit")}
                  </Button>
                </form>
              </>
            )}

            {/* ============================================== */}
            {/* CREATE PIN */}
            {/* ============================================== */}

            {step === "create-pin" && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <LockKeyhole size={20} className="text-blue-600" />
                  </div>

                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">
                      ПИН код яратинг
                    </h1>

                    <p className="text-xs text-gray-400 mt-0.5">
                      Кейинги киришлар учун
                    </p>
                  </div>
                </div>

                {loginData?.owner && (
                  <div className="mb-5 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                    <p className="text-xs text-gray-400">Tashkilot</p>

                    <p className="text-sm font-medium text-gray-900 mt-0.5">
                      {loginData.owner.companyName}
                    </p>
                  </div>
                )}

                <form onSubmit={handleCreatePin} className="space-y-4">
                  <Input
                    label="4 хонали ПИН"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={4}
                    placeholder="••••"
                    value={pin}
                    onChange={(event) =>
                      setPin(normalizePin(event.target.value))
                    }
                    autoFocus
                  />

                  <Input
                    label="ПИН кодни такрорланг"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={4}
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(event) =>
                      setConfirmPin(normalizePin(event.target.value))
                    }
                  />

                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    loading={isSavingPin}
                  >
                    ПИН яратиш
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("login");
                      setLoginData(null);
                      setPin("");
                      setConfirmPin("");
                      setError("");
                    }}
                    className="w-full text-xs text-gray-500 hover:text-gray-700 py-2"
                  >
                    Орқага қайтиш
                  </button>
                </form>
              </>
            )}

            {/* ============================================== */}
            {/* PIN LOGIN */}
            {/* ============================================== */}

            {step === "pin-login" && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <LockKeyhole size={20} className="text-blue-600" />
                  </div>

                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">
                      ПИН кодни киритинг
                    </h1>

                    <p className="text-xs text-gray-400 mt-0.5">
                      CRM тизимига кириш
                    </p>
                  </div>
                </div>

                <form onSubmit={handlePinLogin} className="space-y-4">
                  <Input
                    label="4 хонали ПИН"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={4}
                    placeholder="••••"
                    value={pin}
                    onChange={(event) => {
                      setPin(normalizePin(event.target.value));

                      if (error) {
                        setError("");
                      }
                    }}
                    autoFocus
                  />

                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    loading={isSavingPin}
                  >
                    Кириш
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("reset-pin");
                      setPin("");
                      setConfirmPin("");
                      setResetPassword("");
                      setError("");
                    }}
                    className="w-full text-xs text-blue-600 hover:text-blue-700 py-2"
                  >
                    ПИН код эсдан чиқдими?
                  </button>
                </form>
              </>
            )}

            {/* ============================================== */}
            {/* RESET PIN */}
            {/* ============================================== */}

            {step === "reset-pin" && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <LockKeyhole size={20} className="text-blue-600" />
                  </div>

                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">
                      ПИН кодни тиклаш
                    </h1>

                    <p className="text-xs text-gray-400 mt-0.5">
                      Дастурни биринчи марта ўрнатгандаги логин ва
                      паролни киритинг. Интернет керак.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleResetPin} className="space-y-4">
                  <Input
                    label={t("login.username")}
                    type="text"
                    autoComplete="username"
                    value={resetUsername}
                    onChange={(event) => setResetUsername(event.target.value)}
                    autoFocus
                  />

                  <Input
                    label={t("login.password")}
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                  />

                  <Input
                    label="Янги 4 хонали ПИН"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={4}
                    placeholder="••••"
                    value={pin}
                    onChange={(event) =>
                      setPin(normalizePin(event.target.value))
                    }
                  />

                  <Input
                    label="ПИН кодни такрорланг"
                    type="password"
                    inputMode="numeric"
                    autoComplete="new-password"
                    maxLength={4}
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(event) =>
                      setConfirmPin(normalizePin(event.target.value))
                    }
                  />

                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    loading={isSavingPin}
                  >
                    ПИНни янгилаш ва кириш
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep("pin-login");
                      setPin("");
                      setConfirmPin("");
                      setResetPassword("");
                      setError("");
                    }}
                    className="w-full text-xs text-gray-500 hover:text-gray-700 py-2"
                  >
                    Орқага қайтиш
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
