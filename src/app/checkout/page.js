'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser, logout } from '@/lib/auth'

const QUEUE_KEY = 'pos_offline_queue'
const PRODUCTS_CACHE_KEY = 'pos_products_cache'
const BRANCHES_CACHE_KEY = 'pos_branches_cache'

export default function CheckoutPage() {
  const [businessId, setBusinessId] = useState(null)
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [products, setProducts] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [message, setMessage] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [authorized, setAuthorized] = useState(false)
  const [cashierId, setCashierId] = useState(null)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const router = useRouter()
  const syncingRef = useRef(false)

  useEffect(() => {
    getCurrentAppUser().then((u) => {
      if (!u) {
        router.push('/login')
        return
      }
      if (u.role !== 'cashier') {
        router.push('/dashboard')
        return
      }
      setCashierId(u.id)
      setBusinessId(u.business_id)
      if (u.branch_id) setBranchId(u.branch_id)
      setAuthorized(true)
    })
  }, [])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    updatePendingCount()

    const goOnline = () => {
      setIsOnline(true)
      syncQueue()
    }
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [businessId, branchId, cashierId])

  const getQueue = () => {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    } catch {
      return []
    }
  }

  const saveQueue = (queue) => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    setPendingCount(queue.length)
  }

  const updatePendingCount = () => {
    setPendingCount(getQueue().length)
  }

  const fetchBranches = async () => {
    if (!navigator.onLine) {
      const cached = localStorage.getItem(BRANCHES_CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached)
        setBranches(data)
        if (data.length > 0 && !branchId) setBranchId(data[0].id)
      }
      return
    }

    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('business_id', businessId)
      .order('name')
    setBranches(data || [])
    if (data && data.length > 0 && !branchId) setBranchId(data[0].id)
    if (data) localStorage.setItem(BRANCHES_CACHE_KEY, JSON.stringify(data))
  }

  const fetchProducts = async () => {
    if (!branchId) return

    if (!navigator.onLine) {
      const cached = localStorage.getItem(PRODUCTS_CACHE_KEY)
      if (cached) {
        setProducts(JSON.parse(cached))
      } else {
        setMessage('No offline product data saved yet. Connect once to enable offline checkout.')
      }
      return
    }

    const { data, error } = await supabase
      .from('products')
      .select(`id, name, price, branch_stock ( quantity, branch_id )`)
      .eq('business_id', businessId)
      .order('name')

    if (!error) {
      setProducts(data)
      localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(data))
    }
  }

  useEffect(() => {
    if (authorized && businessId) fetchBranches()
  }, [authorized, businessId])

  useEffect(() => {
    if (authorized && branchId) {
      fetchProducts()
      syncQueue()
    }
  }, [authorized, branchId])

  const getStockForBranch = (product) => {
    const stockRow = product.branch_stock?.find((s) => s.branch_id === branchId)
    return stockRow?.quantity ?? 0
  }

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { product_id: product.id, name: product.name, price: product.price, quantity: 1, discount: 0 }]
    })
  }

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId))
  }

  const updateDiscount = (productId, discount) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, discount: parseFloat(discount) || 0 } : item
      )
    )
  }

  const itemTotal = (item) => Math.max(0, item.price * item.quantity - item.discount)
  const total = cart.reduce((sum, item) => sum + itemTotal(item), 0)

  const submitSale = async (saleData) => {
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        business_id: saleData.businessId,
        branch_id: saleData.branchId,
        cashier_id: saleData.cashierId,
        total: saleData.total,
        payment_method: saleData.paymentMethod,
        created_at: saleData.createdAt,
      })
      .select()
      .single()

    if (saleError) return { error: saleError.message }

    const saleItems = saleData.items.map((item) => ({
      sale_id: sale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price,
    }))

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
    if (itemsError) return { error: itemsError.message }

    for (const item of saleData.items) {
      const { data: stockRow } = await supabase
        .from('branch_stock')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('branch_id', saleData.branchId)
        .single()

      if (stockRow) {
        await supabase
          .from('branch_stock')
          .update({ quantity: stockRow.quantity - item.quantity })
          .eq('id', stockRow.id)

        await supabase.from('stock_movements').insert({
          product_id: item.product_id,
          branch_id: saleData.branchId,
          change_qty: -item.quantity,
          reason: 'sale',
        })
      }
    }

    if (saleData.paymentMethod === 'credit' && saleData.customerName) {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          business_id: saleData.businessId,
          name: saleData.customerName,
          phone: saleData.customerPhone,
        })
        .select()
        .single()

      if (!customerError) {
        await supabase.from('credit_accounts').insert({
          sale_id: sale.id,
          customer_id: customer.id,
          amount_owed: saleData.total,
          amount_paid: 0,
          status: 'unpaid',
        })
      }
    }

    return { error: null, saleId: sale.id }
  }

  const syncQueue = async () => {
    if (syncingRef.current) return
    if (!navigator.onLine) return
    const queue = getQueue()
    if (queue.length === 0) return

    syncingRef.current = true
    setSyncing(true)

    const remaining = [...queue]
    while (remaining.length > 0) {
      const saleData = remaining[0]
      const { error } = await submitSale(saleData)
      if (error) {
        setMessage('Sync error, will retry: ' + error)
        break
      }
      remaining.shift()
      saveQueue(remaining)
    }

    setSyncing(false)
    syncingRef.current = false
    if (remaining.length === 0) {
      setMessage('✅ All offline sales synced!')
      fetchProducts()
    }
  }

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      setMessage('Cart is empty.')
      return
    }

    if (paymentMethod === 'credit' && !customerName.trim()) {
      setMessage('Please enter customer name for a credit sale.')
      return
    }

    const saleData = {
      businessId,
      branchId,
      cashierId,
      items: cart,
      paymentMethod,
      customerName,
      customerPhone,
      total,
      createdAt: new Date().toISOString(),
    }

    if (navigator.onLine) {
      const { error, saleId } = await submitSale(saleData)
      if (error) {
        setMessage('Error creating sale: ' + error)
        return
      }
      setReceipt({ ...saleData, saleId, pending: false })
    } else {
      const queue = getQueue()
      queue.push(saleData)
      saveQueue(queue)

      // Update the local product cache so stock reflects this sale immediately, even offline
      const updatedProducts = products.map((p) => {
        const item = cart.find((c) => c.product_id === p.id)
        if (!item) return p
        return {
          ...p,
          branch_stock: p.branch_stock.map((s) =>
            s.branch_id === branchId ? { ...s, quantity: s.quantity - item.quantity } : s
          ),
        }
      })
      setProducts(updatedProducts)
      localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(updatedProducts))

      setReceipt({ ...saleData, saleId: 'pending', pending: true })
    }

    setMessage('')
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    if (navigator.onLine) fetchProducts()
  }

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  if (receipt) {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Receipt</h1>
          <button
            onClick={logout}
            style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Log Out
          </button>
        </div>
        {receipt.pending && (
          <p style={{ backgroundColor: '#fff3cd', padding: '10px', borderRadius: '6px', color: '#8a6d00' }}>
            Saved offline — will sync automatically once you're back online.
          </p>
        )}
        <p>{new Date(receipt.createdAt).toLocaleString()}</p>
        {receipt.customerName && <p>Customer: {receipt.customerName}</p>}
        <hr />
        {receipt.items.map((item) => (
          <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{item.name} x{item.quantity}</span>
            <span>KES {itemTotal(item)}</span>
          </div>
        ))}
        <hr />
        <h3>Total: KES {receipt.total}</h3>
        <p>Paid via: {receipt.paymentMethod}</p>
        <button
          onClick={() => setReceipt(null)}
          style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px' }}
        >
          New Sale
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Checkout</h1>
        <div>
          <a href="/sales" style={{ marginRight: '15px', color: '#1a73e8', fontWeight: 'bold', textDecoration: 'none' }}>My Sales Today</a>
          <a href="/credit-payments" style={{ marginRight: '15px', color: '#1a73e8', fontWeight: 'bold', textDecoration: 'none' }}>Credit Payments</a>
          <button
            onClick={logout}
            style={{ padding: '8px 16px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Log Out
          </button>
        </div>
      </div>

      {!isOnline && (
        <div style={{ padding: '10px', backgroundColor: '#fde2e2', color: '#c0392b', borderRadius: '6px', marginTop: '15px' }}>
          You are offline. Using saved product data. Sales will sync automatically once connection returns.
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div style={{ padding: '10px', backgroundColor: '#fff3cd', color: '#8a6d00', borderRadius: '6px', marginTop: '15px' }}>
          {syncing ? 'Syncing...' : `${pendingCount} sale(s) waiting to sync.`}
        </div>
      )}
      <p>{message}</p>

      {branches.length === 0 ? (
        <p style={{ color: '#e74c3c', marginTop: '15px' }}>No branch data available. Connect to the internet at least once.</p>
      ) : (
        <label style={{ display: 'block', marginBottom: '15px', marginTop: '15px' }}>
          Branch:{' '}
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '6px' }}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: 'flex', gap: '40px' }}>
        <div style={{ flex: 1 }}>
          <h2>Products</h2>
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '10px',
              width: '100%',
              marginBottom: '15px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              boxSizing: 'border-box',
              fontSize: '14px',
            }}
          />
          {products
            .filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .map((p) => {
              const stock = getStockForBranch(p)
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  <span>{p.name} — KES {p.price} ({stock} in stock)</span>
                  <button
                    onClick={() => addToCart(p)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#1a73e8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Add
                  </button>
                </div>
              )
            })}
        </div>

        <div style={{ flex: 1 }}>
          <h2>Cart</h2>
          {cart.length === 0 && <p>No items yet.</p>}
          {cart.map((item) => (
            <div key={item.product_id} style={{ padding: '6px 0', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.name} x{item.quantity} = KES {itemTotal(item)}</span>
                <button onClick={() => removeFromCart(item.product_id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>
                  Remove
                </button>
              </div>
              <div style={{ marginTop: '4px' }}>
                <label style={{ fontSize: '13px', marginRight: '6px' }}>Discount (KES):</label>
                <input
                  type="number"
                  value={item.discount}
                  onChange={(e) => updateDiscount(item.product_id, e.target.value)}
                  style={{ width: '80px', padding: '4px' }}
                />
              </div>
            </div>
          ))}

          <h3 style={{ marginTop: '20px' }}>Total: KES {total}</h3>

          <label style={{ display: 'block', marginTop: '10px' }}>Payment Method:</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{ padding: '8px', width: '100%', marginTop: '5px' }}
          >
            <option value="cash">Cash</option>
            <option value="mpesa">M-Pesa</option>
            <option value="bank">Bank</option>
            <option value="credit">Credit (customer owes)</option>
          </select>

          {paymentMethod === 'credit' && (
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3f3', borderRadius: '6px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Customer Name:</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                style={{ padding: '8px', width: '100%', marginBottom: '8px', boxSizing: 'border-box' }}
              />
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>Phone (optional):</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                style={{ padding: '8px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          )}

          <button
            onClick={handleCompleteSale}
            style={{
              marginTop: '15px',
              padding: '10px 20px',
              backgroundColor: '#00b386',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              width: '100%',
              fontWeight: 'bold',
            }}
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  )
}