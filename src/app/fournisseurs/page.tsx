"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Edit2, Trash2, X, Briefcase } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useAuth } from "@/components/providers/AuthProvider";

interface Fournisseur {
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  balance: number;
}

export default function FournisseursPage() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({ code: "", name: "", phone: "", email: "", address: "" });
  const { showNotification, showConfirm } = useNotification();
  const [isEditing, setIsEditing] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchFournisseurs();
  }, []);

  const fetchFournisseurs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from("fournisseurs").select("*").order("created_at", { ascending: false });
    if (!error && data) setFournisseurs(data);
    setIsLoading(false);
  };

  const handleEditFournisseur = (fournisseur: Fournisseur) => {
    setFormData({
      code: fournisseur.code,
      name: fournisseur.name,
      phone: fournisseur.phone || "",
      email: fournisseur.email || "",
      address: fournisseur.address || ""
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDeleteFournisseur = (fournisseur: Fournisseur) => {
    showConfirm(`Voulez-vous vraiment supprimer le fournisseur ${fournisseur.name} ?`, async () => {
      try {
        const { error } = await supabase.from("fournisseurs").delete().eq("code", fournisseur.code);
        if (error) {
          if (error.code === '23503') throw new Error("Ce fournisseur est utilisé dans d'autres documents.");
          throw error;
        }
        fetchFournisseurs();
        showNotification("Fournisseur supprimé avec succès.", "success");
      } catch (err: any) {
        showNotification(err.message, "error");
      }
    });
  };

  const handleOpenModal = () => {
    setFormData({ code: "", name: "", phone: "", email: "", address: "" });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) return showNotification("Le code et le nom sont obligatoires.", "error");

    const { error } = await supabase.from("fournisseurs").upsert([formData]);
    
    if (!error) {
      setIsModalOpen(false);
      setFormData({ code: "", name: "", phone: "", email: "", address: "" });
      fetchFournisseurs();
      showNotification("Fournisseur sauvegardé avec succès !", "success");
    } else {
      showNotification("Erreur lors de la sauvegarde : " + error.message, "error");
    }
  };

  const filtered = fournisseurs.filter(f => 
    f.name.toLowerCase().includes(search.toLowerCase()) || 
    f.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Fournisseurs</h2>
          <p className="text-sm text-gray-500">Gérez la liste de vos fournisseurs et partenaires.</p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition transform hover:-translate-y-0.5 text-sm font-medium flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" /> Nouveau Fournisseur
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par nom ou code..."
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
                <th className="px-6 py-4 font-medium">Code</th>
                <th className="px-6 py-4 font-medium">Fournisseur</th>
                <th className="px-6 py-4 font-medium">Contacts</th>
                <th className="px-6 py-4 font-medium">Dette (FCFA)</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.code} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-slate-700">{item.code}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{item.name}</td>
                    <td className="px-6 py-4">
                      <p className="text-gray-700">{item.phone || '-'}</p>
                      <p className="text-gray-500 text-xs">{item.email || '-'}</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-800">
                      {item.balance.toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleEditFournisseur(item)}
                        className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 rounded mr-2 transition"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {user?.role === "Admin" && (
                        <button 
                          onClick={() => handleDeleteFournisseur(item)}
                          className="text-red-600 hover:text-red-800 p-1 bg-red-50 rounded transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Aucun fournisseur trouvé.
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
              <h3 className="text-lg font-bold text-gray-800">{isEditing ? "Modifier le Fournisseur" : "Nouveau Fournisseur"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Code *</label>
                  <input required disabled={isEditing} value={formData.code} onChange={(e) => setFormData({...formData, code: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none disabled:bg-gray-100 disabled:text-gray-500" placeholder="FOU-001" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Nom *</label>
                  <input required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" placeholder="Nom du fournisseur" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Téléphone</label>
                  <input value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Adresse</label>
                  <input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" />
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
