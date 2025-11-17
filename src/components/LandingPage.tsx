import React, { useState, useEffect, useRef } from 'react';
import { FiMenu, FiX, FiArrowRight, FiZap, FiCode, FiMessageSquare, FiCheck, FiGithub, FiAlertCircle } from 'react-icons/fi';
import { FcGoogle } from 'react-icons/fc';
import { useLocalization } from '../contexts/LocalizationContext';
import { supabase } from '../lib/supabaseClient';
import icon from './images/fog.png';

interface LandingPageProps {
  onAuthSuccess: () => void;
}

// Counter Animation Hook
const useCounterAnimation = (end: number, duration: number = 2000, suffix: string = '') => {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number | null = null;
    const isDecimal = suffix === '%';
    const startValue = 0;
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentCount = startValue + (end - startValue) * easeOutQuart;
      
      setCount(isDecimal ? Number(currentCount.toFixed(1)) : Math.floor(currentCount));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [isVisible, end, duration]);

  return { count, ref };
};

export const LandingPage: React.FC<LandingPageProps> = ({ onAuthSuccess }) => {
  const { t } = useLocalization();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Counter animations
  const activeUsers = useCounterAnimation(500, 2000, 'K+');
  const codeExecutions = useCounterAnimation(10, 2000, 'M+');
  const languages = useCounterAnimation(15, 2000, '+');
  const uptime = useCounterAnimation(99.9, 2000, '%');

  // Check for OAuth redirect
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session && !error) {
        onAuthSuccess();
      }
    };
    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        onAuthSuccess();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [onAuthSuccess]);

