'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

export default function DebtsPage() {
  const [businessId, setBusinessId] = useState(null)
  const [debts, setDebts] = useState([])
  const [message, setMessage] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getCurrentAppUser().then((u) => {
      if (!u || u.role !== 'owner') {
        router.push('/checkout')
        return
      }
      setBusinessId(u.business_id)
      setAuthorized(true)
    })
  }, [])

  const fetchDebts = async () => {
    const { data, error } = await supabase
      .from('credit_accounts')
      .select(`
        id,
        amount_owed,
        amount_paid,
        status,
        created_at,
        customers ( name, phone, business_id ),
        credit_payments ( amount, paid_at )
      `)
      .order('created_at', { ascending: false })

    if (!error) {
      const filtered = data.filter((d) => d.customers?.business_id === businessId)
      setDebts(filtered)
    } else {
      setMessage('Error loading debts: ' + error.message)
    }
  }

  useEffect(() => {
    if (authorized && businessId) fetchDebts()
  }, [authorized, businessId])

  const totalOutstanding = debts.reduce((sum, d) => sum + (d.amount_owed - d.amount_paid), 0)

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Customer Debts</h1>
        <button
          onClick={logout}
          style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Log Out
        </button>
      </div>
      <p style={{ fontWeight: 'bold', fontSize: '18px' }}>
        Total outstanding: KES {totalOutstanding}
      </p>
      <p style={{ color: '#666', fontSize: '14px' }}>View only — payments are recorded by cashiers at checkout.</p>
      <p>{message}</p>

      {debts.map((debt) => {
        const remaining = debt.amount_owed - debt.amount_paid
        return (
          <div
            key={debt.id}
            style={{
              border: '1px solid #eee',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{debt.customers.name}</strong>
                {debt.customers.phone && <span style={{ color: '#666' }}> — {debt.customers.phone}</span>}
                <p style={{ margin: '4px 0' }}>
                  Owed: KES {debt.amount_owed} | Paid: KES {debt.amount_paid} | Remaining: KES {remaining}
                </p>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: debt.status === 'paid' ? '#d4f7dc' : debt.status === 'partial' ? '#fff3cd' : '#fde2e2',
                  color: debt.status === 'paid' ? '#1a7a3a' : debt.status === 'partial' ? '#8a6d00' : '#c0392b',
                }}
              >
                {debt.status.toUpperCase()}
              </span>
            </div>
            {debt.credit_payments && debt.credit_payments.length > 0 && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f0f0f0' }}>
                <p style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>Payment history:</p>
                {debt.credit_payments.map((p, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#333' }}>
                    KES {p.amount} on {new Date(p.paid_at).toLocaleDateString()}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}