'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser } from '@/lib/auth'

const BUSINESS_ID = 'ce9c8d78-d29f-470d-bd14-fb2a58eac310'
const BRANCH_ID = '386f0e58-dbd4-4bf3-b157-0719ae994e82'

export default function SalesPage() {
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
      setAuthorized(true)
    })
  }, [])

  const fetchSales = async () => {
    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        created_at,
        total,
        payment_method,
        sale_items (
          id,
          quantity,
          unit_price,
          product_id,
          products ( name ),
          refunds ( quantity )
        )
      `)
      .eq('business_id', BUSINESS_ID)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!error) setSales(data)
    else setMessage('Error loading sales: ' + error.message)
  }

  useEffect(() => {
    if (authorized) fetchSales()
  }, [authorized])

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

    const { data: stockRow } = await supabase
      .from('branch_stock')
      .select('id, quantity')
      .eq('product_id', item.product_id)
      .eq('branch_id', BRANCH_ID)
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
      <h1>Recent Sales</h1>
      <p>{message}</p>
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
                  onClick={() => handleRefund(item)}
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