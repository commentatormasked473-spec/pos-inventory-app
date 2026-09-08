'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

export default function StockHistoryPage() {
  const [businessId, setBusinessId] = useState(null)
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [rows, setRows] = useState([])
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

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('business_id', businessId)
      .order('name')
    setBranches(data || [])
    if (data && data.length > 0 && !branchId) setBranchId(data[0].id)
  }

  const fetchOpeningStock = async () => {
    if (!branchId) return

    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, branch_stock ( quantity, branch_id )')
      .eq('business_id', businessId)
      .order('name')

    if (prodError) {
      setMessage('Error loading products: ' + prodError.message)
      return
    }

    const startOfDay = new Date(selectedDate + 'T00:00:00')

    const results = []
    for (const p of products) {
      const stockRow = p.branch_stock?.find((s) => s.branch_id === branchId)
      const currentQty = stockRow?.quantity ?? 0

      const { data: movements } = await supabase
        .from('stock_movements')
        .select('change_qty')
        .eq('product_id', p.id)
        .eq('branch_id', branchId)
        .gte('created_at', startOfDay.toISOString())

      const changesSinceThen = (movements || []).reduce((sum, m) => sum + m.change_qty, 0)
      const openingStock = currentQty - changesSinceThen

      results.push({
        name: p.name,
        openingStock,
        currentQty,
        netChange: changesSinceThen,
      })
    }

    setRows(results)
  }

  useEffect(() => {
    if (authorized && businessId) fetchBranches()
  }, [authorized, businessId])

  useEffect(() => {
    if (authorized && branchId) fetchOpeningStock()
  }, [authorized, branchId, selectedDate])

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Stock History</h1>
        <button
          onClick={logout}
          style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Log Out
        </button>
      </div>
      <p>{message}</p>

      <div style={{ display: 'flex', gap: '20px', marginTop: '15px', marginBottom: '20px' }}>
        <label>
          Branch:{' '}
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '6px' }}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label>
          Date:{' '}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: '6px' }}
          />
        </label>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Product</th>
            <th style={{ padding: '8px' }}>Opening Stock (start of day)</th>
            <th style={{ padding: '8px' }}>Net Change That Day</th>
            <th style={{ padding: '8px' }}>Current Stock</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px' }}>{r.name}</td>
              <td style={{ padding: '8px' }}>{r.openingStock}</td>
              <td style={{ padding: '8px', color: r.netChange < 0 ? '#e74c3c' : '#00b386' }}>
                {r.netChange > 0 ? '+' : ''}{r.netChange}
              </td>
              <td style={{ padding: '8px' }}>{r.currentQty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}