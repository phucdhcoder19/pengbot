# Demo site — Cloudpine Coffee Roasters

`index.html` is a mock website for a coffee shop. It is written in English and
deliberately **never mentions Pengbot**: the audience sees an ordinary website,
then watches the shop owner paste in one snippet to get a chatbot.

Where to paste: the **Admin** link in the footer opens a **Custom code** box,
mimicking the script-injection settings of Wix / WordPress / Shopify. The page
only accepts the widget's script tag (it reads `src` + `data-key`) and never
executes arbitrary code.

## Run

```bash
npx serve demo
```

Deploy: Vercel → new project, Root Directory = `demo`, Framework = Other.

## Demo script

1. Dashboard → sign up.
2. **Documents** → upload [`cloudpine-faq.md`](cloudpine-faq.md), wait for **READY**.
3. **Settings** → set the widget title and greeting → copy the `<script>` snippet.
4. Coffee site → **Admin** (footer) → paste → **Save & publish**.
5. Open the chat bubble and ask questions.
6. Back to the dashboard → **Conversations** / **Overview**.

Share a link with the widget pre-installed: `https://<demo-site>/?key=pk_...`
(add `&api=http://localhost:3000` when running the backend locally).

> If Settings has `allowedDomains` configured, add the demo site's domain there,
> otherwise the Admin box reports "This domain is not on the allowed list".
