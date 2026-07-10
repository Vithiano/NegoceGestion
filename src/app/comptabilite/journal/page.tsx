"use client";

import { useState, useEffect } from "react";
import { Search, BookOpen, Filter } from "lucide-react";
import { supabase } from "@/utils/supabase";

export default function JournalComptablePage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchJournal();
  }, []);

  const fetchJournal = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("journal_entries")
      .select(`
        *,
        accounts (name),
        accounting_periods (month, year)
      `)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (!error && data) {
      setEntries(data);
    }
    setIsLoading(false);
  };

  const filtered = entries.filter(e => 
    e.account_number.includes(search) || 
    e.accounts?.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.lettrage_code?.toLowerCase().includes(search.toLowerCase()) ||
    e.reference_id?.toLowerCase().includes(search.toLowerCase())
  );

  const totalDebit = filtered.reduce((sum, item) => sum + (Number(item.debit) || 0), 0);
  const totalCredit = filtered.reduce((sum, item) => sum + (Number(item.credit) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Journal Comptable</h2>
          <p className="text-sm text-gray-500">Visualisez toutes les écritures comptables (Grand Livre).</p>
        </div>
        <button 
          onClick={fetchJournal}
          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg shadow-sm transition text-sm font-medium flex items-center"
        >
          <Filter className="h-4 w-4 mr-2" /> Actualiser
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        <div className="p-4 border-b border-gray-100 shrink-0">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher (Compte, Lettrage, Réf)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
              <tr className="text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium border-b border-gray-200">Date</th>
                <th className="px-6 py-4 font-medium border-b border-gray-200">Compte</th>
                <th className="px-6 py-4 font-medium border-b border-gray-200">Réf.</th>
                <th className="px-6 py-4 font-medium border-b border-gray-200">Lettrage</th>
                <th className="px-6 py-4 font-medium text-right border-b border-gray-200">Débit</th>
                <th className="px-6 py-4 font-medium text-right border-b border-gray-200">Crédit</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Chargement des écritures...</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/50 transition">
                    <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                      {new Date(item.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-3">
                      <span className="font-bold text-blue-600">{item.account_number}</span>
                      <span className="text-gray-500 ml-2">- {item.accounts?.name}</span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-400">
                      {item.reference_id?.split('-')[0]}...
                    </td>
                    <td className="px-6 py-3">
                      {item.lettrage_code ? (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-bold font-mono">
                          {item.lettrage_code}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-800">
                      {item.debit > 0 ? Number(item.debit).toLocaleString('fr-FR') : ''}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-800">
                      {item.credit > 0 ? Number(item.credit).toLocaleString('fr-FR') : ''}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Aucune écriture comptable trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Balance */}
        <div className="shrink-0 bg-slate-800 text-white p-4 flex justify-end gap-12 items-center">
          <div className="text-sm text-slate-400 uppercase tracking-widest font-bold">Total Période / Filtre</div>
          <div className="flex gap-12 text-lg font-bold">
            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-400 font-normal uppercase">Débit</span>
              <span>{totalDebit.toLocaleString('fr-FR')}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs text-slate-400 font-normal uppercase">Crédit</span>
              <span>{totalCredit.toLocaleString('fr-FR')}</span>
            </div>
          </div>
          <div className={`ml-8 flex items-center justify-center px-4 py-2 rounded-lg font-bold ${
            totalDebit === totalCredit ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {totalDebit === totalCredit ? 'ÉQUILIBRÉ' : 'DÉSÉQUILIBRE'}
          </div>
        </div>
      </div>
    </div>
  );
}
