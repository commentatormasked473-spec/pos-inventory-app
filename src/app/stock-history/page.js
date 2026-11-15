'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

export default function StockHistoryPage() {
  const [businessId, setBusinessId] = useState(null)
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' })
  )
  const [rows, setRows] = useState([])
  const [movementLog, setMovementLog] = useState([])
  const [monthlyValues, setMonthlyValues] = useState([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
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

  // Nairobi day boundaries
  const getDayRange = (dateStr) => {
    const start = new Date(dateStr + 'T00:00:00+03:00')
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    return { start, end }
  }

  const fetchDayData = async () => {
    if (!branchId || !selectedDate) return
    setLoading(true)
    setMessage('')

    const { start, end } = getDayRange(selectedDate)

    // All products with current stock for this branch
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, cost_price, branch_stock ( quantity, branch_id )')
      .eq('business_id', businessId)
      .order('name')

    if (prodError) {
      setMessage('Error loading products: ' + prodError.message)
      setLoading(false)
      return
    }

    // All movements for this branch on the selected day
    const { data: dayMovements, error: movError } = await supabase
      .from('stock_movements')
      .select('product_id, change_qty, reason, created_at, products ( name )')
      .eq('branch_id', branchId)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: true })

    if (movError) {
      setMessage('Error loading movements: ' + movError.message)
      setLoading(false)
      return
    }

    // Movements AFTER the selected day (to reverse them and get opening)
    const { data: afterMovements } = await supabase
      .from('stock_movements')
      .select('product_id, change_qty')
      .eq('branch_id', branchId)
      .gte('created_at', end.toISOString())

    const afterByProduct = {}
    ;(afterMovements || []).forEach((m) => {
      afterByProduct[m.product_id] = (afterByProduct[m.product_id] || 0) + m.change_qty
    })

    const dayByProduct = {}
    ;(dayMovements || []).forEach((m) => {
      if (!dayByProduct[m.product_id]) {
        dayByProduct[m.product_id] = { sold: 0, otherIn: 0, otherOut: 0 }
      }
      if (m.change_qty < 0 && (m.reason || '').toLowerCase().includes('sale')) {
        dayByProduct[m.product_id].sold += Math.abs(m.change_qty)
      } else if (m.change_qty > 0) {
        dayByProduct[m.product_id].otherIn += m.change_qty
      } else {
        dayByProduct[m.product_id].otherOut += Math.abs(m.change_qty)
      }
    })

    const results = []
    for (const p of products || []) {
      const stockRow = p.branch_stock?.find((s) => s.branch_id === branchId)
      const currentQty = stockRow?.quantity ?? 0
      const afterChange = afterByProduct[p.id] || 0
      const dayInfo = dayByProduct[p.id] || { sold: 0, otherIn: 0, otherOut: 0 }

      // Current - movements after the day = closing stock of the selected day
      const closing = currentQty - afterChange
      // Closing - net day change = opening
      const netDay = (dayInfo.otherIn - dayInfo.sold - dayInfo.otherOut)
      const opening = closing - netDay

      results.push({
        id: p.id,
        name: p.name,
        opening,
        sold: dayInfo.sold,
        otherIn: dayInfo.otherIn,
        otherOut: dayInfo.otherOut,
        remaining: closing,
      })
    }
    setRows(results)
    setMovementLog(dayMovements || [])
    setLoading(false)
  }

  // Monthly total stock value (last 12 months) using cost_price
  const fetchMonthlyValues = async () => {
    if (!branchId) return

    const { data: products } = await supabase
      .from('products')
      .select('id, cost_price, branch_stock ( quantity, branch_id )')
      .eq('business_id', businessId)

    if (!products) return

    // Current total value
    let currentValue = 0
    products.forEach((p) => {
      const qty = p.branch_stock?.find((s) => s.branch_id === branchId)?.quantity ?? 0
      const cost = Number(p.cost_price) || 0
      currentValue += qty * cost
    })

    // Get all movements for the branch in the last ~13 months
    const thirteenMonthsAgo = new Date()
    thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13)
    thirteenMonthsAgo.setDate(1)

    const { data: allMovements } = await supabase
      .from('stock_movements')
      .select('product_id, change_qty, created_at')
      .eq('branch_id', branchId)
      .gte('created_at', thirteenMonthsAgo.toISOString())
      .order('created_at', { ascending: true })

    // Build month-end values by walking backwards from current
    const months = []
    const nowNairobi = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' })
    let runningValue = currentValue

    for (let i = 0; i < 12; i++) {
      const d = new Date(nowNairobi + 'T12:00:00+03:00')
      d.setMonth(d.getMonth() - i)
      const year = d.getFullYear()
      const month = d.getMonth() // 0-11
      const label = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'Africa/Nairobi' })

      // Value at end of this month = current - all movements after this month-end
      const monthEnd = new Date(Date.UTC(year, month + 1, 1)) // first day of next month UTC approx
      // Better: Nairobi end of month
      const endOfMonthStr = new Date(year, month + 1, 0).toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' })
      const endOfMonth = new Date(endOfMonthStr + 'T23:59:59+03:00')

      let valueAtEnd = currentValue
      ;(allMovements || []).forEach((m) => {
        if (new Date(m.created_at) > endOfMonth) {
          // This movement happened after month end, so reverse its effect on value
          // We approximate using current cost (good enough for trend)
          const prod = products.find((p) => p.id === m.product_id)
          const cost = Number(prod?.cost_price) || 0
          valueAtEnd -= m.change_qty * cost
        }
      })

      months.unshift({ label, value: Math.round(valueAtEnd) })
    }

    setMonthlyValues(months)
  }

  useEffect(() => {
    if (authorized && businessId) fetchBranches()
  }, [authorized, businessId])

  useEffect(() => {
    if (authorized && branchId) {
      fetchDayData()
      fetchMonthlyValues()
    }
  }, [authorized, branchId, selectedDate])

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  // Simple SVG line chart
  const Chart = ({ data }) => {
    if (!data || data.length === 0) return null
    const w = 700
    const h = 220
    const pad = 40
    const values = data.map((d) => d.value)
    const min = Math.min(...values) * 0.95
    const max = Math.max(...values) * 1.05 || 1
    const points = data
      .map((d, i) => {
        const x = pad + (i / (data.length - 1)) * (w - pad * 2)
        const y = h - pad - ((d.value - min) / (max - min)) * (h - pad * 2)
        return `${x},${y}`
      })
      .join(' ')

    return (
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ background: '#fafafa', borderRadius: 8 }}>
        <polyline fill="none" stroke="#1a73e8" strokeWidth="2.5" points={points} />
        {data.map((d, i) => {
          const x = pad + (i / (data.length - 1)) * (w - pad * 2)
          const y = h - pad - ((d.value - min) / (max - min)) * (h - pad * 2)
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#1a73e8" />
              <text x={x} y={h - 12} textAnchor="middle" fontSize="11" fill="#555">
                {d.label}
              </text>
              <text x={x} y={y - 10} textAnchor="middle" fontSize="10" fill="#333">
                {d.value.toLocaleString()}
              </text>
            </g>
          )
        })}
      </svg>
    )
  }

  const fmtTime = (iso) =>
    new Date(iso).toLocaleTimeString('en-GB', {
      hourCycle: 'h23',
      timeZone: 'Africa/Nairobi',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Stock History</h1>
        <button
          onClick={logout}
          style={{
            padding: '8px 16px',
            backgroundColor: '#e74c3c',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Log Out
        </button>
      </div>

      {message && <p style={{ color: '#e74c3c' }}>{message}</p>}

      <div style={{ marginTop: '20px', marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Branch:{' '}
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '6px' }}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
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

        {loading && <span style={{ color: '#666' }}>Loading…</span>}
      </div>

      <h2>
        Summary for{' '}
        {new Date(selectedDate + 'T12:00:00+03:00').toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'Africa/Nairobi',
        })}
      </h2>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #ccc', textAlign: 'left' }}>
            <th style={{ padding: '8px' }}>Product</th>
            <th style={{ padding: '8px' }}>Opening</th>
            <th style={{ padding: '8px' }}>Sold</th>
            <th style={{ padding: '8px' }}>Other In</th>
            <th style={{ padding: '8px' }}>Other Out</th>
            <th style={{ padding: '8px' }}>Remaining</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px' }}>{r.name}</td>
              <td style={{ padding: '8px' }}>{r.opening}</td>
              <td style={{ padding: '8px', color: r.sold > 0 ? '#e74c3c' : undefined }}>
                {r.sold > 0 ? `-${r.sold}` : '0'}
              </td>
              <td style={{ padding: '8px', color: r.otherIn > 0 ? '#00b386' : undefined }}>
                {r.otherIn > 0 ? `+${r.otherIn}` : '0'}
              </td>
              <td style={{ padding: '8px', color: r.otherOut > 0 ? '#e74c3c' : undefined }}>
                {r.otherOut > 0 ? `-${r.otherOut}` : '0'}
              </td>
              <td style={{ padding: '8px', fontWeight: 600 }}>{r.remaining}</td>
            </tr>
          ))}
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={6} style={{ padding: '12px', color: '#666' }}>
                No products found for this branch.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Movement Log (oldest first)</h2>
      {movementLog.length === 0 && !loading && (
        <p style={{ color: '#666' }}>No stock movements on this day.</p>
      )}
      {movementLog.map((m, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            fontSize: '14px',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <span>
            <strong>{fmtTime(m.created_at)}</strong> — {m.products?.name || 'Unknown'}{' '}
            <span style={{ textTransform: 'capitalize', color: '#666' }}>({m.reason})</span>
          </span>
          <span style={{ color: m.change_qty < 0 ? '#e74c3c' : '#00b386', fontWeight: 'bold' }}>
            {m.change_qty > 0 ? '+' : ''}
            {m.change_qty}
          </span>
        </div>
      ))}

      <h2 style={{ marginTop: '40px' }}>Monthly Stock Value (KES)</h2>
      <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
        Total value of stock at month-end (using cost price). Last 12 months.
      </p>
      <Chart data={monthlyValues} />
    </div>
  )
}