"use client";

import { useEffect, useState } from "react";
import {
  Printer,
  Save,
  TestTube2,
  Wifi,
  Usb,
  Monitor,
} from "lucide-react";

import { useAuthStore } from "@/store";

type ConnectionType =
  | "mock"
  | "lan"
  | "usb";

interface PrinterSettings {
  id?: string;
  companyName: string;
  companyPhone: string;
  connectionType: ConnectionType;
  printerName: string;
  ip: string;
  port: number;
  paperWidth: number;
}

interface WindowsPrinter {
  Name: string;
  DriverName: string;
  PortName: string;
}

const API_URL =
  "http://127.0.0.1:3008/crm";

export default function PrinterSettingsPage() {
  const token = useAuthStore(
    (state) => state.token,
  );

  const [settings, setSettings] =
    useState<PrinterSettings>({
      companyName: "BLISS MEBEL",
      companyPhone: "",
      connectionType: "mock",
      printerName: "",
      ip: "",
      port: 9100,
      paperWidth: 80,
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [testing, setTesting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [printers, setPrinters] =
    useState<WindowsPrinter[]>([]);

  const [printersLoading, setPrintersLoading] =
    useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    loadSettings();
  }, [token]);

  async function loadSettings() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/printer/settings`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Printer sozlamalarini olishda xato",
        );
      }

      setSettings({
        id: data.id,
        companyName: data.companyName || "BLISS MEBEL",
        companyPhone: data.companyPhone || "",
        connectionType:
          data.connectionType || "mock",
        printerName:
          data.printerName || "",
        ip: data.ip || "",
        port: Number(data.port) || 9100,
        paperWidth:
          Number(data.paperWidth) || 80,
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Xatolik yuz berdi",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadWindowsPrinters() {
    try {
      setPrintersLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/printer/windows-printers`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Printerlarni olishda xato",
        );
      }

      setPrinters(data.printers || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Printerlarni olishda xato",
      );
    } finally {
      setPrintersLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_URL}/printer/settings`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify(settings),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Saqlashda xato",
        );
      }

      if (data.settings) {
        setSettings({
          id: data.settings.id,

          companyName: data.settings.companyName || "BLISS MEBEL",
          companyPhone: data.settings.companyPhone || "",

          connectionType:
            data.settings.connectionType,

          printerName:
            data.settings.printerName || "",

          ip:
            data.settings.ip || "",

          port:
            Number(data.settings.port) ||
            9100,

          paperWidth:
            Number(
              data.settings.paperWidth,
            ) || 80,
        });
      }

      setMessage(
        "Printer sozlamalari saqlandi",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Saqlashda xato",
      );
    } finally {
      setSaving(false);
    }
  }

  async function testPrinter() {
    try {
      setTesting(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_URL}/printer/test`,
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Test chop etishda xato",
        );
      }

      setMessage(
        data.message ||
          "Test chek printerga yuborildi",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Printer xatosi",
      );
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-blue-600" />

          <p className="mt-4 text-sm text-gray-500">
            Printer sozlamalari yuklanmoqda...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900">
          <Printer className="h-7 w-7" />

          Printer sozlamalari
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Xprinter XP-80T printerini sozlash
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Ulanish turi
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <ConnectionButton
            active={
              settings.connectionType ===
              "mock"
            }
            icon={Monitor}
            title="Test rejimi"
            description="Printer ulanmagan"
            onClick={() =>
              setSettings((state) => ({
                ...state,
                connectionType: "mock",
              }))
            }
          />

          <ConnectionButton
            active={
              settings.connectionType ===
              "lan"
            }
            icon={Wifi}
            title="LAN"
            description="IP orqali ulanish"
            onClick={() =>
              setSettings((state) => ({
                ...state,
                connectionType: "lan",
              }))
            }
          />

          <ConnectionButton
            active={
              settings.connectionType ===
              "usb"
            }
            icon={Usb}
            title="USB"
            description="Windows printer"
            onClick={() => {
              setSettings((state) => ({
                ...state,
                connectionType: "usb",
              }));

              loadWindowsPrinters();
            }}
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">
          Printer ma&apos;lumotlari
        </h2>

        <div className="mt-5 space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Korxona nomi
              </label>
              <input
                type="text"
                value={settings.companyName}
                placeholder="BLISS MEBEL"
                onChange={(event) =>
                  setSettings((state) => ({
                    ...state,
                    companyName: event.target.value,
                  }))
                }
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Aloqa telefoni
              </label>
              <input
                type="text"
                value={settings.companyPhone}
                placeholder="+998 90 123 45 67"
                onChange={(event) =>
                  setSettings((state) => ({
                    ...state,
                    companyPhone: event.target.value,
                  }))
                }
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {settings.connectionType ===
            "lan" && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Printer IP manzili
                </label>

                <input
                  type="text"
                  value={settings.ip}
                  placeholder="192.168.1.100"
                  onChange={(event) =>
                    setSettings((state) => ({
                      ...state,
                      ip: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  TCP port
                </label>

                <input
                  type="number"
                  value={settings.port}
                  onChange={(event) =>
                    setSettings((state) => ({
                      ...state,

                      port:
                        Number(
                          event.target.value,
                        ) || 9100,
                    }))
                  }
                  className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          {settings.connectionType ===
            "usb" && (
            <div>
              <label className="mb-2 block text-sm font-medium">
                Windows printer nomi
              </label>

              <select
                value={settings.printerName}
                onChange={(event) =>
                  setSettings((state) => ({
                    ...state,
                    printerName: event.target.value,
                  }))
                }
                className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
              >
                <option value="">
                  {printersLoading
                    ? "Printerlar qidirilmoqda..."
                    : "Printerni tanlang"}
                </option>

                {printers.map((printer) => (
                  <option
                    key={`${printer.Name}-${printer.PortName}`}
                    value={printer.Name}
                  >
                    {printer.Name} — {printer.PortName}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-gray-500">
                Windows&apos;da o&apos;rnatilgan printerlar avtomatik ko&apos;rsatiladi.
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium">
              Qog&apos;oz kengligi
            </label>

            <select
              value={settings.paperWidth}
              onChange={(event) =>
                setSettings((state) => ({
                  ...state,

                  paperWidth: Number(
                    event.target.value,
                  ),
                }))
              }
              className="w-full rounded-xl border px-4 py-3 outline-none focus:border-blue-500"
            >
              <option value={80}>
                80 mm
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={saveSettings}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-50"
        >
          <Save className="h-5 w-5" />

          {saving
            ? "Saqlanmoqda..."
            : "Saqlash"}
        </button>

        <button
          type="button"
          disabled={testing}
          onClick={testPrinter}
          className="flex items-center gap-2 rounded-xl border px-5 py-3 font-medium disabled:opacity-50"
        >
          <TestTube2 className="h-5 w-5" />

          {testing
            ? "Tekshirilmoqda..."
            : "Test chop etish"}
        </button>
      </div>
    </div>
  );
}

function ConnectionButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-5 text-left transition",

        active
          ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
          : "hover:border-gray-400",
      ].join(" ")}
    >
      <Icon className="h-7 w-7" />

      <div className="mt-4 font-semibold">
        {title}
      </div>

      <div className="mt-1 text-sm text-gray-500">
        {description}
      </div>
    </button>
  );
}