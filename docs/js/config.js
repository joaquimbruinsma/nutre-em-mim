// 1) Cole aqui os dados do SEU projeto no Supabase (Settings > API).
// A chave "anon" é pública por padrão; quem protege os dados são as regras (RLS) do banco.
const SUPABASE_URL = "https://jzbdufezwxtllpthriwp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6YmR1ZmV6d3h0bGxwdGhyaXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNzU4MzEsImV4cCI6MjExMDg1MTgzMX0.9cS4-7Vo2hpFFvdtiYnremWOu4ZlOEWUuCsIq4XCQpo";

// "db" é o nosso acesso ao Supabase em todas as páginas.
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
