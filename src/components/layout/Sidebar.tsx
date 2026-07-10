"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  Briefcase,
  BookOpen,
  CreditCard,
  Wallet,
  Calendar,
  ShoppingCart,
  BarChart,
  Shield,
  UserCog,
  Gift,
  ChevronDown,
  ChevronRight,
  Tags
} from "lucide-react";

import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/utils/supabase";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [permissions, setPermissions] = useState<{ module_href: string }[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Principal": true,
    "Gestion": true,
    "Stock": true,
    "Comptabilité": true,
    "Administration": true,
  });

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  useEffect(() => {
    if (user?.role) {
      fetchPermissions(user.role);
    }
  }, [user]);

  const fetchPermissions = async (role: string) => {
    // Si c'est l'Admin (ou que l'on veut forcer), on peut tout autoriser, mais on utilise la table pour être flexible
    const { data } = await supabase
      .from("role_permissions")
      .select("module_href")
      .eq("role", role);
    if (data) {
      setPermissions(data);
    }
  };

  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Tableau de bord", group: "Principal" },
    { href: "/stock", icon: Package, label: "Articles", group: "Gestion" },
    { href: "/stock/categories", icon: Tags, label: "Familles d'articles", group: "Stock" },
    { href: "/stock/mouvements", icon: FileText, label: "Mouvements de Stock", group: "Stock" },
    { href: "/stock/etats", icon: BarChart, label: "États des stocks", group: "Stock" },
    { href: "/achats", icon: ShoppingCart, label: "Achats & Réceptions", group: "Stock" },
    { href: "/facturation", icon: FileText, label: "Facturation", group: "Vente" },
    { href: "/dons", icon: Gift, label: "Dons", group: "Vente" },
    { href: "/destructions", icon: Package, label: "Destruction", group: "Vente" },
    { href: "/comptabilite/paiements", icon: CreditCard, label: "Trésorerie / Paiements", group: "Comptabilité" },
    { href: "/comptabilite/journal", icon: BookOpen, label: "Journal Comptable", group: "Comptabilité" },
    { href: "/comptabilite/comptes", icon: Wallet, label: "Plan Comptable", group: "Comptabilité" },
    { href: "/clients", icon: Users, label: "Clients", group: "Gestion" },
    { href: "/fournisseurs", icon: Briefcase, label: "Fournisseurs", group: "Gestion" },
    { href: "/admin/utilisateurs", icon: Users, label: "Utilisateurs & Groupes", group: "Paramètre" },
    { href: "/admin/acces", icon: Shield, label: "Gestion des accès", group: "Paramètre" },
    { href: "/settings", icon: Settings, label: "Paramètre société", group: "Paramètre" },
    { href: "/comptabilite/exercices", icon: Calendar, label: "Exercices", group: "Paramètre" },
  ];

  const renderNavItems = (groupName: string) => {
    return navItems
      .filter(item => item.group === groupName && (user?.role === "Admin" || permissions.some(p => p.module_href === item.href)))
      .map((item) => {
        const isActive = 
          pathname === item.href || 
          (item.href !== "/" && 
           pathname.startsWith(item.href) && 
           !navItems.some(other => 
             other.href !== "/" && 
             other.href !== item.href && 
             pathname.startsWith(other.href) && 
             other.href.length > item.href.length
           ));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 group ${
              isActive
                ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-900/20 transform scale-[1.02] border border-blue-500/20"
                : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
            }`}
          >
            <item.icon className={`h-5 w-5 mr-3 transition-colors ${isActive ? "text-white" : "text-slate-400 group-hover:text-blue-400"}`} />
            {item.label}
          </Link>
        );
      });
  };

  const renderGroup = (groupName: string) => {
    const items = renderNavItems(groupName);
    if (items.length === 0) return null;
    
    const isOpen = openGroups[groupName];
    
    return (
      <div className="mb-2">
        <button 
          onClick={() => toggleGroup(groupName)}
          className="w-full flex items-center justify-between px-2 py-2 mb-1 hover:bg-slate-800/40 rounded-md transition-colors group"
        >
          <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-widest">{groupName}</span>
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
          )}
        </button>
        <div className={`space-y-1 overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"}`}>
          {items}
        </div>
      </div>
    );
  };

  return (
    <aside className="w-64 bg-[#0f172a] border-r border-slate-800 shadow-2xl flex flex-col z-50 shrink-0 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 left-0 w-full h-64 bg-blue-600 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
      
      <div className="p-6 flex items-center justify-center border-b border-slate-800/80 relative z-10">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-blue-900/50 mr-3 transform rotate-3 transition-transform hover:rotate-6">
          <Package className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 tracking-tight">
          SIVID
        </h1>
      </div>
      
      <div className="px-6 py-4 bg-slate-800/30 border-b border-slate-800/80 relative z-10">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Connecté en tant que</p>
        <p className="text-sm font-semibold text-white truncate">{user?.full_name}</p>
        <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold rounded-md">
          {user?.role}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 scrollbar-hide">
        {renderGroup("Principal")}
        {renderGroup("Gestion")}
        {renderGroup("Stock")}
        {renderGroup("Vente")}
        {renderGroup("Comptabilité")}
        {renderGroup("Paramètre")}
      </nav>

      <div className="p-4 border-t border-slate-800/80 bg-slate-900/50 relative z-10">
        <button 
          onClick={logout}
          className="flex items-center w-full px-4 py-3 text-sm font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-200 group"
        >
          <LogOut className="h-5 w-5 mr-3 text-slate-500 group-hover:text-red-400 transition-colors" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
