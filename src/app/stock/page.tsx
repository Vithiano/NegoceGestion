"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, Edit2, Trash2, X, Package } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useAuth } from "@/components/providers/AuthProvider";

interface Article {
  code: string;
  designation: string;
  category_id: string;
  purchase_price: number;
  sale_price_ht: number;
  min_stock: number;
  stock_quantity?: number; // From view
  tax_rate?: number;
  is_active?: boolean;
  categories?: { name: string };
}

interface Category {
  id: string;
  name: string;
}

export default function StockPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({ 
    code: "", designation: "", category_id: "", purchase_price: 0, sale_price_ht: 0, min_stock: 10, tax_rate: 18, is_active: true
  });
  const { showNotification, showConfirm } = useNotification();
  const [isEditing, setIsEditing] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    setIsLoading(true);
    // Fetch articles and join with the public.stock view to get current quantity
    const { data, error } = await supabase.from("articles").select("*, stock(current_quantity), categories(name)").order("code", { ascending: true });
    if (!error && data) {
      const formatted = data.map((a: any) => ({
        ...a,
        stock_quantity: a.stock?.[0]?.current_quantity || 0
      }));
      setArticles(formatted);
    }

    const { data: catData } = await supabase.from("categories").select("*").order("name");
    if (catData) setCategories(catData);

    setIsLoading(false);
  };

  const handleEditArticle = (article: Article) => {
    setFormData({
      code: article.code,
      designation: article.designation,
      category_id: article.category_id || (categories.length > 0 ? categories[0].id : ""),
      purchase_price: article.purchase_price,
      sale_price_ht: article.sale_price_ht,
      min_stock: article.min_stock,
      tax_rate: article.tax_rate || 18,
      is_active: article.is_active !== false
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeleteArticle = (article: Article) => {
    showConfirm(`Voulez-vous vraiment supprimer l'article ${article.designation} ?`, async () => {
      try {
        const { error } = await supabase.from("articles").delete().eq("code", article.code);
        if (error) {
          if (error.code === '23503') throw new Error("Cet article est utilisé dans d'autres documents.");
          throw error;
        }
        fetchArticles();
        showNotification("Article supprimé avec succès.", "success");
      } catch (err: any) {
        showNotification(err.message, "error");
      }
    });
  };

  const handleOpenModal = () => {
    setFormData({ code: "", designation: "", category_id: categories.length > 0 ? categories[0].id : "", purchase_price: 0, sale_price_ht: 0, min_stock: 10, tax_rate: 18, is_active: true });
    setIsEditing(false);
    setIsModalOpen(true);
  };
  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.designation) {
      return showNotification("Le code et la désignation sont obligatoires.", "error");
    }

    const { error } = await supabase.from("articles").upsert([{
      code: formData.code,
      designation: formData.designation,
      category_id: formData.category_id || null,
      purchase_price: formData.purchase_price,
      sale_price_ht: formData.sale_price_ht,
      min_stock: formData.min_stock,
      tax_rate: formData.tax_rate,
      is_active: formData.is_active,
      unit: 'Pièce'
    }]);
    
    if (!error) {
      setIsModalOpen(false);
      setFormData({ code: "", designation: "", category_id: "", purchase_price: 0, sale_price_ht: 0, min_stock: 10, tax_rate: 18, is_active: true });
      fetchArticles();
      showNotification("Article sauvegardé avec succès !", "success");
    } else {
      showNotification("Erreur lors de la sauvegarde : " + error.message, "error");
    }
  };

  const filtered = articles.filter(a => 
    a.designation.toLowerCase().includes(search.toLowerCase()) || 
    a.code.toLowerCase().includes(search.toLowerCase())
  );

  // Regroupement par famille
  const groupedArticles = filtered.reduce((acc: Record<string, Article[]>, article) => {
    const familyName = article.categories?.name || "Non définie";
    if (!acc[familyName]) acc[familyName] = [];
    acc[familyName].push(article);
    return acc;
  }, {});

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Articles</h2>
          <p className="text-sm text-gray-500">Gérez votre catalogue d'articles et suivez le stock en temps réel.</p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition transform hover:-translate-y-0.5 text-sm font-medium flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" /> Nouvel Article
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Articles</p>
            <h3 className="text-2xl font-bold text-gray-800">{articles.length}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <Package className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Valeur du Stock (Achat)</p>
            <h3 className="text-2xl font-bold text-gray-800">
              {articles.reduce((sum, item) => sum + ((item.stock_quantity || 0) * (item.purchase_price || 0)), 0).toLocaleString('fr-FR')} FCFA
            </h3>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 w-2 h-full bg-red-500"></div>
          <div>
            <p className="text-sm font-medium text-gray-500">Alertes Stock</p>
            <h3 className="text-2xl font-bold text-gray-800">
              {articles.filter(a => (a.stock_quantity || 0) <= a.min_stock).length}
            </h3>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par désignation ou code..."
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
                <th className="px-6 py-4 font-medium">Article</th>
                <th className="px-6 py-4 font-medium text-center">Statut</th>
                <th className="px-6 py-4 font-medium text-right">Prix Achat</th>
                <th className="px-6 py-4 font-medium text-right">Prix Vente</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : filtered.length > 0 ? (
                Object.entries(groupedArticles).sort().map(([family, items]) => (
                  <React.Fragment key={family}>
                    <tr className="bg-gray-100/50">
                      <td colSpan={5} className="px-6 py-2 text-xs font-bold text-gray-500 uppercase tracking-widest border-y border-gray-100">
                        Famille : {family}
                      </td>
                    </tr>
                    {items.map((item) => (
                      <tr key={item.code} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900">{item.designation}</p>
                          <p className="text-xs text-gray-500">Code: {item.code}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${item.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {item.is_active !== false ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-gray-600">
                          {item.purchase_price.toLocaleString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-gray-800">
                          {item.sale_price_ht.toLocaleString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleEditArticle(item)}
                            className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 rounded mr-2 transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {user?.role === "Admin" && (
                            <button 
                              onClick={() => handleDeleteArticle(item)}
                              className="text-red-600 hover:text-red-800 p-1 bg-red-50 rounded transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Aucun article trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">{isEditing ? "Modifier l'Article" : "Nouvel Article"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Code *</label>
                  <input required disabled={isEditing} value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none disabled:bg-gray-100 disabled:text-gray-500" placeholder="ART-001" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Désignation *</label>
                  <input required value={formData.designation} onChange={(e) => setFormData({...formData, designation: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Nom de l'article" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Famille (Catégorie)</label>
                  <select value={formData.category_id} onChange={(e) => setFormData({...formData, category_id: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white">
                    <option value="">Sélectionner une famille</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Prix Achat</label>
                  <input type="number" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Prix Vente</label>
                  <input type="number" value={formData.sale_price_ht} onChange={(e) => setFormData({...formData, sale_price_ht: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock Min (Alerte)</label>
                  <input type="number" value={formData.min_stock} onChange={(e) => setFormData({...formData, min_stock: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Taux TVA</label>
                  <select value={formData.tax_rate} onChange={(e) => setFormData({...formData, tax_rate: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white">
                    <option value={18}>18% (Standard)</option>
                    <option value={0}>0% (Exonéré)</option>
                    <option value={9}>9% (Réduit)</option>
                  </select>
                </div>
                <div className="col-span-2 flex items-center mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <input 
                    type="checkbox" 
                    id="is_active" 
                    checked={formData.is_active} 
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})} 
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" 
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm font-medium text-gray-700 cursor-pointer">
                    Article actif
                  </label>
                  <p className="ml-4 text-xs text-gray-500">Décocher pour masquer ou désactiver cet article sans le supprimer.</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition">Annuler</button>
                <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition">Sauvegarder</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
