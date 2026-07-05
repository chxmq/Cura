import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import ErrorMessage from '../components/ErrorMessage.jsx';

const Login = () => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await login(formData.email, formData.password);
      if (response.success) {
        navigate('/');
      } else {
        setError(response.error || t('auth.signInFailed'));
      }
    } catch (err) {
      const backendError = err?.response?.data?.error || err?.response?.data?.message;
      setError(backendError || err?.message || t('auth.signInError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-semibold text-[#0f1f2e] tracking-tight">
            {t('auth.welcomeBack')}
          </h1>
          <p className="mt-2 text-[#3e4c5b]">{t('auth.signInSubtitle')}</p>
        </div>

        <ErrorMessage message={error} onDismiss={() => setError('')} />

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label={t('auth.email')}
              type="email"
              placeholder={t('auth.emailPlaceholder')}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
            />
            <Input
              label={t('auth.password')}
              type="password"
              placeholder={t('auth.passwordPlaceholder')}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              autoComplete="current-password"
            />

            <Button type="submit" className="w-full" size="lg" isLoading={loading}>
              {t('nav.signIn')}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#e6e2d6] text-center">
            <p className="text-sm text-[#7b8593]">
              {t('auth.newToCura')}{' '}
              <Link to="/register" className="text-[#0f766e] hover:text-[#115e59] font-medium">
                {t('auth.createAccountLink')}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Login;
