'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser } from '@/lib/auth'

export default function DebtsPage() {
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
        customers ( name, phone )
      `)
      .order('created_at', { ascending: false })

    if (!error) setDebts(data)
    else setMessage('Error loading debts: ' + error.message)
  }

  useEffect(() => {
    if (authorized) fetchDebts()
  }, [authorized])

  const handleRecordPayment = async (debt) => {
    const remaining = debt.amount_owed - debt.amount_paid
    const paymentStr = prompt(`Record payment for ${debt.customers.name} (owes KES ${remaining}):`)
    const payment = parseFloat(paymentStr)

    if (!payment || payment <= 0 || payment > remaining) {
      setMessage('Invalid payment amount.')
      return
    }

    const newAmountPaid = debt.amount_paid + payment
    const newStatus = newAmountPaid >= debt.amount_owed ? 'paid' : 'partial'

    const { error } = await supabase
      .from('credit_accounts')
      .update({ amount_paid: newAmountPaid, status: newStatus })
      .eq('id', debt.id)

    if (error) {
      setMessage('Error recording payment: ' + error.message)
      return
    }

    setMessage(`✅ Recorded payment of KES ${payment} from ${debt.customers.name}`)
    fetchDebts()
  }

  const totalOutstanding = debts.reduce((sum, d) => sum + (d.amount_owed - d.amount_paid), 0)

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '700px' }}>
      <h1>Customer Debts</h1>
      <p style={{ fontWeight: 'bold', fontSize: '18px' }}>
        Total outstanding: KES {totalOutstanding}
      </p>
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
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <strong>{debt.customers.name}</strong>
              {debt.customers.phone && <span style={{ color: '#666' }}> — {debt.customers.phone}</span>}
              <p style={{ margin: '4px 0' }}>
                Owed: KES {debt.amount_owed} | Paid: KES {debt.amount_paid} | Remaining: KES {remaining}
              </p>
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
            <button
              onClick={() => handleRecordPayment(debt)}
              disabled={debt.status === 'paid'}
              style={{
                padding: '8px 14px',
                backgroundColor: debt.status === 'paid' ? '#ccc' : '#1a73e8',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: debt.status === 'paid' ? 'not-allowed' : 'pointer',
              }}
            >
              Record Payment
            </button>
          </div>
        )
      })}
    </div>
  )
}