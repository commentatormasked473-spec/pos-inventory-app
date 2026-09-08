'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

export default function SalesPage() {
  const [businessId, setBusinessId] = useState(null)
  const [role, setRole] = useState(null)
  const [userId, setUserId] = useState(null)
  const [period, setPeriod] = useState('today')
  const [sales, setSales] = useState([])
  const [message, setMessage] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()

  useEffect(() => {
    getCurrentAppUser().then((u) => {
      if (!u) {
        router.push('/login')
        return
      }
      setBusinessId(u.business_id)
      setRole(u.role)
      setUserId(u.id)
      setAuthorized(true)
    })
  }, [])

  const fetchSales = async () => {
    let query = supabase
      .from('sales')
      .select(`
        id,
        created_at,
        total,
        payment_method,
        cashier_id,
        sale_items (
          id,
          quantity,
          unit_price,
          product_id,
          products ( name ),
          refunds ( quantity )
        )
      `)
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })

    if (role === 'cashier') {
      // Cashiers always locked to today, regardless of period buttons
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      query = query.eq('cashier_id', userId).gte('created_at', startOfToday.toISOString())
    } else {
      // Owners can pick a date range
      const now = new Date()
      let startDate = new Date()
      if (period === 'today') {
        startDate.setHours(0, 0, 0, 0)
      } else if (period === 'week') {
        startDate.setDate(now.getDate() - 7)
      } else if (period === 'month') {
        startDate.setDate(now.getDate() - 30)
      } else if (period === 'year') {
        startDate.setDate(now.getDate() - 365)
      }
      query = query.gte('created_at', startDate.toISOString()).limit(200)
    }

    const { data, error } = await query

    if (!error) setSales(data)
    else setMessage('Error loading sales: ' + error.message)
  }

  useEffect(() => {
    if (authorized && businessId) fetchSales()
  }, [authorized, businessId, period])

  const refundedQty = (item) =>
    item.refunds?.reduce((sum, r) => sum + r.quantity, 0) ?? 0

  const handleRefund = async (item) => {
    const alreadyRefunded = refundedQty(item)
    const remaining = item.quantity - alreadyRefunded

    if (remaining <= 0) {
      setMessage('This item is already fully refunded.')
      return
    }

    const qtyStr = prompt(`Refund how many units of "${item.products.name}"? (max ${remaining})`)
    const qty = parseInt(qtyStr)

    if (!qty || qty <= 0 || qty > remaining) {
      setMessage('Invalid refund quantity.')
      return
    }

    const { error: refundError } = await supabase.from('refunds').insert({
      sale_item_id: item.id,
      quantity: qty,
      reason: 'Customer return',
    })

    if (refundError) {
      setMessage('Error recording refund: ' + refundError.message)
      return
    }

    const { data: saleRow } = await supabase
      .from('sales')
      .select('branch_id')
      .eq('id', item.sale_id)
      .single()

    const { data: stockRow } = await supabase
      .from('branch_stock')
      .select('id, quantity')
      .eq('product_id', item.product_id)
      .eq('branch_id', saleRow?.branch_id)
      .single()

    if (stockRow) {
      await supabase
        .from('branch_stock')
        .update({ quantity: stockRow.quantity + qty })
        .eq('id', stockRow.id)
    }

    setMessage(`✅ Refunded ${qty} unit(s) of "${item.products.name}"`)
    fetchSales()
  }

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{role === 'cashier' ? "Today's Sales" : 'Recent Sales'}</h1>
        <button
          onClick={logout}
          style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Log Out
        </button>
      </div>

      {role !== 'cashier' && (
        <div style={{ margin: '15px 0' }}>
          {['today', 'week', 'month', 'year'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '8px 16px',
                marginRight: '10px',
                backgroundColor: period === p ? '#1a73e8' : '#eee',
                color: period === p ? 'white' : 'black',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'Last 7 Days' : p === 'month' ? 'Last 30 Days' : 'This Year'}
            </button>
          ))}
        </div>
      )}

      <p>{message}</p>
      {sales.length === 0 && <p style={{ color: '#666' }}>No sales yet.</p>}
      {sales.map((sale) => (
        <div key={sale.id} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '15px', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <strong>KES {sale.total}</strong>
            <span>{new Date(sale.created_at).toLocaleString()}</span>
          </div>
          <p style={{ color: '#666', margin: '4px 0' }}>Paid via: {sale.payment_method}</p>
          {sale.sale_items.map((item) => {
            const refunded = refundedQty(item)
            const fullyRefunded = refunded >= item.quantity
            return (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span>
                  {item.products.name} x{item.quantity} @ KES {item.unit_price}
                  {refunded > 0 ? ` (${refunded} refunded)` : ''}
                </span>
                <button
                  onClick={() => handleRefund({ ...item, sale_id: sale.id })}
                  disabled={fullyRefunded}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: fullyRefunded ? '#ccc' : '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: fullyRefunded ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {fullyRefunded ? 'Refunded' : 'Refund'}
                </button>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}