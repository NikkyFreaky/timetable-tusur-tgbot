import { promises as fs } from "fs"
import path from "path"
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

const DATA_DIR = path.join(process.cwd(), "data")
const USERS_FILE = path.join(DATA_DIR, "users.json")
const CHATS_FILE = path.join(DATA_DIR, "chats.json")

type JsonUser = any
type JsonChat = any

async function migrateUsers() {
  console.log("📦 Reading users.json...")
  const raw = await fs.readFile(USERS_FILE, "utf-8")
  const users = JSON.parse(raw) as JsonUser[]

  console.log(`👥 Found ${users.length} users`)

  let migrated = 0
  let errors = 0

  for (const user of users) {
    try {
      const userData = {
        id: user.id,
        first_name: user.firstName,
        last_name: user.lastName || null,
        username: user.username || null,
        photo_url: user.photoUrl || null,
        language_code: user.languageCode || null,
        is_premium: user.isPremium || null,
        added_to_attachment_menu: user.addedToAttachmentMenu || null,
        allows_write_to_pm: user.allowsWriteToPm || null,
        is_bot: user.isBot || null,
        settings: user.settings || null,
        notification_state: user.notificationState || {},
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        last_seen_at: user.lastSeenAt,
      }

      const { error } = await supabase
        .from("users")
        .upsert(userData, { onConflict: "id" })

      if (error) throw error

      if (user.devices && Array.isArray(user.devices)) {
        for (const device of user.devices) {
          const deviceData = {
            id: device.id,
            user_id: user.id,
            label: device.label,
            tg_platform: device.tgPlatform || null,
            tg_version: device.tgVersion || null,
            user_agent: device.userAgent || null,
            platform: device.platform || null,
            language: device.language || null,
            timezone: device.timezone || null,
            first_seen_at: device.firstSeenAt,
            last_seen_at: device.lastSeenAt,
            settings: device.settings || null,
          }

          await supabase.from("user_devices").upsert(deviceData, { onConflict: "id" })
        }
      }

      migrated++
      if (migrated % 10 === 0) {
        console.log(`   Progress: ${migrated}/${users.length} users migrated`)
      }
    } catch (error) {
      console.error(`❌ Error migrating user ${user.id}:`, error)
      errors++
    }
  }

  console.log(`✅ Users migration complete: ${migrated} migrated, ${errors} errors`)
  return { migrated, errors }
}

async function migrateChats() {
  console.log("📦 Reading chats.json...")

  try {
    await fs.access(CHATS_FILE)
    const raw = await fs.readFile(CHATS_FILE, "utf-8")
    const chats = JSON.parse(raw) as JsonChat[]

    console.log(`💬 Found ${chats.length} chats`)

    let migrated = 0
    let errors = 0

    for (const chat of chats) {
      try {
        const chatData = {
          id: chat.id,
          type: chat.type,
          title: chat.title || null,
          username: chat.username || null,
          photo_url: chat.photoUrl || null,
          settings: chat.settings || null,
          notification_state: chat.notificationState || {},
          created_at: chat.createdAt,
          updated_at: chat.updatedAt,
          last_seen_at: chat.lastSeenAt,
        }

        const { error } = await supabase
          .from("chats")
          .upsert(chatData, { onConflict: "id" })

        if (error) throw error

        migrated++
      } catch (error) {
        console.error(`❌ Error migrating chat ${chat.id}:`, error)
        errors++
      }
    }

    console.log(`✅ Chats migration complete: ${migrated} migrated, ${errors} errors`)
    return { migrated, errors }
  } catch (error) {
    console.log("ℹ️  chats.json not found, skipping chat migration")
    return { migrated: 0, errors: 0 }
  }
}

async function verifyMigration() {
  console.log("🔍 Verifying migration...")

  const { count: usersCount } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })

  const { count: chatsCount } = await supabase
    .from("chats")
    .select("*", { count: "exact", head: true })

  const { count: devicesCount } = await supabase
    .from("user_devices")
    .select("*", { count: "exact", head: true })

  console.log(`📊 Supabase statistics:`)
  console.log(`   Users: ${usersCount || 0}`)
  console.log(`   Chats: ${chatsCount || 0}`)
  console.log(`   Devices: ${devicesCount || 0}`)

  return { usersCount, chatsCount, devicesCount }
}

async function main() {
  console.log("🚀 Starting migration to Supabase...\n")

  const usersResult = await migrateUsers()
  console.log()
  const chatsResult = await migrateChats()
  console.log()
  await verifyMigration()

  console.log("\n✨ Migration complete!")
  console.log("\n📝 Next steps:")
  console.log("   1. Verify data in Supabase dashboard")
  console.log("   2. Backup data/users.json and data/chats.json")
  console.log("   3. Delete data/users.json and data/chats.json")
}

main().catch(console.error)
