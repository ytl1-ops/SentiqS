import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import i18n from '@/i18n';
import { supabase } from '@/lib/supabase';

const SUPABASE_BASE_URL = (import.meta.env.VITE_PUBLIC_SUPABASE_URL as string).replace(/\/+$/, '');
const EDGE_FUNCTION_URL = `${SUPABASE_BASE_URL}/functions/v1/auto-confirm-signup`;

interface SelectedPlan {
  id: number;
  name: string;
  price: number;
  currency: string;
  billing_cycle: string;
  features: string[];
}

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('plan');

  const [lang, setLang] = useState<'fr' | 'en'>(i18n.language.startsWith('fr') ? 'fr' : 'en');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [zone, setZone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [planLoading, setPlanLoading] = useState(!!planId);

  const t = (key: string) => {
    const fr: Record<string, string> = {
      'signup.title': 'Créer un compte',
      'signup.subtitle': 'Demande d\'accès à la plateforme de veille stratégique',
      'signup.fullName': 'Nom complet',
      'signup.fullName.ph': 'Votre nom complet',
      'signup.email': 'Adresse e-mail',
      'signup.email.ph': 'vous@organisation.com',
      'signup.org': 'Organisation (optionnel)',
      'signup.org.ph': 'Votre organisation ou entreprise',
      'signup.zone': 'Zone prioritaire (optionnel)',
      'signup.zone.default': 'Aucune (répartition standard)',
      'signup.password': 'Mot de passe',
      'signup.password.ph': 'Minimum 8 caractères',
      'signup.confirm': 'Confirmer le mot de passe',
      'signup.confirm.ph': 'Répétez votre mot de passe',
      'signup.submit': 'Créer mon compte',
      'signup.login': 'Déjà un compte ?',
      'signup.loginLink': 'Se connecter',
      'signup.goLogin': 'Aller à la page de connexion',
      'signup.success': 'Compte créé avec succès ! Vous pouvez maintenant vous connecter.',
      'signup.error.name': 'Veuillez saisir votre nom complet.',
      'signup.error.email': 'Veuillez saisir votre adresse e-mail.',
      'signup.error.password': 'Veuillez saisir un mot de passe.',
      'signup.error.length': 'Le mot de passe doit contenir au moins 8 caractères.',
      'signup.error.match': 'Les mots de passe ne correspondent pas.',
      'signup.error.exists': 'Un compte existe déjà avec cette adresse e-mail.',
      'signup.error.generic': 'Une erreur est survenue. Veuillez réessayer.',
      'side.badge': 'VEILLE ACTIVE',
      'side.countries': '54 PAYS',
    };
    const en: Record<string, string> = {
      'signup.title': 'Create an account',
      'signup.subtitle': 'Request access to the strategic intelligence platform',
      'signup.fullName': 'Full name',
      'signup.fullName.ph': 'Your full name',
      'signup.email': 'Email address',
      'signup.email.ph': 'you@organisation.com',
      'signup.org': 'Organisation (optional)',
      'signup.org.ph': 'Your organisation or company',
      'signup.zone': 'Priority zone (optional)',
      'signup.zone.default': 'None (standard distribution)',
      'signup.password': 'Password',
      'signup.password.ph': 'Minimum 8 characters',
      'signup.confirm': 'Confirm password',
      'signup.confirm.ph': 'Repeat your password',
      'signup.submit': 'Create account',
      'signup.login': 'Already have an account?',
      'signup.loginLink': 'Sign in',
      'signup.goLogin': 'Go to sign in page',
      'signup.success': 'Account created successfully! You can now log in.',
      'signup.error.name': 'Please enter your full name.',
      'signup.error.email': 'Please enter your email address.',
      'signup.error.password': 'Please enter a password.',
      'signup.error.length': 'Password must be at least 8 characters.',
      'signup.error.match': 'Passwords do not match.',
      'signup.error.exists': 'An account already exists with this email address.',
      'signup.error.generic': 'An error occurred. Please try again.',
      'side.badge': 'LIVE MONITORING',
      'side.countries': '54 COUNTRIES',
    };
    return (lang === 'fr' ? fr[key] : en[key]) ?? key;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/dashboard', { replace: true });
    }).catch(() => {});
  }, [navigate]);

  // Fetch selected plan from URL param
  useEffect(() => {
    if (!planId) { setPlanLoading(false); return; }
    let cancelled = false;
    supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', Number(planId))
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setSelectedPlan({
            id: data.id as number,
            name: data.name as string,
            price: Number(data.price) || 0,
            currency: (data.currency as string) || 'EUR',
            billing_cycle: (data.billing_cycle as string) || 'monthly',
            features: Array.isArray(data.features) ? (data.features as string[]) : [],
          });
        }
        setPlanLoading(false);
      });
    return () => { cancelled = true; };
  }, [planId]);

  const switchLang = useCallback((newLang: 'fr' | 'en') => {
    setLang(newLang);
    i18n.changeLanguage(newLang);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!fullName.trim()) { setFormError(t('signup.error.name')); return; }
    if (!email.trim()) { setFormError(t('signup.error.email')); return; }
    if (!password.trim()) { setFormError(t('signup.error.password')); return; }
    if (password.length < 8) { setFormError(t('signup.error.length')); return; }
    if (password !== confirmPassword) { setFormError(t('signup.error.match')); return; }

    setIsSubmitting(true);
    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string,
          'Authorization': `Bearer ${import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY as string}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          organization: organization.trim(),
          zone,
          plan_id: selectedPlan?.id || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const errMsg = data.error || 'Signup failed';
        if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('exists')) {
          setFormError(t('signup.error.exists'));
        } else {
          setFormError(errMsg);
        }
        return;
      }

      setSuccessMessage(t('signup.success'));
    } catch {
      setFormError(t('signup.error.generic'));
    } finally {
      setIsSubmitting(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, email, organization, zone, password, confirmPassword, lang]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] relative flex-col overflow-hidden bg-sentiqs-navy">
        <div className="absolute inset-0">
          <img
            src="https://readdy.ai/api/search-image?query=Dark%20dramatic%20aerial%20satellite%20view%20of%20African%20continent%20at%20night%20with%20glowing%20city%20lights%20and%20network%20connectivity%20lines%20overlaid%20on%20deep%20navy%20blue%20background%2C%20high%20contrast%20intelligence%20monitoring%20aesthetic%2C%20minimalist%20professional%20security%20technology%20visualization%2C%20subtle%20geometric%20grid%20overlay%2C%20cinematic%20deep%20blue%20tones&width=1200&height=1400&seq=login-left-panel-africa&orientation=portrait"
            alt=""
            className="w-full h-full object-cover object-center opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-sentiqs-navy via-sentiqs-navy/95 to-[#0d1f35]" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <i className="ri-earth-line text-white text-base" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">SentiqS</span>
          </div>

          <div className="flex-1 flex flex-col justify-center mt-8">
            <div className="inline-flex items-center gap-2 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-400 uppercase">
                {t('side.badge')} · {t('side.countries')}
              </span>
            </div>
            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-snug mb-5 max-w-xs">
              Rejoignez la plateforme de veille africaine
            </h1>
            <p className="text-sm text-white/50 max-w-xs leading-relaxed">
              Alertes temps réel, corrélations automatiques et rapports personnalisés sur 54 pays africains.
            </p>

            <div className="mt-10 space-y-3">
              {[
                { icon: 'ri-alarm-warning-line', label: 'Alertes temps réel sur 54 pays' },
                { icon: 'ri-git-merge-line', label: 'Corrélations automatiques' },
                { icon: 'ri-file-chart-line', label: 'Rapports personnalisés' },
                { icon: 'ri-calendar-line', label: 'Agenda opérationnel' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                    <i className={`${f.icon} text-white/70 text-sm`} />
                  </div>
                  <span className="text-xs font-medium text-white/70">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-8 border-t border-white/10">
            <span className="text-[10px] font-semibold tracking-[0.15em] text-white/30 uppercase">SENTIQS © 2026</span>
            <span className="text-[10px] font-semibold tracking-[0.15em] text-white/30 uppercase">AFRICA RISK INTELLIGENCE</span>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-sentiqs-navy flex items-center justify-center">
              <i className="ri-earth-line text-white text-sm" />
            </div>
            <span className="text-sm font-bold text-sentiqs-navy">SentiqS</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-10 lg:px-16 py-8">
          <div className="w-full max-w-[400px]">

            {/* Lang + header row */}
            <div className="flex items-center justify-between mb-8">
              <div className="hidden lg:block">
                <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">
                  Veille active · 54 pays
                </span>
              </div>
              <div className="inline-flex rounded-md overflow-hidden border border-sentiqs-gray-border">
                <button type="button" onClick={() => switchLang('fr')} className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${lang === 'fr' ? 'bg-sentiqs-navy text-white' : 'bg-white text-sentiqs-gray-text hover:bg-gray-50'}`}>FR</button>
                <button type="button" onClick={() => switchLang('en')} className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${lang === 'en' ? 'bg-sentiqs-navy text-white' : 'bg-white text-sentiqs-gray-text hover:bg-gray-50'}`}>EN</button>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-sentiqs-navy mb-1.5">{t('signup.title')}</h2>
              <p className="text-sm text-sentiqs-gray-text">{t('signup.subtitle')}</p>
            </div>

            {/* Selected Plan Card */}
            {planLoading ? (
              <div className="flex items-center gap-2 mb-5 p-3 rounded-lg bg-sentiqs-gray-bg border border-gray-100">
                <span className="w-4 h-4 border-2 border-sentiqs-navy/30 border-t-sentiqs-navy rounded-full animate-spin" />
                <span className="text-xs text-sentiqs-gray-text">Chargement du plan...</span>
              </div>
            ) : selectedPlan ? (
              <div className="mb-5 p-4 rounded-lg bg-emerald-50/70 border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Plan sélectionné
                  </span>
                  <span className="text-xs text-emerald-600 font-medium">
                    {selectedPlan.billing_cycle === 'yearly' ? 'Facturation annuelle' : 'Facturation mensuelle'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-lg font-bold text-sentiqs-navy">{selectedPlan.name}</span>
                  <span className="text-sm text-sentiqs-gray-text">·</span>
                  <span className="text-lg font-bold text-sentiqs-navy">
                    {selectedPlan.price.toLocaleString('fr-FR')} {selectedPlan.currency}
                  </span>
                  <span className="text-xs text-sentiqs-gray-text">
                    /{selectedPlan.billing_cycle === 'yearly' ? 'an' : 'mois'}
                  </span>
                </div>
                {selectedPlan.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedPlan.features.slice(0, 3).map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-emerald-100 text-xs text-emerald-700">
                        <i className="ri-check-line text-emerald-500 text-xs" />
                        {f}
                      </span>
                    ))}
                    {selectedPlan.features.length > 3 && (
                      <span className="text-xs text-sentiqs-gray-text self-center">
                        +{selectedPlan.features.length - 3} autres
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {/* Success */}
            {successMessage && (
              <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-5">
                <i className="ri-checkbox-circle-line text-emerald-600 text-sm mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
                  <Link
                    to="/login"
                    className="inline-block mt-3 text-xs font-semibold text-sentiqs-blue hover:text-sentiqs-blue-dark underline underline-offset-2 transition-colors"
                  >
                    {t('signup.goLogin')}
                  </Link>
                </div>
              </div>
            )}

            {/* Error */}
            {formError && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3.5 py-3 mb-5">
                <i className="ri-error-warning-line text-red-500 text-sm mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-600">{formError}</p>
              </div>
            )}

            {/* Form */}
            {!successMessage && (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full name */}
                <div>
                  <label className="block text-[11px] font-bold tracking-[0.08em] text-sentiqs-navy uppercase mb-1.5">{t('signup.fullName')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <i className="ri-user-line text-sentiqs-gray-text text-sm" />
                    </div>
                    <input type="text" name="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('signup.fullName.ph')} autoComplete="name" className="w-full pl-9 pr-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-navy/15 focus:border-sentiqs-navy transition-all" />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[11px] font-bold tracking-[0.08em] text-sentiqs-navy uppercase mb-1.5">{t('signup.email')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <i className="ri-mail-line text-sentiqs-gray-text text-sm" />
                    </div>
                    <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('signup.email.ph')} autoComplete="email" className="w-full pl-9 pr-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-navy/15 focus:border-sentiqs-navy transition-all" />
                  </div>
                </div>

                {/* Organisation */}
                <div>
                  <label className="block text-[11px] font-bold tracking-[0.08em] text-sentiqs-navy uppercase mb-1.5">{t('signup.org')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <i className="ri-building-line text-sentiqs-gray-text text-sm" />
                    </div>
                    <input type="text" name="organization" value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder={t('signup.org.ph')} autoComplete="organization" className="w-full pl-9 pr-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-navy/15 focus:border-sentiqs-navy transition-all" />
                  </div>
                </div>

                {/* Zone */}
                <div>
                  <label className="block text-[11px] font-bold tracking-[0.08em] text-sentiqs-navy uppercase mb-1.5">{t('signup.zone')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <i className="ri-global-line text-sentiqs-gray-text text-sm" />
                    </div>
                    <select name="zone" value={zone} onChange={(e) => setZone(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy focus:outline-none focus:ring-2 focus:ring-sentiqs-navy/15 focus:border-sentiqs-navy transition-all cursor-pointer appearance-none">
                      <option value="">{t('signup.zone.default')}</option>
                      <option value="golfe">Golfe de Guinée</option>
                      <option value="sahel">Sahel</option>
                      <option value="afrique-est">Afrique de l&apos;Est</option>
                      <option value="afrique-centrale">Afrique Centrale</option>
                      <option value="afrique-sud">Afrique du Sud</option>
                      <option value="maghreb">Maghreb</option>
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                      <i className="ri-arrow-down-s-line text-sentiqs-gray-text text-sm" />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-[11px] font-bold tracking-[0.08em] text-sentiqs-navy uppercase mb-1.5">{t('signup.password')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <i className="ri-lock-line text-sentiqs-gray-text text-sm" />
                    </div>
                    <input type={showPassword ? 'text' : 'password'} name="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('signup.password.ph')} autoComplete="new-password" className="w-full pl-9 pr-10 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-navy/15 focus:border-sentiqs-navy transition-all" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute inset-y-0 right-3 flex items-center text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors">
                      <i className={`text-sm ${showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}`} />
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-[11px] font-bold tracking-[0.08em] text-sentiqs-navy uppercase mb-1.5">{t('signup.confirm')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <i className="ri-lock-line text-sentiqs-gray-text text-sm" />
                    </div>
                    <input type="password" name="confirm_password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('signup.confirm.ph')} autoComplete="new-password" className="w-full pl-9 pr-3 py-2.5 text-sm border border-sentiqs-gray-border rounded-lg bg-white text-sentiqs-navy placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sentiqs-navy/15 focus:border-sentiqs-navy transition-all" />
                  </div>
                </div>

                {/* Submit */}
                <input type="hidden" name="plan_id" value={selectedPlan?.id || ''} />
                <button type="submit" disabled={isSubmitting} className="w-full py-2.5 bg-sentiqs-navy hover:bg-sentiqs-navy-light text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap mt-1">
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <i className="ri-user-add-line text-sm" />
                  )}
                  {t('signup.submit')}
                </button>
              </form>
            )}

            {/* Login link */}
            {!successMessage && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[10px] text-sentiqs-gray-text font-medium uppercase tracking-widest">ou</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
                <p className="text-center text-xs text-sentiqs-gray-text">
                  {t('signup.login')}{' '}
                  <Link to="/login" className="text-sentiqs-blue hover:text-sentiqs-blue-dark font-semibold underline underline-offset-2 transition-colors">
                    {t('signup.loginLink')}
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>

        <div className="px-6 sm:px-10 lg:px-16 py-5 border-t border-gray-100 flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">FLUX · CORRÉLATIONS · ALERTES</span>
          <span className="text-[10px] font-semibold tracking-[0.15em] text-sentiqs-gray-text uppercase">SÛRETÉ OPÉRATIONNELLE</span>
        </div>
      </div>
    </div>
  );
}