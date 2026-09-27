"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Bell, Shield, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("profile");

  const TABS = [
    { id: "profile", label: "Meu Perfil", icon: User },
    { id: "security", label: "Segurança", icon: Shield },
    { id: "notifications", label: "Notificações", icon: Bell },
  ];

  const handleSave = () => {
    toast.success("Configurações salvas com sucesso!");
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      <header>
        <Link href="/dashboard" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 mb-6 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">Configurações</h1>
        <p className="text-zinc-500 mt-1">Gerencie as preferências da sua conta e da sua assinatura.</p>
      </header>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                activeTab === tab.id ? "bg-zinc-900 text-white shadow-md" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
          <div className="pt-4 mt-4 border-t border-zinc-200">
            <button onClick={() => signOut()} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
              <LogOut className="h-4 w-4" /> Sair da Conta
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 w-full bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden min-h-[400px] p-8">
          
          {activeTab === "profile" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Informações Pessoais</h2>
              
              <div className="grid gap-6 max-w-md">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">Nome Completo</label>
                  <Input defaultValue={session?.user?.name || ""} className="h-12 bg-zinc-50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">Endereço de E-mail</label>
                  <Input disabled defaultValue={session?.user?.email || ""} className="h-12 bg-zinc-100 text-zinc-500" />
                  <p className="text-xs text-zinc-500">Para alterar seu e-mail, entre em contato com o suporte.</p>
                </div>
              </div>

              <div className="pt-6">
                <Button onClick={handleSave} className="rounded-full bg-zinc-900 h-12 px-8">Salvar Alterações</Button>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Segurança da Conta</h2>
              <div className="grid gap-6 max-w-md">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">Senha Atual</label>
                  <Input type="password" placeholder="••••••••" className="h-12 bg-zinc-50" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">Nova Senha</label>
                  <Input type="password" placeholder="••••••••" className="h-12 bg-zinc-50" />
                </div>
              </div>
              <div className="pt-6">
                <Button onClick={handleSave} className="rounded-full bg-zinc-900 h-12 px-8">Atualizar Senha</Button>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Preferências de Email</h2>
              <div className="space-y-4">
                <label className="flex items-center gap-3 p-4 border border-zinc-200 rounded-2xl cursor-pointer hover:bg-zinc-50 transition-colors">
                  <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                  <div>
                    <p className="font-semibold text-zinc-900">Atualizações de Produto</p>
                    <p className="text-sm text-zinc-500">Receba novidades sobre novos recursos da IA.</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-4 border border-zinc-200 rounded-2xl cursor-pointer hover:bg-zinc-50 transition-colors">
                  <input type="checkbox" defaultChecked className="h-5 w-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900" />
                  <div>
                    <p className="font-semibold text-zinc-900">Alertas de Geração</p>
                    <p className="text-sm text-zinc-500">Aviso quando uma geração assíncrona for concluída.</p>
                  </div>
                </label>
              </div>
              <div className="pt-6">
                <Button onClick={handleSave} className="rounded-full bg-zinc-900 h-12 px-8">Salvar Preferências</Button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
