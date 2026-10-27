
'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Eye, EyeOff, User, Lock, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* ── Luz ambiente e gradientes volumétricos ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[650px] h-[650px] bg-gradient-to-br from-blue-600/20 via-cyan-500/10 to-transparent rounded-full blur-3xl opacity-75"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-indigo-600/15 via-blue-500/10 to-transparent rounded-full blur-3xl opacity-60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40"
      />

      {/* ── Card Glassmorphism ── */}
      <div className="relative w-full max-w-[420px] rounded-2xl border border-slate-700/50 bg-slate-900/65 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-6 sm:p-8">
        {/* Borda superior iluminada */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-px left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
        />

        {/* ── Cabeçalho & Marca ── */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="relative mb-3.5 flex items-center justify-center">
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-2xl bg-blue-500/25 blur-md"
            />
            <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/80 shadow-inner">
              <ShieldCheck className="w-7 h-7 text-cyan-400 drop-shadow-[0_2px_8px_rgba(34,211,238,0.4)]" />
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-cyan-300 border border-blue-500/20 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            ADC Móveis e Eletro
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white">
            Portal Administrativo
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Acesso seguro restrito para equipe de vendas, gerência e administração.
          </p>
        </div>

        {/* ── Formulário ── */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="username"
              className="text-xs font-medium text-slate-300 uppercase tracking-wider"
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
                placeholder="Ex: admin, gerente ou vendedor"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                required
                className="pl-10 h-11 bg-slate-950/70 border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-xl focus-visible:ring-2 focus-visible:ring-cyan-500/30 focus-visible:border-cyan-500/70 transition-all duration-150"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs font-medium text-slate-300 uppercase tracking-wider"
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
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
                className="pl-10 pr-10 h-11 bg-slate-950/70 border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-xl focus-visible:ring-2 focus-visible:ring-cyan-500/30 focus-visible:border-cyan-500/70 transition-all duration-150"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-lg transition-colors"
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

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 mt-2 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all duration-150 border-0"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Autenticando...
              </span>
            ) : (
              'Acessar Painel'
            )}
          </Button>

          {/* ── Link de Retorno ── */}
          <div className="pt-2 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors py-1 focus:outline-none focus:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Voltar ao Catálogo da Loja
            </Link>
          </div>
        </form>

        {/* ── Selo de Segurança no Rodapé do Card ── */}
        <div className="mt-6 pt-4 border-t border-slate-800/70 flex items-center justify-center">
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Sessão Protegida por Criptografia de Ponta a Ponta</span>
          </div>
        </div>
      </div>
    </div>
  );
}
