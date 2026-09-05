'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getCurrentAppUser } from '@/lib/auth'

const BUSINESS_ID = 'ce9c8d78-d29f-470d-bd14-fb2a58eac310'

export default function CheckoutPage() {
  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [message, setMessage] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [authorized, setAuthorized] = useState(false)
  const [cashierId, setCashierId] = useState(null)
  const router = useRouter()

  useEffect(() => {
    getCurrentAppUser().then((u) => {
      if (!u) {
        router.push('/login')
        return
      }
      setCashierId(u.id)
      // If the cashier has a fixed branch, default to it; owners can pick
      if (u.branch_id) setBranchId(u.branch_id)
      setAuthorized(true)
    })
  }, [])

  const fetchBranches = async () => {
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('business_id', BUSINESS_ID)
      .order('name')
    setBranches(data || [])
    if (data && data.length > 0 && !branchId) setBranchId(data[0].id)
  }

  const fetchProducts = async () => {
    if (!branchId) return
    const { data, error } = await supabase
      .from('products')
      .select(`id, name, price, branch_stock ( quantity, branch_id )`)
      .eq('business_id', BUSINESS_ID)
      .order('name')

    if (!error) setProducts(data)
  }

  useEffect(() => {
    if (authorized) fetchBranches()
  }, [authorized])

  useEffect(() => {
    if (authorized && branchId) fetchProducts()
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

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      setMessage('Cart is empty.')
      return
    }

    if (paymentMethod === 'credit' && !customerName.trim()) {
      setMessage('Please enter customer name for a credit sale.')
      return
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        business_id: BUSINESS_ID,
        branch_id: branchId,
        cashier_id: cashierId,
        total: total,
        payment_method: paymentMethod,
      })
      .select()
      .single()

    if (saleError) {
      setMessage('Error creating sale: ' + saleError.message)
      return
    }

    const saleItems = cart.map((item) => ({
      sale_id: sale.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.price,
    }))

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)

    if (itemsError) {
      setMessage('Sale created, but items failed: ' + itemsError.message)
      return
    }

    for (const item of cart) {
      const { data: stockRow } = await supabase
        .from('branch_stock')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('branch_id', branchId)
        .single()

      if (stockRow) {
        await supabase
          .from('branch_stock')
          .update({ quantity: stockRow.quantity - item.quantity })
          .eq('id', stockRow.id)
      }
    }

    if (paymentMethod === 'credit') {
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          business_id: BUSINESS_ID,
          name: customerName,
          phone: customerPhone,
        })
        .select()
        .single()

      if (!customerError) {
        await supabase.from('credit_accounts').insert({
          sale_id: sale.id,
          customer_id: customer.id,
          amount_owed: total,
          amount_paid: 0,
          status: 'unpaid',
        })
      }
    }

    setReceipt({
      items: cart,
      total,
      paymentMethod,
      customerName,
      date: new Date().toLocaleString(),
      saleId: sale.id,
    })
    setMessage('')
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    fetchProducts()
  }

  if (!authorized) return <p style={{ padding: '40px' }}>Checking access...</p>

  if (receipt) {
    return (
      <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '400px' }}>
        <h1>Receipt</h1>
        <p>{receipt.date}</p>
        <p>Sale ID: {receipt.saleId.slice(0, 8)}</p>
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
        {receipt.paymentMethod === 'credit' && (
          <p style={{ color: '#e74c3c', fontWeight: 'bold' }}>⚠️ Amount owed by customer</p>
        )}
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
      <h1>Checkout</h1>

      <label style={{ display: 'block', marginBottom: '15px' }}>
        Branch:{' '}
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={{ padding: '6px' }}>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>

      <div style={{ display: 'flex', gap: '40px' }}>
        <div style={{ flex: 1 }}>
          <h2>Products</h2>
          {products.map((p) => {
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
                <span>
                  {p.name} — KES {p.price} ({stock} in stock)
                </span>
                <button
                  onClick={() => addToCart(p)}
                  disabled={stock <= 0}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: stock <= 0 ? '#ccc' : '#1a73e8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: stock <= 0 ? 'not-allowed' : 'pointer',
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
          <p>{message}</p>
        </div>
      </div>
    </div>
  )
}