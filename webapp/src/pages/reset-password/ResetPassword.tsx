import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasSession(true);
      }
      setCheckingSession(false);
    }).catch(() => {
      setCheckingSession(false);
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!password || password.length < 6) {
      setFormError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setFormError(error.message);
        return;
      }

      setSuccessMessage('Mot de passe mis à jour avec succès ! Redirection vers le tableau de bord...');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);
    } catch {
      setFormError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsSubmitting(false);
    }
  }, [password, confirmPassword, navigate]);

  if (checkingSession) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-sentiqs-gray-bg">
        <div className="w-8 h-8 border-2 border-sentiqs-navy/30 border-t-sentiqs-navy rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-between overflow-hidden bg-sentiqs-gray-bg">
      {/* Globe Background Image */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img
          src="https://readdy.ai/api/search-image?query=Abstract%20minimalist%20wireframe%20globe%20sphere%20with%20latitude%20and%20longitude%20mesh%20lines%2C%20very%20light%20pale%20blue%20gray%20background%2C%20subtle%20soft%20gradient%2C%20corporate%20security%20intelligence%20aesthetic%2C%20clean%203D%20render%2C%20delicate%20thin%20lines%2C%20professional%20design%2C%20soft%20lighting%2C%20no%20text%2C%20monochromatic%20blue%20gray%20tones%2C%20faint%20glowing%20blue%20dots%20on%20surface&width=1200&height=900&seq=sentiqs-globe-bg&orientation=landscape"
          alt=""
          className="w-[800px] h-[600px] object-contain opacity-40"
        />
      </div>

      {/* Top Header */}
      <header className="relative z-10 w-full flex items-center justify-between px-8 py-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-sentiqs-navy flex items-center justify-center">
            <i className="ri-earth-line text-white text-base" />
          </div>
          <span className="text-sm font-bold text-sentiqs-navy">SentiqS</span>
        </Link>
        <div className="text-right">
          <p className="text-xs font-semibold tracking-[0.15em] text-sentiqs-navy uppercase">
            NETWORK
          </p>
          <p className="text-[10px] tracking-[0.15em] text-sentiqs-gray-text uppercase mt-0.5">
            AFRICA
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex items-center justify-center w-full px-4 py-8">
        {!hasSession ? (
          /* Invalid or Expired Link */
          <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-red-500 text-xl" />
            </div>
            <h2 className="text-lg font-bold text-sentiqs-navy mb-2">Lien invalide ou expiré</h2>
            <p className="text-sm text-sentiqs-gray-text mb-6">
              Ce lien de réinitialisation n&apos;est plus valide. Veuillez en demander un nouveau.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-sentiqs-navy hover:bg-sentiqs-navy-light text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
            >
              <i className="ri-arrow-left-line" />
              Demander un nouveau lien
            </Link>
          </div>
        ) : (
          /* Reset Password Form */
          <div className="w-full max-w-[480px] bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {/* Logo Section */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-sentiqs-navy flex items-center justify-center flex-shrink-0">
                <i className="ri-earth-line text-white text-lg" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-sentiqs-navy tracking-tight">SentiqS</h1>
                <p className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
                  NOUVEAU MOT DE PASSE
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-100 mb-5" />

            {/* Success Message */}
            {successMessage && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <i className="ri-check-line text-white text-xs" />
                  </div>
                  <p className="text-sm font-medium text-green-800">{successMessage}</p>
                </div>
              </div>
            )}

            {!successMessage && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-600">{formError}</p>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold tracking-[0.1em] text-sentiqs-navy uppercase mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="6 caractères minimum"
                    className="w-full px-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-blue/20 focus:border-sentiqs-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold tracking-[0.1em] text-sentiqs-navy uppercase mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez le mot de passe"
                    className="w-full px-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-blue/20 focus:border-sentiqs-blue transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-sentiqs-navy hover:bg-sentiqs-navy-light text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <i className="ri-lock-line" />
                  )}
                  Mettre à jour le mot de passe
                </button>
              </form>
            )}

            {/* Back to Login */}
            <div className="flex items-center justify-center mt-5">
              <Link
                to="/login"
                className="flex items-center gap-1.5 text-xs text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors"
              >
                <i className="ri-arrow-left-line" />
                Retour à la connexion
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 w-full flex items-center justify-between px-8 py-4">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-sentiqs-navy uppercase">
          SENTIQS © 2026
        </p>
        <p className="text-[10px] font-semibold tracking-[0.2em] text-sentiqs-navy uppercase">
          AFRICA RISK INTELLIGENCE
        </p>
      </footer>
    </div>
  );
}