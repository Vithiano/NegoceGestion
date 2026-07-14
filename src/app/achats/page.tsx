"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Eye, Printer, FileText, X, Save, CheckCircle2, Trash2, Edit2 } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useAuth } from "@/components/providers/AuthProvider";

interface Purchase {
  id: string;
  purchase_number: string;
  fournisseur_code: string;
  dossier_number?: string;
  facture_number?: string;
  date: string;
  total_ht: number;
  total_ttc: number;
  status: "DRAFT" | "VALIDATED" | "PAID" | "CANCELLED";
  fournisseurs?: { name: string };
  created_at?: string;
  updated_at?: string;
  creator?: { full_name: string };
  updater?: { full_name: string };
}

export default function AchatsPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sub-modal states
  const [isFournisseurModalOpen, setIsFournisseurModalOpen] = useState(false);
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [fournisseurSearch, setFournisseurSearch] = useState("");
  const [articleSearch, setArticleSearch] = useState("");

  // Form states
  const [fournisseurCode, setFournisseurCode] = useState("");
  const [dossierNumber, setDossierNumber] = useState("");
  const [factureNumber, setFactureNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [observations, setObservations] = useState("");
  const [lines, setLines] = useState<any[]>([]);

  // Mini-form states for adding lines
  const [currentArticleCode, setCurrentArticleCode] = useState("");
  const [currentDesignation, setCurrentDesignation] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState<number>(1);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currentVatRate, setCurrentVatRate] = useState<number>(18);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);

  // CRUD states
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  
  const { showNotification, showConfirm } = useNotification();

  useEffect(() => {
    fetchPurchases();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("settings").select("*").limit(1).single();
    if (data) setSettings(data);
  };

  const fetchPurchases = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("purchases")
      .select(`*, fournisseurs(*), creator:app_users!purchases_created_by_fkey(full_name), updater:app_users!purchases_updated_by_fkey(full_name)`)
      .order("created_at", { ascending: false });
      
    if (!error && data) setPurchases(data as any);
    setIsLoading(false);
  };

  const loadFormData = async () => {
    const { data: fournData } = await supabase.from("fournisseurs").select("*").order("name");
    const { data: articlesData } = await supabase.from("articles").select("*").neq("is_active", false).order("designation");

    if (fournData) setFournisseurs(fournData);
    if (articlesData) setArticles(articlesData);
  };

  const handleOpenModal = () => {
    setEditingPurchaseId(null);
    setFournisseurCode("");
    setDossierNumber("");
    setFactureNumber("");
    setIssueDate(new Date().toISOString().split('T')[0]);
    setObservations("");
    setLines([]);
    loadFormData();
    setIsModalOpen(true);
  };

  const handleViewDetails = async (purchase: any) => {
    const { data } = await supabase.from("purchase_lines").select("*, articles(designation)").eq("purchase_id", purchase.id).order('position');
    setSelectedPurchase({ ...purchase, lines: data || [] });
    setIsDetailsModalOpen(true);
  };

  const handleEditPurchase = async (purchase: any) => {
    const { data } = await supabase.from("purchase_lines").select("*, articles(designation)").eq("purchase_id", purchase.id).order('position');
    
    const formattedData = (data || []).map((line: any) => ({
      ...line,
      designation: line.articles?.designation
    }));

    setEditingPurchaseId(purchase.id);
    setFournisseurCode(purchase.fournisseur_code);
    setDossierNumber(purchase.dossier_number || "");
    setFactureNumber(purchase.facture_number || "");
    setIssueDate(purchase.date);
    setObservations(purchase.observations || "");
    setLines(formattedData);
    loadFormData();
    setIsModalOpen(true);
  };

  const handleDeletePurchase = (purchase: any) => {
    showConfirm(`Voulez-vous vraiment supprimer le bon de réception ${purchase.purchase_number} ?`, async () => {
      try {
        if (purchase.status === "VALIDATED") {
          // Delete stock movements and journal entries first
          await supabase.from("stock_movements").delete().eq("reference_id", purchase.id);
          await supabase.from("journal_entries").delete().eq("reference_id", purchase.id);
        }
        const { error } = await supabase.from("purchases").delete().eq("id", purchase.id);
        if (error) throw error;
        fetchPurchases();
        showNotification("Bon de réception supprimé.", "success");
      } catch (error: any) {
        showNotification("Erreur lors de la suppression.", "error");
      }
    });
  };

  const handlePrintPurchase = async (purchaseToPrint?: any) => {
    const isEvent = purchaseToPrint && purchaseToPrint.nativeEvent;
    const purchase = (isEvent || !purchaseToPrint) ? selectedPurchase : purchaseToPrint;
    
    if (!purchase) return;
    
    let linesToPrint = purchase.lines;
    if (!linesToPrint) {
      const { data } = await supabase.from("purchase_lines").select("*, articles(designation)").eq("purchase_id", purchase.id).order('position');
      linesToPrint = data || [];
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bon de Réception ${purchase.purchase_number}</title>
          <style>
            @page {
              size: A5 portrait;
              margin: 10mm;
            }
            body { 
              font-family: Arial, sans-serif; 
              color: #000; 
              margin: 0; 
              padding: 0;
              font-size: 10px;
              line-height: 1.3;
              width: 128mm;
              height: 190mm;
            }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #111; }
            .company { font-size: 14px; color: #666; }
            .details { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .box { background: #f9f9f9; padding: 15px; border-radius: 8px; width: 45%; }
            .box-title { font-size: 12px; text-transform: uppercase; color: #888; margin: 0 0 5px 0; }
            .box-value { font-size: 16px; font-weight: bold; margin: 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; padding: 10px; border-bottom: 2px solid #eee; color: #666; font-size: 12px; text-transform: uppercase; }
            td { padding: 10px; border-bottom: 1px solid #eee; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totals { width: 300px; margin-left: auto; }
            .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .total-row.final { border-bottom: none; font-weight: bold; font-size: 18px; color: #000; }
            .observations { margin-top: 50px; font-size: 14px; color: #555; }
            .watermark {
              display: none;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info" style="width: 55%;">
              ${settings?.company_name ? `<div style="font-size: 24px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px;">${settings.company_name}</div>` : ''}
              <div style="font-size: 10px;">
                ${settings?.capital ? `<p style="margin: 1px 0;">SARL au capital de ${settings.capital}</p>` : ''}
                ${settings?.rcc ? `<p style="margin: 1px 0;">R.C.CM / C.C. N° ${settings.rcc}</p>` : ''}
                ${settings?.address ? `<p style="margin: 1px 0;">${settings.address}</p>` : ''}
                ${settings?.phone ? `<p style="margin: 1px 0;">Tél : ${settings.phone}</p>` : ''}
                ${settings?.email ? `<p style="margin: 1px 0;">Email : ${settings.email}</p>` : ''}
                ${settings?.bank_account ? `<p style="margin: 1px 0;">Banque : ${settings.bank_account}</p>` : ''}
              </div>
            </div>
            <div style="text-align: right; width: 40%;">
              <div class="title" style="font-size: 20px;">BON DE RÉCEPTION</div>
              <div class="company" style="font-size: 14px;">N° ${purchase.purchase_number}</div>
            </div>
          </div>
          
          <div class="details">
            <div class="box">
              <p class="box-title">Fournisseur</p>
              <p class="box-value">${purchase.fournisseurs?.name || purchase.fournisseur_code || 'Fournisseur'}</p>
            </div>
            <div class="box">
              <p class="box-title">Détails</p>
              <p style="margin: 0; font-size: 14px;">Date: ${new Date(purchase.date).toLocaleDateString('fr-FR')}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px;">Statut: ${purchase.status}</p>
              ${purchase.facture_number ? `<p style="margin: 5px 0 0 0; font-size: 14px;">N° Facture: ${purchase.facture_number}</p>` : ''}
              ${purchase.dossier_number ? `<p style="margin: 5px 0 0 0; font-size: 14px;">N° Dossier: ${purchase.dossier_number}</p>` : ''}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th class="text-center">Qté</th>
                <th class="text-right">PU HT</th>
                <th class="text-right">Total HT</th>
              </tr>
            </thead>
            <tbody>
              ${(linesToPrint || []).map((line: any) => `
                <tr>
                  <td>
                    <div style="font-weight: bold;">${line.article_code}</div>
                    <div style="font-size: 12px; color: #666;">${line.designation || line.articles?.designation || ''}</div>
                  </td>
                  <td class="text-center">${line.quantity}</td>
                  <td class="text-right">${Number(line.unit_price_ht || 0).toLocaleString('fr-FR')}</td>
                  <td class="text-right">${Number((line.unit_price_ht || 0) * (line.quantity || 0)).toLocaleString('fr-FR')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Total HT</span>
              <span>${Number(purchase.total_ht || 0).toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div class="total-row">
              <span>TVA</span>
              <span>${Number(purchase.total_tax || 0).toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div class="total-row final">
              <span>Total TTC</span>
              <span>${Number(purchase.total_ttc || 0).toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>

          ${purchase.observations ? `
            <div class="observations">
              <p style="font-weight: bold; margin-bottom: 5px;">Observations:</p>
              <p style="margin: 0;">${purchase.observations}</p>
            </div>
          ` : ''}
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    iframe.contentDocument?.open();
    iframe.contentDocument?.write(html);
    iframe.contentDocument?.close();
    
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };

  // --- Form Handlers ---
  const handleFournisseurSelect = (code: string) => {
    setFournisseurCode(code);
    setIsFournisseurModalOpen(false);
    setFournisseurSearch("");
  };

  const handleArticleSelect = (code: string) => {
    const article = articles.find(a => a.code === code);
    if (!article) return;

    setCurrentArticleCode(article.code);
    setCurrentDesignation(article.designation);
    setCurrentPrice(article.purchase_price || 0);
    setCurrentQuantity(1);
    setCurrentVatRate(article.tax_rate !== undefined ? article.tax_rate : 18);
    
    setIsArticleModalOpen(false);
    setArticleSearch("");
  };

  const pushLine = (): boolean => {
    if (!currentArticleCode) {
      showNotification("Veuillez sélectionner un article.", "error");
      return false;
    }
    if (currentQuantity <= 0) {
      showNotification("La quantité doit être supérieure à 0.", "error");
      return false;
    }

    const newLine = {
      id: editingLineId || Date.now(),
      article_code: currentArticleCode,
      designation: currentDesignation,
      quantity: currentQuantity,
      unit_price_ht: currentPrice,
      tax_amount: (currentPrice * currentQuantity) * (currentVatRate / 100),
      total_ttc: (currentPrice * currentQuantity) * (1 + (currentVatRate / 100))
    };

    if (editingLineId) {
      setLines(lines.map(l => l.id === editingLineId ? newLine : l));
    } else {
      setLines([...lines, newLine]);
    }

    // Reset mini-form
    setCurrentArticleCode("");
    setCurrentDesignation("");
    setCurrentQuantity(1);
    setCurrentPrice(0);
    setCurrentVatRate(18);
    setEditingLineId(null);
    return true;
  };

  const handleApplyLine = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    pushLine(); // Reste ouvert
  };

  const handleValidateLine = () => {
    if (pushLine()) {
      setIsAddLineModalOpen(false); // Ferme si succès
    }
  };

  const editLine = (index: number) => {
    const line = lines[index];
    setCurrentArticleCode(line.article_code);
    setCurrentDesignation(line.designation);
    setCurrentQuantity(line.quantity);
    setCurrentPrice(line.unit_price_ht);
    
    const calculatedVatRate = line.tax_amount && line.quantity && line.unit_price_ht 
      ? Math.round((line.tax_amount / (line.quantity * line.unit_price_ht)) * 100) 
      : 18;
    setCurrentVatRate(calculatedVatRate);
    
    setEditingLineId(line.id);
    setIsAddLineModalOpen(true);
  };

  const removeLine = (index: number) => {
    showConfirm("Voulez-vous vraiment retirer cet article du bon ?", () => {
      const newLines = [...lines];
      newLines.splice(index, 1);
      setLines(newLines);
    });
  };

  const totalHT = lines.reduce((sum, line) => sum + (line.unit_price_ht * line.quantity), 0);
  const totalVAT = lines.reduce((sum, line) => sum + line.tax_amount, 0);
  const totalTTC = totalHT + totalVAT;

  const handleSave = async (status: "DRAFT" | "VALIDATED") => {
    if (!fournisseurCode) return showNotification("Veuillez sélectionner un fournisseur.", "error");
    if (lines.length === 0) return showNotification("Veuillez ajouter au moins une ligne d'article.", "error");

    setIsSaving(true);
    try {
      const issueMonth = new Date(issueDate).getMonth() + 1;
      const issueYear = new Date(issueDate).getFullYear();
      const { data: period } = await supabase
        .from("accounting_periods")
        .select("id, status")
        .eq("month", issueMonth)
        .eq("year", issueYear)
        .single();
        
      if (status === "VALIDATED" && (!period || period.status !== "OPEN")) {
        throw new Error(`La période comptable (${issueMonth}/${issueYear}) n'est pas ouverte. Veuillez l'ouvrir dans Comptabilité > Exercices.`);
      }

      let purchaseId = editingPurchaseId;
      let purchaseNum = "";

      if (editingPurchaseId) {
        if (status === "VALIDATED") {
          // Si on modifie un bon validé, on efface d'abord ses anciens effets comptables/stock
          await supabase.from("stock_movements").delete().eq("reference_id", editingPurchaseId);
          await supabase.from("journal_entries").delete().eq("reference_id", editingPurchaseId);
        }
        
        const { error: purError } = await supabase.from("purchases").update({
          fournisseur_code: fournisseurCode,
          dossier_number: dossierNumber,
          facture_number: factureNumber,
          date: issueDate,
          observations: observations,
          total_ht: totalHT,
          total_tax: totalVAT,
          total_ttc: totalTTC,
          status: status,
          period_id: period?.id || null,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        }).eq("id", editingPurchaseId);
        if (purError) throw purError;
        
        await supabase.from("purchase_lines").delete().eq("purchase_id", editingPurchaseId);
      } else {
        const yyyy = new Date().getFullYear().toString();
        const mm = (new Date().getMonth() + 1).toString().padStart(2, '0');
        const prefix = `ACH-${yyyy}${mm}-`;
        
        const { data: lastPurchase } = await supabase
          .from('purchases')
          .select('purchase_number')
          .ilike('purchase_number', `${prefix}%`)
          .order('purchase_number', { ascending: false })
          .limit(1);
          
        let seqNum = 1;
        if (lastPurchase && lastPurchase.length > 0) {
           const lastSeq = parseInt(lastPurchase[0].purchase_number.split('-').pop() || "0", 10);
           if (!isNaN(lastSeq)) {
             seqNum = lastSeq + 1;
           }
        }
        
        const seq = seqNum.toString().padStart(4, '0');
        purchaseNum = `${prefix}${seq}`;

        const { data: purchaseData, error: purError } = await supabase.from("purchases").insert([{
          purchase_number: purchaseNum,
          fournisseur_code: fournisseurCode,
          dossier_number: dossierNumber,
          facture_number: factureNumber,
          date: issueDate,
          observations: observations,
          total_ht: totalHT,
          total_tax: totalVAT,
          total_ttc: totalTTC,
          status: status,
          period_id: period?.id || null,
          created_by: user?.id
        }]).select().single();

        if (purError) throw purError;
        purchaseId = purchaseData.id;
      }

      const linesToInsert = lines.map((l, i) => ({
        purchase_id: purchaseId,
        article_code: l.article_code,
        quantity: l.quantity,
        unit_price_ht: l.unit_price_ht,
        tax_amount: l.tax_amount,
        total_ttc: l.total_ttc,
        position: i + 1
      }));

      const { error: linesError } = await supabase.from("purchase_lines").insert(linesToInsert);
      if (linesError) throw linesError;

      if (status === "VALIDATED") {
        const movementsToInsert = lines.map(l => ({
          article_code: l.article_code,
          type: "IN_PURCHASE", 
          quantity: l.quantity,
          unit_price: l.unit_price_ht,
          date: issueDate,
          reference_id: purchaseId,
          dossier_number: dossierNumber,
          facture_number: factureNumber
        }));
        
        const { error: movError } = await supabase.from("stock_movements").insert(movementsToInsert);
        if (movError) throw movError;

        if (period) {
          const journalEntries = [
            {
              date: issueDate,
              account_number: "401", // Fournisseurs
              debit: 0,
              credit: totalTTC,
              reference_id: purchaseId,
              period_id: period.id
            },
            {
              date: issueDate,
              account_number: "601", // Achats
              debit: totalHT,
              credit: 0,
              reference_id: purchaseId,
              period_id: period.id
            }
          ];
          
          if (totalVAT > 0) {
            journalEntries.push({
              date: issueDate,
              account_number: "4456", // TVA Déductible
              debit: totalVAT,
              credit: 0,
              reference_id: purchaseId,
              period_id: period.id
            });
          }
          
          const { error: journalError } = await supabase.from("journal_entries").insert(journalEntries);
          if (journalError) throw journalError;
        }
      }

      showNotification(`Bon de réception ${status === "VALIDATED" ? "validé" : "brouillon"} enregistré avec succès !`, "success");
      
      setIsModalOpen(false);
      setEditingPurchaseId(null);
      setFournisseurCode("");
      setDossierNumber("");
      setFactureNumber("");
      setLines([]);
      setCurrentArticleCode("");
      fetchPurchases();

    } catch (error: any) {
      showNotification("Erreur: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = purchases.filter(inv => 
    inv.purchase_number.toLowerCase().includes(search.toLowerCase()) || 
    inv.fournisseurs?.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredFournisseurs = fournisseurs.filter(c => c.name.toLowerCase().includes(fournisseurSearch.toLowerCase()) || c.code.toLowerCase().includes(fournisseurSearch.toLowerCase()));
  const filteredArticles = articles.filter(a => a.designation.toLowerCase().includes(articleSearch.toLowerCase()) || a.code.toLowerCase().includes(articleSearch.toLowerCase()));

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Achats & Réceptions</h2>
          <p className="text-sm text-gray-500">Gérez vos entrées en stock (Bons de réception fournisseurs).</p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition transform hover:-translate-y-0.5 text-sm font-medium flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" /> Nouveau Bon
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Bons Validés (Ce mois)</p>
            <h3 className="text-2xl font-bold text-gray-800">{purchases.filter(i => i.status === 'VALIDATED').length}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <FileText className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Achats (TTC)</p>
            <h3 className="text-2xl font-bold text-gray-800">
              {purchases.filter(i => i.status === 'VALIDATED' || i.status === 'PAID').reduce((sum, item) => sum + (item.total_ttc || 0), 0).toLocaleString('fr-FR')} FCFA
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
              placeholder="Rechercher par n° de bon ou fournisseur..."
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
                <th className="px-6 py-4 font-medium">N° Bon</th>
                <th className="px-6 py-4 font-medium">N° Dossier</th>
                <th className="px-6 py-4 font-medium">N° Facture</th>
                <th className="px-6 py-4 font-medium">Fournisseur</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium text-right">Montant TTC</th>
                <th className="px-6 py-4 font-medium text-center">Statut</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-slate-700">{item.purchase_number}</td>
                    <td className="px-6 py-4 text-slate-600">{item.dossier_number || '-'}</td>
                    <td className="px-6 py-4 text-slate-600">{item.facture_number || '-'}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{item.fournisseurs?.name || 'Inconnu'}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(item.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-800">
                      {(item.total_ttc || 0).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 inline-block rounded-full text-xs font-semibold border ${
                        item.status === 'PAID' ? 'bg-green-100 text-green-700 border-green-200' :
                        item.status === 'VALIDATED' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        item.status === 'CANCELLED' ? 'bg-red-100 text-red-700 border-red-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        {item.status === 'PAID' ? 'PAYÉ' : 
                         item.status === 'VALIDATED' ? 'VALIDÉ' : 
                         item.status === 'CANCELLED' ? 'ANNULÉ' : 'BROUILLON'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleViewDetails(item)}
                        className="text-gray-600 hover:text-blue-600 p-1 bg-gray-50 rounded mr-2 transition"
                        title="Voir"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handlePrintPurchase(item)}
                        className="text-gray-600 hover:text-green-600 p-1 bg-gray-50 rounded mr-2 transition"
                        title="Imprimer"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleEditPurchase(item)}
                        className="text-gray-600 hover:text-orange-600 p-1 bg-gray-50 rounded mr-2 transition"
                        title="Modifier"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {user?.role === "Admin" && (
                      <button 
                        onClick={() => handleDeletePurchase(item)}
                        className="text-gray-600 hover:text-red-600 p-1 bg-gray-50 rounded transition"
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
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Aucun bon de réception trouvé.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nouveau Bon */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {editingPurchaseId ? "Modifier le Bon de Réception" : "Nouveau Bon de Réception"}
                </h3>
                <p className="text-xs text-gray-500">Création d'une nouvelle réception fournisseur.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              {/* Section 1 : Informations Générales (Haut) */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center uppercase tracking-wider">
                  <FileText className="h-4 w-4 mr-2 text-blue-600" /> Informations Générales
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Fournisseur *</label>
                    <button 
                      onClick={() => setIsFournisseurModalOpen(true)}
                      className="w-full text-left border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition flex justify-between items-center"
                    >
                      <span className={fournisseurCode ? "text-gray-900 font-medium" : "text-gray-400"}>
                        {fournisseurCode ? fournisseurs.find(c => c.code === fournisseurCode)?.name : "Sélectionner un fournisseur..."}
                      </span>
                      <Search className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Date de réception *</label>
                    <input 
                      type="date" 
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">N° Dossier</label>
                    <input 
                      type="text" 
                      value={dossierNumber}
                      onChange={(e) => setDossierNumber(e.target.value)}
                      placeholder="Optionnel"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">N° Facture</label>
                    <input 
                      type="text" 
                      value={factureNumber}
                      onChange={(e) => setFactureNumber(e.target.value)}
                      placeholder="Optionnel"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                    />
                  </div>
                </div>

                <div className="space-y-1 mt-4">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Observations</label>
                  <textarea 
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                    placeholder="Notes, remarques..."
                  />
                </div>
              </div>

              {/* Section 2 : Tableau de restitution */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center">
                    <span>Détail des articles reçus</span>
                    <span className="ml-3 text-xs font-normal text-gray-500 normal-case bg-gray-100 px-2 py-1 rounded-full">{lines.length} article(s)</span>
                  </h3>
                  <button 
                    onClick={() => {
                      setEditingLineId(null);
                      setCurrentArticleCode("");
                      setCurrentDesignation("");
                      setCurrentQuantity(1);
                      setCurrentPrice(0);
                      setIsAddLineModalOpen(true);
                    }}
                    className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center border border-blue-200"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Ajouter
                  </button>
                </div>
                
                {lines.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 font-medium">Article</th>
                          <th className="px-4 py-3 font-medium text-center">Qté</th>
                          <th className="px-4 py-3 font-medium text-right">PU Achat HT</th>
                          <th className="px-4 py-3 font-medium text-right">Total HT</th>
                          <th className="px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lines.map((line, index) => (
                          <tr key={line.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-gray-800">{line.article_code}</span>
                              <span className="text-gray-500 ml-2">- {line.designation}</span>
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-gray-800">{line.quantity}</td>
                            <td className="px-4 py-3 text-right text-gray-600">{Number(line.unit_price_ht || 0).toLocaleString('fr-FR')}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800">{Number((line.unit_price_ht || 0) * (line.quantity || 0)).toLocaleString('fr-FR')}</td>
                            <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => editLine(index)}
                                className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors mr-1"
                                title="Modifier"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button 
                                onClick={() => removeLine(index)}
                                className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-gray-50 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                    Aucun article ajouté au bon pour le moment. Cliquez sur "Ajouter" pour commencer.
                  </div>
                )}
              </div>

              {/* Section 3 : Récapitulatif et Actions (Bas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p>• La <strong>validation</strong> d'un bon de réception INCORPORE instantanément les articles au stock global de l'entreprise.</p>
                  <p className="mt-2">• Les écritures comptables (Débit Achats, Débit TVA Déductible, Crédit Fournisseur) seront également passées à la date sélectionnée.</p>
                  
                  {editingPurchaseId && (
                    <div className="mt-4 pt-4 border-t border-gray-200/60 space-y-1">
                      <p className="flex items-center text-[11px] text-gray-400 uppercase font-semibold tracking-wider">
                        Traçabilité du document
                      </p>
                      <p className="text-xs text-gray-500">
                        Créé par <span className="font-semibold text-gray-700">{purchases.find(p => p.id === editingPurchaseId)?.creator?.full_name || 'Inconnu'}</span> le {new Date(purchases.find(p => p.id === editingPurchaseId)?.created_at || '').toLocaleString('fr-FR')}
                      </p>
                      {purchases.find(p => p.id === editingPurchaseId)?.updated_at && (
                        <p className="text-xs text-gray-500">
                          Modifié par <span className="font-semibold text-gray-700">{purchases.find(p => p.id === editingPurchaseId)?.updater?.full_name || 'Inconnu'}</span> le {new Date(purchases.find(p => p.id === editingPurchaseId)?.updated_at || '').toLocaleString('fr-FR')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-5 text-white">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Récapitulatif Achats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total HT</span>
                      <span className="font-medium">{totalHT.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">TVA</span>
                      <span className="font-medium">{totalVAT.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="pt-3 border-t border-slate-600 flex justify-between items-center">
                      <span className="font-bold">TOTAL TTC</span>
                      <span className="font-bold text-2xl text-blue-400">{totalTTC.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <button 
                      onClick={() => handleSave("DRAFT")}
                      disabled={isSaving}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-lg text-sm font-semibold transition-all flex justify-center items-center order-2 sm:order-1"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Brouillon
                    </button>
                    <button 
                      onClick={() => handleSave("VALIDATED")}
                      disabled={isSaving}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-sm font-bold shadow-md transition-all focus:ring-4 focus:ring-blue-500/30 flex justify-center items-center order-1 sm:order-2"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Valider Réception
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal : Ajouter Ligne */}
      {isAddLineModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[50] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">
                {editingLineId ? "Modifier l'article" : "Ajouter un article"}
              </h3>
              <button onClick={() => setIsAddLineModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleApplyLine} className="p-6 space-y-4 flex-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Article *</label>
                <button 
                  type="button"
                  onClick={() => setIsArticleModalOpen(true)}
                  className="w-full text-left border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition flex justify-between items-center"
                >
                  <span className={currentArticleCode ? "text-gray-900 font-medium truncate" : "text-gray-400"}>
                    {currentArticleCode ? `${currentArticleCode} - ${currentDesignation}` : "Sélectionner un article..."}
                  </span>
                  <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Quantité *</label>
                  <input 
                    type="number" min="1" 
                    required
                    value={currentQuantity}
                    onChange={(e) => setCurrentQuantity(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Prix Achat HT *</label>
                  <input 
                    type="number" 
                    required min="0"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">TVA (%) *</label>
                  <input 
                    type="number" 
                    required min="0" max="100"
                    value={currentVatRate}
                    onChange={(e) => setCurrentVatRate(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                  />
                </div>
              </div>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2">
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="text-slate-500">Total HT</span>
                  <span className="font-semibold text-slate-700">{(currentQuantity * currentPrice).toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-slate-500">TVA ({currentVatRate}%)</span>
                  <span className="font-semibold text-slate-700">{((currentQuantity * currentPrice) * (currentVatRate / 100)).toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                  <span className="font-bold text-slate-800">TOTAL TTC</span>
                  <span className="font-bold text-lg text-blue-600">{((currentQuantity * currentPrice) * (1 + currentVatRate / 100)).toLocaleString('fr-FR')} FCFA</span>
                </div>
              </div>

              {/* Submission button hidden so Enter key works seamlessly */}
              <button type="submit" className="hidden">Submit</button>
            </form>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
              <button 
                type="button"
                onClick={() => setIsAddLineModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-lg transition"
              >
                Annuler
              </button>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={handleApplyLine}
                  className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 border border-blue-200 rounded-lg transition"
                >
                  Appliquer
                </button>
                <button 
                  type="button"
                  onClick={handleValidateLine}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
                >
                  Valider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal : Sélection Fournisseur */}
      {isFournisseurModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">Rechercher un Fournisseur</h3>
              <button onClick={() => setIsFournisseurModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Rechercher par nom ou code..."
                  value={fournisseurSearch}
                  onChange={(e) => setFournisseurSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="overflow-y-auto p-2 custom-scrollbar">
              {filteredFournisseurs.length > 0 ? (
                <ul className="space-y-1">
                  {filteredFournisseurs.map(c => (
                    <li key={c.code}>
                      <button 
                        onClick={() => handleFournisseurSelect(c.code)}
                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 transition-colors flex flex-col border border-transparent hover:border-blue-100"
                      >
                        <span className="font-semibold text-gray-900">{c.name}</span>
                        <span className="text-xs text-gray-500 font-mono mt-1">{c.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-8 text-center text-gray-500">Aucun fournisseur trouvé.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal : Sélection Article */}
      {isArticleModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">Rechercher un Article</h3>
              <button onClick={() => setIsArticleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Rechercher par désignation ou code..."
                  value={articleSearch}
                  onChange={(e) => setArticleSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="overflow-y-auto p-2 custom-scrollbar">
              {filteredArticles.length > 0 ? (
                <ul className="space-y-1">
                  {filteredArticles.map(a => (
                    <li key={a.code}>
                      <button 
                        onClick={() => handleArticleSelect(a.code)}
                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 transition-colors flex items-center justify-between border border-transparent hover:border-blue-100"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">{a.designation}</p>
                          <p className="text-xs text-gray-500 font-mono mt-1">{a.code}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-600">Dernier PA: {a.purchase_price ? a.purchase_price.toLocaleString('fr-FR') : 0} FCFA</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-8 text-center text-gray-500">Aucun article trouvé.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Détails du Bon */}
      {isDetailsModalOpen && selectedPurchase && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-800">Détails du Bon {selectedPurchase.purchase_number}</h3>
                <p className="text-xs text-gray-500">{new Date(selectedPurchase.date).toLocaleDateString('fr-FR')} - {selectedPurchase.fournisseurs?.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handlePrintPurchase}
                  className="text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center border border-blue-200"
                >
                  <Printer className="h-4 w-4 mr-2" /> Imprimer
                </button>
                <button onClick={() => setIsDetailsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-medium">Article</th>
                      <th className="px-4 py-3 font-medium text-center">Qté</th>
                      <th className="px-4 py-3 font-medium text-right">PU HT</th>
                      <th className="px-4 py-3 font-medium text-right">TVA</th>
                      <th className="px-4 py-3 font-medium text-right">Total TTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedPurchase.lines.map((line: any) => (
                      <tr key={line.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-800">{line.article_code}</span>
                          <span className="text-gray-500 ml-2">- {line.articles?.designation || line.designation}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-gray-800">{line.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{Number(line.unit_price_ht).toLocaleString('fr-FR')}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{Number(line.tax_amount).toLocaleString('fr-FR')}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{Number(line.total_ttc).toLocaleString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-72 bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Total HT</span>
                      <span className="font-medium">{Number(selectedPurchase.total_ht).toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">TVA</span>
                      <span className="font-medium">{Number(selectedPurchase.total_tax).toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                      <span className="font-bold text-slate-700">TOTAL TTC</span>
                      <span className="font-bold text-lg text-blue-600">{Number(selectedPurchase.total_ttc).toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
