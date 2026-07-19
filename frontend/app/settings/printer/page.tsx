'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface ElectronPrinter {
  name: string
  isDefault: boolean
  status: number
}

export default function PrinterSettingsPage() {
  const [connectionType, setConnectionType] = React.useState<'test' | 'lan' | 'usb'>('usb')
  const [printers, setPrinters] = React.useState<ElectronPrinter[]>([])
  const [selectedPrinter, setSelectedPrinter] = React.useState<string>('')
  const [companyName, setCompanyName] = React.useState('BLISS MEBEL')
  const [phone, setPhone] = React.useState('+998 90 123 45 67')
  const [isLoadingPrinters, setIsLoadingPrinters] = React.useState(false)

  // 1. Sahifa yuklanganda saqlangan sozlamalarni va Electron printerlarini yuklash
  React.useEffect(() => {
    // LocalStorage xotirasidan o'qish
    const savedPrinter = localStorage.getItem('selected_printer')
    if (savedPrinter) setSelectedPrinter(savedPrinter)

    const savedCompany = localStorage.getItem('printer_company_name')
    if (savedCompany) setCompanyName(savedCompany)

    const savedPhone = localStorage.getItem('printer_phone')
    if (savedPhone) setPhone(savedPhone)

    const savedType = localStorage.getItem('printer_connection_type') as 'test' | 'lan' | 'usb'
    if (savedType) setConnectionType(savedType)

    // Electron orqali kompyuterdagi drayverlar ro'yxatini olish
    const fetchSystemPrinters = async () => {
      setIsLoadingPrinters(true)
      try {
        const globalWindow = window as any
        // Electron muhitini tekshirish va IPC invoke qilish
        if (globalWindow.electron && globalWindow.electron.ipcRenderer) {
          const systemPrinters = await globalWindow.electron.ipcRenderer.invoke('get-printers')
          setPrinters(systemPrinters || [])
          
          // Agar xotira bo'sh bo'lsa, standart (default) printerni tanlab qo'yish
          if (!savedPrinter && systemPrinters && systemPrinters.length > 0) {
            const defaultPrinter = systemPrinters.find((p: ElectronPrinter) => p.isDefault) || systemPrinters[0]
            setSelectedPrinter(defaultPrinter.name)
            localStorage.setItem('selected_printer', defaultPrinter.name)
          }
        } else if (globalWindow.require) {
          const { ipcRenderer } = globalWindow.require('electron')
          const systemPrinters = await ipcRenderer.invoke('get-printers')
          setPrinters(systemPrinters || [])
        } else {
          console.warn("Electron IPC topilmadi, brauzer rejimida ishlamoqda.")
          // Sinov uchun dummy drayverlar
          setPrinters([
            { name: 'XP-80', isDefault: true, status: 0 },
            { name: 'Xprinter XP-80T', isDefault: false, status: 0 }
          ])
        }
      } catch (err) {
        console.error("Printerlarni olishda xatolik:", err)
      } finally {
        setIsLoadingPrinters(false)
      }
    }

    fetchSystemPrinters()
  }, [])

  // 2. Printer o'zgarganda xotiraga saqlash funksiyasi
  const handlePrinterChange = (name: string) => {
    setSelectedPrinter(name)
    localStorage.setItem('selected_printer', name)
  }

  // Ulanish turi o'zgarganda saqlash
  const handleTypeChange = (type: 'test' | 'lan' | 'usb') => {
    setConnectionType(type)
    localStorage.setItem('printer_connection_type', type)
  }

  // Matnli ma'lumotlar o'zgarganda saqlash funksiyasi
  const handleSaveChanges = () => {
    localStorage.setItem('printer_company_name', companyName)
    localStorage.setItem('printer_phone', phone)
    alert("Sozlamalar muvaffaqiyatli saqlandi! 💾")
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">🖨️ Printer sozlamalari</h1>
        <p className="text-sm text-gray-500 mt-1">Xprinter XP-80T printerini va chek shablonini sozlash</p>
      </div>

      {/* ULANISH TURI SEKTORI */}
      <div className="bg-white border rounded-xl p-5 space-y-4 shadow-sm">
        <h3 className="font-medium text-gray-900">Ulanish turi</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => handleTypeChange('test')}
            className={cn(
              "p-4 border rounded-xl text-left space-y-1 transition",
              connectionType === 'test' ? "border-blue-600 bg-blue-50/50" : "hover:bg-gray-50"
            )}
          >
            <div className="text-lg">🖥️</div>
            <div className="font-semibold text-sm">Test rejimi</div>
            <div className="text-xs text-gray-400">Printer ulanmagan</div>
          </button>

          <button
            onClick={() => handleTypeChange('lan')}
            className={cn(
              "p-4 border rounded-xl text-left space-y-1 transition",
              connectionType === 'lan' ? "border-blue-600 bg-blue-50/50" : "hover:bg-gray-50"
            )}
          >
            <div className="text-lg">📶</div>
            <div className="font-semibold text-sm">LAN</div>
            <div className="text-xs text-gray-400">IP-manzil orqali ulanish</div>
          </button>

          <button
            onClick={() => handleTypeChange('usb')}
            className={cn(
              "p-4 border rounded-xl text-left space-y-1 transition",
              connectionType === 'usb' ? "border-blue-600 bg-blue-50/50" : "hover:bg-gray-50"
            )}
          >
            <div className="text-lg">🔌</div>
            <div className="font-semibold text-sm">USB</div>
            <div className="text-xs text-gray-400">Windows drayveri orqali</div>
          </button>
        </div>
      </div>

      {/* PRINTER VA CHEK MA'LUMOTLARI */}
      <div className="bg-white border rounded-xl p-5 space-y-5 shadow-sm">
        <h3 className="font-medium text-gray-900">Printer va chek ma'lumotlari</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">Korxona nomi</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">Aloqa telefoni</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* WINDOWS PRINTER DRAYVERLARINI DINAMIK SELECT QILISH */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase">Windows printer nomi</label>
          <select
            value={selectedPrinter}
            onChange={(e) => handlePrinterChange(e.target.value)}
            disabled={isLoadingPrinters}
            className="w-full border bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600 disabled:bg-gray-100"
          >
            {isLoadingPrinters ? (
              <option>Printerlar yuklanmoqda...</option>
            ) : printers.length === 0 ? (
              <option value="">Printerlar topilmadi (XP-80 standart o'rnatiladi)</option>
            ) : (
              printers.map((p, idx) => (
                <option key={idx} value={p.name}>
                  {p.name} {p.isDefault ? '(Standart)' : ''}
                </option>
              ))
            )}
          </select>
          <p className="text-[11px] text-gray-400">Windows tizimida "Printers & Scanners" bo'limida o'rnatilgan drayverlar avtomatik aniqlanadi.</p>
        </div>

        {/* SAQLASH TUGMASI */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveChanges}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-lg shadow-sm transition"
          >
            O'zgarishlarni Saqlash 💾
          </button>
        </div>
      </div>
    </div>
  )
}
