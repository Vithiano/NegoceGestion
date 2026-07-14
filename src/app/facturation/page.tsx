"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Eye, Printer, FileText, X, Save, CheckCircle2, Trash2, Edit2 } from "lucide-react";
import { supabase } from "@/utils/supabase";
import { useNotification } from "@/components/providers/NotificationProvider";
import { useAuth } from "@/components/providers/AuthProvider";

interface Invoice {
  id: string;
  invoice_number: string;
  client_code: string;
  date: string;
  total_ht: number;
  total_ttc: number;
  status: "DRAFT" | "VALIDATED" | "PAID" | "CANCELLED";
  clients?: { name: string };
  created_at?: string;
  updated_at?: string;
  creator?: { full_name: string };
  updater?: { full_name: string };
}

export default function FacturationPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Sub-modal states
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
  const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [articleSearch, setArticleSearch] = useState("");

  // Form states
  const [clientCode, setClientCode] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState("");
  const [observations, setObservations] = useState("");
  const [invoiceType, setInvoiceType] = useState<"FACTURE" | "AVOIR">("FACTURE");
  const [lines, setLines] = useState<any[]>([]);

  // Mini-form states for adding lines
  const [currentArticleCode, setCurrentArticleCode] = useState("");
  const [currentDesignation, setCurrentDesignation] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState<number>(1);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currentVatRate, setCurrentVatRate] = useState<number>(18);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);

  // CRUD states
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  
  const { showNotification, showConfirm } = useNotification();

  useEffect(() => {
    fetchInvoices();
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from("settings").select("*").limit(1).single();
    if (data) setSettings(data);
  };

  const fetchInvoices = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("invoices")
      .select(`*, clients(*), creator:app_users!invoices_created_by_fkey(full_name), updater:app_users!invoices_updated_by_fkey(full_name)`)
      .order("created_at", { ascending: false });
      
    if (!error && data) setInvoices(data as any);
    setIsLoading(false);
  };

  const loadFormData = async () => {
    const { data: clientsData } = await supabase.from("clients").select("*").order("name");
    const { data: articlesData } = await supabase.from("articles").select("*, stock(current_quantity)").neq("is_active", false).order("designation");
    const { data: settingsData } = await supabase.from("settings").select("*").limit(1).single();

    if (clientsData) setClients(clientsData);
    if (articlesData) {
      const formatted = articlesData.map((a: any) => ({
        ...a,
        current_quantity: a.stock?.[0]?.current_quantity || 0
      }));
      setArticles(formatted);
    }
    
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 30);
    setDueDate(defaultDue.toISOString().split('T')[0]);
  };

  const handleOpenModal = () => {
    setEditingInvoiceId(null);
    setInvoiceType("FACTURE");
    setClientCode("");
    setIssueDate(new Date().toISOString().split('T')[0]);
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 30);
    setDueDate(defaultDue.toISOString().split('T')[0]);
    setObservations("");
    setLines([]);
    loadFormData();
    setIsModalOpen(true);
  };

  const handleViewDetails = async (invoice: any) => {
    const { data } = await supabase.from("invoice_lines").select("*, articles(designation)").eq("invoice_id", invoice.id).order('id');
    setSelectedInvoice({ ...invoice, lines: data || [] });
    setIsDetailsModalOpen(true);
  };

  const handleEditInvoice = async (invoice: any) => {
    setInvoiceType(invoice.invoice_number?.startsWith("AV-") ? "AVOIR" : "FACTURE");
    const { data } = await supabase.from("invoice_lines").select("*, articles(designation)").eq("invoice_id", invoice.id).order('id');
    
    const formattedData = (data || []).map((line: any) => ({
      ...line,
      designation: line.articles?.designation,
      unit_price: line.unit_price_ht,
      total_ht: line.quantity * line.unit_price_ht,
      vat_rate: line.tax_amount && line.quantity * line.unit_price_ht ? Math.round((line.tax_amount / (line.quantity * line.unit_price_ht)) * 100) : 18
    }));

    setEditingInvoiceId(invoice.id);
    setClientCode(invoice.client_code);
    setIssueDate(invoice.date);
    setDueDate("");
    setObservations(invoice.observations || "");
    setLines(formattedData);
    loadFormData();
    setIsModalOpen(true);
  };

  const handleDeleteInvoice = (invoice: any) => {
    showConfirm(`Voulez-vous vraiment supprimer la facture ${invoice.invoice_number} ?`, async () => {
      try {
        if (invoice.status === "VALIDATED") {
          // Delete stock movements and journal entries first
          await supabase.from("stock_movements").delete().eq("reference_id", invoice.id);
          await supabase.from("journal_entries").delete().eq("reference_id", invoice.id);
        }
        const { error } = await supabase.from("invoices").delete().eq("id", invoice.id);
        if (error) throw error;
        fetchInvoices();
        showNotification("Facture supprimée.", "success");
      } catch (error: any) {
        showNotification("Erreur lors de la suppression.", "error");
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedInvoiceIds.length === 0) return;
    
    showConfirm(`Voulez-vous vraiment supprimer ${selectedInvoiceIds.length} facture(s) sélectionnée(s) ?`, async () => {
      try {
        const invoicesToDelete = invoices.filter(inv => selectedInvoiceIds.includes(inv.id));
        const validatedIds = invoicesToDelete.filter(inv => inv.status === 'VALIDATED').map(inv => inv.id);

        if (validatedIds.length > 0) {
          await supabase.from("stock_movements").delete().in("reference_id", validatedIds);
          await supabase.from("journal_entries").delete().in("reference_id", validatedIds);
        }

        const { error } = await supabase.from("invoices").delete().in("id", selectedInvoiceIds);
        if (error) throw error;

        fetchInvoices();
        setSelectedInvoiceIds([]);
        showNotification(`${selectedInvoiceIds.length} facture(s) supprimée(s).`, "success");
      } catch (error: any) {
        showNotification("Erreur lors de la suppression multiple.", "error");
      }
    });
  };

  const toggleSelectAll = () => {
    const filtered = invoices.filter(inv => 
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) || 
      inv.clients?.name.toLowerCase().includes(search.toLowerCase())
    );
    if (selectedInvoiceIds.length === filtered.length && filtered.length > 0) {
      setSelectedInvoiceIds([]);
    } else {
      setSelectedInvoiceIds(filtered.map(i => i.id));
    }
  };

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoiceIds(prev => 
      prev.includes(id) ? prev.filter(invId => invId !== id) : [...prev, id]
    );
  };

  const handlePrintInvoice = async (invoiceToPrint?: any) => {
    // Si appelé depuis le bouton du tableau, on utilise invoiceToPrint. Sinon selectedInvoice (modal).
    // Eviter les problèmes d'événement pour le click: on prend l'événement optionnellement.
    // L'argument peut être l'event si on a onClick={handlePrintInvoice} sans (), donc on vérifie si c'est un event synthétique.
    const isEvent = invoiceToPrint && invoiceToPrint.nativeEvent;
    const invoice = (isEvent || !invoiceToPrint) ? selectedInvoice : invoiceToPrint;
    
    if (!invoice) return;
    
    let linesToPrint = invoice.lines;
    if (!linesToPrint) {
      const { data } = await supabase.from("invoice_lines").select("*, articles(designation)").eq("invoice_id", invoice.id).order('id');
      linesToPrint = data || [];
    }

    // Calcul de secours au cas où la facture a été mal sauvegardée précédemment
    const calcTotalHT = linesToPrint.reduce((acc: number, l: any) => acc + (l.total_ht || (l.quantity * (l.unit_price || l.unit_price_ht || 0))), 0);
    const calcTotalTTC = linesToPrint.reduce((acc: number, l: any) => {
      const ht = (l.total_ht || (l.quantity * (l.unit_price || l.unit_price_ht || 0)));
      const vat = (l.tax_amount !== undefined && l.tax_amount !== null) ? l.tax_amount : (ht * (l.vat_rate ?? 18) / 100);
      return acc + (l.total_ttc || (ht + vat));
    }, 0);
    
    const displayTotalHT = invoice.total_ht || calcTotalHT;
    const displayTotalTTC = invoice.total_ttc || calcTotalTTC;

    const numberToWords = (num: number): string => {
      if (!num || isNaN(num) || num === 0) return "zéro";
      const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
      const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];
      
      const convertLessThan1000 = (n: number): string => {
        if (n === 0) return "";
        let res = "";
        if (n >= 100) {
          res += (Math.floor(n/100) > 1 ? units[Math.floor(n/100)] + " cent " : "cent ");
          n %= 100;
        }
        if (n > 0) {
          if (n < 20) res += units[n] + " ";
          else {
            let t = Math.floor(n/10);
            let u = n % 10;
            if (t === 7 || t === 9) {
              res += tens[t-1] + "-" + units[10+u] + " ";
            } else {
              res += tens[t] + (u === 1 && t !== 8 ? " et un " : (u > 0 ? "-" + units[u] + " " : " "));
            }
          }
        }
        return res;
      };
      
      let result = "";
      let tempNum = Math.floor(num);
      if (Math.floor(tempNum / 1000000000) > 0) {
        result += convertLessThan1000(Math.floor(tempNum / 1000000000)) + "milliard ";
        tempNum %= 1000000000;
      }
      if (Math.floor(tempNum / 1000000) > 0) {
        result += convertLessThan1000(Math.floor(tempNum / 1000000)) + "million ";
        tempNum %= 1000000;
      }
      if (Math.floor(tempNum / 1000) > 0) {
        let thousands = Math.floor(tempNum / 1000);
        if (thousands === 1) result += "mille ";
        else result += convertLessThan1000(thousands) + "mille ";
        tempNum %= 1000;
      }
      result += convertLessThan1000(tempNum);
      return result.trim() + " FRANCS CFA";
    };

    const amountInWords = numberToWords(Math.abs(displayTotalTTC)).toUpperCase();

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Facture ${invoice.invoice_number}</title>
          <style>
            @page {
              size: A5 portrait; /* Force le navigateur à sélectionner A5 */
              margin: 10mm;
            }
            body { 
              font-family: Arial, sans-serif; 
              color: #000; 
              margin: 0; 
              padding: 0;
              font-size: 10px;
              line-height: 1.3;
              width: 128mm; /* 148mm - 20mm margins */
              height: 190mm; /* 210mm - 20mm margins */
            }
            .header { 
              display: flex; 
              justify-content: space-between; 
              margin-bottom: 20px;
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
            .invoice-title {
              text-align: center;
              margin: 15px 0;
            }
            .invoice-title h2 {
              margin: 0;
              font-size: 16px;
              text-transform: uppercase;
            }
            .invoice-title h3 {
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
              text-align: center; 
              font-weight: bold; 
              background-color: #f0f0f0; 
              font-size: 9px;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            
            .totals-container {
              display: flex;
              justify-content: space-between;
              margin-top: 10px;
            }
            .taxes-table {
              width: 45%;
            }
            .totals-table {
              width: 50%;
            }
            .totals-table th {
              background: none;
              text-align: right;
              border: none;
              padding-right: 10px;
            }
            .totals-table td {
              border: 1px solid #000;
              text-align: right;
              font-weight: bold;
              font-size: 11px;
            }
            
            .footer {
              margin-top: 20px;
              font-size: 9px;
            }
            .amount-words {
              font-weight: bold;
              margin-bottom: 10px;
              text-transform: uppercase;
            }
            .conditions {
              text-align: justify;
              margin-bottom: 10px;
            }
            
            .watermark {
              display: none;
            }
          </style>
        </head>
        <body>
          
          <div class="header">
            <div class="company-info">
              ${settings?.company_name ? `<div class="company-name">${settings.company_name}</div>` : ''}
              <div class="company-details">
                ${settings?.capital ? `<p>SARL au capital de ${settings.capital}</p>` : ''}
                ${settings?.rcc ? `<p>R.C.CM / C.C. N° ${settings.rcc}</p>` : ''}
                ${settings?.address ? `<p>${settings.address}</p>` : ''}
                ${settings?.phone ? `<p>Tél : ${settings.phone}</p>` : ''}
                ${settings?.email ? `<p>Email : ${settings.email}</p>` : ''}
                ${settings?.bank_account ? `<p>Banque : ${settings.bank_account}</p>` : ''}
              </div>
            </div>
            
            <div class="client-info-container">
              <div class="date-page">
                <span>Abidjan, le ${new Date(invoice.date).toLocaleDateString('fr-FR')}</span>
                <span>Page 1/1</span>
              </div>
              <div class="client-box">
                <p style="font-weight: bold; margin-bottom: 5px;">DOIT : ${invoice.clients?.name || invoice.client_code || 'Client'}</p>
                ${invoice.clients?.address ? `<p>${invoice.clients.address}</p>` : ''}
                ${invoice.clients?.phone ? `<p>Tél : ${invoice.clients.phone}</p>` : ''}
                ${invoice.clients?.email ? `<p>Email : ${invoice.clients.email}</p>` : ''}
                ${invoice.clients?.cc ? `<p>CC : ${invoice.clients.cc}</p>` : ''}
                ${invoice.clients?.rc ? `<p>RC : ${invoice.clients.rc}</p>` : ''}
              </div>
            </div>
          </div>
          
          <div class="invoice-title">
            <h2>${invoice.invoice_number?.startsWith("AV-") ? "FACTURE D'AVOIR" : "FACTURE"}</h2>
            <h3>N° : ${invoice.invoice_number}</h3>
          </div>

          <table>
            <thead>
              <tr>
                <th rowspan="2" style="width: 15%;">Codes</th>
                <th rowspan="2" style="width: 40%;">Désignations</th>
                <th rowspan="2" style="width: 10%;">Qté</th>
                <th colspan="2">PRIX UNITAIRES</th>
                <th rowspan="2" style="width: 15%;">MONTANT NET</th>
              </tr>
              <tr>
                <th>HT</th>
                <th>TTC</th>
              </tr>
            </thead>
            <tbody>
              ${(linesToPrint || []).map((line: any) => {
                const lineHt = line.total_ht || (line.quantity * (line.unit_price || line.unit_price_ht || 0));
                const lineVat = (line.tax_amount !== undefined && line.tax_amount !== null) ? line.tax_amount : (lineHt * (line.vat_rate ?? 18) / 100);
                const lineTtc = line.total_ttc || (lineHt + lineVat);
                const unitHt = line.unit_price || line.unit_price_ht || 0;
                const unitTtc = line.quantity > 0 ? (lineTtc / line.quantity) : 0;
                
                return `
                <tr>
                  <td class="text-center">${line.article_code}</td>
                  <td>${line.designation || line.articles?.designation || ''}</td>
                  <td class="text-center">${Math.abs(line.quantity)}</td>
                  <td class="text-right">${Number(Math.abs(unitHt)).toLocaleString('fr-FR')}</td>
                  <td class="text-right">${Number(Math.abs(unitTtc)).toLocaleString('fr-FR')}</td>
                  <td class="text-right font-bold">${Number(Math.abs(lineHt)).toLocaleString('fr-FR')}</td>
                </tr>
                `;
              }).join('')}
              <tr style="height: 50px;">
                <td></td><td></td><td></td><td></td><td></td><td></td>
              </tr>
            </tbody>
          </table>

          <div class="totals-container">
            <div class="taxes-table">
              <table style="margin: 0;">
                <thead>
                  <tr>
                    <th>Taxes</th>
                    <th>Bases</th>
                    <th>Montants</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="text-center">TVA</td>
                    <td class="text-right">${Number(Math.abs(displayTotalHT)).toLocaleString('fr-FR')}</td>
                    <td class="text-right">${Number(Math.abs(displayTotalTTC - displayTotalHT)).toLocaleString('fr-FR')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div class="totals-table">
              <table>
                <tr>
                  <th>TOTAL HT</th>
                  <td>${Number(displayTotalHT).toLocaleString('fr-FR')}</td>
                </tr>
                <tr>
                  <th>TVA</th>
                  <td>${Number(displayTotalTTC - displayTotalHT).toLocaleString('fr-FR')}</td>
                </tr>
                <tr>
                  <th style="font-size: 14px;">MONTANT NET</th>
                  <td style="font-size: 14px;">${Number(displayTotalTTC).toLocaleString('fr-FR')}</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="footer">
            <p class="amount-words">Facture certifiée sincère et conforme à nos livres <span id="amount-words">ARRÊTÉE À LA SOMME DE : ${amountInWords}</span></p>
            <p class="conditions">Nos marchandises ne sont ni reprises ni échangées et voyagent aux risques et périls du destinataire. Les prix sont établis en fonction du tarif à la date de la présente et sont sujets de modification.</p>
            
            ${invoice.observations ? `
              <p><strong>Observations:</strong> ${invoice.observations}</p>
            ` : ''}
            
            <div style="display: flex; justify-content: space-between; margin-top: 30px;">
              <div>Edité le ${new Date().toLocaleDateString('fr-FR')}</div>
              <div style="font-weight: bold; text-align: center;">LA DIRECTION<br><br><br><br></div>
            </div>
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
    
    // Attendre que le contenu (comme numberToWords) s'exécute
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Nettoyer après l'impression
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 250);
  };

  // --- Form Handlers ---
  const handleClientSelect = (code: string) => {
    setClientCode(code);
    setIsClientModalOpen(false);
    setClientSearch("");
  };

  const handleArticleSelect = (code: string) => {
    const article = articles.find(a => a.code === code);
    if (!article) return;

    setCurrentArticleCode(article.code);
    setCurrentDesignation(article.designation);
    setCurrentPrice(article.sale_price_ht || 0);
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
      unit_price: currentPrice,
      vat_rate: currentVatRate,
      total_ht: currentQuantity * currentPrice
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
    setCurrentDesignation(line.designation || line.articles?.designation);
    setCurrentQuantity(line.quantity);
    setCurrentPrice(line.unit_price);
    setCurrentVatRate(line.vat_rate ?? 18);
    setEditingLineId(line.id);
    setIsAddLineModalOpen(true);
  };

  const removeLine = (index: number) => {
    showConfirm("Voulez-vous vraiment retirer cet article de la facture ?", () => {
      const newLines = [...lines];
      newLines.splice(index, 1);
      setLines(newLines);
    });
  };

  const multiplier = invoiceType === "AVOIR" ? -1 : 1;
  const totalHT = lines.reduce((sum, line) => sum + (line.total_ht || 0), 0) * multiplier;
  const totalVAT = lines.reduce((sum, line) => sum + ((line.total_ht || 0) * ((line.vat_rate ?? 18) / 100)), 0) * multiplier;
  const totalTTC = totalHT + totalVAT;

  const handleSave = async (status: "DRAFT" | "VALIDATED") => {
    if (!clientCode) return showNotification("Veuillez sélectionner un client.", "error");
    if (lines.length === 0) return showNotification("Veuillez ajouter au moins une ligne d'article.", "error");

    setIsSaving(true);
    try {
      // 1. Vérification de la Période Comptable
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

      let invoiceId = editingInvoiceId;

      if (editingInvoiceId) {
        if (status === "VALIDATED") {
          // Si on modifie validé, on efface anciens effets
          await supabase.from("stock_movements").delete().eq("reference_id", editingInvoiceId);
          await supabase.from("journal_entries").delete().eq("reference_id", editingInvoiceId);
        }

        const { error: invError } = await supabase.from("invoices").update({
          client_code: clientCode,
          date: issueDate,
          observations: observations,
          total_ht: totalHT,
          total_tax: totalVAT,
          total_ttc: totalTTC,
          status: status,
          period_id: period?.id || null,
          updated_by: user?.id,
          updated_at: new Date().toISOString()
        }).eq("id", editingInvoiceId);
        
        if (invError) throw invError;
        await supabase.from("invoice_lines").delete().eq("invoice_id", editingInvoiceId);
      } else {
        // 2. Formatage du numéro de facture
        // 2. Formatage du numéro de facture
        const yyyy = new Date().getFullYear().toString();
        const mm = (new Date().getMonth() + 1).toString().padStart(2, '0');
        const prefix = invoiceType === "AVOIR" ? `AV-${yyyy}${mm}-` : `FAC-${yyyy}${mm}-`;
        
        const { data: lastInvoice } = await supabase
          .from('invoices')
          .select('invoice_number')
          .ilike('invoice_number', `${prefix}%`)
          .order('invoice_number', { ascending: false })
          .limit(1);
          
        let seqNum = 1;
        if (lastInvoice && lastInvoice.length > 0) {
           const lastSeq = parseInt(lastInvoice[0].invoice_number.split('-').pop() || "0", 10);
           if (!isNaN(lastSeq)) {
             seqNum = lastSeq + 1;
           }
        }
        
        const seq = seqNum.toString().padStart(4, '0');
        const invNum = `${prefix}${seq}`;

        // 3. Création de l'en-tête de facture
        const { data: invoiceData, error: invError } = await supabase.from("invoices").insert([{
          invoice_number: invNum,
          client_code: clientCode,
          date: issueDate,
          observations: observations,
          total_ht: totalHT,
          total_tax: totalVAT,
          total_ttc: totalTTC,
          status: status,
          period_id: period?.id || null,
          created_by: user?.id
        }]).select().single();

        if (invError) throw invError;
        invoiceId = invoiceData.id;
      }

      // 4. Insertion des lignes
      const insertMultiplier = invoiceType === "AVOIR" ? -1 : 1;
      const linesToInsert = lines.map((l, i) => {
        const ht = (l.total_ht || (l.quantity * l.unit_price)) * insertMultiplier;
        const vat = l.vat_rate ?? 18;
        return {
          invoice_id: invoiceId,
          article_code: l.article_code,
          quantity: l.quantity * insertMultiplier,
          unit_price_ht: l.unit_price,
          tax_amount: (ht * (vat / 100)),
          total_ttc: ht + (ht * (vat / 100))
        };
      });

      const { error: linesError } = await supabase.from("invoice_lines").insert(linesToInsert);
      if (linesError) throw linesError;

      // 5. Actions post-validation (Stock & Compta)
      if (status === "VALIDATED") {
        // --- Mouvements de Stock ---
        const movementsToInsert = lines.map(l => ({
          article_code: l.article_code,
          type: "OUT_SALE", // MAJ selon schéma 'OUT_SALE' au lieu de 'OUT'
          quantity: l.quantity,
          unit_price: l.unit_price,
          date: issueDate,
          reference_id: invoiceId
        }));
        
        const { error: movError } = await supabase.from("stock_movements").insert(movementsToInsert);
        if (movError) throw movError;

        // --- Écritures Comptables ---
        if (period) {
          const journalEntries = [
            {
              date: issueDate,
              account_number: "411", // Clients
              debit: totalTTC,
              credit: 0,
              reference_id: invoiceId,
              period_id: period.id
            },
            {
              date: issueDate,
              account_number: "707", // Ventes de marchandises
              debit: 0,
              credit: totalHT,
              reference_id: invoiceId,
              period_id: period.id
            }
          ];
          
          if (totalVAT > 0) {
            journalEntries.push({
              date: issueDate,
              account_number: "443", // TVA Collectée
              debit: 0,
              credit: totalVAT,
              reference_id: invoiceId,
              period_id: period.id
            });
          }
          
          const { error: journalError } = await supabase.from("journal_entries").insert(journalEntries);
          if (journalError) throw journalError;
        }
      }

      showNotification(`Facture ${status === "VALIDATED" ? "validée" : "brouillon"} enregistrée avec succès !`, "success");
      
      setIsModalOpen(false);
      setEditingInvoiceId(null);
      setClientCode("");
      setLines([]);
      setCurrentArticleCode("");
      fetchInvoices();

    } catch (error: any) {
      showNotification("Erreur: " + error.message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const filtered = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) || 
    inv.clients?.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.code.toLowerCase().includes(clientSearch.toLowerCase()));
  const filteredArticles = articles.filter(a => a.designation.toLowerCase().includes(articleSearch.toLowerCase()) || a.code.toLowerCase().includes(articleSearch.toLowerCase()));

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Facturation</h2>
          <p className="text-sm text-gray-500">Gérez vos factures de vente et devis.</p>
        </div>
        <div className="flex gap-3">
          {selectedInvoiceIds.length > 0 && user?.role === "Admin" && (
            <button 
              onClick={handleBulkDelete}
              className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg shadow-sm border border-red-200 transition text-sm font-medium flex items-center"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Supprimer ({selectedInvoiceIds.length})
            </button>
          )}
          <button 
            onClick={handleOpenModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition transform hover:-translate-y-0.5 text-sm font-medium flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" /> Créer une Facture
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Factures Validées (Ce mois)</p>
            <h3 className="text-2xl font-bold text-gray-800">{invoices.filter(i => i.status === 'VALIDATED').length}</h3>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <FileText className="h-5 w-5" />
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Validé (TTC)</p>
            <h3 className="text-2xl font-bold text-gray-800">
              {invoices.filter(i => i.status === 'VALIDATED' || i.status === 'PAID').reduce((sum, item) => sum + (item.total_ttc || 0), 0).toLocaleString('fr-FR')} FCFA
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
              placeholder="Rechercher par numéro ou client..."
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
                <th className="px-6 py-4 font-medium w-12">
                  <input 
                    type="checkbox" 
                    checked={selectedInvoiceIds.length === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-4 font-medium">N° Facture</th>
                <th className="px-6 py-4 font-medium">Client</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium text-right">Montant TTC</th>
                <th className="px-6 py-4 font-medium text-center">Statut</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">Chargement...</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        checked={selectedInvoiceIds.includes(item.id)}
                        onChange={() => toggleSelectInvoice(item.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">
                      {item.invoice_number}
                      {item.invoice_number?.startsWith("AV-") && (
                        <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-bold">AVOIR</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{item.clients?.name || 'Client inconnu'}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(item.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${item.total_ttc < 0 ? "text-orange-600" : "text-gray-800"}`}>
                      {(item.total_ttc || 0).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 inline-block rounded-full text-xs font-semibold border ${
                        item.status === 'PAID' ? 'bg-green-100 text-green-700 border-green-200' :
                        item.status === 'VALIDATED' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                        item.status === 'CANCELLED' ? 'bg-red-100 text-red-700 border-red-200' :
                        'bg-gray-100 text-gray-700 border-gray-200'
                      }`}>
                        {item.status === 'PAID' ? 'PAYÉE' : 
                         item.status === 'VALIDATED' ? 'VALIDÉE' : 
                         item.status === 'CANCELLED' ? 'ANNULÉE' : 'BROUILLON'}
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
                        onClick={() => handlePrintInvoice(item)}
                        className="text-gray-600 hover:text-green-600 p-1 bg-gray-50 rounded mr-2 transition"
                        title="Imprimer"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => handleEditInvoice(item)}
                        className="text-gray-600 hover:text-orange-600 p-1 bg-gray-50 rounded mr-2 transition"
                        title="Modifier"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {user?.role === "Admin" && (
                        <button 
                          onClick={() => handleDeleteInvoice(item)}
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
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Aucune facture trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nouvelle Facture */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {editingInvoiceId ? "Modifier la Facture" : "Nouvelle Facture"}
                </h3>
                <p className="text-xs text-gray-500">Création d'une facture ou d'un devis.</p>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Type *</label>
                    <select
                      value={invoiceType}
                      onChange={(e) => setInvoiceType(e.target.value as "FACTURE" | "AVOIR")}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                      disabled={!!editingInvoiceId}
                    >
                      <option value="FACTURE">Facture Standard</option>
                      <option value="AVOIR">Facture d'Avoir</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Client *</label>
                    <button 
                      onClick={() => setIsClientModalOpen(true)}
                      className="w-full text-left border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition flex justify-between items-center"
                    >
                      <span className={clientCode ? "text-gray-900 font-medium" : "text-gray-400"}>
                        {clientCode ? clients.find(c => c.code === clientCode)?.name : "Sélectionner un client..."}
                      </span>
                      <Search className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Date d'émission *</label>
                    <input 
                      type="date" 
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Date d'échéance *</label>
                    <input 
                      type="date" 
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
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
                    <span>Détail des articles</span>
                    <span className="ml-3 text-xs font-normal text-gray-500 normal-case bg-gray-100 px-2 py-1 rounded-full">{lines.length} article(s)</span>
                  </h3>
                  <button 
                    onClick={() => setIsAddLineModalOpen(true)}
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
                          <th className="px-4 py-3 font-medium text-right">PU HT</th>
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
                            <td className="px-4 py-3 text-right text-gray-600">{Number(line.unit_price || 0).toLocaleString('fr-FR')}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-800">{Number(line.total_ht || 0).toLocaleString('fr-FR')}</td>
                            <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => editLine(index)}
                                className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors mr-1"
                                title="Modifier"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              {user?.role === "Admin" && (
                                <button 
                                  onClick={() => removeLine(index)}
                                  className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-gray-50 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                    Aucun article ajouté à la facture pour le moment. Cliquez sur "Ajouter" pour commencer.
                  </div>
                )}
              </div>

              {/* Section 3 : Récapitulatif et Actions (Bas) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="text-xs text-gray-500 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p>• La facture générée obtiendra automatiquement un numéro selon le format défini dans les paramètres.</p>
                  <p className="mt-2">• La <strong>validation</strong> d'une facture décrémente instantanément les articles du stock global.</p>
                  <p className="mt-2">• L'enregistrement en <strong>brouillon</strong> permet de conserver la facture sans affecter les stocks.</p>
                  
                  {editingInvoiceId && (
                    <div className="mt-4 pt-4 border-t border-gray-200/60 space-y-1">
                      <p className="flex items-center text-[11px] text-gray-400 uppercase font-semibold tracking-wider">
                        Traçabilité du document
                      </p>
                      <p className="text-xs text-gray-500">
                        Créé par <span className="font-semibold text-gray-700">{invoices.find(i => i.id === editingInvoiceId)?.creator?.full_name || 'Inconnu'}</span> le {new Date(invoices.find(i => i.id === editingInvoiceId)?.created_at || '').toLocaleString('fr-FR')}
                      </p>
                      {invoices.find(i => i.id === editingInvoiceId)?.updated_at && (
                        <p className="text-xs text-gray-500">
                          Modifié par <span className="font-semibold text-gray-700">{invoices.find(i => i.id === editingInvoiceId)?.updater?.full_name || 'Inconnu'}</span> le {new Date(invoices.find(i => i.id === editingInvoiceId)?.updated_at || '').toLocaleString('fr-FR')}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-5 text-white">
                  <h3 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Récapitulatif</h3>
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
                      Valider
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal : Voir les détails */}
      {isDetailsModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Détails de la Facture {selectedInvoice.invoice_number}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handlePrintInvoice}
                  className="flex items-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  Imprimer
                </button>
                <button onClick={() => setIsDetailsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Client</p>
                  <p className="font-bold text-gray-800">{selectedInvoice.clients?.name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</p>
                  <p className="font-bold text-gray-800">{new Date(selectedInvoice.date).toLocaleDateString('fr-FR')}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Statut</p>
                  <span className={`px-3 py-1 inline-block rounded-full text-xs font-semibold border ${
                    selectedInvoice.status === 'PAID' ? 'bg-green-100 text-green-700 border-green-200' :
                    selectedInvoice.status === 'VALIDATED' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                    selectedInvoice.status === 'CANCELLED' ? 'bg-red-100 text-red-700 border-red-200' :
                    'bg-gray-100 text-gray-700 border-gray-200'
                  }`}>
                    {selectedInvoice.status}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-medium">Article</th>
                      <th className="px-4 py-3 font-medium text-center">Qté</th>
                      <th className="px-4 py-3 font-medium text-right">PU HT</th>
                      <th className="px-4 py-3 font-medium text-right">Total HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedInvoice.lines?.map((line: any) => (
                      <tr key={line.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-800">{line.article_code}</span>
                          <span className="text-gray-500 ml-2">- {line.articles?.designation}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-medium text-gray-800">{line.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{line.unit_price_ht?.toLocaleString('fr-FR')}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{((line.unit_price_ht || 0) * line.quantity).toLocaleString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="flex justify-end mt-4">
                <div className="w-64 bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Total HT</span>
                    <span className="font-medium text-slate-800">{selectedInvoice.total_ht?.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">TVA</span>
                    <span className="font-medium text-slate-800">{(selectedInvoice.total_ttc - selectedInvoice.total_ht)?.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-slate-800">TOTAL TTC</span>
                    <span className="font-bold text-xl text-blue-600">{selectedInvoice.total_ttc?.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
              <button 
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal : Ajouter Ligne */}
      {isAddLineModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[50] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">Ajouter un article</h3>
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
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Prix Unitaire *</label>
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

      {/* Sub-Modal : Sélection Client */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800">Rechercher un Client</h3>
              <button onClick={() => setIsClientModalOpen(false)} className="text-gray-400 hover:text-gray-600">
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
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>
            </div>
            <div className="overflow-y-auto p-2 custom-scrollbar">
              {filteredClients.length > 0 ? (
                <ul className="space-y-1">
                  {filteredClients.map(c => (
                    <li key={c.code}>
                      <button 
                        onClick={() => handleClientSelect(c.code)}
                        className="w-full text-left px-4 py-3 rounded-xl hover:bg-blue-50 transition-colors flex flex-col border border-transparent hover:border-blue-100"
                      >
                        <span className="font-semibold text-gray-900">{c.name}</span>
                        <span className="text-xs text-gray-500 font-mono mt-1">{c.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-8 text-center text-gray-500">Aucun client trouvé.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal : Sélection Article */}
      {isArticleModalOpen && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
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
                          <p className="font-bold text-blue-600">{a.sale_price ? a.sale_price.toLocaleString('fr-FR') : 0} FCFA</p>
                          <p className="text-xs text-gray-500 mt-1">En stock: {a.quantity_available || 0}</p>
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
    </div>
  );
}
