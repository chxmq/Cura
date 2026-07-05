import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import ErrorMessage from '../components/ErrorMessage.jsx';

const Register = () => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = formData.name.trim();
    const normalizedEmail = formData.email.trim().toLowerCase();
    const password = formData.password;

    if (!trimmedName || !normalizedEmail || !password) {
      setError(t('auth.fillAllFields'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await register(trimmedName, normalizedEmail, password);
      if (response.success) {
        navigate('/');
      } else {
        setError(response.error || t('auth.registerFailed'));
      }
    } catch (err) {
      const backendError = err?.response?.data?.error || err?.response?.data?.message;
      setError(backendError || err?.message || t('auth.registerError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-semibold text-[#0f1f2e] tracking-tight">
            {t('auth.createAccount')}
          </h1>
          <p className="mt-2 text-[#3e4c5b]">{t('auth.registerSubtitle')}</p>
        </div>

        <ErrorMessage message={error} onDismiss={() => setError('')} />

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label={t('auth.fullName')}
              type="text"
              placeholder={t('auth.namePlaceholder')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              autoComplete="name"
            />
            <Input
              label={t('auth.email')}
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label={t('auth.password')}
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                minLength={6}
                required
                autoComplete="new-password"
                hint={t('auth.passwordHint')}
              />
              <Input
                label={t('auth.confirmPassword')}
                type="password"
                placeholder={t('auth.passwordPlaceholder')}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                autoComplete="new-password"
              />
            </div>

            <Button type="submit" className="w-full" size="lg" isLoading={loading}>
              {t('auth.createAccountBtn')}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#e6e2d6] text-center">
            <p className="text-sm text-[#7b8593]">
              {t('auth.haveAccount')}{' '}
              <Link to="/login" className="text-[#0f766e] hover:text-[#115e59] font-medium">
                {t('nav.signIn')}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Register;
