## S6 — Failure hunt

22 questions run with --debug. 16 passed (incl. date reasoning, arithmetic,
inference, and refusing to invent facts). 6 failures below.

##QUESTIONS/PROMPT

npm run ask -- "I paid for yearly Plus 20 days ago, can I get my money back?" --debug && npm run ask -- "My Team admin cancelled 2 months after paying yearly, how much refund do we get?" --debug && npm run ask -- "How long until a deleted account's notes are gone forever?" --debug && npm run ask -- "What is the max attachment size on Plus?" --debug && npm run ask -- "Is SSO available on the Plus plan?" --debug && npm run ask -- "How much does Team cost per year for 25 members, and can we pay by bank transfer?" --debug && npm run ask -- "What's the difference between Plus and Team?" --debug && npm run ask -- "Tell me everything about billing" --debug && npm run ask -- "Who becomes admin if the person who pays leaves the company?" --debug && npm run ask -- "Can I share a note so others can edit it on the Free plan?" --debug


### F1 — "Is it free?"
Expected: There's a Free plan; Plus and Team are paid.
Got: "I don't know based on the documents."
Retrieved: yes, the plans chunk was [1]
Category: prompt ignored context (too strict)
Hypothesis: "it" is vague, and the all-or-nothing "I don't know" rule makes the model refuse instead of answering with what it has.

### F2 — "What can't I do on the Free plan?"
Expected: 100-note limit, 1 GB, 2 devices, no attachments over 10 MB, view-only sharing, no version history, 3-day support.
Got: only "no attachments over 10 MB".
Retrieved: partly. Limits chunk yes; Sharing and Support sections no.
Category: bad retrieval + prompt
Hypothesis: facts are spread over 3 sections but we fetch only 5 chunks; and the model only listed the one sentence that literally says "cannot".

### F3 — "क्या मुझे रिफंड मिल सकता है?" (Hindi: can I get a refund?)
Expected: the refund rules for all plans.
Got: Team refund rules only, in mixed Hindi/English.
Retrieved: no. All scores ~0.11; the yearly-Plus refund chunk was missing.
Category: bad retrieval
Hypothesis: a Hindi question lands far from English chunks on the meaning map, so the scores collapse and the top 5 is close to random.

### F4 — "My Team admin cancelled 2 months after paying yearly, how much refund?"
Expected: "The docs only describe refunds within 30 days; 2 months is outside that, and the docs don't say what happens then."
Got: "I don't know based on the documents."
Retrieved: yes, the Team refund chunk was [1] (0.72)
Category: prompt ignored context (too strict)
Hypothesis: the rule has no "partial answer" option, so the model can't say what the docs DO cover.

### F5 — "Tell me everything about billing"
Expected: payment methods, taxes, renewal, failed payments, cancelling, AND refunds for every plan.
Got: good list, but the monthly/yearly Plus refund rules were missing.
Retrieved: no. Chunk 7 (Plus refunds) wasn't in the top 5.
Category: bad retrieval (top 5 too small)
Hypothesis: a broad question needs ~8 chunks; we only fetch 5.

### F6 — "refnd polcy for yrly plus" (minor)
Expected: yearly Plus refund rule only.
Got: correct rule, plus Team refunds and double-charge rules nobody asked for.
Retrieved: yes
Category: prompt (over-answering)
Hypothesis: nothing in the prompt says "answer only what was asked".

### Finding: no chunking failures
Overlap (500/100) didn't chop a single fact across 22 questions.

## Top 3 causes
1. **The "I don't know" rule is all-or-nothing** (F1, F4). The rule that stops
   made-up answers also blocks partial and fuzzy answers. The model can't say
   "the docs cover X but not Y".
   Fix later: allow partial answers in the prompt; rewrite vague questions first.
2. **Broad and list questions need more than 5 chunks** (F2, F5). The facts sit
   in several sections, and top 5 can't hold them all.
   Fix later: fetch more chunks (top 10–20), then re-rank and keep the best.
3. **The question's wording is far from the document's wording** (F3, and partly F1).
   A different language or vague words land far away on the meaning map, so
   retrieval brings the wrong chunks.
   Fix later: rewrite or translate the question before embedding it.