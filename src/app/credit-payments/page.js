'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mpesa', label: 'M-Pesa' },
  { value: 'bank', label: 'Bank' },
]

const methodBtn = (active) => ({ padding: '8px 16px', marginRight: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: active ? '#1a73e8' : '#eee', color: active ? 'white' : 'black' })

export default function CreditPaymentsPage() {
  const [businessId, setBusinessId] = useState(null)
  const [debts, setDebts] = useState([])
  const [amounts, setAmounts] = useState({})
  const [method, setMethod] = useState('cash')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getCurrentAppUser().then((u) => {
      if (!u || u.role !== 'cashier') {
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
      .select('id, amount_owed, amount_paid, status, created_at, customers ( name, phone, business_id )')
      .neq('status', 'paid')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage('Error loading debts: ' + error.message)
      return
    }
    setDebts(data.filter((d) => d.customers?.business_id === businessId))
  }

  useEffect(() => {
    if (authorized && businessId) fetchDebts()
  }, [authorized, businessId])

  const methodLabel = METHODS.find((m) => m.value === method)?.label

  const handleRecordPayment = async (debt) => {
    if (!navigator.onLine) {
      setMessage('Recording a debt payment needs an internet connection.')
      return
    }
    const remaining = Number(debt.amount_owed) - Number(debt.amount_paid)
    const payment = parseFloat(amounts[debt.id])
    if (!payment || payment <= 0) {
      setMessage('Enter the amount received first.')
      return
    }
    if (payment > remaining) {
      setMessage('That is more than the KES ' + remaining + ' still owed by ' + debt.customers.name + '.')
      return
    }

    setBusyId(debt.id)
    setMessage('')
    const { error } = await supabase.rpc('record_credit_payment', {
      p_credit_account_id: debt.id,
      p_amount: payment,
      p_method: method,
    })
    setBusyId(null)

    if (error) {
      setMessage('Error recording payment: ' + error.message)
      return
    }

    setAmounts((prev) => ({ ...prev, [debt.id]: '' }))
    setMessage('Recorded KES ' + payment + ' from ' + debt.customers.name + ' (' + methodLabel + ')')
    fetchDebts()
  }

  const totalOwed = debts.reduce((sum, d) => sum + (Number(d.amount_owed) - Number(d.amount_paid)), 0)

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '700px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Record Credit Payment</h1>
        <div>
          <a href="/checkout" style={{ marginRight: '15px', color: '#1a73e8', fontWeight: 'bold', textDecoration: 'none' }}>Back to Checkout</a>
          <button onClick={logout} style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Log Out</button>
        </div>
      </div>

      <p style={{ fontWeight: 'bold', fontSize: '18px' }}>Total still owed by customers: KES {totalOwed.toLocaleString()}</p>

      <div style={{ margin: '15px 0' }}>
        <div style={{ color: '#666', fontSize: '13px', marginBottom: '6px' }}>Customer is paying by:</div>
        {METHODS.map((m) => (
          <button key={m.value} onClick={() => setMethod(m.value)} style={methodBtn(method === m.value)}>{m.label}</button>
        ))}
      </div>

      <p>{message}</p>
      {debts.length === 0 && <p style={{ color: '#666' }}>No outstanding debts.</p>}

      {debts.map((debt) => {
        const remaining = Number(debt.amount_owed) - Number(debt.amount_paid)
        return (
          <div key={debt.id} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '15px', marginBottom: '12px' }}>
            <strong>{debt.customers.name}</strong>
            {debt.customers.phone && <span style={{ color: '#666' }}> - {debt.customers.phone}</span>}
            <p style={{ margin: '4px 0' }}>Owed: KES {debt.amount_owed} | Paid: KES {debt.amount_paid} | Remaining: KES {remaining}</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              <input type="number" placeholder="Amount received" value={amounts[debt.id] || ''} onChange={(e) => setAmounts((prev) => ({ ...prev, [debt.id]: e.target.value }))} style={{ padding: '8px', width: '160px' }} />
              <button onClick={() => setAmounts((prev) => ({ ...prev, [debt.id]: String(remaining) }))} style={{ padding: '8px 12px', backgroundColor: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Full amount</button>
              <button onClick={() => handleRecordPayment(debt)} disabled={busyId === debt.id} style={{ padding: '8px 14px', backgroundColor: '#00b386', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>{busyId === debt.id ? 'Saving...' : 'Record ' + methodLabel + ' payment'}</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}