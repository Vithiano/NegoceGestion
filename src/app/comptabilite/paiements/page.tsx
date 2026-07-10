"use client";

import { useState, useEffect } from "react";
import { Plus, Search, CheckCircle2, FileText, CreditCard, X } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useNotification } from "@/components/providers/NotificationProvider";

export default function PaiementsPage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAmount, setFormAmount] = useState(0);
  const [formMethod, setFormMethod] = useState("TRANSFER");
  const [formInvoiceId, setFormInvoiceId] = useState("");
  const [formReference, setFormReference] = useState("");
  
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    // Fetch payments
    const { data: paymentsData } = await supabase
      .from("payments")
      .select(`*, invoices(invoice_number, clients(name))`)
      .order("date", { ascending: false });

    // Fetch unpaid/validated invoices for the dropdown
    const { data: invoicesData } = await supabase
      .from("invoices")
      .select(`id, invoice_number, total_ttc, status, clients(name)`)
      .in("status", ["VALIDATED", "UNPAID"])
      .order("created_at", { ascending: false });

    if (paymentsData) setPayments(paymentsData);
    if (invoicesData) setInvoices(invoicesData);
    setIsLoading(false);
  };

  const handleInvoiceSelect = (invId: string) => {
    setFormInvoiceId(invId);
    const inv = invoices.find(i => i.id === invId);
    if (inv) {
      setFormAmount(inv.total_ttc);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formInvoiceId || formAmount <= 0) return showNotification("Veuillez remplir correctement les champs.", "error");

    setIsSaving(true);
    try {
      // 1. Vérification Période
      const issueMonth = new Date(formDate).getMonth() + 1;
      const issueYear = new Date(formDate).getFullYear();
      const { data: period } = await supabase
        .from("accounting_periods")
        .select("id, status")
        .eq("month", issueMonth)
        .eq("year", issueYear)
        .single();
        
      if (!period || period.status !== "OPEN") {
        throw new Error(`La période comptable (${issueMonth}/${issueYear}) n'est pas ouverte.`);
      }

      // 2. Insertion Paiement
      const { data: paymentData, error: payError } = await supabase.from("payments").insert([{
        invoice_id: formInvoiceId,
        date: formDate,
        amount: formAmount,
        method: formMethod,
        period_id: period.id,
        reference_tx: formReference
      }]).select().single();

      if (payError) throw payError;

      // 3. Mise à jour statut facture
      // Note: On passe directement à PAID pour simplifier, idéalement on vérifierait si le solde est 0
      await supabase.from("invoices").update({ status: 'PAID' }).eq("id", formInvoiceId);

      // 4. Génération du Lettrage Code (Ex: LET-ID)
      const lettrageCode = `L-${paymentData.id.split('-')[0].toUpperCase()}`;

      // 5. Écritures Comptables
      const accountDebit = formMethod === 'CASH' ? '571' : '521'; // Caisse ou Banque
      
      const journalEntries = [
        {
          date: formDate,
          account_number: accountDebit, // Banque/Caisse
          debit: formAmount,
          credit: 0,
          reference_id: paymentData.id,
          period_id: period.id,
          lettrage_code: lettrageCode
        },
        {
          date: formDate,
          account_number: "411", // Clients
          debit: 0,
          credit: formAmount,
          reference_id: paymentData.id,
          period_id: period.id,
          lettrage_code: lettrageCode
        }
      ];

      const { error: journalError } = await supabase.from("journal_entries").insert(journalEntries);
      if (journalError) throw journalError;

      // 6. Mettre à jour l'écriture d'origine de la facture (pour lettrer le compte 411)
      await supabase
        .from("journal_entries")
        .update({ lettrage_code: lettrageCode })
        .eq("reference_id", formInvoiceId)
        .eq("account_number", "411");

      setIsModalOpen(false);
      setFormInvoiceId("");
      setFormAmount(0);
      setFormReference("");
      fetchData();
      showNotification("Paiement enregistré et lettrage effectué avec succès !", "success");
    } catch (error: any) {
      showNotification("Erreur: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = payments.filter(p => 
    p.invoices?.invoice_number?.toLowerCase().includes(search.toLowerCase()) || 
    p.invoices?.clients?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Trésorerie & Paiements</h2>
          <p className="text-sm text-gray-500">Enregistrez les règlements clients et générez le lettrage automatique.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition transform hover:-translate-y-0.5 text-sm font-medium flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" /> Nouveau Règlement
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par facture ou client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Facture Réf.</th>
                <th className="px-6 py-4 font-medium">Client</th>
                <th className="px-6 py-4 font-medium text-center">Méthode</th>
                <th className="px-6 py-4 font-medium text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(item.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 font-semibold text-blue-600">
                      {item.invoices?.invoice_number}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {item.invoices?.clients?.name}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                        {item.method}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-800">
                      {item.amount.toLocaleString('fr-FR')} FCFA
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Aucun paiement enregistré.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">Saisir un Règlement</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="h-5 w-5 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Facture à régler *</label>
                <select 
                  required
                  value={formInvoiceId}
                  onChange={(e) => handleInvoiceSelect(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  <option value="">Sélectionner une facture...</option>
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} - {inv.clients?.name} ({inv.total_ttc.toLocaleString('fr-FR')} FCFA)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Date *</label>
                  <input 
                    type="date" 
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Montant *</label>
                  <input 
                    type="number" 
                    required min="1"
                    value={formAmount}
                    onChange={(e) => setFormAmount(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Mode de paiement *</label>
                  <select 
                    required
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  >
                    <option value="TRANSFER">Virement / Transfert</option>
                    <option value="CASH">Espèces (Caisse)</option>
                    <option value="CHECK">Chèque</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Référence (Optionnel)</label>
                  <input 
                    type="text" 
                    value={formReference}
                    onChange={(e) => setFormReference(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                    placeholder="Ex: Virement N°123"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition flex items-center"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {isSaving ? "Enregistrement..." : "Valider Paiement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
