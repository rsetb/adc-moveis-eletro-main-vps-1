
'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Eye,
  EyeOff,
  User,
  Lock,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const storeName =
    settings?.storeName && settings.storeName !== 'Minha Loja'
      ? settings.storeName.trim()
      : 'ADC Móveis e Eletro';

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await login(username, password);
    } finally {
      setIsSubmitting(false);
    }
  };

  const featurePills = ['PDV', 'Caixa', 'Estoque', 'Crediário', 'Pedidos', 'Catálogo'];

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#0b171e]">
      {/* ── COLUNA ESQUERDA: Identidade Oficial ADC (Azul Petróleo Profundo & Laranja) ── */}
      <div className="relative flex-1 bg-[#0b171e] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-[#142d3a]">
        {/* Iluminação ambiente com as cores da ADC */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-40 w-[500px] h-[500px] bg-[#1B6A8B]/20 rounded-full blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-36 -left-36 w-[540px] h-[540px] rounded-full border border-[#1B6A8B]/20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-48 -left-48 w-[660px] h-[660px] rounded-full border border-[#1B6A8B]/10"
        />

        {/* Forma geométrica 3D flutuante com o Laranja oficial da ADC (#F26522) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-16 right-10 lg:right-20 w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-[#F26522] to-[#ff7d42] rotate-12 shadow-2xl shadow-[#F26522]/30 opacity-95 hidden sm:block"
        />

        {/* Topo: Logotipo Oficial da ADC */}
        <div className="relative z-10 flex items-center gap-4 mb-10 lg:mb-0">
          <div className="bg-white/95 p-2 rounded-2xl shadow-xl border border-white/20 backdrop-blur-sm flex items-center justify-center">
            <Image
              src="/logo-adc.png"
              alt="ADC Móveis e Eletro"
              width={130}
              height={56}
              className="h-10 sm:h-12 w-auto object-contain"
              priority
            />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white leading-tight">
              {storeName}
            </h2>
            <p className="text-xs text-[#6bb0cc]">Painel da loja</p>
          </div>
        </div>

        {/* Centro: Slogan & Chamada Comercial com as cores da marca */}
        <div className="relative z-10 my-auto py-8 lg:py-16">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-white">
            Móveis e eletro, <br />
            <span className="text-[#F26522]">do seu jeito.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300 mt-5 max-w-md font-normal leading-relaxed">
            Vendas, caixa, estoque e crediário da loja num lugar só.
          </p>
        </div>

        {/* Rodapé da Coluna Esquerda: Tags dos Módulos */}
        <div className="relative z-10 pt-4 hidden sm:flex flex-wrap items-center gap-2">
          {featurePills.map((pill) => (
            <span
              key={pill}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#11242e]/90 text-slate-200 border border-[#1b3a4a] shadow-sm"
            >
              {pill}
            </span>
          ))}
        </div>
      </div>

      {/* ── COLUNA DIREITA: Formulário Clean e Moderno (Light) ── */}
      <div className="flex-1 bg-[#fbfcfd] flex flex-col justify-center items-center p-6 sm:p-12 lg:p-20 text-slate-900">
        <div className="w-full max-w-[400px]">
          {/* Cabeçalho do Formulário */}
          <div className="mb-8">
            <span className="text-xs font-bold tracking-wider uppercase text-[#F26522] block mb-2">
              ACESSO AO PAINEL
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0b171e] tracking-tight">
              Entrar
            </h2>
            <p className="text-sm text-slate-500 mt-1.5 font-normal">
              Use seu usuário e senha da loja.
            </p>
          </div>

          {/* Formulário de Login */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="username"
                className="text-xs font-medium text-slate-700"
              >
                Usuário
              </Label>
              <div className="relative">
                <User
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Seu usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="pl-10 h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl shadow-sm focus-visible:ring-2 focus-visible:ring-[#F26522]/25 focus-visible:border-[#F26522] transition-all text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs font-medium text-slate-700"
              >
                Senha
              </Label>
              <div className="relative">
                <Lock
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  required
                  className="pl-10 pr-10 h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 rounded-xl shadow-sm focus-visible:ring-2 focus-visible:ring-[#F26522]/25 focus-visible:border-[#F26522] transition-all text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Botão Oficial em Laranja ADC (#F26522) */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 mt-2 bg-[#F26522] hover:bg-[#d95316] text-white font-bold rounded-xl shadow-lg shadow-[#F26522]/25 active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 text-sm border-0 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                  <span>Entrando...</span>
                </>
              ) : (
                <>
                  <span>Entrar no painel</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            {/* Link para o Catálogo em Azul Petróleo ADC (#1B6A8B) */}
            <div className="pt-2 text-center">
              <Link
                href="/"
                className="text-xs font-semibold text-[#1B6A8B] hover:text-[#0f4459] underline underline-offset-4 transition-colors"
              >
                Ver o catálogo da loja
              </Link>
            </div>
          </form>

          {/* Micro rodapé */}
          <div className="mt-12 text-center flex flex-col items-center gap-1">
            <span className="text-[11px] text-slate-400">
              {storeName} · Painel Administrativo
            </span>
            <span className="text-[10px] text-emerald-600 inline-flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3 h-3" /> Conexão Criptografada e Segura
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
