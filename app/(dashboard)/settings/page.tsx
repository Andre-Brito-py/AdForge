"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Bell, Shield, LogOut, Globe } from "lucide-react";
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
    { id: "preferences", label: "Idioma e Região", icon: Globe },
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
            <button onClick={() => signOut({ callbackUrl: '/' })} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
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
            <div className="space-y-8">
              <div>
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
              
              <div className="pt-8 border-t border-zinc-200">
                <h2 className="text-xl font-bold text-zinc-900 mb-2">Autenticação de Dois Fatores (2FA)</h2>
                <p className="text-sm text-zinc-500 mb-6">Aumente a segurança da sua conta usando o Google Authenticator.</p>
                <TwoFactorSection />
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
            </div>
          )}

          {activeTab === "preferences" && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Idioma e Região</h2>
              
              <div className="grid gap-6 max-w-md">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">Idioma da Interface</label>
                  <select 
                    className="w-full h-12 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    onChange={(e) => {
                      document.cookie = `NEXT_LOCALE=${e.target.value}; path=/`;
                      window.location.reload();
                    }}
                  >
                    <option value="pt">Português (Brasil)</option>
                    <option value="en">English (US)</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-900">Moeda de Cobrança</label>
                  <select 
                    className="w-full h-12 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    onChange={(e) => {
                      document.cookie = `CURRENCY=${e.target.value}; path=/`;
                      window.location.reload();
                    }}
                  >
                    <option value="BRL">Real (R$)</option>
                    <option value="USD">Dólar ($)</option>
                    <option value="EUR">Euro (€)</option>
                  </select>
                  <p className="text-xs text-zinc-500">Isto altera a exibição de preços na página de Planos.</p>
                </div>
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

function TwoFactorSection() {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [step, setStep] = useState<"IDLE" | "SETUP">("IDLE");

  useEffect(() => {
    fetch("/api/user/2fa/status")
      .then(res => res.json())
      .then(data => setIsEnabled(data.enabled))
      .catch(() => {});
  }, []);

  const generate2FA = async () => {
    setLoading(true);
    const res = await fetch("/api/user/2fa/generate", { method: "POST" });
    const data = await res.json();
    setQrCode(data.qrCodeUrl);
    setSecret(data.secret);
    setStep("SETUP");
    setLoading(false);
  };

  const verify2FA = async () => {
    setLoading(true);
    const res = await fetch("/api/user/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ token })
    });
    const data = await res.json();
    if (data.success) {
      toast.success("2FA habilitado com sucesso!");
      setIsEnabled(true);
      setStep("IDLE");
    } else {
      toast.error("Código inválido. Tente novamente.");
    }
    setLoading(false);
  };

  const disable2FA = async () => {
    setLoading(true);
    await fetch("/api/user/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ disable: true })
    });
    toast.success("2FA desabilitado.");
    setIsEnabled(false);
    setLoading(false);
  };

  if (isEnabled) {
    return (
      <div className="p-4 border border-emerald-200 bg-emerald-50 rounded-xl flex items-center justify-between">
        <div>
          <h3 className="font-bold text-emerald-900">2FA Ativado</h3>
          <p className="text-sm text-emerald-700">Sua conta está mais segura.</p>
        </div>
        <Button onClick={disable2FA} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" disabled={loading}>
          Desabilitar
        </Button>
      </div>
    );
  }

  if (step === "SETUP") {
    return (
      <div className="p-6 border border-zinc-200 rounded-xl max-w-md space-y-4">
        <h3 className="font-bold text-zinc-900">Configure o Google Authenticator</h3>
        <p className="text-sm text-zinc-500">1. Escaneie o QR Code abaixo com seu aplicativo.</p>
        {qrCode && <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 border rounded-lg" />}
        <p className="text-sm text-zinc-500 mt-2">2. Digite o código de 6 dígitos gerado no app.</p>
        <div className="flex gap-2">
          <Input 
            value={token} 
            onChange={e => setToken(e.target.value)} 
            placeholder="000000" 
            maxLength={6}
            className="tracking-widest text-center"
          />
          <Button onClick={verify2FA} disabled={loading || token.length < 6} className="bg-zinc-900">
            Verificar
          </Button>
        </div>
        <Button variant="ghost" onClick={() => setStep("IDLE")} className="w-full text-zinc-500 mt-2">Cancelar</Button>
      </div>
    );
  }

  return (
    <div>
      <Button onClick={generate2FA} disabled={loading} className="bg-zinc-900 text-white rounded-full px-6">
        Configurar Autenticador
      </Button>
    </div>
  );
}
