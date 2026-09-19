export default function sitemap() {
  return [
    {
      url: 'https://pos-inventory-app-psi.vercel.app',
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: 'https://pos-inventory-app-psi.vercel.app/login',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ]
}
