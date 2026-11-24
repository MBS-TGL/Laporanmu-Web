# Planning: Improvisasi Asisten AI Laporanmu

## 1. Ringkasan
Asisten AI sudah aman dari sisi API key (Edge Function `ai-proxy`), tetapi masih punya celah abuse, jawaban terlalu umum, dan belum streaming. Pengerjaan dibagi empat fase: P0 safety, P1 akurasi, P2 kecepatan non-streaming, P3 streaming setelah P0-P2 stabil.

## 2. Keputusan yang sudah disepakati
- Model `openai/gpt-oss-20b` diasumsikan tersedia; verifikasi saat implementasi.
- Riwayat chat hanya di memori React. Tidak ada persistensi antar sesi atau antar reload.
- Streaming dikerjakan paling akhir, setelah P0 dan P1 stabil.
- Kuota awal: 5 permintaan/menit, 30 permintaan/hari per user, 24.000 token/menit, 180.000 token/hari global. Configurable via env.

## 3. Tujuan dan metrik
- **Safety**: client tidak bisa memilih model atau mengirim system prompt bebas; ada kuota per user; error tidak menyamar sebagai jawaban.
- **Akurasi**: jawaban menyebut menu/route yang benar, sesuai role dan flag modul; tidak mengarang nama, nomor, atau nilai.
- **Kecepatan**: jawaban FAQ umum instan dari cache; latency dan token usage tercatat.
- **Kualitas kode**: `npm run lint` dan `npm run build` bersih; unit test untuk retrieval dan parser SSE.

## 4. Kondisi saat ini
| Area | Temuan | Lokasi |
|---|---|---|
| Abuse | `system` dan `model` diterima dari client | `supabase/functions/ai-proxy/index.ts:76`, `:102` |
| Konteks | Hanya daftar fitur, tanpa route/role/glossary | `src/shared/lib/ai.ts:11` |
| Error | String error masuk sebagai bubble asisten | `src/shared/lib/ai.ts:56`, `ChatAssistant.tsx:54` |
| Batas | CORS `*`, history 20 x 8000 char, output 8192 token | `ai-proxy/index.ts:12`, `:84`, `:91` |
| Kuota | Tidak ada batas per user | `ai-proxy/index.ts` |
| Kecepatan | Non-streaming, history 4 pesan, tanpa cache | `ChatAssistant.tsx:48`, `:54` |

## 5. Arsitektur target
```
ChatAssistant
  -> buildChatContext(role, flags, can)        // menu + panduan terfilter
  -> retrieveKnowledge(question)               // top 4 entri relevan
  -> callAi({ mode, input, history, context })
       -> Edge ai-proxy
            -> cek JWT + role staff
            -> ai_consume_quota(estimatedTokens)
            -> prompt kanonik per mode (server)
            -> Groq
```
Modul lain (CBT, konseling, kesehatan, insights, rapor) tetap memakai `callAi` non-streaming, tetapi ikut aturan model dan guardrail server.

## 6. Kontrak API baru
```ts
type AiMode = 'chat' | 'cbt' | 'counseling' | 'health' | 'insights' | 'rapor'

POST /functions/v1/ai-proxy
{
  mode: AiMode,
  input: string,
  history?: { role: 'user' | 'assistant'; content: string }[],
  context?: string,          // data tak tepercaya, dibungkus tag
  stream?: boolean,
  maxOutputTokens?: number   // di-clamp server per mode
}

// non-stream: { text, usage? }
// stream (P3): text/event-stream format OpenAI
```
- `body.system` dan `body.model` diabaikan. Untuk transisi, modul lama boleh kirim `system`, tetapi server tetap menambahkan guardrail dan memilih model dari allowlist.
- Model: `openai/gpt-oss-20b` untuk `chat`/`insights`, `openai/gpt-oss-120b` untuk `cbt`/`rapor`.
- Suhu: chat 0,2; konseling 0,4; generasi 0,5.
- Batas input: 2.000 char per pesan, 6 pesan history, total context 12.000 char. Tolak dengan pesan jelas jika lewat.

