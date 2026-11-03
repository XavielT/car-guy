# Original notes — IMP 03112026 (verbatim, unedited) + answers

Xaviel's message, 2026-11-03 (his words, typos kept so you can check the package against them):

> nuevo round de improvements, ya sabes que hacer con las notas:
> first of all lets include and use the api keys, tokens and things that sgc and csd app use, as for example the anthropic api key, the google maps key, etc. in order to make this app more strong and better. then i want to include ai into this app to, but not a simple chat bot, i dont want that, i want to include the ai into the real workflows of the system, so study the workflows, features, modules, and so on that the system have. u can ask me questions in order to let u know more information and take important decitions. remember the paths of the sgc and csd app. i attached them into this chat. i want to open this project on my laptop too, so if it doesnt have a website lets create it based on the actual app or pwa.

## Notes split into items (IDs continue the Car Guy sequence: this cycle uses `P1…`)

| ID | Note (as understood) |
|----|----------------------|
| P1 | Include and **use** the API keys, tokens and "things" that SGC and CSD App use (Anthropic key, Google Maps key, "etc.") in Car Guy, to make it stronger and better |
| P1a | The "etc.": every other credential/token SGC and CSD App hold must be looked at and judged — reuse what is safe and useful, say why for what is not |
| P2 | Put AI in Car Guy, **not a simple chatbot**: AI inside the app's real workflows |
| P2a | Study the workflows, features, modules and so on that Car Guy has (and learn from how SGC already does AI) before deciding where AI goes |
| P2b | Ask questions to take important decisions (done — answers below) |
| P3 | Remember the paths of SGC and CSD App (`C:\dev\SGC`, `C:\dev2\csd-app`) — attached folders; used as reference, **read-only** for this cycle |
| P4 | Open the project on the laptop too |
| P4a | If it has no website, create one based on the actual app or PWA (it **does** have one — Expo web + PWA on Vercel — so P4 becomes a desktop-grade experience of that web) |

## Answers to my questions (2026-11-03)

1. **Keys**: "Reusar las de Constructora SD" — reuse the company's Anthropic and Google Maps keys. (My recommendation was separate keys; his call stands. See BRIEF → "Honest notes" for what I did to make that safe.)
2. **Where AI runs**: Edge Functions in `x-core` (the SGC pattern: user JWT, per-user rate limit, usage table, server-side consent).
3. **Where AI goes**: photo/voice capture · vehicle documents · OBD diagnosis and repairs · prediction and alerts · "any other place where it can be applied and improves the workflows" (→ SPEC-G, found by studying the app).
4. **Laptop**: desktop layout (side navigation, wide screens, keyboard, drag-and-drop) — not just "works".
5. **Reply language**: same as he writes (English in this message).

## Rules inherited from his saved preferences (apply to every prompt)
- Every note appears in the prompts; nothing is dropped.
- No item waits on a pending decision: apply the recommended default, record it in `04-tracking/PROGRESS.md` → "Decisions taken", keep going.
- He will check the prompts against these notes → see `COBERTURA-NOTAS.md`.


---
# Round 2 — same day, 2026-11-03 (verbatim) + answers

> la app actualmente se le dificulta registrar cuando yo inicio un viaje, usualmente si no lo hago yo manualmente, no lo registra, arreglemos y mejoremos eso. igualmente siento que el registro de la velocidad no es tan certero como deberia ser. debe crear monthly and yearly recaps. deberia ser mas facil y entendible de usar tambien, si al usuario se le aborda con mucho contenido en pantalla se pierde, yo mismo a veces intento usarla y no se por donde empezar o donde encontrar o hacer algo en especifico, trabajemos eso. igualmente con el registro de combustible, con yo pasarle una foto de mi tablero y una foto del recibo el deberia de poder leer eso con ia y llenar los fields necesarios del form y yo solo tener que darle a confirmar y ya.

| ID | Note (as understood) |
|----|----------------------|
| P5 | Trips are hard to register when he starts driving; if he doesn't start manually it usually doesn't record — fix and improve |
| P5a | Answer: it **never starts** on its own, and it **only works with the app open** |
| P5b | Answer: phones = **both** (Redmi APK and iPhone PWA) |
| P6 | Speed recording is not as accurate as it should be |
| P6a | Answer: it fails in the **live needle**, the **trip's top speed**, **average speed / distance**, and **the route map** |
| P6b | New note (in the same answer): the **heat line of the routes he usually takes is too thick** — make it thinner and stylised |
| P7 | Create **monthly and yearly recaps** — answer: swipeable stories + a shareable image |
| P8 | Easier and more understandable to use: too much content overwhelms; he himself doesn't know where to start or where to find/do something specific |
| P9 | Fuel logging: give it a **photo of the dashboard and a photo of the receipt**, AI reads them, fills the form fields, he only taps **Confirm** |
