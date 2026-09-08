'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

export default function StockHistoryPage() {
  const [businessId, setBusinessId] = useState(null)
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [period, setPeriod] = useState('today')
  const [rows, setRows] = useState([])
  const [movementLog, setMovementLog] = useState([])
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

  const getStartDate = () => {
    const now = new Date()
    let start = new Date()
    if (period === 'today') {
      start.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      start.setDate(now.getDate() - 7)
    } else if (period === 'month') {
      start.setDate(now.getDate() - 30)
    } else if (period === 'year') {
      start.setDate(now.getDate() - 365)
    }
    return start
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

    const startDate = getStartDate()

    // Summary: opening vs current stock per product
    const results = []
    for (const p of products) {
      const stockRow = p.branch_stock?.find((s) => s.branch_id === branchId)
      const currentQty = stockRow?.quantity ?? 0

      const { data: movements } = await supabase
        .from('stock_movements')
        .select('change_qty')
        .eq('product_id', p.id)
        .eq('branch_id', branchId)
        .gte('created_at', startDate.toISOString())

      const changesSincePeriodStart = (movements || []).reduce((sum, m) => sum + m.change_qty, 0)
      const openingStock = currentQty - changesSincePeriodStart

      results.push({
        name: p.name,
        openingStock,
        currentQty,
        netChange: changesSincePeriodStart,
      })
    }
    setRows(results)

    // Day-by-day movement log for the selected period
    const { data: logData, error: logError } = await supabase
      .from('stock_movements')
      .select('change_qty, reason, created_at, products ( name )')
      .eq('branch_id', branchId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (!logError) setMovementLog(logData)
  }

  useEffect(() => {
    if (authorized && businessId) fetchBranches()
  }, [authorized, businessId])

  useEffect(() => {
    if (authorized && branchId) fetchOpeningStock()
  }, [authorized, branchId, period])

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  const periodLabel = {
    today: "Opening stock at start of today",
    week: "Opening stock 7 days ago",
    month: "Opening stock 30 days ago",
    year: "Opening stock 1 year ago",
  }[period]

  // Group the movement log by calendar date for display
  const groupedByDate = {}
  movementLog.forEach((m) => {
    const dateKey = new Date(m.created_at).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = []
    groupedByDate[dateKey].push(m)
  })

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

      <div style={{ marginTop: '15px', marginBottom: '15px' }}>
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

      <label style={{ display: 'block', marginBottom: '15px' }}>
        Branch:{' '}
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '6px' }}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>

      <h2>Summary</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Product</th>
            <th style={{ padding: '8px' }}>{periodLabel}</th>
            <th style={{ padding: '8px' }}>Net Change</th>
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

      <h2>Daily Movement Log</h2>
      {Object.keys(groupedByDate).length === 0 && <p style={{ color: '#666' }}>No stock movements in this period.</p>}
      {Object.entries(groupedByDate).map(([date, movements]) => (
        <div key={date} style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', color: '#333', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>{date}</h3>
          {movements.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '14px' }}>
              <span>
                {m.products?.name || 'Unknown'} — <span style={{ textTransform: 'capitalize', color: '#666' }}>{m.reason}</span>
              </span>
              <span style={{ color: m.change_qty < 0 ? '#e74c3c' : '#00b386', fontWeight: 'bold' }}>
                {m.change_qty > 0 ? '+' : ''}{m.change_qty}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}