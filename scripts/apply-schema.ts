import { readFileSync } from "fs"
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing required environment variables:")
  console.error("   NEXT_PUBLIC_SUPABASE_URL")
  console.error("   NEXT_PUBLIC_SUPABASE_ANON_KEY")
  console.error("\n💡 Create .env.local file with these variables.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function applySchema() {
  console.log("📋 Reading schema file...")
  const schema = readFileSync("./supabase-schema.sql", "utf-8")

  console.log("🔧 Applying schema to Supabase...")

  const { data, error } = await supabase.rpc("exec_sql", { sql: schema })

  if (error) {
    console.error("❌ Error applying schema:", error)
    console.log("\n⚠️  Please manually apply the schema in Supabase SQL Editor:")
    console.log("   1. Open https://supabase.com/dashboard/project/wujyhmdwhgvyhkxxvbta/sql")
    console.log("   2. Copy the content of supabase-schema.sql")
    console.log("   3. Paste and execute in the SQL Editor")
    return false
  }

  console.log("✅ Schema applied successfully!")
  return true
}

async function verifyTables() {
  console.log("\n🔍 Verifying tables...")

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("*")
    .limit(1)

  const { data: chats, error: chatsError } = await supabase
    .from("chats")
    .select("*")
    .limit(1)

  const { data: devices, error: devicesError } = await supabase
    .from("user_devices")
    .select("*")
    .limit(1)

  console.log(`   Users table: ${usersError ? "❌ Error" : "✅ OK"}`)
  console.log(`   Chats table: ${chatsError ? "❌ Error" : "✅ OK"}`)
  console.log(`   User devices table: ${devicesError ? "❌ Error" : "✅ OK"}`)
}

applySchema().then(async (success) => {
  if (success) {
    await verifyTables()
  }
}).catch(console.error)
