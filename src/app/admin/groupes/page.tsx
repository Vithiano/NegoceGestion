"use client";

import { useState, useEffect } from "react";
import { Users, Search, Plus, Filter } from "lucide-react";

export default function GroupesPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simuler le chargement initial
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Groupes
            </h1>
          </div>
          <p className="text-slate-500">
            Gérez les groupes d'utilisateurs et leurs rôles.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm">
            <Plus className="w-4 h-4" />
            Nouveau groupe
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px] flex items-center justify-center">
        {isLoading ? (
          <div className="flex flex-col items-center text-gray-400">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p>Chargement des données...</p>
          </div>
        ) : (
          <div className="text-center text-gray-500 p-8">
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Module en construction</h3>
            <p>La liste des groupes sera bientôt disponible.</p>
          </div>
        )}
      </div>
    </div>
  );
}
