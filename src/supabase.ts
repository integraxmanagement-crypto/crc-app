import { createClient } from '@supabase/supabase-js'

// Las claves vienen de variables de entorno (.env.local en el equipo, o Vercel al publicar).
// Solo se usa la clave PÚBLICA; los datos los protegen las reglas de seguridad por fila (RLS).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabase = url && key ? createClient(url, key) : null
