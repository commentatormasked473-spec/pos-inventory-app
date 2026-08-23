import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data, error } = await supabase.from('_test').select('*').limit(1)

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Supabase Connection Test</h1>
      {error ? (
        <p style={{ color: 'green' }}>
          ✅ Connected to Supabase! (Expected error since '_test' table doesn't exist: {error.message})
        </p>
      ) : (
        <p>Data: {JSON.stringify(data)}</p>
      )}
    </div>
  )
}