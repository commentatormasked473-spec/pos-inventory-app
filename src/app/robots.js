export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/checkout', '/admin', '/products', '/reports', '/debts', '/sales', '/restocking', '/branches', '/staff', '/credit-payments', '/stock-history'],
    },
    sitemap: 'https://pos-inventory-app-psi.vercel.app/sitemap.xml',
  }
}
