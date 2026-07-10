"use client";

import React, { useState, useEffect } from "react";
import { BarChart, Search, Download, Filter, Package, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";
import { supabase } from "@/utils/supabase";

interface StockState {
  code: string;
  designation: string;
  category_name: string;
  purchase_price: number;
  sale_price_ht: number;
  min_stock: number;
  current_quantity: number;
  is_active: boolean;
}

export default function EtatsStockPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stockData, setStockData] = useState<StockState[]>([]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "alert" | "out">("all");

  useEffect(() => {
    fetchStockState();
  }, []);

  const fetchStockState = async () => {
    setIsLoading(true);
    // Fetch articles with their stock and category
    const { data, error } = await supabase
      .from("articles")
      .select("code, designation, purchase_price, sale_price_ht, min_stock, is_active, stock(current_quantity), categories(name)")
      .eq("is_active", true)
      .order("designation", { ascending: true });

    if (!error && data) {
      const formatted = data.map((item: any) => ({
        code: item.code,
        designation: item.designation,
        category_name: item.categories?.name || "Non classé",
        purchase_price: item.purchase_price || 0,
        sale_price_ht: item.sale_price_ht || 0,
        min_stock: item.min_stock || 0,
        current_quantity: item.stock?.[0]?.current_quantity || 0,
        is_active: item.is_active !== false,
      }));
      setStockData(formatted);
    }
    setIsLoading(false);
  };

  // KPIs
  const totalPurchaseValue = stockData.reduce((acc, item) => acc + (item.purchase_price * item.current_quantity), 0);
  const totalSaleValue = stockData.reduce((acc, item) => acc + (item.sale_price_ht * item.current_quantity), 0);
  const articlesInAlert = stockData.filter(item => item.current_quantity <= item.min_stock && item.current_quantity > 0).length;
  const articlesOut = stockData.filter(item => item.current_quantity <= 0).length;

  // Filtering
  const filteredData = stockData.filter((item) => {
    const matchesSearch = item.designation.toLowerCase().includes(search.toLowerCase()) || 
                          item.code.toLowerCase().includes(search.toLowerCase()) ||
                          item.category_name.toLowerCase().includes(search.toLowerCase());
                          
    if (!matchesSearch) return false;
    
    if (filterMode === "alert") return item.current_quantity <= item.min_stock && item.current_quantity > 0;
    if (filterMode === "out") return item.current_quantity <= 0;
    
    return true;
  });

  // Group by family
  const groupedData = filteredData.reduce((acc: { [key: string]: StockState[] }, item) => {
    const family = item.category_name || "Non classé";
    if (!acc[family]) acc[family] = [];
    acc[family].push(item);
    return acc;
  }, {});

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <BarChart className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              États des Stocks
            </h1>
          </div>
          <p className="text-slate-500">
            Consultez les niveaux de stock, les valorisations et les alertes.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button onClick={fetchStockState} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm">
            Actualiser
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm">
            <Download className="w-4 h-4" />
            Exporter
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Valeur Totale (Achat)</p>
              <h3 className="text-2xl font-bold text-gray-900">{totalPurchaseValue.toLocaleString('fr-FR')} F</h3>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><DollarSign className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Valeur Totale (Vente HT)</p>
              <h3 className="text-2xl font-bold text-gray-900">{totalSaleValue.toLocaleString('fr-FR')} F</h3>
            </div>
            <div className="p-2 bg-green-50 text-green-600 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Articles en Alerte</p>
              <h3 className="text-2xl font-bold text-orange-600">{articlesInAlert}</h3>
            </div>
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Ruptures de Stock</p>
              <h3 className="text-2xl font-bold text-red-600">{articlesOut}</h3>
            </div>
            <div className="p-2 bg-red-50 text-red-600 rounded-lg"><Package className="w-5 h-5" /></div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Rechercher par article, code, famille..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition bg-white"
            />
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${filterMode === "all" ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              Tous
            </button>
            <button 
              onClick={() => setFilterMode("alert")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition flex items-center ${filterMode === "alert" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              En Alerte
            </button>
            <button 
              onClick={() => setFilterMode("out")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition flex items-center ${filterMode === "out" ? "bg-red-100 text-red-700 border-red-200" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              Rupture
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto custom-scrollbar max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white shadow-sm z-10">
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Article</th>
                <th className="px-6 py-4 font-medium text-center">Quantité</th>
                <th className="px-6 py-4 font-medium text-center">Stock Min</th>
                <th className="px-6 py-4 font-medium text-center">Statut</th>
                <th className="px-6 py-4 font-medium text-right">Valeur Achat</th>
                <th className="px-6 py-4 font-medium text-right">Valeur Vente (HT)</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Chargement des données...</td></tr>
              ) : filteredData.length > 0 ? (
                Object.entries(groupedData).sort().map(([family, items]) => (
                  <React.Fragment key={family}>
                    <tr className="bg-gray-100/50">
                      <td colSpan={6} className="px-6 py-2 text-xs font-bold text-gray-500 uppercase tracking-widest border-y border-gray-100">
                        Famille : {family}
                      </td>
                    </tr>
                    {items.map((item, idx) => {
                      const isOut = item.current_quantity <= 0;
                      const isAlert = item.current_quantity <= item.min_stock && item.current_quantity > 0;
                      const statusColor = isOut ? "bg-red-100 text-red-700" : isAlert ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700";
                      const statusText = isOut ? "Rupture" : isAlert ? "Alerte" : "Normal";

                      return (
                        <tr key={item.code + idx} className="hover:bg-gray-50 transition">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900">{item.designation}</p>
                            <p className="text-xs text-gray-500">Code: {item.code}</p>
                          </td>
                          <td className={`px-6 py-4 text-center font-bold ${isOut ? 'text-red-600' : isAlert ? 'text-orange-600' : 'text-gray-900'}`}>
                            {item.current_quantity}
                          </td>
                          <td className="px-6 py-4 text-center text-gray-500">{item.min_stock}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${statusColor}`}>
                              {statusText}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-gray-600">
                            {(item.current_quantity * item.purchase_price).toLocaleString('fr-FR')}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-gray-800">
                            {(item.current_quantity * item.sale_price_ht).toLocaleString('fr-FR')}
                          </td>
                        </tr>
                      )
                    })}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Aucun article ne correspond à vos filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