const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Get the current URL without any hash or query params
      const redirectUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}`;
      
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: redirectUrl,
          shouldCreateUser: true,
        },
      });

      if (signInError) throw signInError;

      setSuccessMessage(t('emailMagicLink') || 'Check your email for the login link!');
      setEmail('');
    } catch (err: any) {
      console.error('Email auth error:', err);
      setError(err.message || t('loginFailed') || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

 const handleOAuthLogin = async (provider: 'google' | 'github') => {
  setIsLoading(true);
  setError('');

  try {
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/Syrion-app/`,
      },
    });

    if (signInError) throw signInError;
  } catch (err: any) {
    console.error(`${provider} auth error:`, err);
    setError(err.message || t('loginFailed') || 'Authentication failed. Please try again.');
    setIsLoading(false);
  }
};


  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const element = document.querySelector(targetId);
    if (element) {
      const offsetTop = element.getBoundingClientRect().top + window.pageYOffset - 64;
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 bg-[#1a1a1a]/95 backdrop-blur-sm border-b border-gray-800 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-12 rounded-lg flex items-center justify-center overflow-hidden">
                <img src={icon} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <span className="md:text-2xl text-xl -ml-3 font-semibold">{t('appName')}</span>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <a 
                href="#features" 
                onClick={(e) => handleSmoothScroll(e, '#features')}
                className="text-gray-300 hover:text-white transition-colors text-sm cursor-pointer"
              >
                {t('features') || 'Features'}
              </a>
              <a 
                href="#stats" 
                onClick={(e) => handleSmoothScroll(e, '#stats')}
                className="text-gray-300 hover:text-white transition-colors text-sm cursor-pointer"
              >
                {t('stats') || 'Statistics'}
              </a>
              <a 
                href="#compare" 
                onClick={(e) => handleSmoothScroll(e, '#compare')}
                className="text-gray-300 hover:text-white transition-colors text-sm cursor-pointer"
              >
                {t('compare') || 'Compare'}
              </a>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-gray-300 hover:text-white transition-colors"
              >
                {isMobileMenuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-800 bg-[#1a1a1a]">
            <div className="px-4 py-4 space-y-3">
              <a
                href="#features"
                onClick={(e) => handleSmoothScroll(e, '#features')}
                className="block text-gray-300 hover:text-white transition-colors py-2 cursor-pointer"
              >
                {t('features') || 'Features'}
              </a>
              <a
                href="#stats"
                onClick={(e) => handleSmoothScroll(e, '#stats')}
                className="block text-gray-300 hover:text-white transition-colors py-2 cursor-pointer"
              >
                {t('stats') || 'Statistics'}
              </a>
              <a
                href="#compare"
                onClick={(e) => handleSmoothScroll(e, '#compare')}
                className="block text-gray-300 hover:text-white transition-colors py-2 cursor-pointer"
              >
                {t('compare') || 'Compare'}
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section with Login Form */}
      <section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Hero Content */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                {t('heroTitle')}<br /> {t('heroSC')}
              </h1>
              <p className="text-lg sm:text-xl text-gray-400 mb-8">
                {t('heroSubtitle') || 'The AI assistant for problem solvers. Write, debug, and learn with your intelligent coding companion.'}
              </p>
              <div className="flex flex-wrap items-center gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <FiCheck className="text-green-400" size={20} />
                  <span>{t('freeToUse') || 'Free to use'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FiCheck className="text-green-400" size={20} />
                  <span>{t('noCardRequired') || 'No credit card required'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FiCheck className="text-green-400" size={20} />
                  <span>{t('instantAccess') || 'Instant access'}</span>
                </div>
              </div>
            </div>

            {/* Right - Login Form */}
            <div className="bg-[#151515] border border-gray-800 rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl font-bold mb-2 text-center">
                {t('getStarted') || 'Get Started'}
              </h2>
              <p className="text-gray-400 text-sm text-center mb-6">
                {t('signInOrSignUp') || 'Sign in or create your account'}
              </p>

              {/* OAuth Buttons */}
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => handleOAuthLogin('google')}
                  disabled={isLoading}
                  className="w-full py-3 bg-white hover:bg-gray-100 disabled:bg-gray-700 text-black rounded-lg font-medium transition-colors flex items-center justify-center gap-3 border border-gray-300"
                >
                  <FcGoogle size={22} />
                  <span>{t('continueWithGoogle') || 'Continue with Google'}</span>
                </button>

                <button
                  onClick={() => handleOAuthLogin('github')}
                  disabled={isLoading}
                  className="w-full py-3 bg-[#2a2a2a] hover:bg-[#333333] disabled:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-3 border border-gray-700"
                >
                  <FiGithub size={20} />
                  <span>{t('continueWithGithub') || 'Continue with GitHub'}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#151515] text-gray-500 uppercase text-xs tracking-wider">
                    {t('or') || 'or'}
                  </span>
                </div>
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('email') || 'Email'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 bg-[#2a2a2a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-700/50 rounded-lg text-red-400 text-sm">
                    <FiAlertCircle className="flex-shrink-0" size={16} />
                    <span>{error}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="flex items-center gap-2 p-3 bg-green-900/20 border border-green-700/50 rounded-lg text-green-400 text-sm">
                    <FiCheck className="flex-shrink-0" size={16} />
                    <span>{successMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-white hover:bg-gray-100 disabled:bg-gray-700 disabled:cursor-not-allowed text-black disabled:text-gray-400 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent" />
                      <span>{t('loading') || 'Loading...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{t('continueWithEmail') || 'Continue with email'}</span>
                      <FiArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-gray-500">
                {t('byCreatingAccount') || 'By continuing, you agree to our'}{' '}
                <a href="#" className="text-gray-400 hover:text-white transition-colors underline">
                  {t('terms') || 'Terms'}
                </a>{' '}
                {t('and') || 'and'}{' '}
                <a href="#" className="text-gray-400 hover:text-white transition-colors underline">
                  {t('privacy') || 'Privacy'}
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#151515]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t('trustedByDevelopers') || 'Trusted by developers worldwide'}
            </h2>
            <p className="text-gray-400 text-lg">
              {t('joinCommunity') || 'Join our growing community of problem solvers'}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center" ref={activeUsers.ref}>
              <div className="text-4xl font-bold text-blue-400 mb-2">
                {activeUsers.count}K+
              </div>
              <div className="text-gray-400">{t('activeUsers') || 'Active Users'}</div>
            </div>
            <div className="text-center" ref={codeExecutions.ref}>
              <div className="text-4xl font-bold text-green-400 mb-2">
                {codeExecutions.count}M+
              </div>
              <div className="text-gray-400">{t('codeExecutions') || 'Code Executions'}</div>
            </div>
            <div className="text-center" ref={languages.ref}>
              <div className="text-4xl font-bold text-purple-400 mb-2">
                {languages.count}+
              </div>
              <div className="text-gray-400">{t('languages') || 'Languages'}</div>
            </div>
            <div className="text-center" ref={uptime.ref}>
              <div className="text-4xl font-bold text-orange-400 mb-2">
                {uptime.count}%
              </div>
              <div className="text-gray-400">{t('uptime') || 'Uptime'}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t('featuresTitle') || 'Everything you need to build faster'}
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('featuresSubtitle') || 'Powerful features to help you code smarter, not harder'}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-xl bg-[#151515] border border-gray-800 hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-blue-600/10 flex items-center justify-center mb-4">
                <FiMessageSquare className="text-blue-400" size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t('feature1Title') || 'Natural Conversation'}
              </h3>
              <p className="text-gray-400">
                {t('feature1Description') || 'Chat naturally about your code. Ask questions, get explanations, and solve problems together.'}
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-xl bg-[#151515] border border-gray-800 hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-green-600/10 flex items-center justify-center mb-4">
                <FiCode className="text-green-400" size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t('feature2Title') || 'Interactive Canvas'}
              </h3>
              <p className="text-gray-400">
                {t('feature2Description') || 'Run code in 10+ languages directly in your browser. See results instantly with live preview.'}
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-xl bg-[#151515] border border-gray-800 hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-purple-600/10 flex items-center justify-center mb-4">
                <FiZap className="text-purple-400" size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                {t('feature3Title') || 'Lightning Fast'}
              </h3>
              <p className="text-gray-400">
                {t('feature3Description') || 'Get instant responses and compile code in milliseconds. No waiting, just building.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Compare Section */}
      <section id="compare" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#151515]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              {t('compareTitle') || 'Why choose us?'}
            </h2>
            <p className="text-gray-400 text-lg">
              {t('compareSubtitle') || 'See how we compare with other AI assistants'}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-4 px-4 text-gray-400 font-medium">Feature</th>
                  <th className="text-center py-4 px-4">
                    <div className="text-white font-semibold">{t('appName')}</div>
                  </th>
                  <th className="text-center py-4 px-4 text-gray-400">ChatGPT</th>
                  <th className="text-center py-4 px-4 text-gray-400">Claude</th>
                  <th className="text-center py-4 px-4 text-gray-400">Gemini</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-4 text-gray-300">Code Execution</td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-green-400" size={20} /></td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-gray-600" size={20} /></td>
                  <td className="text-center py-4 px-4"><span className="text-gray-600">-</span></td>
                  <td className="text-center py-4 px-4"><span className="text-gray-600">-</span></td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-4 text-gray-300">Interactive Canvas</td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-green-400" size={20} /></td>
                  <td className="text-center py-4 px-4"><span className="text-gray-600">-</span></td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-gray-600" size={20} /></td>
                  <td className="text-center py-4 px-4"><span className="text-gray-600">-</span></td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-4 text-gray-300">Multi-language Support</td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-green-400" size={20} /></td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-gray-600" size={20} /></td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-gray-600" size={20} /></td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-gray-600" size={20} /></td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-4 px-4 text-gray-300">Free Tier</td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-green-400" size={20} /></td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-gray-600" size={20} /></td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-gray-600" size={20} /></td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-gray-600" size={20} /></td>
                </tr>
                <tr>
                  <td className="py-4 px-4 text-gray-300">No Installation</td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-green-400" size={20} /></td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-gray-600" size={20} /></td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-gray-600" size={20} /></td>
                  <td className="text-center py-4 px-4"><FiCheck className="inline text-gray-600" size={20} /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 rounded-lg flex items-center justify-center overflow-hidden">
                <img src={icon} alt="Logo" className="w-full h-full object-cover" />
              </div>
              <span className="text-sm text-gray-400">
                © 2025 {t('appName')}. {t('allRightsReserved') || 'All rights reserved.'}
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                {t('privacy') || 'Privacy'}
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                {t('terms') || 'Terms'}
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors text-sm">
                {t('contact') || 'Contact'}
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};