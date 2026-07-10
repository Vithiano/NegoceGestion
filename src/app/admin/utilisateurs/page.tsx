"use client";

import { useState, useEffect } from "react";
import { UserCog, Search, Plus, Trash2, Edit2, Shield, X, Save, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useAuth } from "@/components/providers/AuthProvider";

interface AppUser {
  id: string;
  username: string;
  role: string;
  full_name: string;
  created_at: string;
  password?: string;
}

export default function UtilisateursPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { showNotification, showConfirm } = useNotification();
  const { user } = useAuth();

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("Commercial");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data: usersData, error } = await supabase.from("app_users").select("*").order("created_at", { ascending: false });
    if (!error && usersData) setUsers(usersData);
    
    const { data: rolesData } = await supabase.from("app_roles").select("name").order("name");
    if (rolesData) {
      setAvailableRoles(rolesData.map(r => r.name));
    } else {
      setAvailableRoles(["Admin", "Commercial", "Magasinier", "Comptable"]);
    }
    
    setIsLoading(false);
  };

  const handleOpenModal = () => {
    setEditingUserId(null);
    setFullName("");
    setUsername("");
    setPassword("");
    setShowPassword(false);
    setRole("Commercial");
    setIsModalOpen(true);
  };

  const handleEditUser = (user: AppUser) => {
    setEditingUserId(user.id);
    setFullName(user.full_name);
    setUsername(user.username);
    setPassword(user.password || "");
    setShowPassword(false);
    setRole(user.role);
    setIsModalOpen(true);
  };

  const handleDeleteUser = (user: AppUser) => {
    showConfirm(`Voulez-vous vraiment supprimer l'utilisateur ${user.full_name} ?`, async () => {
      if (user.username === "admin") {
        return showNotification("Impossible de supprimer l'administrateur principal.", "error");
      }
      try {
        const { error } = await supabase.from("app_users").delete().eq("id", user.id);
        if (error) throw error;
        fetchUsers();
        showNotification("Utilisateur supprimé.", "success");
      } catch (error: any) {
        showNotification("Erreur lors de la suppression.", "error");
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !username || (!password && !editingUserId)) {
      return showNotification("Veuillez remplir tous les champs obligatoires.", "error");
    }

    setIsSaving(true);
    try {
      if (editingUserId) {
        const updateData: any = {
          full_name: fullName,
          username: username.toLowerCase(),
          role: role
        };
        if (password) updateData.password = password; // Basic update for demonstration. Ideally hashing is needed.

        const { error } = await supabase.from("app_users").update(updateData).eq("id", editingUserId);
        if (error) throw error;
        showNotification("Utilisateur modifié.", "success");
      } else {
        const { error } = await supabase.from("app_users").insert([{
          full_name: fullName,
          username: username.toLowerCase(),
          password: password,
          role: role
        }]);
        if (error) {
          if (error.code === '23505') throw new Error("Ce nom d'utilisateur existe déjà.");
          throw error;
        }
        showNotification("Utilisateur créé avec succès.", "success");
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      showNotification(error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = users.filter(u => 
    u.full_name.toLowerCase().includes(search.toLowerCase()) || 
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 relative">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <UserCog className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Utilisateurs & Groupes
            </h1>
          </div>
          <p className="text-slate-500">
            Gérez les comptes d'accès, affectez les rôles et contrôlez l'utilisation de la plateforme.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button onClick={handleOpenModal} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm">
            <Plus className="w-4 h-4" />
            Nouvel utilisateur
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un utilisateur, rôle..."
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
                <th className="px-6 py-4 font-medium">Nom complet</th>
                <th className="px-6 py-4 font-medium">Identifiant</th>
                <th className="px-6 py-4 font-medium">Groupe / Rôle</th>
                <th className="px-6 py-4 font-medium">Date de création</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((userItem) => (
                  <tr key={userItem.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-slate-800">{userItem.full_name}</td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-sm">{userItem.username}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 inline-block rounded-full text-xs font-semibold border flex items-center w-fit ${
                        userItem.role === 'Admin' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                        userItem.role === 'Commercial' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        userItem.role === 'Magasinier' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                        userItem.role === 'Comptable' ? 'bg-green-100 text-green-700 border-green-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        <Shield className="w-3 h-3 mr-1" /> {userItem.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {new Date(userItem.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleEditUser(userItem)}
                        className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition mr-2"
                        title="Modifier"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {user?.role === "Admin" && (
                        <button 
                          onClick={() => handleDeleteUser(userItem)}
                          className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition"
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
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Aucun utilisateur trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">
                {editingUserId ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Nom complet *</label>
                <input 
                  type="text" required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  placeholder="Ex: Jean Dupont"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Identifiant *</label>
                  <input 
                    type="text" required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                    placeholder="Ex: jdupont"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    {editingUserId ? "Nouveau Mot de passe" : "Mot de passe *"}
                  </label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} required={!editingUserId}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg pl-3 pr-10 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Groupe (Rôle) *</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none bg-white"
                >
                  {availableRoles.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">Le rôle détermine les accès par défaut de l'utilisateur.</p>
              </div>

              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 mt-6">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center"
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
