"use client";

import { useState, useEffect } from "react";
import { Plus, Lock, Unlock, Calendar as CalendarIcon, X, Save } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useNotification } from "@/components/providers/NotificationProvider";

interface Period {
  id: string;
  month: number;
  year: number;
  status: "OPEN" | "CLOSED";
}

const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export default function ExercicesPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMonth, setFormMonth] = useState(new Date().getMonth() + 1);
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [isSaving, setIsSaving] = useState(false);
  const { showNotification, showConfirm } = useNotification();

  useEffect(() => {
    fetchPeriods();
  }, []);

  const fetchPeriods = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("accounting_periods")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false });
      
    if (!error && data) setPeriods(data as Period[]);
    setIsLoading(false);
  };

  const handleOpenModal = () => {
    setFormMonth(new Date().getMonth() + 1);
    setFormYear(new Date().getFullYear());
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      // Check if already exists
      const existing = periods.find(p => p.month === formMonth && p.year === formYear);
      if (existing) {
        throw new Error("Cette période existe déjà.");
      }

      const { error } = await supabase
        .from("accounting_periods")
        .insert([{ month: formMonth, year: formYear, status: 'OPEN' }]);
        
      if (error) throw error;

      setIsModalOpen(false);
      fetchPeriods();
      showNotification("Période comptable enregistrée !", "success");
    } catch (error: any) {
      showNotification("Erreur: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStatus = async (period: Period) => {
    const newStatus = period.status === "OPEN" ? "CLOSED" : "OPEN";
    const msg = newStatus === "CLOSED" 
      ? `Êtes-vous sûr de vouloir CLÔTURER la période de ${MONTHS[period.month-1]} ${period.year} ? Vous ne pourrez plus enregistrer d'écritures pour cette période.` 
      : `Êtes-vous sûr de vouloir RÉOUVRIR la période de ${MONTHS[period.month-1]} ${period.year} ?`;
      
    showConfirm(msg, async () => {
      try {
        const { error } = await supabase
          .from("accounting_periods")
          .update({ status: newStatus })
          .eq("id", period.id);
          
        if (error) throw error;
        fetchPeriods();
        showNotification("Statut de la période mis à jour.", "success");
      } catch (error: any) {
        showNotification("Erreur lors de la modification du statut.", "error");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Périodes Comptables</h2>
          <p className="text-sm text-gray-500">Gérez les mois et exercices comptables (Ouverture/Clôture).</p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition transform hover:-translate-y-0.5 text-sm font-medium flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" /> Ouvrir une Période
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Période</th>
                <th className="px-6 py-4 font-medium">Année</th>
                <th className="px-6 py-4 font-medium text-center">Statut</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : periods.length > 0 ? (
                periods.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-bold text-gray-800 flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-gray-400" />
                      {MONTHS[item.month - 1]}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-600">{item.year}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 inline-flex items-center gap-1.5 rounded-full text-xs font-bold border ${
                        item.status === 'OPEN' 
                          ? 'bg-green-100 text-green-700 border-green-200' 
                          : 'bg-red-100 text-red-700 border-red-200'
                      }`}>
                        {item.status === 'OPEN' ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                        {item.status === 'OPEN' ? 'OUVERTE' : 'CLÔTURÉE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => toggleStatus(item)}
                        className={`text-sm px-3 py-1.5 rounded font-medium transition ${
                          item.status === 'OPEN' 
                            ? 'text-red-600 hover:bg-red-50 border border-red-100' 
                            : 'text-green-600 hover:bg-green-50 border border-green-100'
                        }`}
                      >
                        {item.status === 'OPEN' ? 'Clôturer' : 'Réouvrir'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Aucune période comptable n'a été créée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">Nouvelle Période</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Mois</label>
                <select 
                  value={formMonth}
                  onChange={(e) => setFormMonth(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Année</label>
                <input 
                  type="number" 
                  min="2020" max="2100"
                  required
                  value={formYear}
                  onChange={(e) => setFormYear(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                />
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
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? "Création..." : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
