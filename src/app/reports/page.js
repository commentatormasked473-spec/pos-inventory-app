'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser } from '@/lib/auth'

const BUSINESS_ID = 'ce9c8d78-d29f-470d-bd14-fb2a58eac310'

export default function ReportsPage() {
  const [period, setPeriod] = useState('today')
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
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

  const fetchSales = async () => {
    setLoading(true)
    const now = new Date()
    let startDate = new Date()

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7)
    } else if (period === 'month') {
      startDate.setDate(now.getDate() - 30)
    }

    const { data, error } = await supabase
      .from('sales')
      .select(`
        id,
        total,
        payment_method,
        created_at,
        sale_items (
          quantity,
          unit_price,
          product_id,
          products ( name, cost_price )
        )
      `)
      .eq('business_id', BUSINESS_ID)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })

    if (!error) setSales(data)
    setLoading(false)
  }

  useEffect(() => {
    if (authorized) fetchSales()
  }, [period, authorized])

  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0)
  const totalSalesCount = sales.length

  const productStats = {}
  let totalProfit = 0

  sales.forEach((sale) => {
    sale.sale_items.forEach((item) => {
      const name = item.products?.name || 'Unknown'
      const cost = item.products?.cost_price || 0
      const revenue = item.unit_price * item.quantity
      const profit = (item.unit_price - cost) * item.quantity

      totalProfit += profit

      if (!productStats[name]) {
        productStats[name] = { name, unitsSold: 0, revenue: 0 }
      }
      productStats[name].unitsSold += item.quantity
      productStats[name].revenue += revenue
    })
  })

  const productList = Object.values(productStats).sort((a, b) => b.unitsSold - a.unitsSold)
  const bestSellers = productList.slice(0, 3)
  const slowSellers = [...productList].sort((a, b) => a.unitsSold - b.unitsSold).slice(0, 3)

  const paymentBreakdown = {}
  sales.forEach((s) => {
    paymentBreakdown[s.payment_method] = (paymentBreakdown[s.payment_method] || 0) + s.total
  })

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  if (loading) {
    return <p style={{ padding: '40px' }}>Loading...</p>
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px' }}>
      <h1>Sales Reports</h1>

      <div style={{ marginBottom: '20px' }}>
        {['today', 'week', 'month'].map((p) => (
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
            {p === 'today' ? 'Today' : p === 'week' ? 'Last 7 Days' : 'Last 30 Days'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px' }}>
        <div style={{ flex: 1, padding: '15px', backgroundColor: '#f0f7ff', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666' }}>Total Revenue</p>
          <h2 style={{ margin: '5px 0' }}>KES {totalRevenue.toFixed(2)}</h2>
        </div>
        <div style={{ flex: 1, padding: '15px', backgroundColor: '#f0fff5', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666' }}>Estimated Profit</p>
          <h2 style={{ margin: '5px 0' }}>KES {totalProfit.toFixed(2)}</h2>
        </div>
        <div style={{ flex: 1, padding: '15px', backgroundColor: '#fff8f0', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#666' }}>Number of Sales</p>
          <h2 style={{ margin: '5px 0' }}>{totalSalesCount}</h2>
        </div>
      </div>

      <h2>Payment Method Breakdown</h2>
      {Object.entries(paymentBreakdown).map(([method, amount]) => (
        <div key={method} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
          <span style={{ textTransform: 'capitalize' }}>{method}</span>
          <span>KES {amount.toFixed(2)}</span>
        </div>
      ))}

      <h2 style={{ marginTop: '30px' }}>Best Sellers</h2>
      {bestSellers.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
          <span>{p.name}</span>
          <span>{p.unitsSold} units — KES {p.revenue.toFixed(2)}</span>
        </div>
      ))}

      <h2 style={{ marginTop: '30px' }}>Slow Sellers</h2>
      {slowSellers.map((p) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee' }}>
          <span>{p.name}</span>
          <span>{p.unitsSold} units — KES {p.revenue.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}