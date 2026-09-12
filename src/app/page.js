export default function Home() {
  return (
    <div style={{ fontFamily: 'sans-serif', color: '#222' }}>
      <section
        style={{
          background: 'linear-gradient(135deg, #00c6ff, #00ffb3)',
          padding: '80px 20px',
          textAlign: 'center',
          color: 'white',
        }}
      >
        <h1 style={{ fontSize: '42px', marginBottom: '10px' }}>SCO Tech POS</h1>
        <p style={{ fontSize: '20px', maxWidth: '600px', margin: '0 auto 30px' }}>
          Point of Sale and Inventory Management built for Kenyan small businesses.
          Track stock, sales, staff, and customer debts, all in one simple app.
        </p>
        
          href="https://wa.me/254796136938"
          style={{
            display: 'inline-block',
            padding: '14px 28px',
            backgroundColor: '#1a73e8',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 'bold',
            fontSize: '16px',
          }}
        >
          Chat with us on WhatsApp
        </a>
      </section>

      <section style={{ padding: '60px 20px', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '40px' }}>Everything your shop needs</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
          {[
            { title: 'Fast Checkout', desc: 'Ring up sales quickly with product search, discounts, and instant receipts.' },
            { title: 'Inventory Tracking', desc: 'Stock updates automatically with every sale. Get low-stock alerts before you run out.' },
            { title: 'Multi-Branch', desc: 'Manage stock and staff across multiple shop locations from one account.' },
            { title: 'Staff Accounts', desc: 'Give each cashier their own login. Owners see reports; cashiers just see checkout.' },
            { title: 'Customer Credit', desc: 'Track goods sold on credit and record payments as customers pay off their debt.' },
            { title: 'Sales Reports', desc: 'See daily, weekly, monthly, and yearly sales, profit, and best-selling products.' },
          ].map((f) => (
            <div key={f.title} style={{ padding: '20px', border: '1px solid #eee', borderRadius: '10px' }}>
              <h3 style={{ marginBottom: '8px', color: '#1a73e8' }}>{f.title}</h3>
              <p style={{ color: '#555', fontSize: '15px', lineHeight: '1.5' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '60px 20px', backgroundColor: '#f7f9fc' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '40px' }}>Simple pricing</h2>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '900px', margin: '0 auto' }}>
          {[
            { name: 'Starter', price: 'KES 1,000/mo', desc: 'Single branch, core POS and inventory' },
            { name: 'Standard', price: 'KES 2,000/mo', desc: 'Adds customer credit, supplier orders' },
            { name: 'Multi-Branch', price: 'KES 3,500/mo', desc: 'Multiple branches, unlimited staff' },
          ].map((tier) => (
            <div key={tier.name} style={{ padding: '30px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', width: '250px', textAlign: 'center' }}>
              <h3>{tier.name}</h3>
              <p style={{ fontSize: '22px', fontWeight: 'bold', color: '#1a73e8', margin: '10px 0' }}>{tier.price}</p>
              <p style={{ color: '#666', fontSize: '14px' }}>{tier.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '60px 20px', textAlign: 'center' }}>
        <h2 style={{ marginBottom: '15px' }}>Ready to get started?</h2>
        <p style={{ color: '#555', marginBottom: '25px' }}>
          Reach out and we will set up your shop's account for you.
        </p>
        <p style={{ fontSize: '16px' }}>
          Call or WhatsApp: <a href="tel:0796136938" style={{ color: '#1a73e8' }}>0796 136 938</a>
        </p>
        <p style={{ fontSize: '16px' }}>
          Email: <a href="mailto:csternly@gmail.com" style={{ color: '#1a73e8' }}>csternly@gmail.com</a>
        </p>
      </section>

      <footer style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '13px', borderTop: '1px solid #eee' }}>
        SCO Tech. All rights reserved.
      </footer>
    </div>
  )
}
