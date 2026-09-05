'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentAppUser } from '@/lib/auth'

export default function DashboardPage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    getCurrentAppUser().then((u) => {
      if (!u) {
        router.push('/login')
        return
      }
      if (u.role !== 'owner') {
        router.push('/checkout')
        return
      }
      setUser(u)
      setLoading(false)
    })
  }, [])

  if (loading) return <p style={{ padding: '40px' }}>Loading...</p>
  const links = [
    { href: '/products', label: 'Products & Inventory' },
    { href: '/checkout', label: 'Checkout' },
    { href: '/sales', label: 'Recent Sales & Refunds' },
    { href: '/debts', label: 'Customer Debts' },
    { href: '/restocking', label: 'Suppliers & Restocking' },
    { href: '/reports', label: 'Sales Reports' },
    { href: '/branches', label: 'Branches' },
  ]

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '600px' }}>
      <h1>Welcome, {user.full_name}</h1>
      <p style={{ color: '#666' }}>Owner Dashboard</p>
      <div style={{ marginTop: '30px', display: 'grid', gap: '12px' }}>
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: 'block',
              padding: '16px',
              backgroundColor: '#f0f7ff',
              borderRadius: '8px',
              textDecoration: 'none',
              color: '#1a73e8',
              fontWeight: 'bold',
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}