import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Mail } from 'lucide-react';
import { api } from '../../services/api.js';
import toast from 'react-hot-toast';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
      toast.success('Email enviado!');
    } catch {
      toast.error('Erro ao enviar email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-brand-500/15 rounded-full flex items-center justify-center mx-auto">
          <Mail className="w-8 h-8 text-brand-400" />
        </div>
        <h2 className="text-xl font-display font-bold text-slate-100">Email enviado!</h2>
        <p className="text-slate-400 text-sm">
          Se este email estiver cadastrado, você receberá um link para redefinir sua senha.
        </p>
        <Link to="/login" className="btn-secondary inline-flex items-center gap-2 mt-4">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao login
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link to="/login" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Voltar ao login
      </Link>
      <h1 className="text-2xl font-display font-bold text-slate-100 mb-1">Recuperar senha</h1>
      <p className="text-slate-400 text-sm mb-8">
        Digite seu email e enviaremos um link para criar nova senha.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
          <input type="email" className="input" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Enviar link de recuperação
        </button>
      </form>
    </>
  );
}
