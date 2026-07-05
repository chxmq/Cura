import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import LanguageSwitcher from './LanguageSwitcher';
import Button from './ui/Button';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = user
    ? [
        { path: '/symptoms', label: t('nav.symptoms') },
        { path: '/prescription', label: t('nav.prescription') },
        { path: '/history', label: t('nav.history') },
        { path: '/analytics', label: t('nav.analytics') }
      ]
    : [];

  const isActive = (path) => location.pathname === path;

  const closeMobile = () => setIsOpen(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#f7f7f3]/85 backdrop-blur-md border-b border-[#e6e2d6]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="group" onClick={closeMobile}>
            <span className="font-display text-2xl font-semibold text-[#0f1f2e] tracking-tight">
              Cura<span className="text-[#0f766e]">.</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-[#0f766e]/10 text-[#0f766e]'
                    : 'text-[#3e4c5b] hover:text-[#0f1f2e] hover:bg-[#f0eee6]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth controls (desktop) */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            {user ? (
              <>
                <span className="text-sm font-medium text-[#3e4c5b]">
                  {t('nav.greeting', { name: user.name?.split(' ')[0] || 'there' })}
                </span>
                <Button variant="secondary" size="sm" onClick={logout}>
                  {t('nav.signOut')}
                </Button>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">{t('nav.signIn')}</Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">{t('nav.getStarted')}</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg text-[#0f1f2e] hover:bg-[#f0eee6] transition-colors"
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-[#e6e2d6] animate-fade-in">
          <div className="px-4 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={closeMobile}
                className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? 'bg-[#0f766e]/10 text-[#0f766e]'
                    : 'text-[#3e4c5b] hover:bg-[#f0eee6]'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 mt-3 border-t border-[#e6e2d6] flex flex-col gap-2">
              <LanguageSwitcher className="px-2 pb-2" />
              {user ? (
                <Button
                  variant="secondary"
                  onClick={() => { logout(); closeMobile(); }}
                  className="w-full"
                >
                  {t('nav.signOut')}
                </Button>
              ) : (
                <>
                  <Link to="/login" onClick={closeMobile}>
                    <Button variant="ghost" className="w-full">{t('nav.signIn')}</Button>
                  </Link>
                  <Link to="/register" onClick={closeMobile}>
                    <Button variant="primary" className="w-full">{t('nav.getStarted')}</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