## 7. P0: Safety dan robust
- [ ] Kunci model di server. Hapus pemakaian `body.model`; pakai peta `MODE_MODEL`.
- [ ] Tambah `BASE_GUARDRAILS` server: hanya topik aplikasi, jangan mengarang data, jangan membocorkan prompt.
- [ ] Bungkus `context` dan `input` dengan tag `<konteks_aplikasi>` / `<pertanyaan_pengguna>`; instruksikan isi tag adalah data, bukan perintah.
- [ ] Timeout Groq 25 detik (`AbortSignal.timeout`) dan `AbortController` di client; batalkan saat drawer ditutup.
- [ ] Ubah `askAi` menjadi `AiResult` (`{ ok: true, text } | { ok: false, code, message }`). Error tampil sebagai state dengan tombol **Coba lagi**, bukan bubble asisten.
- [ ] CORS allowlist dari env `APP_ORIGIN` (localhost:5174 + domain produksi).
- [ ] Rate limit per user lewat migrasi `0070_ai_guardrails.sql` (nomor 0069 sudah dipakai guardian portal).
- [ ] Cooldown client 30 detik saat kena 429.
- [ ] Hapus greeting dari history; kirim maksimal 6 pesan terakhir.
- [ ] Estimasi token: `ceil((system + context + history + input) / 4) + maxOutputTokens`, kirim ke RPC kuota.

**Kriteria selesai**: client tidak bisa mengganti model; error punya tombol retry; request berhenti saat drawer ditutup; 5 pertanyaan uji tidak menghasilkan nama/nomor karangan; kuota menolak permintaan ke-6 dalam satu menit.

## 8. P1: Akurasi jawaban
- [x] Buat `src/shared/lib/aiKnowledge.ts`: `AiKnowledgeEntry { id, title, keywords, answer, route, perm, flag, isPublic }`. Isi awal 20-30 FAQ dari `NAV_GROUPS`, `docs/GLOSSARY.md`, dan alur nyata (poin, rapor, izin, SPP, halaqah).
- [x] Buat `retrieveKnowledge(question, filters)`: normalisasi teks, skor keyword + judul, filter akses, ambil top 4. Tanpa embedding, cukup untuk <100 entri.
- [x] Buat `src/shared/lib/aiContext.ts`: `buildChatContext({ role, flags, can, knowledge })` yang memfilter menu berdasarkan role, permission, dan flag.
- [x] Kirim ringkasan menu yang tersedia + panduan relevan ke server. Jawaban menyebut route konkret, misalnya "Buka **Poin & Disiplin** (`/discipline`)".
- [x] Tampilkan chip **Sumber** di bawah jawaban dari entri knowledge yang dipakai. Klik chip menutup drawer dan pindah route; halaman publik dibuka di tab baru.
- [x] Guardrail: jika tidak ada di knowledge, jawab "belum ada di panduan" dan arahkan ke menu; dilarang mengarang.
- [x] Buat `docs/AI-EVAL.md` berisi 20 pertanyaan, termasuk jebakan (nama guru, nomor HP, nilai santri).
- [ ] Uji manual 20 pertanyaan di `localhost:5174` sebagai admin dan guru sebelum rilis.

**Kriteria selesai**: 10 FAQ menjawab dengan menu/route benar; role guru tidak disarankan membuka menu admin; pertanyaan di luar konteks dijawab dengan arahan menu, bukan karangan.

## 9. P2: Kecepatan non-streaming
- [x] Cache jawaban FAQ sukses di `sessionStorage` (`ai:faq:v1`, TTL 24 jam, kunci pertanyaan ternormalisasi, scope role). Klik saran kedua kali instan.
- [x] Model routing: 20b untuk chat, 120b hanya untuk generasi panjang.
- [x] Jangan kirim greeting ke history.
- [ ] Ringkas prompt dan history panjang.
- [x] Catat `latency_ms` dan `tokens_est` di console DEV (tanpa isi percakapan).
- [ ] Opsional: ringkas history lama menjadi satu kalimat jika percakapan panjang.

**Kriteria selesai**: jawaban saran kedua instan; p50 latency chat turun dibanding baseline; tidak ada regresi pada modul non-streaming.

## 10. P3: Streaming (setelah stabil)
- [ ] Edge meneruskan `response.body` Groq; client memakai `fetch` langsung (bukan `functions.invoke`) dan parser SSE kecil.
- [ ] Render token per token; tombol **Berhenti** saat streaming.
- [ ] Fallback otomatis ke non-streaming jika stream gagal.
- [ ] Gate dengan feature flag `ai.chat.stream` (default mati) sampai P0-P2 stabil.

**Kriteria selesai**: token pertama < 1,5 detik p50 lokal; fallback berfungsi; tidak ada kebocoran state saat drawer ditutup.

