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
  const [companyName, setCompanyName] = React.useState('Shuhrat')
  const [phone, setPhone] = React.useState('97 677 23 01')
  
  // 💡 YANGI QO'SHILGAN DINAMIK MAYDONLAR REPLICA STATE'LARI:
  const [companyDescription, setCompanyDescription] = React.useState('Sifatli mebellar maskani')
  const [companyAddress, setCompanyAddress] = React.useState('')
  const [thanksMessage, setThanksMessage] = React.useState('Xaridingiz uchun rahmat!')
  
  const [isLoadingPrinters, setIsLoadingPrinters] = React.useState(false)

  React.useEffect(() => {
    // LocalStorage xotirasidan o'qish
    const savedPrinter = localStorage.getItem('selected_printer')
    if (savedPrinter) setSelectedPrinter(savedPrinter)

    const savedCompany = localStorage.getItem('printer_company_name')
    if (savedCompany) setCompanyName(savedCompany)

    const savedPhone = localStorage.getItem('printer_phone')
    if (savedPhone) setPhone(savedPhone)

    // 💡 Xotiradan yangi kalitlarni o'qish:
    const savedDesc = localStorage.getItem('printer_company_description')
    if (savedDesc) setCompanyDescription(savedDesc)

    const savedAddr = localStorage.getItem('printer_company_address')
    if (savedAddr) setCompanyAddress(savedAddr)

    const savedThanks = localStorage.getItem('printer_thanks_message')
    if (savedThanks) setThanksMessage(savedThanks)

    const savedType = localStorage.getItem('printer_connection_type') as 'test' | 'lan' | 'usb'
    if (savedType) setConnectionType(savedType)

    const fetchSystemPrinters = async () => {
      setIsLoadingPrinters(true)
      try {
        const globalWindow = window as any
        if (globalWindow.electron && globalWindow.electron.ipcRenderer) {
          const systemPrinters = await globalWindow.electron.ipcRenderer.invoke('get-printers')
          setPrinters(systemPrinters || [])
        } else if (globalWindow.require) {
          const { ipcRenderer } = globalWindow.require('electron')
          const systemPrinters = await ipcRenderer.invoke('get-printers')
          setPrinters(systemPrinters || [])
        } else {
          setPrinters([
            { name: 'Xprinter XP-80T', isDefault: true, status: 0 },
            { name: 'XP-80', isDefault: false, status: 0 }
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

  const handlePrinterChange = (name: string) => {
    setSelectedPrinter(name)
    localStorage.setItem('selected_printer', name)
  }

  const handleTypeChange = (type: 'test' | 'lan' | 'usb') => {
    setConnectionType(type)
    localStorage.setItem('printer_connection_type', type)
  }

  // 💡 O'zgarishlarni xotiraga saqlash mantiqi:
  const handleSaveChanges = () => {
    localStorage.setItem('printer_company_name', companyName)
    localStorage.setItem('printer_phone', phone)
    localStorage.setItem('printer_company_description', companyDescription)
    localStorage.setItem('printer_company_address', companyAddress)
    localStorage.setItem('printer_thanks_message', thanksMessage)
    alert("Sozlamalar muvaffaqiyatli saqlandi! 💾")
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold text-gray-900">🖨️ Printer sozlamalari</h1>
        <p className="text-sm text-gray-500 mt-1">Xprinter XP-80T printerini va chek shablonini sozlash</p>
      </div>

      {/* ULANISH TURI */}
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

          {/* 💡 YANGI QO'SHILGAN MAYDONLAR INPUTLARI: */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">Firma Izohi (Slogan)</label>
            <input
              type="text"
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
              placeholder="Masalan: Sifatli mebellar maskani"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 uppercase">Firma Manzili</label>
            <input
              type="text"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
              placeholder="Masalan: Toshkent sh., Chilonzor"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase">Chek ostidagi Rahmatnoma matni</label>
          <input
            type="text"
            value={thanksMessage}
            onChange={(e) => setThanksMessage(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
          />
        </div>

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
              <option value="">Printerlar topilmadi</option>
            ) : (
              printers.map((p, idx) => (
                <option key={idx} value={p.name}>
                  {p.name} {p.isDefault ? '(Standart)' : ''}
                </option>
              ))
            )}
          </select>
        </div>

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
