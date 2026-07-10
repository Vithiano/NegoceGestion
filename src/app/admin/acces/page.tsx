"use client";

import React, { useState, useEffect } from "react";
import { Shield, Save, CheckCircle2, Plus, Trash2, X } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useAuth } from "@/components/providers/AuthProvider";

export default function AccesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { showNotification, showConfirm } = useNotification();
  const { user } = useAuth();

  const [roles, setRoles] = useState<string[]>([]);
  const defaultRoles = ["Admin", "Commercial", "Magasinier", "Comptable"];
  
  const [isAddRoleModalOpen, setIsAddRoleModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  
  const modules = [
    { href: "/", label: "Tableau de bord", group: "Principal" },
    { href: "/stock", label: "Articles", group: "Gestion" },
    { href: "/clients", label: "Clients", group: "Gestion" },
    { href: "/fournisseurs", label: "Fournisseurs", group: "Gestion" },
    { href: "/stock/categories", label: "Familles d'articles", group: "Stock" },
    { href: "/stock/mouvements", label: "Mouvements de Stock", group: "Stock" },
    { href: "/stock/etats", label: "États des stocks", group: "Stock" },
    { href: "/achats", label: "Achats & Réceptions", group: "Stock" },
    { href: "/facturation", label: "Facturation", group: "Vente" },
    { href: "/dons", label: "Dons", group: "Vente" },
    { href: "/destructions", label: "Destruction", group: "Vente" },
    { href: "/comptabilite/paiements", label: "Trésorerie / Paiements", group: "Comptabilité" },
    { href: "/comptabilite/journal", label: "Journal Comptable", group: "Comptabilité" },
    { href: "/comptabilite/comptes", label: "Plan Comptable", group: "Comptabilité" },
    { href: "/admin/utilisateurs", label: "Utilisateurs & Groupes", group: "Paramètre" },
    { href: "/admin/acces", label: "Gestion des accès", group: "Paramètre" },
    { href: "/settings", label: "Paramètre société", group: "Paramètre" },
    { href: "/comptabilite/exercices", label: "Exercices", group: "Paramètre" }
  ];

  // Matrice des permissions: { "Admin": ["/", "/facturation", ...], "Commercial": [...] }
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    // Fetch roles
    const { data: rolesData } = await supabase.from("app_roles").select("name").order("name");
    const rolesList = rolesData ? rolesData.map(r => r.name) : defaultRoles;
    
    // Assure \"Admin\" is always first
    const sortedRoles = ["Admin", ...rolesList.filter(r => r !== "Admin")];
    setRoles(sortedRoles);

    // Fetch permissions
    const { data: permData } = await supabase.from("role_permissions").select("*");
    
    const permMap: Record<string, string[]> = {};
    sortedRoles.forEach(r => permMap[r] = []); // Initialize empty
    
    if (permData) {
      permData.forEach(p => {
        if (!permMap[p.role]) permMap[p.role] = [];
        permMap[p.role].push(p.module_href);
      });
    }
    setPermissions(permMap);
    setIsLoading(false);
  };

  const handleAddRole = async () => {
    if (!newRoleName.trim()) return showNotification("Le nom du rôle est requis.", "error");
    if (roles.includes(newRoleName.trim())) return showNotification("Ce rôle existe déjà.", "error");

    try {
      const { error } = await supabase.from("app_roles").insert([{ name: newRoleName.trim() }]);
      if (error) throw error;
      
      showNotification("Rôle ajouté avec succès.", "success");
      setNewRoleName("");
      setIsAddRoleModalOpen(false);
      fetchData();
    } catch (err: any) {
      showNotification("Erreur lors de l'ajout: " + err.message, "error");
    }
  };

  const handleDeleteRole = (roleToDelete: string) => {
    if (defaultRoles.includes(roleToDelete)) {
      return showNotification("Les rôles par défaut ne peuvent pas être supprimés.", "error");
    }
    
    showConfirm(`Voulez-vous vraiment supprimer le rôle "${roleToDelete}" ? Tous ses accès seront perdus.`, async () => {
      try {
        const { error: permError } = await supabase.from("role_permissions").delete().eq("role", roleToDelete);
        const { error: roleError } = await supabase.from("app_roles").delete().eq("name", roleToDelete);
        
        if (roleError) throw roleError;
        
        showNotification("Rôle supprimé.", "success");
        fetchData();
      } catch (err: any) {
        showNotification("Erreur de suppression. Vérifiez qu'aucun utilisateur n'y est associé.", "error");
      }
    });
  };

  const handleToggle = (role: string, href: string) => {
    setPermissions(prev => {
      const current = prev[role] || [];
      const newPerms = current.includes(href)
        ? current.filter(h => h !== href)
        : [...current, href];
      return { ...prev, [role]: newPerms };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Pour éviter les complexités de mise à jour fine, on supprime tout et on réinsère
      // On le fait dans une transaction théoriquement, mais Supabase REST ne le permet pas facilement en une ligne.
      // On delete tout puis insert.
      
      const { error: delError } = await supabase.from("role_permissions").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // trick pour tout supprimer
      
      const inserts: any[] = [];
      Object.keys(permissions).forEach(role => {
        permissions[role].forEach(href => {
          inserts.push({ role, module_href: href });
        });
      });

      if (inserts.length > 0) {
        const { error: insError } = await supabase.from("role_permissions").insert(inserts);
        if (insError) throw insError;
      }
      
      showNotification("Permissions mises à jour avec succès. Le menu s'adaptera au prochain rechargement pour les utilisateurs concernés.", "success");
    } catch (err: any) {
      showNotification("Erreur lors de la sauvegarde: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Gestion des Accès
            </h1>
          </div>
          <p className="text-slate-500">
            Définissez quel groupe d'utilisateurs a accès à quel module de l'application.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => setIsAddRoleModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-semibold shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Nouveau Rôle
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-md focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            Sauvegarder les accès
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 text-gray-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p>Chargement de la matrice...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-gray-50 text-gray-800 text-sm tracking-wider border-b border-gray-200">
                  <th className="px-6 py-4 font-bold sticky left-0 bg-gray-50 z-10 w-64">
                    Modules de l'application
                  </th>
                  {roles.map(role => (
                    <th key={role} className="px-4 py-4 font-bold text-center border-l border-gray-200 min-w-[120px] group relative">
                      <div className={`mx-auto inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                        role === 'Admin' ? 'bg-purple-100 text-purple-700' :
                        role === 'Commercial' ? 'bg-blue-100 text-blue-700' :
                        role === 'Magasinier' ? 'bg-orange-100 text-orange-700' :
                        role === 'Comptable' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {role}
                        {user?.role === "Admin" && !defaultRoles.includes(role) && (
                          <button 
                            onClick={() => handleDeleteRole(role)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-0.5 rounded transition"
                            title="Supprimer ce rôle"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-100">
                {modules.map((mod, idx) => {
                  const showGroupHeader = idx === 0 || modules[idx-1].group !== mod.group;
                  return (
                    <React.Fragment key={mod.href}>
                      {showGroupHeader && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={roles.length + 1} className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-widest bg-slate-50 border-y border-gray-100">
                            {mod.group}
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-700 sticky left-0 bg-white group-hover:bg-blue-50/30">
                          {mod.label}
                        </td>
                        {roles.map(role => {
                          const isChecked = permissions[role]?.includes(mod.href);
                          const isAdmin = role === "Admin";
                          return (
                            <td key={role} className="px-4 py-4 text-center border-l border-gray-100">
                              <label className="relative flex items-center justify-center cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  className="peer sr-only"
                                  checked={isChecked}
                                  onChange={() => !isAdmin && handleToggle(role, mod.href)}
                                  disabled={isAdmin}
                                />
                                <div className={`w-6 h-6 rounded-md border-2 transition-all flex items-center justify-center
                                  ${isChecked ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}
                                  ${isAdmin ? 'opacity-60 cursor-not-allowed' : 'peer-hover:border-blue-400'}
                                `}>
                                  {isChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                                </div>
                              </label>
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-4 text-blue-800 text-sm">
        <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <p>
          <strong>Note :</strong> Le groupe "Admin" a toujours un accès inconditionnel à tous les modules par défaut. Ses permissions ne peuvent pas être modifiées ou désactivées ici pour éviter le verrouillage du compte principal.
        </p>
      </div>

      {/* Add Role Modal */}
      {isAddRoleModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Ajouter un nouveau rôle</h3>
              <button onClick={() => setIsAddRoleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Nom du rôle</label>
              <input 
                type="text" 
                autoFocus
                placeholder="Ex: Stagiaire, Trésorier..."
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRole()}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
              />
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 border-t border-gray-100">
              <button onClick={() => setIsAddRoleModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition">Annuler</button>
              <button onClick={handleAddRole} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
