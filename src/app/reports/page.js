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
  const [creditPayments, setCreditPayments] = useState([])
  const [creditOwed, setCreditOwed] = useState(0)
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

    const start = new Date(selectedDate + 'T00:00:00+03:00'); const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('sales')
      .select(`
        id, created_at, total, payment_method,
        sale_items (
          quantity, unit_price,
          products ( name, cost_price ), refunds ( quantity )
        )
      `)
      .eq('business_id', businessId)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('created_at', { ascending: true })

    if (error) {
      setMessage('Error loading day: ' + error.message)
      setDailySales([]); setCreditPayments([])
    } else {
      setDailySales(data || [])
      const { data: payData } = await supabase
        .from('credit_payments')
        .select('amount, payment_method, paid_at, credit_accounts ( customers ( name ) )')
        .gte('paid_at', start.toISOString())
        .lt('paid_at', end.toISOString())
        .order('paid_at', { ascending: true })
      setCreditPayments(payData || [])
      const { data: owedData } = await supabase.from('credit_accounts').select('amount_owed, amount_paid')
      setCreditOwed((owedData || []).reduce((sum, d) => sum + (Number(d.amount_owed) - Number(d.amount_paid)), 0))
      setMessage(data?.length ? `Found ${data.length} sale(s) on ${selectedDate}` : `No sales on ${selectedDate}`)
    }
    setLoading(false)
  }

  const dayTotalSold = dailySales.reduce((sum, s) => sum + Number(s.total || 0), 0)
  const dayCostOfGoods = dailySales.reduce(
    (sum, s) => sum + (s.sale_items || []).reduce((n, i) => n + (Number(i.quantity || 0) - (i.refunds || []).reduce((r, x) => r + Number(x.quantity || 0), 0)) * Number(i.products?.cost_price || 0), 0),
    0
  )
  const dayProfit = dayTotalSold - dayCostOfGoods
  const byMethod = (m) => dailySales.filter((s) => s.payment_method === m).reduce((sum, s) => sum + Number(s.total || 0), 0) + creditPayments.filter((c) => c.payment_method === m).reduce((sum, c) => sum + Number(c.amount || 0), 0)

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
            <p>Gross Profit: <strong>KES {Number(archive.net_revenue).toLocaleString()}</strong></p>
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
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 150, padding: 14, background: '#f0f7ff', borderRadius: 8 }}>
              <div style={{ color: '#666', fontSize: 13 }}>Total Sold</div>
              <strong style={{ fontSize: 20 }}>KES {dayTotalSold.toLocaleString()}</strong>
            </div>
            <div style={{ flex: 1, minWidth: 150, padding: 14, background: '#fff8f0', borderRadius: 8 }}>
              <div style={{ color: '#666', fontSize: 13 }}>Cost of Goods Sold</div>
              <strong style={{ fontSize: 20 }}>KES {dayCostOfGoods.toLocaleString()}</strong>
            </div>
            <div style={{ flex: 1, minWidth: 150, padding: 14, background: '#f0fff5', borderRadius: 8 }}>
              <div style={{ color: '#666', fontSize: 13 }}>Estimated Profit</div>
              <strong style={{ fontSize: 20, color: dayProfit >= 0 ? 'green' : 'red' }}>KES {dayProfit.toLocaleString()}</strong>
            </div>
            <div style={{ flex: 1, minWidth: 150, padding: 14, background: '#f7f7f7', borderRadius: 8 }}>
              <div style={{ color: '#666', fontSize: 13 }}>Number of Sales</div>
              <strong style={{ fontSize: 20 }}>{dailySales.length}</strong>
            </div>
          </div>
        )}
        {dailySales.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#666', fontSize: 13, marginBottom: 8 }}>Money by payment method</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 130, padding: 14, background: '#f0fff5', borderRadius: 8 }}>
                <div style={{ color: '#666', fontSize: 13 }}>Cash</div>
                <strong style={{ fontSize: 18 }}>KES {byMethod('cash').toLocaleString()}</strong>
              </div>
              <div style={{ flex: 1, minWidth: 130, padding: 14, background: '#f0f7ff', borderRadius: 8 }}>
                <div style={{ color: '#666', fontSize: 13 }}>M-Pesa</div>
                <strong style={{ fontSize: 18 }}>KES {byMethod('mpesa').toLocaleString()}</strong>
              </div>
              <div style={{ flex: 1, minWidth: 130, padding: 14, background: '#f7f4ff', borderRadius: 8 }}>
                <div style={{ color: '#666', fontSize: 13 }}>Bank</div>
                <strong style={{ fontSize: 18 }}>KES {byMethod('bank').toLocaleString()}</strong>
              </div>
              <div style={{ flex: 1, minWidth: 130, padding: 14, background: '#fff3f3', borderRadius: 8 }}>
                <div style={{ color: '#666', fontSize: 13 }}>Credit sold today</div>
                <strong style={{ fontSize: 18, color: '#c0392b' }}>KES {byMethod('credit').toLocaleString()}</strong>
              </div>
            </div>
          </div>
        )}
        {(creditPayments.length > 0 || dailySales.length > 0) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 180, padding: 14, background: '#f0fff5', borderRadius: 8 }}>
                <div style={{ color: '#666', fontSize: 13 }}>Debts collected today</div>
                <strong style={{ fontSize: 18 }}>KES {creditPayments.reduce((sum, c) => sum + Number(c.amount || 0), 0).toLocaleString()}</strong>
              </div>
              <div style={{ flex: 1, minWidth: 180, padding: 14, background: '#fff3f3', borderRadius: 8 }}>
                <div style={{ color: '#666', fontSize: 13 }}>Credit still owed (all customers)</div>
                <strong style={{ fontSize: 18, color: '#c0392b' }}>KES {creditOwed.toLocaleString()}</strong>
              </div>
            </div>
            {creditPayments.length > 0 && (
              <div>
                <div style={{ color: '#666', fontSize: 13, marginBottom: 6 }}>Money received from goods sold on credit</div>
                {creditPayments.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 14 }}>
                    <span>{new Date(c.paid_at).toLocaleTimeString('en-GB', { hourCycle: 'h23', timeZone: 'Africa/Nairobi' })} - {c.credit_accounts?.customers?.name || 'Customer'} ({({ cash: 'Cash', mpesa: 'M-Pesa', bank: 'Bank' })[c.payment_method] || c.payment_method})</span>
                    <strong>KES {Number(c.amount).toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {dailySales.length > 0 && (
          <div>
            {dailySales.map((sale) => (
              <div key={sale.id} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>KES {sale.total}</strong>
                  <span>{new Date(sale.created_at).toLocaleTimeString('en-GB', { hourCycle: 'h23', timeZone: 'Africa/Nairobi' })}</span>
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