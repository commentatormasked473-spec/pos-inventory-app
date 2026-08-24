'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const BUSINESS_ID = 'ce9c8d78-d29f-470d-bd14-fb2a58eac310'
const BRANCH_ID = '386f0e58-dbd4-4bf3-b157-0719ae994e82'
const CASHIER_ID = '9630f4b4-5fcc-4ef3-9751-97b4a0790164' // Test Owner, from app_users

export default function CheckoutPage() {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([]) // { product_id, name, price, quantity }
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [message, setMessage] = useState('')

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`id, name, price, branch_stock ( quantity )`)
      .eq('business_id', BUSINESS_ID)
      .order('name')

    if (!error) setProducts(data)
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { product_id: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
  }

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId))
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      setMessage('Cart is empty.')
      return
    }

    // 1. Create the sale
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        business_id: BUSINESS_ID,
        branch_id: BRANCH_ID,
        cashier_id: CASHIER_ID,
        total: total,
        payment_method: paymentMethod,
      })
      .select()
      .single()

    if (saleError) {
      setMessage('Error creating sale: ' + saleError.message)
      return
    }

    // 2. Create sale_items for each cart item
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

    // 3. Deduct stock for each item
    for (const item of cart) {
      const { data: stockRow } = await supabase
        .from('branch_stock')
        .select('id, quantity')
        .eq('product_id', item.product_id)
        .eq('branch_id', BRANCH_ID)
        .single()

      if (stockRow) {
        await supabase
          .from('branch_stock')
          .update({ quantity: stockRow.quantity - item.quantity })
          .eq('id', stockRow.id)
      }
    }

    setMessage(`✅ Sale completed! Total: KES ${total}`)
    setCart([])
    fetchProducts()
  }

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif', maxWidth: '800px' }}>
      <h1>Checkout</h1>

      <div style={{ display: 'flex', gap: '40px' }}>
        {/* Product list */}
        <div style={{ flex: 1 }}>
          <h2>Products</h2>
          {products.map((p) => {
            const stock = p.branch_stock?.[0]?.quantity ?? 0
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

        {/* Cart */}
        <div style={{ flex: 1 }}>
          <h2>Cart</h2>
          {cart.length === 0 && <p>No items yet.</p>}
          {cart.map((item) => (
            <div
              key={item.product_id}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}
            >
              <span>
                {item.name} x{item.quantity} = KES {item.price * item.quantity}
              </span>
              <button onClick={() => removeFromCart(item.product_id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>
                Remove
              </button>
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