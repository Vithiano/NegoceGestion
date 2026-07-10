"use client";

import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  Users, 
  Package, 
  CreditCard,
  Plus,
  FileText
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/utils/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

export default function Home() {
  const [isLoading, setIsLoading] = useState(true);
  
  // States for KPIs
  const [revenueData, setRevenueData] = useState({ current: 0, previous: 0 });
  const [unpaidData, setUnpaidData] = useState({ count: 0, amount: 0 });
  const [newClientsCount, setNewClientsCount] = useState(0);
  const [stockAlertsCount, setStockAlertsCount] = useState(0);
  
  // States for Chart and Recent Invoices
  const [chartData, setChartData] = useState<{ name: string, ventes: number }[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    try {
      // 1. Invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("*, clients(name)");

      if (invoices) {
        // Recent invoices
        const recent = [...invoices]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5);
        setRecentInvoices(recent);

        // Revenue (current month)
        const monthInvoices = invoices.filter(inv => {
          const d = new Date(inv.date);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear && inv.status !== 'CANCELLED';
        });
        const revenue = monthInvoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0);
        
        // Revenue (previous month)
        const prevMonthInvoices = invoices.filter(inv => {
          const d = new Date(inv.date);
          const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          return d.getMonth() === prevMonth && d.getFullYear() === prevYear && inv.status !== 'CANCELLED';
        });
        const prevRevenue = prevMonthInvoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0);
        
        setRevenueData({ current: revenue, previous: prevRevenue });

        // Unpaid invoices (VALIDATED or EN ATTENTE)
        const unpaid = invoices.filter(inv => inv.status === 'VALIDATED' || inv.status === 'EN ATTENTE');
        const unpaidCount = unpaid.length;
        const unpaidSum = unpaid.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0);
        setUnpaidData({ count: unpaidCount, amount: unpaidSum });

        // Chart Data (6 last months)
        const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];
        const cData = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(currentYear, currentMonth - i, 1);
          const m = d.getMonth();
          const y = d.getFullYear();
          const mInvoices = invoices.filter(inv => {
            const idate = new Date(inv.date);
            return idate.getMonth() === m && idate.getFullYear() === y && inv.status !== 'CANCELLED';
          });
          const mRevenue = mInvoices.reduce((sum, inv) => sum + (inv.total_ttc || 0), 0);
          cData.push({ name: months[m], ventes: mRevenue });
        }
        setChartData(cData);
      }

      // 2. Clients
      const { data: clients } = await supabase.from("clients").select("created_at");
      if (clients) {
        const newClients = clients.filter(c => {
          const d = new Date(c.created_at);
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;
        setNewClientsCount(newClients);
      }

      // 3. Stock alerts
      const { data: articles } = await supabase.from("articles").select("*, stock(current_quantity)");
      if (articles) {
        const alerts = articles.filter(a => {
          const qty = a.stock?.[0]?.current_quantity || 0;
          return qty <= a.min_stock;
        }).length;
        setStockAlertsCount(alerts);
      }
    } catch (err) {
      console.error("Error fetching dashboard data", err);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateRevenueGrowth = () => {
    if (revenueData.previous === 0) return revenueData.current > 0 ? 100 : 0;
    return Math.round(((revenueData.current - revenueData.previous) / revenueData.previous) * 100);
  };

  const growth = calculateRevenueGrowth();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Aperçu de l'Activité</h2>
          <p className="text-sm text-gray-500">Statistiques du mois en cours</p>
        </div>
        <Link href="/facturation" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition transform hover:-translate-y-0.5 text-sm font-medium flex items-center">
          <Plus className="h-4 w-4 mr-2" /> Nouvelle Facture
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        {/* Card 1 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Chiffre d'Affaires</p>
              <h3 className="text-2xl font-bold text-gray-800">{revenueData.current.toLocaleString('fr-FR')} FCFA</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className={`font-medium ${growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {growth >= 0 ? '+' : ''}{growth}%
            </span>
            <span className="text-gray-400 ml-2">vs mois précédent</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Factures Impayées</p>
              <h3 className="text-2xl font-bold text-gray-800">{unpaidData.count}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-gray-400 font-medium">{unpaidData.amount.toLocaleString('fr-FR')} FCFA</span>
            <span className="text-gray-400 ml-2">en attente</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Nouveaux Clients</p>
              <h3 className="text-2xl font-bold text-gray-800">+{newClientsCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <span>Depuis le début du mois</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition relative overflow-hidden">
          {stockAlertsCount > 0 && <div className="absolute right-0 top-0 w-2 h-full bg-red-500"></div>}
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Alertes Stock</p>
              <h3 className="text-2xl font-bold text-gray-800">{stockAlertsCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <Link href="/stock" className={`${stockAlertsCount > 0 ? 'text-red-500' : 'text-blue-500'} font-medium cursor-pointer hover:underline`}>
              Voir les articles
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Évolution des Ventes (6 derniers mois)</h3>
          <div className="relative h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  tickFormatter={(value) => value === 0 ? '0' : `${(value / 1000).toFixed(0)}k`} 
                  dx={-10}
                />
                <Tooltip 
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: any) => [`${Number(value || 0).toLocaleString('fr-FR')} FCFA`, 'Ventes']}
                />
                <Bar dataKey="ventes" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Recent Invoices Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Factures Récentes</h3>
          <div className="space-y-4">
            {recentInvoices.length > 0 ? recentInvoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-800">{invoice.invoice_number}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[120px]">{invoice.clients?.name || invoice.client_code}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-gray-800">{(invoice.total_ttc || 0).toLocaleString('fr-FR')}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    invoice.status === 'PAID' || invoice.status === 'PAYÉE'
                      ? 'bg-green-100 text-green-700 border-green-200' 
                      : invoice.status === 'VALIDATED' || invoice.status === 'EN ATTENTE'
                        ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}>
                    {invoice.status === 'PAID' ? 'PAYÉE' : 
                     invoice.status === 'VALIDATED' ? 'VALIDÉE' : 
                     invoice.status === 'CANCELLED' ? 'ANNULÉE' : 
                     invoice.status === 'DRAFT' ? 'BROUILLON' : invoice.status}
                  </span>
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-500 text-center py-4">Aucune facture récente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
