"use client";

import { useState, useEffect } from "react";
import { Search, Plus, ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import { supabase } from "@/utils/supabase";

interface Movement {
  id: string;
  article_code: string;
  movement_type: "IN" | "OUT"; // We keep this for UI logic if needed, but DB returns 'IN_PURCHASE', 'OUT_SALE' etc
  type: string;
  quantity: number;
  unit_price: number;
  date: string;
  reference_id: string;
  dossier_number?: string;
  facture_number?: string;
  articles?: { designation: string; category_id?: string | null };
}

interface Category {
  id: string;
  name: string;
}

interface Article {
  code: string;
  designation: string;
}

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Filters
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedArticle, setSelectedArticle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    // Fetch movements with article names
    const { data: movData } = await supabase
      .from("stock_movements")
      .select(`*, articles(designation, category_id)`)
      .order("created_at", { ascending: false });
      
    // Fetch articles for the dropdown
    const { data: artData } = await supabase.from("articles").select("code, designation").order("designation");
    
    // Fetch categories for the dropdown
    const { data: catData } = await supabase.from("categories").select("*").order("name");
    
    if (movData) setMovements(movData);
    if (artData) setArticles(artData);
    if (catData) setCategories(catData);
    
    setIsLoading(false);
  };

  const filtered = movements.filter(m => {
    const matchesSearch = 
      (m.reference_id || "").toLowerCase().includes(search.toLowerCase()) || 
      (m.article_code || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.articles?.designation || "").toLowerCase().includes(search.toLowerCase());
      
    const matchesStartDate = startDate ? new Date(m.date) >= new Date(startDate) : true;
    const matchesEndDate = endDate ? new Date(m.date) <= new Date(endDate) : true;
    const matchesArticle = selectedArticle ? m.article_code === selectedArticle : true;
    const matchesCategory = selectedCategory ? m.articles?.category_id === selectedCategory : true;

    return matchesSearch && matchesStartDate && matchesEndDate && matchesArticle && matchesCategory;
  });

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Mouvements de Stock</h2>
          <p className="text-sm text-gray-500">Historique des entrées et sorties (généré automatiquement).</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-4 space-y-4">
        {/* Filters Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Recherche..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
              title="Du (Date de début)"
            />
          </div>
          
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
              title="Au (Date de fin)"
            />
          </div>
          
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
            >
              <option value="">Toutes les familles</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <select
              value={selectedArticle}
              onChange={(e) => setSelectedArticle(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-600"
            >
              <option value="">Tous les articles</option>
              {articles.map(a => (
                <option key={a.code} value={a.code}>{a.designation}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Type</th>
                <th className="px-6 py-4 font-medium">N° Dossier</th>
                <th className="px-6 py-4 font-medium">N° Facture</th>
                <th className="px-6 py-4 font-medium">Article</th>
                <th className="px-6 py-4 font-medium text-center">Quantité</th>
                <th className="px-6 py-4 font-medium text-right">Valeur Unitaire</th>
                <th className="px-6 py-4 font-medium">Référence Document</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-medium text-gray-600">
                      {new Date(item.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4">
                      {item.type.startsWith("IN") || item.type.startsWith("RET_CLIENT") ? (
                        <span className="flex items-center text-green-600 font-semibold text-xs bg-green-50 px-2 py-1 rounded-md w-fit border border-green-100">
                          <ArrowDownRight className="w-3 h-3 mr-1" /> ENTRÉE
                        </span>
                      ) : (
                        <span className="flex items-center text-orange-600 font-semibold text-xs bg-orange-50 px-2 py-1 rounded-md w-fit border border-orange-100">
                          <ArrowUpRight className="w-3 h-3 mr-1" /> SORTIE
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {item.dossier_number || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {item.facture_number || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{item.articles?.designation}</p>
                      <p className="text-xs text-gray-500">Code: {item.article_code}</p>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-gray-800">
                      {item.type.startsWith("IN") || item.type.startsWith("RET_CLIENT") ? "+" : "-"}{item.quantity}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {item.unit_price ? item.unit_price.toLocaleString('fr-FR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                      {item.reference_id ? item.reference_id.substring(0,8) + '...' : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Aucun mouvement trouvé.
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
