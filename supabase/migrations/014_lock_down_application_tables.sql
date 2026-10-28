-- Application data is accessed only through authenticated server routes.
-- The service_role client used by those routes bypasses RLS.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_message_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_message_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_notification_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_availability_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_availability_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_availability_people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for users" ON public.users;
DROP POLICY IF EXISTS "Enable all access for chats" ON public.chats;
DROP POLICY IF EXISTS "Enable all access for user_devices" ON public.user_devices;

REVOKE ALL ON TABLE
  public.users,
  public.chats,
  public.user_devices,
  public.cache,
  public.chat_members,
  public.chat_topics,
  public.user_login_history,
  public.user_change_history,
  public.bot_message_templates,
  public.bot_message_dispatches,
  public.bot_message_delivery_attempts,
  public.cron_notification_claims,
  public.employee_availability_access,
  public.employee_availability_configs,
  public.employee_availability_people
FROM anon, authenticated;
