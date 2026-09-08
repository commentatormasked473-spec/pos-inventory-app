'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

export default function CreditPaymentsPage() {
  const [businessId, setBusinessId] = useState(null)
  const [userId, setUserId] = useState(null)
  const [debts, setDebts] = useState([])
  const [message, setMessage] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getCurrentAppUser().then((u) => {
      if (!u || u.role !== 'cashier') {
        router.push('/checkout')
        return
      }
      setBusinessId(u.business_id)
      setUserId(u.id)
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
        customers ( name, phone, business_id )
      `)
      .neq('status', 'paid')
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

  const handleRecordPayment = async (debt) => {
    const remaining = debt.amount_owed - debt.amount_paid
    const paymentStr = prompt(`Record payment for ${debt.customers.name} (owes KES ${remaining}):`)
    const payment = parseFloat(paymentStr)

    if (!payment || payment <= 0 || payment > remaining) {
      setMessage('Invalid payment amount.')
      return
    }

    // Log the individual payment event
    const { error: paymentError } = await supabase.from('credit_payments').insert({
      credit_account_id: debt.id,
      amount: payment,
      recorded_by: userId,
    })

    if (paymentError) {
      setMessage('Error recording payment: ' + paymentError.message)
      return
    }

    // Update the running balance on the credit account
    const newAmountPaid = debt.amount_paid + payment
    const newStatus = newAmountPaid >= debt.amount_owed ? 'paid' : 'partial'

    const { error: updateError } = await supabase
      .from('credit_accounts')
      .update({ amount_paid: newAmountPaid, status: newStatus })
      .eq('id', debt.id)

    if (updateError) {
      setMessage('Error updating balance: ' + updateError.message)
      return
    }

    setMessage(`✅ Recorded payment of KES ${payment} from ${debt.customers.name}`)
    fetchDebts()
  }

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Record Credit Payment</h1>
        <button
          onClick={logout}
          style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Log Out
        </button>
      </div>
      <p>{message}</p>

      {debts.length === 0 && <p style={{ color: '#666' }}>No outstanding debts.</p>}

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
            </div>
            <button
              onClick={() => handleRecordPayment(debt)}
              style={{ padding: '8px 14px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              Record Payment
            </button>
          </div>
        )
      })}
    </div>
  )
}