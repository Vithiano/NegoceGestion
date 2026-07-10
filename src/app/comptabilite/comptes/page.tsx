"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Edit, Trash2, X, Save } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useAuth } from "@/components/providers/AuthProvider";

interface Account {
  number: string;
  name: string;
}

export default function PlanComptablePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formNumber, setFormNumber] = useState("");
  const [formName, setFormName] = useState("");
  
  const { showNotification, showConfirm } = useNotification();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .order("number", { ascending: true });
      
    if (!error && data) setAccounts(data);
    setIsLoading(false);
  };

  const handleOpenModal = (acc?: Account) => {
    if (acc) {
      setIsEditing(true);
      setFormNumber(acc.number);
      setFormName(acc.name);
    } else {
      setIsEditing(false);
      setFormNumber("");
      setFormName("");
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNumber || !formName) return;

    setIsSaving(true);
    try {
      if (isEditing) {
        const { error } = await supabase
          .from("accounts")
          .update({ name: formName })
          .eq("number", formNumber);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("accounts")
          .insert([{ number: formNumber, name: formName }]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setFormNumber("");
      setFormName("");
      fetchAccounts();
      showNotification("Compte enregistré avec succès !", "success");
    } catch (error: any) {
      showNotification("Erreur lors de l'enregistrement: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (number: string) => {
    showConfirm(`Voulez-vous vraiment supprimer le compte ${number} ?`, async () => {
      try {
        const { error } = await supabase
          .from("accounts")
          .delete()
          .eq("number", number);
        if (error) throw error;
        fetchAccounts();
        showNotification("Compte supprimé.", "success");
      } catch (error: any) {
        showNotification("Impossible de supprimer ce compte. Il est probablement utilisé dans des écritures comptables.", "error");
      }
    });
  };

  const filtered = accounts.filter(a => 
    a.number.includes(search) || 
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Plan Comptable</h2>
          <p className="text-sm text-gray-500">Gérez les comptes de votre plan comptable.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition transform hover:-translate-y-0.5 text-sm font-medium flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" /> Nouveau Compte
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par numéro ou libellé..."
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
                <th className="px-6 py-4 font-medium">N° de Compte</th>
                <th className="px-6 py-4 font-medium">Libellé</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.number} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-bold text-blue-600">{item.number}</td>
                    <td className="px-6 py-4 font-medium text-gray-800">{item.name}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleOpenModal(item)}
                        className="text-gray-400 hover:text-blue-600 p-1.5 bg-gray-50 rounded mr-2 transition-colors"
                        title="Modifier"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {user?.role === "Admin" && (
                        <button 
                          onClick={() => handleDelete(item.number)}
                          className="text-red-600 hover:text-red-800 p-1.5 bg-red-50 hover:bg-red-100 rounded transition"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    Aucun compte trouvé.
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
              <h3 className="text-lg font-bold text-gray-800">
                {isEditing ? "Modifier Compte" : "Nouveau Compte"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">N° de Compte *</label>
                <input 
                  type="text" 
                  required
                  disabled={isEditing} // On ne modifie pas la PK
                  value={formNumber}
                  onChange={(e) => setFormNumber(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none disabled:bg-gray-100" 
                  placeholder="Ex: 411001"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Libellé du Compte *</label>
                <input 
                  type="text" 
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  placeholder="Ex: Clients - Ventes Diverses"
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
                  {isSaving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
