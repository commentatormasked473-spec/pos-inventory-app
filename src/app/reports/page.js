'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

export default function ReportsPage() {
  const [businessId, setBusinessId] = useState(null)
  const [role, setRole] = useState(null)
  const [authorized, setAuthorized] = useState(false)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [archive, setArchive] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [dailySales, setDailySales] = useState([])
  const router = useRouter()

  useEffect(() => {
    getCurrentAppUser().then((u) => {
      if (!u) {
        router.push('/login')
        return
      }
      if (u.role === 'cashier') {
        router.push('/checkout')
        return
      }
      setBusinessId(u.business_id)
      setRole(u.role)
      setAuthorized(true)
    })
  }, [])

  const generateAndLoadMonth = async () => {
    if (!businessId) return
    setLoading(true)
    setMessage('')

    // 1. Generate / update the archive on the server
    const { error: genError } = await supabase.rpc('generate_monthly_financial_archive', {
      p_business_id: businessId,
      p_year: year,
      p_month: month,
    })

    if (genError) {
      setMessage('Error generating report: ' + genError.message)
      setLoading(false)
      return
    }

    // 2. Load the saved archive
    const { data, error } = await supabase
      .from('monthly_financial_archives')
      .select('*')
      .eq('business_id', businessId)
      .eq('year', year)
      .eq('month', month)
      .single()

    if (error) {
      setMessage('Could not load archive: ' + error.message)
    } else {
      setArchive(data)
      setMessage('Report ready (saved permanently in archives)')
    }
    setLoading(false)
  }

  const loadDailyReport = async () => {
    if (!selectedDate || !businessId) return
    setLoading(true)
    setMessage('')

    const start = new Date(selectedDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(selectedDate)
    end.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('sales')
      .select(`
        id, created_at, total, payment_method,
        sale_items (
          quantity, unit_price,
          products ( name )
        )
      `)
      .eq('business_id', businessId)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at')

    if (error) {
      setMessage('Error loading day: ' + error.message)
      setDailySales([])
    } else {
      setDailySales(data || [])
      setMessage(data?.length ? `Found ${data.length} sale(s) on ${selectedDate}` : `No sales on ${selectedDate}`)
    }
    setLoading(false)
  }

  if (!authorized) return <p style={{ padding: 40 }}>Checking access...</p>

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Reports & Archives</h1>
        <button
          onClick={logout}
          style={{ padding: '8px 16px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: 6 }}
        >
          Log Out
        </button>
      </div>

      {/* MONTHLY P&L */}
      <section style={{ marginTop: 30, padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
        <h2>Monthly Profit / Loss Archive</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '15px 0' }}>
          <label>
            Year:{' '}
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value) || year)}
              style={{ width: 80, padding: 6 }}
            />
          </label>
          <label>
            Month:{' '}
            <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} style={{ padding: 6 }}>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i, 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={generateAndLoadMonth}
            disabled={loading}
            style={{ padding: '8px 18px', background: '#1a73e8', color: 'white', border: 'none', borderRadius: 6 }}
          >
            {loading ? 'Working...' : 'Generate / View Archive'}
          </button>
        </div>

        {archive && (
          <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 6 }}>
            <h3>
              {new Date(archive.year, archive.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
            </h3>
            <p>Total Sales: <strong>KES {Number(archive.total_sales).toLocaleString()}</strong></p>
            <p>Refunds: <strong>KES {Number(archive.total_refunds).toLocaleString()}</strong></p>
            <p>Net Revenue: <strong>KES {Number(archive.net_revenue).toLocaleString()}</strong></p>
            <p>Total Expenses: <strong>KES {Number(archive.total_expenses).toLocaleString()}</strong></p>
            <p style={{ fontSize: 18, marginTop: 10 }}>
              Net Profit / Loss:{' '}
              <strong style={{ color: archive.net_profit >= 0 ? 'green' : 'red' }}>
                KES {Number(archive.net_profit).toLocaleString()}
              </strong>
            </p>
            <p style={{ color: '#666', fontSize: 13 }}>
              Saved permanently on {new Date(archive.generated_at).toLocaleString()} — available for 10+ years
            </p>
          </div>
        )}
      </section>

      {/* DAILY HISTORICAL REPORT */}
      <section style={{ marginTop: 40, padding: 20, border: '1px solid #ddd', borderRadius: 8 }}>
        <h2>Daily Sales Report (any day, even 10 years ago)</h2>
        <p style={{ color: '#666' }}>
          Pick any date. If the day is older than one year the system still shows the full original sales.
        </p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '15px 0' }}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: 8 }}
          />
          <button
            onClick={loadDailyReport}
            disabled={loading || !selectedDate}
            style={{ padding: '8px 18px', background: '#00b386', color: 'white', border: 'none', borderRadius: 6 }}
          >
            Load Day Report
          </button>
        </div>

        {dailySales.length > 0 && (
          <div>
            {dailySales.map((sale) => (
              <div key={sale.id} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>KES {sale.total}</strong>
                  <span>{new Date(sale.created_at).toLocaleTimeString()}</span>
                </div>
                <div style={{ color: '#666' }}>Paid: {sale.payment_method}</div>
                {sale.sale_items?.map((item, idx) => (
                  <div key={idx} style={{ fontSize: 14 }}>
                    {item.products?.name} × {item.quantity} @ {item.unit_price}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={{ marginTop: 20 }}>{message}</p>
    </div>
  )
}