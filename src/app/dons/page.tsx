"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Eye, Printer, FileText, X, Save, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useAuth } from "@/components/providers/AuthProvider";


interface Don {
  id: string;
  don_number: string;
  date: string;
  beneficiary_name: string;
  observations?: string;
  status: "DRAFT" | "VALIDATED" | "CANCELLED";
  created_at?: string;
  creator?: { full_name: string };
}

export default function DonsPage() {
  const { user } = useAuth();
  const [dons, setDons] = useState<Don[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sub-modal states
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [articleSearch, setArticleSearch] = useState("");

  // Form states
  const [editingDonId, setEditingDonId] = useState<string | null>(null);
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [observations, setObservations] = useState("");
  const [lines, setLines] = useState<any[]>([]);

  // Mini-form states for adding lines
  const [currentArticleCode, setCurrentArticleCode] = useState("");
  const [currentDesignation, setCurrentDesignation] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState<number>(1);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedDon, setSelectedDon] = useState<any>(null);
  
  const { showNotification, showConfirm } = useNotification();

  useEffect(() => {
    fetchDons();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("settings").select("*").limit(1).single();
    if (data) setSettings(data);
  };

  const fetchDons = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("dons")
      .select(`*, creator:app_users!dons_created_by_fkey(full_name)`)
      .order("created_at", { ascending: false });
      
    if (!error && data) setDons(data as any);
    setIsLoading(false);
  };

  const loadFormData = async () => {
    const { data: articlesData } = await supabase.from("articles").select("*, stock(current_quantity)").neq("is_active", false).order("designation");
    if (articlesData) {
      const formatted = articlesData.map((a: any) => ({
        ...a,
        current_quantity: a.stock?.[0]?.current_quantity || 0
      }));
      setArticles(formatted);
    }
  };

  const handleOpenModal = () => {
    setEditingDonId(null);
    setBeneficiaryName("");
    setIssueDate(new Date().toISOString().split('T')[0]);
    setObservations("");
    setLines([]);
    loadFormData();
    setIsModalOpen(true);
  };

  const handleViewDetails = async (don: any) => {
    const { data } = await supabase.from("don_lines").select("*, articles(designation)").eq("don_id", don.id).order('id');
    setSelectedDon({ ...don, lines: data || [] });
    setIsDetailsModalOpen(true);
  };

  const handleEditDon = async (don: any) => {
    const { data } = await supabase.from("don_lines").select("*, articles(designation)").eq("don_id", don.id).order('id');
    
    const formattedData = (data || []).map((line: any) => ({
      ...line,
      designation: line.articles?.designation,
      unit_price: line.unit_value,
      total_ht: line.total_value
    }));

    setEditingDonId(don.id);
    setBeneficiaryName(don.beneficiary_name || "");
    setIssueDate(don.date);
    setObservations(don.observations || "");
    setLines(formattedData);
    loadFormData();
    setIsModalOpen(true);
  };

  const handleDeleteDon = (don: any) => {
    showConfirm(`Voulez-vous vraiment supprimer le don ${don.don_number} ?`, async () => {
      try {
        if (don.status === "VALIDATED") {
          await supabase.from("stock_movements").delete().eq("reference_id", don.id);
        }
        const { error } = await supabase.from("dons").delete().eq("id", don.id);
        if (error) throw error;
        fetchDons();
        showNotification("Don supprimé.", "success");
      } catch (error: any) {
        showNotification("Erreur lors de la suppression.", "error");
      }
    });
  };

  const handlePrintDon = async (donToPrint?: any) => {
    let don = donToPrint;
    if (!donToPrint || donToPrint.nativeEvent) {
      don = selectedDon;
    }
    if (!don) return;

    let linesToPrint = don.lines;
    if (!linesToPrint) {
      const { data } = await supabase.from("don_lines").select("*, articles(designation)").eq("don_id", don.id).order('id');
      linesToPrint = data || [];
    }

    const calcTotalVal = linesToPrint.reduce((acc: number, l: any) => acc + (l.total_value || (l.quantity * (l.unit_value || 0))), 0);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bon de Don - ${don.don_number}</title>
          <style>
            @page {
              size: 148mm 210mm;
              margin: 0;
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0;
              padding: 15px;
              color: #000;
              font-size: 10px;
              position: relative;
            }
            .header {
              display: flex;
              justify-content: space-between;
              border-bottom: 2px solid #000;
              padding-bottom: 5px;
              margin-bottom: 10px;
            }
            .company-info {
              width: 55%;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 5px;
            }
            .company-details p {
              margin: 1px 0;
              font-size: 9px;
            }
            .client-info-container {
              width: 40%;
            }
            .date-page {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              font-weight: bold;
            }
            .client-box {
              border: 1px solid #000;
              padding: 10px;
            }
            .client-box p {
              margin: 2px 0;
            }
            .don-title {
              text-align: center;
              margin: 15px 0;
            }
            .don-title h2 {
              margin: 0;
              font-size: 16px;
              text-transform: uppercase;
            }
            .don-title h3 {
              margin: 2px 0 0 0;
              font-size: 14px;
            }
            
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 10px; 
              border: 1px solid #000;
            }
            th, td { 
              border: 1px solid #000; 
              padding: 4px; 
              vertical-align: top;
            }
            th { 
              background-color: #f0f0f0; 
              font-weight: bold;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            
            .totals-container {
              display: flex;
              justify-content: flex-end;
              margin-top: 10px;
            }
            
            .totals-table {
              width: 40%;
            }
            
            .footer {
              margin-top: 20px;
              border-top: 1px solid #000;
              padding-top: 10px;
            }
            .amount-words {
              font-weight: bold;
              font-size: 10px;
              margin-bottom: 15px;
            }
            .conditions {
              font-size: 8px;
              text-align: center;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <div class="company-name">${settings?.company_name || 'GECKO NEGOCE'}</div>
              <div class="company-details">
                <p>SARL au capital de ${settings?.capital || '1.000.000 F CFA'}</p>
                <p>R.C.CM / C.C. N° ${settings?.rcc || '1234567 A'}</p>
                <p>${settings?.address || 'Adresse de l\'entreprise / Ville'}</p>
                <p>Tél : ${settings?.phone || '+225 00 00 00 00 00'}</p>
                <p>Email : ${settings?.email || 'contact@entreprise.com'}</p>
                <p>Banque : ${settings?.bank_account || 'NOM DE LA BANQUE CI 000 0000 00000000 00'}</p>
              </div>
            </div>
            
            <div class="client-info-container">
              <div class="date-page">
                <span>Abidjan, le ${new Date(don.date).toLocaleDateString('fr-FR')}</span>
                <span>Page 1/1</span>
              </div>
              <div class="client-box">
                <p style="font-weight: bold; margin-bottom: 5px;">BÉNÉFICIAIRE :</p>
                <p style="font-weight: bold; font-size: 12px;">${don.beneficiary_name || 'Non renseigné'}</p>
              </div>
            </div>
          </div>

          <div class="don-title">
            <h2>BON DE DON</h2>
            <h3>N° ${don.don_number}</h3>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 15%">Code Article</th>
                <th style="width: 45%">Désignation</th>
                <th style="width: 10%">Qté</th>
                <th style="width: 15%">Val. Unitaire</th>
                <th style="width: 15%">Val. Totale</th>
              </tr>
            </thead>
            <tbody>
              ${(linesToPrint || []).map((line: any) => `
                <tr>
                  <td class="text-center">${line.article_code}</td>
                  <td>${line.designation || line.articles?.designation || ''}</td>
                  <td class="text-center">${line.quantity}</td>
                  <td class="text-right">${Number(line.unit_value || 0).toLocaleString('fr-FR')}</td>
                  <td class="text-right font-bold">${Number(line.total_value || 0).toLocaleString('fr-FR')}</td>
                </tr>
              `).join('')}
              <tr style="height: 50px;">
                <td></td><td></td><td></td><td></td><td></td>
              </tr>
            </tbody>
          </table>

          <div class="totals-container">
            <div class="totals-table">
              <table>
                <tr>
                  <th style="font-size: 14px; text-align: left;">VALEUR TOTALE</th>
                  <td style="font-size: 14px; text-align: right;" class="font-bold">${Number(calcTotalVal).toLocaleString('fr-FR')} CFA</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="footer">
            <p class="conditions">Document établi pour valoir ce que de droit concernant les dons de l'entreprise.</p>
          </div>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    
    iframe.document?.open();
    iframe.document?.write(html);
    iframe.document?.close();
    
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };

  const handleArticleSelect = (code: string) => {
    const article = articles.find(a => a.code === code);
    if (!article) return;

    setCurrentArticleCode(article.code);
    setCurrentDesignation(article.designation);
    setCurrentPrice(article.purchase_price || article.sale_price_ht || 0); // Valeur d'achat par défaut
    setCurrentQuantity(1);
    
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
      unit_price: currentPrice,
      total_ht: currentQuantity * currentPrice
    };

    if (editingLineId) {
      setLines(lines.map(l => l.id === editingLineId ? newLine : l));
    } else {
      setLines([...lines, newLine]);
    }

    setCurrentArticleCode("");
    setCurrentDesignation("");
    setCurrentQuantity(1);
    setCurrentPrice(0);
    setEditingLineId(null);
    return true;
  };

  const handleValidateLine = () => {
    if (pushLine()) {
      setIsAddLineModalOpen(false);
    }
  };

  const editLine = (index: number) => {
    const line = lines[index];
    setCurrentArticleCode(line.article_code);
    setCurrentDesignation(line.designation || line.articles?.designation);
    setCurrentQuantity(line.quantity);
    setCurrentPrice(line.unit_price);
    setEditingLineId(line.id);
    setIsAddLineModalOpen(true);
  };

  const removeLine = (index: number) => {
    showConfirm("Voulez-vous vraiment retirer cet article du don ?", () => {
      const newLines = [...lines];
      newLines.splice(index, 1);
      setLines(newLines);
    });
  };

  const handleSave = async (status: "DRAFT" | "VALIDATED") => {
    if (!beneficiaryName) return showNotification("Veuillez renseigner le nom du bénéficiaire.", "error");
    if (lines.length === 0) return showNotification("Veuillez ajouter au moins un article.", "error");

    setIsSaving(true);
    try {
      let donId = editingDonId;

      if (editingDonId) {
        if (status === "VALIDATED") {
          await supabase.from("stock_movements").delete().eq("reference_id", editingDonId);
        }

        const { error: donError } = await supabase.from("dons").update({
          beneficiary_name: beneficiaryName,
          date: issueDate,
          observations: observations,
          status: status,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        }).eq("id", editingDonId);
        
        if (donError) throw donError;
        await supabase.from("don_lines").delete().eq("don_id", editingDonId);
      } else {
        const formatStr = settings?.don_format || "DON-YYYYMM-XXXX";
        const yyyy = new Date().getFullYear().toString();
        const mm = (new Date().getMonth() + 1).toString().padStart(2, '0');
        const prefix = formatStr.split('-')[0] + `-${yyyy}${mm}-`;
        
        const { data: lastDon } = await supabase
          .from('dons')
          .select('don_number')
          .ilike('don_number', `${prefix}%`)
          .order('don_number', { ascending: false })
          .limit(1);
          
        let seqNum = 1;
        if (lastDon && lastDon.length > 0) {
           const lastSeq = parseInt(lastDon[0].don_number.split('-').pop() || "0", 10);
           if (!isNaN(lastSeq)) {
             seqNum = lastSeq + 1;
           }
        }
        
        const seq = seqNum.toString().padStart(4, '0');
        const donNum = `${prefix}${seq}`;

        const { data: donData, error: donError } = await supabase.from("dons").insert([{
          don_number: donNum,
          beneficiary_name: beneficiaryName,
          date: issueDate,
          observations: observations,
          status: status,
          created_by: user?.id
        }]).select().single();

        if (donError) throw donError;
        donId = donData.id;
      }

      const linesToInsert = lines.map((l, i) => ({
        don_id: donId,
        article_code: l.article_code,
        quantity: l.quantity,
        unit_value: l.unit_price,
        total_value: l.total_ht
      }));

      const { error: linesError } = await supabase.from("don_lines").insert(linesToInsert);
      if (linesError) throw linesError;

      if (status === "VALIDATED") {
        const movementsToInsert = lines.map(l => ({
          article_code: l.article_code,
          type: "OUT_DON",
          quantity: l.quantity,
          unit_price: l.unit_price,
          date: issueDate,
          reference_id: donId
        }));
        
        const { error: movError } = await supabase.from("stock_movements").insert(movementsToInsert);
        if (movError) throw movError;
      }

      showNotification("Don sauvegardé avec succès !", "success");
      
      setIsModalOpen(false);
      setEditingDonId(null);
      setBeneficiaryName("");
      setLines([]);
      fetchDons();

    } catch (error: any) {
      showNotification("Erreur: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = dons.filter(d => 
    d.don_number.toLowerCase().includes(search.toLowerCase()) || 
    d.beneficiary_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredArticles = articles.filter(a => a.designation.toLowerCase().includes(articleSearch.toLowerCase()) || a.code.toLowerCase().includes(articleSearch.toLowerCase()));

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestion des Dons</h2>
          <p className="text-sm text-gray-500">Tracez les articles offerts gratuitement.</p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition transform hover:-translate-y-0.5 text-sm font-medium flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" /> Nouveau Don
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par numéro ou bénéficiaire..."
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
                <th className="px-6 py-4 font-medium">N° Don</th>
                <th className="px-6 py-4 font-medium">Bénéficiaire</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium text-center">Statut</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 font-semibold text-slate-700">{item.don_number}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{item.beneficiary_name}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(item.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 inline-block rounded-full text-xs font-semibold border ${
                        item.status === 'VALIDATED' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        item.status === 'CANCELLED' ? 'bg-red-100 text-red-700 border-red-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        {item.status === 'VALIDATED' ? 'VALIDÉ' : 
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
                        onClick={() => handlePrintDon(item)}
                        className="text-gray-600 hover:text-green-600 p-1 bg-gray-50 rounded mr-2 transition"
                        title="Imprimer"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleEditDon(item)}
                        className="text-gray-600 hover:text-orange-600 p-1 bg-gray-50 rounded mr-2 transition"
                        title="Modifier"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {user?.role === "Admin" && (
                        <button 
                          onClick={() => handleDeleteDon(item)}
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
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Aucun don trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">
                {editingDonId ? "Modifier le Don" : "Nouveau Don"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Nom du bénéficiaire *</label>
                    <input
                      type="text"
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      placeholder="Nom de l'association, client, etc."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Date</label>
                    <input
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">Observations</label>
                  <textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    rows={4}
                    placeholder="Détails, motif du don..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800 flex items-center">
                    <FileText className="h-4 w-4 mr-2" /> Articles Donnés
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentArticleCode("");
                      setCurrentDesignation("");
                      setCurrentQuantity(1);
                      setCurrentPrice(0);
                      setEditingLineId(null);
                      setIsAddLineModalOpen(true);
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Ajouter Ligne
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/4">Code</th>
                        <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider w-2/4">Désignation</th>
                        <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/12 text-center">Qté</th>
                        <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider w-1/6 text-right">Valeur Unitaire</th>
                        <th className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase tracking-wider w-[50px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lines.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">
                            Aucun article ajouté.
                          </td>
                        </tr>
                      ) : (
                        lines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition">
                            <td className="px-4 py-2 text-sm text-gray-800 font-medium">{line.article_code}</td>
                            <td className="px-4 py-2 text-sm text-gray-600 truncate max-w-[200px]">{line.designation}</td>
                            <td className="px-4 py-2 text-sm text-gray-800 text-center">{line.quantity}</td>
                            <td className="px-4 py-2 text-sm text-gray-800 text-right">{line.unit_price.toLocaleString('fr-FR')}</td>
                            <td className="px-4 py-2 text-sm text-right">
                              <button onClick={() => editLine(idx)} className="text-blue-500 hover:text-blue-700 mx-1"><Edit2 className="h-4 w-4" /></button>
                              <button onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700 mx-1"><X className="h-4 w-4" /></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div className="text-sm text-gray-500">
                L'enregistrement d'un don validé décrémente automatiquement le stock.
              </div>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                  Fermer
                </button>
                <button 
                  onClick={() => handleSave("DRAFT")} 
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm transition flex items-center disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" /> Brouillon
                </button>
                <button 
                  onClick={() => handleSave("VALIDATED")} 
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition flex items-center disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" /> Valider le Don
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Line Modal */}
      {isAddLineModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 text-sm">Ajouter un Article</h3>
              <button onClick={() => setIsAddLineModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Article *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={currentArticleCode}
                    readOnly
                    placeholder="Sélectionner..."
                    className="w-1/3 border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-gray-50"
                  />
                  <input
                    type="text"
                    value={currentDesignation}
                    readOnly
                    className="flex-1 border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-gray-50"
                  />
                  <button 
                    onClick={() => setIsArticleModalOpen(true)}
                    className="bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md px-3 py-1.5 text-gray-700 transition"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quantité *</label>
                  <input
                    type="number"
                    min="1"
                    value={currentQuantity}
                    onChange={(e) => setCurrentQuantity(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Val. Unitaire (Info)</label>
                  <input
                    type="number"
                    min="0"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(Number(e.target.value))}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setIsAddLineModalOpen(false)} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-md transition">Annuler</button>
              <button onClick={handleValidateLine} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition">Valider</button>
            </div>
          </div>
        </div>
      )}

      {/* Select Article Modal */}
      {isArticleModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800 text-sm">Choisir un Article</h3>
              <button onClick={() => setIsArticleModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un article..."
                  value={articleSearch}
                  onChange={(e) => setArticleSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-0">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-600">Code</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-600">Désignation</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-600 text-center">Stock</th>
                    <th className="px-4 py-2 text-xs font-semibold text-gray-600 text-right">Prix Achat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredArticles.map(a => (
                    <tr 
                      key={a.code} 
                      onClick={() => handleArticleSelect(a.code)}
                      className="hover:bg-blue-50 cursor-pointer transition"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{a.code}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{a.designation}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${a.current_quantity <= a.min_stock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {a.current_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{Number(a.purchase_price || 0).toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                  {filteredArticles.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500 text-sm">Aucun article trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {isDetailsModalOpen && selectedDon && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-bold text-gray-800">Détails du Don - {selectedDon.don_number}</h3>
              <button onClick={() => setIsDetailsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Bénéficiaire</p>
                  <p className="font-bold text-gray-800">{selectedDon.beneficiary_name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Date</p>
                  <p className="font-bold text-gray-800">{new Date(selectedDon.date).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Statut</p>
                  <p className="font-bold text-gray-800">{selectedDon.status === 'VALIDATED' ? 'VALIDÉ' : 'BROUILLON'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Observations</p>
                  <p className="text-sm text-gray-700">{selectedDon.observations || '-'}</p>
                </div>
              </div>

              <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">Articles donnés</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="px-3 py-2 font-medium">Code</th>
                      <th className="px-3 py-2 font-medium">Désignation</th>
                      <th className="px-3 py-2 font-medium text-center">Qté</th>
                      <th className="px-3 py-2 font-medium text-right">Val. Unitaire</th>
                      <th className="px-3 py-2 font-medium text-right">Val. Totale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedDon.lines?.map((line: any) => (
                      <tr key={line.id}>
                        <td className="px-3 py-2 text-gray-800">{line.article_code}</td>
                        <td className="px-3 py-2 text-gray-600">{line.articles?.designation}</td>
                        <td className="px-3 py-2 text-gray-800 text-center font-bold">{line.quantity}</td>
                        <td className="px-3 py-2 text-gray-600 text-right">{Number(line.unit_value || 0).toLocaleString('fr-FR')}</td>
                        <td className="px-3 py-2 text-gray-800 text-right font-bold">{Number(line.total_value || 0).toLocaleString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition"
              >
                Fermer
              </button>
              <button 
                onClick={() => { setIsDetailsModalOpen(false); handlePrintDon(selectedDon); }}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition flex items-center"
              >
                <Printer className="h-4 w-4 mr-2" /> Imprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
