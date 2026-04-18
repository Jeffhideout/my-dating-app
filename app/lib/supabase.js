import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oiwronhwpbqnuldbrczw.supabase.co'
const supabaseAnonKey = 'sb_publishable_GGD4UZQQeUw0IwQKJ4Zb5Q_WlSb8Bmu'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export { supabase }
export default supabase