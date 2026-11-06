# أرشيف الصور — دليل التشغيل والنشر (Image Archive)

موقع مجاني لرفع الصور والبحث فيها (بنص داخل الصورة أو بوصف لها) مع مساعد ذكي يرتب الصور. كل الخدمات في الطبقات المجانية.

## تجربة سريعة بدون أي حساب (وضع تجريبي)
افتح الملف `demo.html` بنقرتين في المتصفح (Chrome أو Edge). كل شيء يعمل داخل متصفحك: الرفع والمجلدات والسلة والبحث. الصور تُحفظ في متصفحك فقط، والمساعد الذكي غير متاح فيه. أول رفع يحتاج إنترنت لتنزيل نموذجي OCR وCLIP. لإعادة بناء الملف: `npm run build:demo`.

## ١. إنشاء مشروع Supabase (مجاني)
1. أنشئ حساباً على supabase.com ثم مشروعاً جديداً.
2. من **SQL Editor** الصق محتوى `supabase/schema.sql` ثم شغّله.
3. من **Authentication → Providers** تأكد أن Email مفعّل. (اختياري: عطّل التسجيل العام بعد إنشاء حسابات أصدقائك.)
4. من **Settings → API** انسخ `Project URL` و `anon public key`.
5. ستضعهما في متغيّرات GitHub (الخطوة ٤) أو في ملف `.env` محلي (انسخ `.env.example`). المفتاح العام آمن؛ الخصوصية تحميها قواعد RLS.

## ٢. التحقق من الخصوصية (مرة واحدة)
أنشئ حسابين تجريبيين، ثم غيّر المعرّفين في `supabase/rls-check.sql` وشغّله. النتيجة المتوقعة: العدّادان 0.

## ٣. المساعد الذكي (Gemini المجاني)
1. احصل على مفتاح مجاني من aistudio.google.com.
2. ثبّت Supabase CLI ثم:
   ```
   supabase login
   supabase link --project-ref <معرّف مشروعك>
   supabase secrets set GEMINI_API_KEY=<المفتاح> ALLOWED_ORIGIN=https://<اسمك>.github.io
   supabase functions deploy agent
   ```

## ٤. النشر على GitHub Pages (مجاني)
1. أنشئ مستودعاً **عاماً** على GitHub وارفع محتويات هذا المجلد (بدون `node_modules`).
2. في المستودع: **Settings → Secrets and variables → Actions → Variables** أضف متغيّرين: `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` (قيمهما من الخطوة ١).
3. **Settings → Pages**: اجعل المصدر **GitHub Actions**.
4. ادفع إلى فرع `main`: تُشغَّل الاختبارات ثم يُبنى الموقع وينشر على `https://<اسمك>.github.io/<المستودع>/`.
5. ارجع إلى الخطوة ٣ واجعل `ALLOWED_ORIGIN=https://<اسمك>.github.io` وأعد نشر الدالة. وفي Supabase من **Authentication → URL Configuration** ضع رابط موقعك في Site URL.

*(بديل اختياري: Vercel، فالمشروع يحتوي `vercel.json`؛ أضف المتغيّرين نفسيهما في Environment Variables هناك.)*

## التشغيل محلياً
```
npm install
npm test
npm run dev
```

## حدود المجاني
- تخزين Supabase حوالي 1 جيجا: الصور تُصغَّر عند الرفع (~300–500KB).
- المشروع المجاني يتوقف بعد أسبوع بلا استخدام؛ يُعاد تشغيله من لوحة Supabase بنقرة.
- حصة Gemini المجانية محدودة: عند استهلاكها تظهر رسالة ويعمل الباقي.
- أول بحث أو رفع يحمّل نموذجي OCR وCLIP (عشرات الميجابايت) ثم يُخزَّنان في المتصفح.

---
## English summary
Free static site (GitHub Pages) + Supabase (auth, Postgres/pgvector, storage, one Edge Function) + Gemini free tier.
Steps: create a Supabase project → run `supabase/schema.sql` → put URL/anon key in `src/config.ts` → deploy the `agent` function with `GEMINI_API_KEY` → push to a public GitHub repo and enable Pages (GitHub Actions).
