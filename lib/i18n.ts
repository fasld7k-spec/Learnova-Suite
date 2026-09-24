import { localizedCopy, normalizeLocale, type SupportedLocale } from '@/lib/localized-copy';

export const dictionaries = {
  en: {
    home: 'Home',
    courses: 'Courses',
    login: 'Log in',
    register: 'Create account',
    dashboard: 'Dashboard',
    buyNow: 'Buy now'
  },
  ar: {
    home: 'الرئيسية',
    courses: 'الدورات',
    login: 'تسجيل الدخول',
    register: 'إنشاء حساب',
    dashboard: 'لوحة التحكم',
    buyNow: 'اشتر الآن'
  },
  fr: {
    home: 'Accueil',
    courses: 'Cours',
    login: 'Connexion',
    register: 'Créer un compte',
    dashboard: 'Tableau de bord',
    buyNow: 'Acheter maintenant'
  },
  es: {
    home: 'Inicio',
    courses: 'Cursos',
    login: 'Iniciar sesión',
    register: 'Crear cuenta',
    dashboard: 'Panel',
    buyNow: 'Comprar ahora'
  },
  de: {
    home: 'Startseite',
    courses: 'Kurse',
    login: 'Anmelden',
    register: 'Konto erstellen',
    dashboard: 'Dashboard',
    buyNow: 'Jetzt kaufen'
  },
  tr: {
    home: 'Ana sayfa',
    courses: 'Kurslar',
    login: 'Giriş yap',
    register: 'Hesap oluştur',
    dashboard: 'Panel',
    buyNow: 'Şimdi satın al'
  },
  pt: {
    home: 'Início',
    courses: 'Cursos',
    login: 'Entrar',
    register: 'Criar conta',
    dashboard: 'Painel',
    buyNow: 'Comprar agora'
  }
} as const;

export type Locale = keyof typeof dictionaries;

export function t(locale: Locale, key: keyof typeof dictionaries.en) {
  return dictionaries[locale]?.[key] || dictionaries.en[key];
}

export function direction(locale: Locale) {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export { localizedCopy, normalizeLocale };
export type { SupportedLocale };
