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


   ## S2 — Re-ranking (top-20 → LLM picks top-5)

| Q | Before (hybrid top 5) | After (rerank) | Verdict |
|---|---|---|---|
| F1 Is it free? | correct | same, 3 chunks | no change (both pass) |
| F2 Free plan limits | 1 fact (10 MB) | 1 fact | no change — answer prompt only lists "cannot" sentences |
| F3 Hindi refund | Team + duplicate only | Plus monthly/yearly + Team + duplicate + cancel | FIXED — chunk 7 moved to [1] |
| F5 billing | no refund rules (chunks 7, 8 missing) | all refund rules; lost taxes + renewal (chunk 5 dropped) | partly better |
| F6 typo refund | correct, to the point | added Team rule not asked for | slightly worse |

- Rerank latency: 4.8–9.2 s per question (extra nano call).
- Rerank helps when the right chunk is in the top 20 but ranked low (F3, F5).
- It can't fix answer-prompt problems (F2, F6). Broad questions may need more than 5 chunks even after reranking.
- One run per question; answers vary between runs.

## S3 — Query rewriting (LLM turns the question into 1–3 clean search queries)

| Q | Rewrite did | Result |
|---|---|---|
| 2-part: edit sharing + support speed | split into 2 ✅ | correct — but plain hybrid was already correct |
| F2 Free plan limits | no split | still 1–2 facts; sharing (#10) + support (#15) WERE retrieved → writer problem → S5 |
| F3 Hindi | translated ✅ | still missing Plus refunds (needs rerank, S2) |
| F6 typo | fixed spelling ✅ | correct |
| F1 Is it free? | made specific ✅ | correct, thinner |

Cost/time of the rewrite step:
| setting | time | out tokens | cost/question |
|---|---|---|---|
| default thinking | ~4.7 s | ~438 | $0.00018 |
| reasoning_effort minimal | ~1.7 s | ~22 | $0.00002 |

- Rewrite cleans words well (typos, language, vagueness) but can only split VISIBLE multi-part questions.
- >90% of the default cost was hidden thinking; minimal is 10× cheaper but ignored a complex rule.
- Writer bug: lists facts then appends "I don't know based on the documents." → S5.

## S4 — Chat UI + streaming

| Writer setting | refund | billing | Hindi | France (guard) |
|---|---|---|---|---|
| default | 10.5 s ✅ | 18.6 s ✅ 12 facts | 11.6 s ✅ | — |
| minimal | 3.7 s ✅ | 2.6 s ❌ "I don't know" | 2.9 s ⚠️ sloppy | 2.1 s ✅ refused |
| low (chosen) | 4.2 s ✅ | 6.0 s ✅ 9 facts | 4.0 s ✅ | 2.2 s ✅ refused |

- With default thinking, 90%+ of the wait was hidden thinking; writing took only 0.2–1.5 s.
- Streaming helps most with long answers; nano writes short answers so fast they appear almost at once.
- Too little thinking broke a judgement call (billing refused). Keep a guard question in every speed test.
- Measuring mistake: the browser only gets a response at the first piece, so search time must be logged on the server.