"use client";

import { useState, useEffect } from "react";
import { Search, BarChart, Filter, Printer } from "lucide-react";
import { supabase } from "@/utils/supabase";

interface VATGroup {
  rate: number;
  totalHT: number;
  totalTax: number;
  totalTTC: number;
}

export default function CATvaPage() {
  const [data, setData] = useState<VATGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Récupérer les factures validées/payées sur la période
      const { data: invoices, error: invError } = await supabase
        .from("invoices")
        .select("id, invoice_number")
        .in("status", ["VALIDATED", "PAID"])
        .gte("date", startDate)
        .lte("date", endDate);

      if (invError) throw invError;

      if (!invoices || invoices.length === 0) {
        setData([]);
        setIsLoading(false);
        return;
      }

      const invoiceIds = invoices.map(i => i.id);

      // 2. Récupérer les lignes de ces factures
      const { data: lines, error: linesError } = await supabase
        .from("invoice_lines")
        .select("quantity, unit_price_ht, tax_amount, total_ttc")
        .in("invoice_id", invoiceIds);

      if (linesError) throw linesError;

      // 3. Agrégation par taux de TVA
      const groups: Record<number, VATGroup> = {};

      (lines || []).forEach(line => {
        const ht = line.quantity * line.unit_price_ht;
        const tax = line.tax_amount || 0;
        const ttc = line.total_ttc || (ht + tax);
        
        // Calcul du taux avec arrondi à l'entier le plus proche
        let rate = 0;
        if (ht > 0) {
          rate = Math.round((tax / ht) * 100);
        }

        if (!groups[rate]) {
          groups[rate] = { rate, totalHT: 0, totalTax: 0, totalTTC: 0 };
        }
        
        groups[rate].totalHT += ht;
        groups[rate].totalTax += tax;
        groups[rate].totalTTC += ttc;
      });

      // Convertir l'objet en tableau trié par taux croissant
      const sortedData = Object.values(groups).sort((a, b) => a.rate - b.rate);
      setData(sortedData);

    } catch (error) {
      console.error("Erreur lors de la récupération des données CA/TVA :", error);
    } finally {
      setIsLoading(false);
    }
  };

  const globalTotalHT = data.reduce((sum, item) => sum + item.totalHT, 0);
  const globalTotalTax = data.reduce((sum, item) => sum + item.totalTax, 0);
  const globalTotalTTC = data.reduce((sum, item) => sum + item.totalTTC, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 p-print-0" id="print-area">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Chiffre d'Affaire par Taux de TVA/AIRSI</h2>
          <p className="text-sm text-gray-500">Visualisez la répartition de votre CA et des taxes collectées.</p>
        </div>
        <button 
          onClick={handlePrint}
          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg shadow-sm transition text-sm font-medium flex items-center"
        >
          <Printer className="h-4 w-4 mr-2" /> Imprimer / Exporter
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-wrap gap-4 items-end no-print">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Date de début</label>
          <input 
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Date de fin</label>
          <input 
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <button 
          onClick={fetchData}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow-md transition transform hover:-translate-y-0.5 text-sm font-medium flex items-center"
        >
          <Filter className="h-4 w-4 mr-2" /> Filtrer
        </button>
      </div>
      
      <div className="hidden print-only print-header mb-8">
        <h1 className="text-2xl font-bold mb-2">Chiffre d'Affaire par Taux de TVA/AIRSI</h1>
        <p className="text-gray-600">Période du {new Date(startDate).toLocaleDateString('fr-FR')} au {new Date(endDate).toLocaleDateString('fr-FR')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print-grid">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 print-border">
          <p className="text-sm font-medium text-gray-500 mb-1">Total Chiffre d'Affaires HT</p>
          <h3 className="text-3xl font-bold text-gray-800">{globalTotalHT.toLocaleString('fr-FR')} <span className="text-lg text-gray-500 font-normal">FCFA</span></h3>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 print-border">
          <p className="text-sm font-medium text-gray-500 mb-1">Total TVA/AIRSI Collectée</p>
          <h3 className="text-3xl font-bold text-blue-600">{globalTotalTax.toLocaleString('fr-FR')} <span className="text-lg text-blue-400 font-normal">FCFA</span></h3>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 print-border">
          <p className="text-sm font-medium text-gray-500 mb-1">Total TTC</p>
          <h3 className="text-3xl font-bold text-gray-800">{globalTotalTTC.toLocaleString('fr-FR')} <span className="text-lg text-gray-500 font-normal">FCFA</span></h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print-border mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium border-b border-gray-200">Taux de Taxe (TVA/AIRSI)</th>
                <th className="px-6 py-4 font-medium text-right border-b border-gray-200">Base HT (Chiffre d'Affaire)</th>
                <th className="px-6 py-4 font-medium text-right border-b border-gray-200">Montant Taxe</th>
                <th className="px-6 py-4 font-medium text-right border-b border-gray-200">Total TTC</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Chargement des données...</td></tr>
              ) : data.length > 0 ? (
                data.map((item, index) => (
                  <tr key={index} className="hover:bg-blue-50/50 transition">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-bold bg-purple-100 text-purple-700">
                        {item.rate} %
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-800">
                      {item.totalHT.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-blue-600">
                      {item.totalTax.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-800">
                      {item.totalTTC.toLocaleString('fr-FR')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Aucune donnée pour cette période.
                  </td>
                </tr>
              )}
            </tbody>
            {data.length > 0 && (
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td className="px-6 py-4 text-gray-700 uppercase text-xs tracking-wider">Total Général</td>
                  <td className="px-6 py-4 text-right text-gray-900">{globalTotalHT.toLocaleString('fr-FR')}</td>
                  <td className="px-6 py-4 text-right text-blue-700">{globalTotalTax.toLocaleString('fr-FR')}</td>
                  <td className="px-6 py-4 text-right text-gray-900">{globalTotalTTC.toLocaleString('fr-FR')}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .print-only { display: none; }
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .print-border {
            border: 1px solid #e5e7eb !important;
            box-shadow: none !important;
          }
          .print-grid {
            display: flex !important;
            justify-content: space-between !important;
            gap: 1rem !important;
          }
          .print-grid > div {
            flex: 1 !important;
            min-width: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 1.5cm;
          }
        }
      `}} />
    </div>
  );
}
