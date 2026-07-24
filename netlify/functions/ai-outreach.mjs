import { json, requireUser } from './_supabase.mjs'

const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim()
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || 'gpt-5.4-mini').trim()
const languageNames = { uk: 'українською', pl: 'польською', en: 'англійською' }
const toneNames = { friendly: 'людяний, природний і доброзичливий', direct: 'прямий, короткий і діловий', expert: 'експертний, конкретний і впевнений без зверхності', soft: 'м’який, ненав’язливий і спокійний' }
function clean(value, max = 1200) { return String(value || '').trim().slice(0, max) }
function extractOutputText(data) { if (typeof data?.output_text === 'string') return data.output_text; const parts=[]; for (const item of data?.output || []) for (const content of item?.content || []) if (typeof content?.text === 'string') parts.push(content.text); return parts.join('\n') }
function parseJsonText(text) { return JSON.parse(String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()) }
export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    await requireUser(request)
    if (!OPENAI_API_KEY) return json({ error: 'OPENAI_API_KEY не налаштований у Netlify.' }, 503)
    const body = await request.json().catch(() => ({}))
    const form = { service: clean(body.service,300), audience: clean(body.audience,300), problem: clean(body.problem), result: clean(body.result,500), offer: clean(body.offer,500), cta: clean(body.cta,400), proof: clean(body.proof,500), language: ['uk','pl','en'].includes(body.language)?body.language:'uk', tone: ['friendly','direct','expert','soft'].includes(body.tone)?body.tone:'friendly' }
    if (['service','audience','problem','result','offer','cta'].some((key)=>!form[key])) return json({ error: 'Заповніть усі обов’язкові поля конструктора.' }, 400)
    const prompt = `Ти — senior B2B outreach-маркетолог із 10+ роками досвіду.
Створи персоналізований пакет холодного B2B-звернення ${languageNames[form.language]}.
Стиль: ${toneNames[form.tone]}.

Вхідні дані:
- Послуга або продукт: ${form.service}
- Цільова аудиторія: ${form.audience}
- Типова проблема: ${form.problem}
- Бажаний результат: ${form.result}
- Перший офер: ${form.offer}
- Доказ довіри: ${form.proof || 'не вказано'}
- Заклик або запитання: ${form.cta}

Правила:
1. Не вигадуй фактів, цифр, клієнтів, кейсів або гарантій.
2. Не використовуй клікбейт, тиск, фальшиву терміновість чи надмірні компліменти.
3. Основне повідомлення має бути коротким, природним і придатним для Email, Facebook, Instagram, WhatsApp або Telegram.
4. Коротке повідомлення має підходити для SMS або дуже короткого direct.
5. Покажи релевантність, проблему, результат, офер і простий наступний крок.
6. Тема листа — чесна, без великих літер і рекламного спаму.
7. Поверни ТІЛЬКИ валідний JSON без markdown:
{"subject":"...","main":"...","short":"..."}`
    const response = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{ Authorization:`Bearer ${OPENAI_API_KEY}`, 'Content-Type':'application/json' }, body:JSON.stringify({ model:OPENAI_MODEL, input:prompt, max_output_tokens:700 }) })
    const data = await response.json().catch(()=>({}))
    if (!response.ok) { console.error('OpenAI API error:', data?.error?.message || response.status); return json({ error:'AI тимчасово не зміг створити звернення. Перевірте API-баланс або спробуйте пізніше.' }, response.status===429?429:502) }
    const parsed = parseJsonText(extractOutputText(data))
    const pack = { subject:clean(parsed.subject,300), main:clean(parsed.main,2200), short:clean(parsed.short,900) }
    if (Object.values(pack).some((value)=>!value)) throw new Error('AI повернув неповну відповідь.')
    return json({ pack, model:OPENAI_MODEL })
  } catch (error) { console.error('AI outreach error:', error); return json({ error:error?.message || 'Не вдалося створити AI-звернення.' }, error?.status || 500) }
}
