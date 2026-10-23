import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BRAND = 'NoteMind';
const DEFAULT_TITLE = `${BRAND} — Notes that think with you`;

// Exact-path titles. Anything not listed (landing page, the dynamic
// /share/:token page, 404s) falls back to a sensible default below.
const TITLES = {
  '/dashboard': 'Notes',
  '/graph': 'Graph view',
  '/account': 'Account',
  '/login': 'Log in',
  '/register': 'Create your account',
  '/forgot-password': 'Reset your password',
  '/reset-password': 'Choose a new password',
  '/features': 'Features',
  '/use-cases': 'Use cases',
  '/whats-new': "What's new",
  '/privacy': 'Privacy policy',
  '/terms': 'Terms of service',
  '/admin': 'Admin',
  '/admin/login': 'Admin sign in',
};

function titleFor(pathname) {
  if (pathname === '/') return DEFAULT_TITLE;
  if (pathname.startsWith('/share/')) return `Shared note · ${BRAND}`;
  const page = TITLES[pathname.replace(/\/+$/, '')];
  return page ? `${page} · ${BRAND}` : DEFAULT_TITLE;
}

// One central map instead of a call in every page, so tab titles / history
// entries / PWA window titles stay consistent as routes get added.
export default function useRouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = titleFor(pathname);
  }, [pathname]);
}
