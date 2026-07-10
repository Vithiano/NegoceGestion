"use client";

import { Bell, Search, User } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

export default function Header() {
  const { user } = useAuth();
  
  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200 sticky top-0 z-20">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center bg-gray-100 rounded-full px-4 py-2 w-72 md:w-96 focus-within:ring-2 focus-within:ring-blue-400 transition">
            <Search className="h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Rechercher une facture, un client..." 
              className="bg-transparent border-none outline-none ml-2 w-full text-sm" 
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <button className="relative p-2 text-gray-400 hover:text-gray-600 transition">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          <div className="flex items-center space-x-3 border-l pl-4 border-gray-200 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <User className="h-5 w-5" />
            </div>
            <div className="hidden md:block text-sm">
              <p className="font-semibold text-gray-700">{user?.full_name || "Utilisateur"}</p>
              <p className="text-xs text-gray-500">{user?.role || "Chargement..."}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
