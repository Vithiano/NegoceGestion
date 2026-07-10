"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, HelpCircle } from "lucide-react";

type NotificationType = "success" | "error" | "info" | "confirm";

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType, title?: string) => void;
  showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<NotificationType>("info");
  const [onConfirmAction, setOnConfirmAction] = useState<(() => void) | null>(null);

  const showNotification = (msg: string, notifType: NotificationType = "info", customTitle?: string) => {
    setMessage(msg);
    setType(notifType);
    setOnConfirmAction(null);
    
    if (customTitle) {
      setTitle(customTitle);
    } else {
      if (notifType === "error") setTitle("Erreur");
      else if (notifType === "success") setTitle("Succès");
      else setTitle("Information");
    }
    
    setIsOpen(true);
  };

  const showConfirm = (msg: string, onConfirm: () => void, customTitle?: string) => {
    setMessage(msg);
    setType("confirm");
    setTitle(customTitle || "Confirmation");
    setOnConfirmAction(() => onConfirm);
    setIsOpen(true);
  };

  const closeNotification = () => {
    setIsOpen(false);
    setTimeout(() => setOnConfirmAction(null), 200); // Cleanup after animation
  };

  return (
    <NotificationContext.Provider value={{ showNotification, showConfirm }}>
      {children}
      
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className={`px-6 py-4 border-b border-gray-100 flex items-center gap-3 ${
              type === "error" ? "bg-red-50/50" : type === "success" ? "bg-green-50/50" : type === "confirm" ? "bg-orange-50/50" : "bg-blue-50/50"
            }`}>
              {type === "error" && <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />}
              {type === "success" && <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />}
              {type === "info" && <Info className="w-6 h-6 text-blue-500 flex-shrink-0" />}
              {type === "confirm" && <HelpCircle className="w-6 h-6 text-orange-500 flex-shrink-0" />}
              <h3 className="text-lg font-bold text-gray-800">{title}</h3>
            </div>
            
            <div className="p-6 text-gray-600 text-sm">
              {message}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
              {type === "confirm" ? (
                <>
                  <button 
                    onClick={closeNotification}
                    className="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 bg-gray-100 rounded-lg transition"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={() => {
                      if (onConfirmAction) onConfirmAction();
                      closeNotification();
                    }}
                    className="px-5 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-transform transform hover:-translate-y-0.5 shadow-md"
                  >
                    Confirmer
                  </button>
                </>
              ) : (
                <button 
                  onClick={closeNotification}
                  className={`px-5 py-2 text-sm font-bold text-white rounded-lg transition-transform transform hover:-translate-y-0.5 shadow-md ${
                    type === "error" ? "bg-red-600 hover:bg-red-700" : type === "success" ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  Compris
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}
