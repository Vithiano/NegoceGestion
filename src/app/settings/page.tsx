"use client";

import { useState, useEffect } from "react";
import { Save, Building2, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/utils/supabase";

export default function SettingsPage() {
  const [companyName, setCompanyName] = useState("");
  const [invoiceFormat, setInvoiceFormat] = useState("FAC-YYYYMM-XXXX");
  const [donFormat, setDonFormat] = useState("DON-YYYYMM-XXXX");
  const [destructionFormat, setDestructionFormat] = useState("DES-YYYYMM-XXXX");
  const [logo, setLogo] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [rcc, setRcc] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [capital, setCapital] = useState("");
  const [address, setAddress] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("settings").select("*").limit(1).single();
      
      if (data) {
        setCompanyName(data.company_name || "");
        setInvoiceFormat(data.invoice_format || "FAC-YYYYMM-XXXX");
        setDonFormat(data.don_format || "DON-YYYYMM-XXXX");
        setDestructionFormat(data.destruction_format || "DES-YYYYMM-XXXX");
        setLogo(data.logo || "");
        setPhone(data.phone || "");
        setEmail(data.email || "");
        setRcc(data.rcc || "");
        setBankAccount(data.bank_account || "");
        setCapital(data.capital || "");
        setAddress(data.address || "");
      } else if (error && error.code !== "PGRST116") {
        // PGRST116 is "no rows returned", which is fine for first load
        console.error("Error fetching settings:", error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!companyName) {
      showNotification("error", "Le nom de l'entreprise est obligatoire.");
      return;
    }

    setIsSaving(true);
    try {
      // First, check if a row exists
      const { data: existingData } = await supabase.from("settings").select("id").limit(1).single();

      const payload = {
        company_name: companyName,
        invoice_format: invoiceFormat,
        don_format: donFormat,
        destruction_format: destructionFormat,
        logo,
        phone,
        email,
        rcc,
        bank_account: bankAccount,
        capital,
        address
      };

      if (existingData) {
        // Update existing
        const { error } = await supabase
          .from("settings")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", existingData.id);
          
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("settings")
          .insert([payload]);
          
        if (error) throw error;
      }
      
      showNotification("success", "Les paramètres ont été sauvegardés avec succès.");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      const errorMsg = err?.message || err?.error_description || JSON.stringify(err);
      showNotification("error", "Erreur lors de la sauvegarde: " + errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Paramètres</h2>
          <p className="text-sm text-gray-500 mt-1">Gérez les informations de votre entreprise et les préférences du système.</p>
        </div>
      </div>

      {notification && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          notification.type === "success" 
            ? "bg-green-50 border-green-200 text-green-800" 
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          {notification.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          <p className="text-sm font-medium">{notification.message}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Informations de l'Entreprise</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="companyName" className="text-sm font-medium text-gray-700">
                Nom de l'entreprise <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ex: Gecko Negoce S.A"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Téléphone</label>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ex: +225 000 000 00" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ex: contact@entreprise.com" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Adresse</label>
              <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ex: 29 Rue de l'Industrie Zone 3, Abidjan" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">RCCM / C.C. N°</label>
                <input type="text" value={rcc} onChange={(e) => setRcc(e.target.value)} placeholder="Ex: CI-ABJ-1972-B-9663" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Capital Social</label>
                <input type="text" value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="Ex: 1.000.000.000 F CFA" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Compte Bancaire</label>
              <input type="text" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="Ex: BANK CI 042 01212... " className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">URL du Logo</label>
              <input type="text" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-800">Numérotation</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="invoiceFormat" className="text-sm font-medium text-gray-700">
                Format des numéros de facture
              </label>
              <input
                type="text"
                id="invoiceFormat"
                value={invoiceFormat}
                onChange={(e) => setInvoiceFormat(e.target.value)}
                placeholder="Ex: FAC-YYYYMM-XXXX"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-mono transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
              <p className="text-xs text-gray-500 mt-1">
                Utilisez YYYY pour l'année, MM pour le mois, et XXXX pour le numéro séquentiel à 4 chiffres.
              </p>
            </div>
            
            <div className="pt-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Aperçu du prochain numéro de facture</span>
                <span className="font-mono text-sm text-slate-900 font-bold">
                  {invoiceFormat.replace('YYYY', new Date().getFullYear().toString()).replace('MM', (new Date().getMonth() + 1).toString().padStart(2, '0')).replace('XXXX', '0001')}
                </span>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <label htmlFor="donFormat" className="text-sm font-medium text-gray-700">
                Format des numéros de Don
              </label>
              <input
                type="text"
                id="donFormat"
                value={donFormat}
                onChange={(e) => setDonFormat(e.target.value)}
                placeholder="Ex: DON-YYYYMM-XXXX"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-mono transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
            
            <div className="pt-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Aperçu du prochain numéro de don</span>
                <span className="font-mono text-sm text-slate-900 font-bold">
                  {donFormat.replace('YYYY', new Date().getFullYear().toString()).replace('MM', (new Date().getMonth() + 1).toString().padStart(2, '0')).replace('XXXX', '0001')}
                </span>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              <label htmlFor="destructionFormat" className="text-sm font-medium text-gray-700">
                Format des numéros de Destruction
              </label>
              <input
                type="text"
                id="destructionFormat"
                value={destructionFormat}
                onChange={(e) => setDestructionFormat(e.target.value)}
                placeholder="Ex: DES-YYYYMM-XXXX"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-mono transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
            </div>
            
            <div className="pt-2">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Aperçu du prochain numéro de destruction</span>
                <span className="font-mono text-sm text-slate-900 font-bold">
                  {destructionFormat.replace('YYYY', new Date().getFullYear().toString()).replace('MM', (new Date().getMonth() + 1).toString().padStart(2, '0')).replace('XXXX', '0001')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={saveSettings}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
          ) : (
            <Save className="h-4 w-4" />
          )}
          {isSaving ? "Sauvegarde..." : "Enregistrer les paramètres"}
        </button>
      </div>
    </div>
  );
}
