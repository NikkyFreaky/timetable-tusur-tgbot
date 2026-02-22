import React from 'react'
import type { Metadata } from 'next'
import { getAdminUser } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/admin/admin-nav'

export const metadata: Metadata = {
  title: 'Админ-панель | Расписание ТУСУР',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const adminUser = await getAdminUser()

  if (!adminUser) {
    redirect('/admin/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminNav
        email={adminUser.admin.email}
        displayName={adminUser.admin.displayName}
        role={adminUser.admin.role}
      />
      <main className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </div>
  )
}