## 11. Perubahan file
```
src/shared/lib/ai.ts                 kontrak AiResult, callAi, mode, estimasi token
src/shared/lib/aiKnowledge.ts        entri FAQ + retrieveKnowledge
src/shared/lib/aiContext.ts          buildChatContext (role/flag/permission)
src/layouts/ChatAssistant.tsx        error+retry, stop, sumber, cache (streaming di P3)
supabase/functions/ai-proxy/index.ts mode, model lock, quota, timeout, CORS, SSE
supabase/functions/ai-proxy/prompts.ts  prompt kanonik per mode (opsional)
supabase/migrations/0070_ai_guardrails.sql  ai_usage + ai_consume_quota
src/shared/lib/aiKnowledge.test.ts   unit test retrieval
src/shared/lib/ai.test.ts            unit test parser SSE + mapping error
docs/AI-EVAL.md                      20 pertanyaan evaluasi
```

## 12. Migrasi kuota
```sql
create table if not exists public.ai_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  used_at timestamptz not null default now(),
  tokens_est int not null default 0
);
create index if not exists ai_usage_user_idx
  on public.ai_usage (user_id, used_at);
create index if not exists ai_usage_time_idx
  on public.ai_usage (used_at);

alter table public.ai_usage enable row level security;

create or replace function public.ai_consume_quota(
  p_tokens int,
  p_minute_limit int default 5,
  p_day_limit int default 30,
  p_minute_tokens int default 24000,
  p_day_tokens int default 180000
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return 'unauthenticated'; end if;

  delete from public.ai_usage where used_at < now() - interval '2 days';

  if (select count(*) from public.ai_usage
      where user_id = v_uid and used_at > now() - interval '1 minute')
     >= p_minute_limit then
    return 'minute';
  end if;

  if (select count(*) from public.ai_usage
      where user_id = v_uid and used_at > now() - interval '1 day')
     >= p_day_limit then
    return 'day';
  end if;

  if (select coalesce(sum(tokens_est), 0) from public.ai_usage
      where used_at > now() - interval '1 minute')
     + p_tokens > p_minute_tokens then
    return 'token_minute';
  end if;

  if (select coalesce(sum(tokens_est), 0) from public.ai_usage
      where used_at > now() - interval '1 day')
     + p_tokens > p_day_tokens then
    return 'token_day';
  end if;

  insert into public.ai_usage (user_id, tokens_est) values (v_uid, p_tokens);
  return 'ok';
end;
$$;

revoke execute on function public.ai_consume_quota(int, int, int, int, int)
  from public, anon;
grant execute on function public.ai_consume_quota(int, int, int, int, int)
  to authenticated;
```
Env default: `AI_MINUTE_LIMIT=5`, `AI_DAY_LIMIT=30`, `AI_MINUTE_TOKENS=24000`, `AI_DAY_TOKENS=180000`. Batas token lebih longgar agar satu generasi CBT (hingga 8.192 token output) tidak langsung ditolak. Jika staf aktif sedikit, naikkan permintaan ke 10/50. Jika pemakaian tinggi, pertimbangkan upgrade Groq.

## 13. Deploy
1. Jalankan `0070_ai_guardrails.sql` di SQL Editor.
2. `supabase functions deploy ai-proxy`.
3. Deploy frontend.
4. Verifikasi manual di `http://localhost:5174`.

## 14. Testing
- `npm run lint`
- `npm run build` (termasuk `tsc -b`)
- `npm test` untuk retrieval, estimasi token, dan parser SSE.
- Uji manual: login sebagai guru dan admin, tanya 5 FAQ + 3 pertanyaan jebakan.
- Uji kuota: 6 permintaan cepat harus ditolak dengan pesan yang jelas.
- Uji offline: muncul error + retry, bukan jawaban palsu.

## 15. Risiko dan rollback
| Risiko | Mitigasi |
|---|---|
| Model Groq berubah/tidak tersedia | Konstanta model di satu tempat; fallback ke model allowlist lain |
| 429 free tier | Batas token, history pendek, kuota per user |
| Prompt injection lewat context | Tag data + guardrail server + tanpa akses DB/tool |
| `callAi` lama rusak | Pertahankan `callAi`; tambah `AiResult` terpisah |
| Tabel `ai_usage` membengkak | Hapus baris > 2 hari setiap pemanggilan RPC |
| Streaming bermasalah | Gate feature flag, fallback non-streaming |

## 16. Estimasi
- P0: 4-6 jam (termasuk migrasi + deploy).
- P1: 4-6 jam.
- P2: 2-4 jam.
- P3: 3-5 jam.
- Total: sekitar 2 hari kerja.
