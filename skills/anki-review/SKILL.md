---
name: anki-review
description: Quiz the user on their scheduled flashcards (spaced repetition) through the anki-cloud MCP tools, including cards with images, SVG diagrams and audio. Use when the user wants to review, study, revise, practice, or be tested on their due cards or a deck. Paraphrases each question so it can't be answered from visual memory of the card (without leaking the answer), proposes a grade, and records it only after the user confirms it in an interactive multiple-choice prompt.
---

# Spaced-repetition review

You run a study session over the user's *scheduled* cards. You are the examiner: the goal is
to test real understanding, not recognition of how a card looks.

Tools (from the anki-cloud MCP server): `list_decks`, `get_review_counts`, `get_due_cards`, `answer_card`, plus the media tools `get_media`, `get_media_info`, `list_media` (see "Media cards").

## Hard rules

1. **Never show a card's `question` or `answer` text before the user has attempted it.**
   After the attempt, show the original card only in debug mode or when the user asks (see step 3).
2. **Never call `answer_card` until the user has confirmed a grade** (see "Confirm the grade").
3. One card at a time. Keep every message short; no JSON, IDs or tool chatter in the chat.
4. Fetch at most 5 cards per `get_due_cards` call. Never dump the queue.

## Modes

- **Normal** (default): after the user answers, give feedback and a suggested grade, but do
  **not** print the original card. Offer to show it.
- **Debug**: only when the user explicitly asks to start the session in debug mode (e.g. "review
  my Rust deck in debug mode"). After every attempt, also print the original `question` and
  `answer` so the user can check that your paraphrase tested the same fact. Say once at the
  start that debug mode is on. Never switch to debug mode on your own.

## Language

Three languages are in play. Keep them apart:

1. **Question language**: the language of the card's *question side*. Ask the question in it.
2. **Answer language**: the language of the card's *answer side*. Expect the user's answer in it
   (for translation cards say so in a few words, e.g. "Answer in Chinese.").
3. **Conversation language**: the language the user writes to you in. Use it for your verdict,
   the suggested grade, the grade prompt and everything else outside the question itself. A
   learner must not get explanations in the language they are still learning. An explicit
   request ("review in English", "explain in Polish") overrides this.

Detect languages from the question and answer text itself. Do not rely on deck names or tags.
Use them only as a tie-breaker when the text is ambiguous (code, numbers, one loanword, mixed
language), e.g. a deck "English – Chinese" or a `lang:` tag. If still unclear, use the
conversation language. Pinyin or romanisation next to characters counts as that language. For a
mixed-language sentence, the language of the sentence itself is the question language.

Two kinds of card:

- **Knowledge card** (same language on both sides): paraphrase as described below, in that
  language.
- **Translation / vocabulary card** (different languages, typically a word or short phrase):
  do not invent a scenario. Ask in the question language, near-verbatim, and you may add **one
  short example sentence** in the question language that uses the word, like a cloze context:
  the sentence contains the question-side word (highlight it in bold) and you ask for its
  translation. Rules for the sentence:
  - It is in the question language only. Never include the answer-language word or any
    translation of the sentence.
  - It is neutral: it must not explain or define the word, and must not make the meaning
    obvious through glosses or synonyms. A card that is ambiguous stays ambiguous.
  - Skip the sentence if the card is a full phrase or sentence already.
  - The leak check below applies to it in full.

## Start

1. Find the deck: use `list_decks`; if the user named one, match it by name, otherwise ask which.
2. Call `get_review_counts` and tell the user in one line what's due
   (e.g. "Rust: 12 review, 3 learning, 5 new"). Ask nothing else; start.
3. Call `get_due_cards` (limit 5).

## For each card

### 1. Ask a paraphrased question

Rewrite the card's `question` so the user must recall the knowledge, not pattern-match the
wording or layout they've seen many times. Pick whatever fits the card:

- reword it completely (different vocabulary and sentence structure),
- put it in a small concrete scenario ("You're debugging X and see Y, what's happening?"),
- ask from the other direction ("why" instead of "what", "when would you use" instead of "define"),
- for code: change names/values but keep the concept.

Constraints: the paraphrase must test **exactly the same fact** as the card, must not contain
or hint at the answer, and must not reuse distinctive phrases from the original. Do not make
it harder than the card (no extra knowledge required), and **never easier either**: a
paraphrase must not carry more information than the card does.

**Leak check (do this silently before every question).** Paraphrasing is where mistakes happen:
rewording tends to add helpful context, and helpful context gives the answer away. Before
sending, work out the answer, then verify the paraphrase:

1. It does not contain the answer, any word sharing its stem, or a translation of it.
2. It does not contain the answer's *defining neighbours*: the words you would use to explain
   the answer, or the words that usually appear next to it. Example: a card whose answer is
   "frontmatter" must not be paraphrased with "metadata", "YAML", "Markdown" or "document
   header", because those practically spell it out.
3. It adds no clue the original card lacks. If the card is vague, the paraphrase stays equally
   vague. Do not "improve" a vague card by making it more specific.
4. Someone who does not know the fact could not deduce the answer from your wording alone.

If a paraphrase cannot pass this check, which is common for short term-to-definition cards
(the card gives a description, the answer is a term, or the reverse), don't paraphrase: ask the
original card's question almost verbatim, with only trivial rewording. Recalling the card as
written is better than a leaky test.

Cloze cards (the question contains `[...]` or a blank): don't present a fill-in-the-blank.
Turn the missing part into a direct question about it.

Card state `new`: the user has never seen it. First show the card (question and answer) as a
short lesson, then ask a paraphrased question about it, and grade that. For a new card with
media, show both the question-side and the answer-side media in the lesson.

**Media cards.** `get_due_cards` returns plain text, so a card with media shows only a filename
appended to the question or answer (e.g. `... diagram.svg`, `... photo.png`,
`[sound:clip.mp3]`). Never skip such a card just because only a filename appears: fetch the
file with `get_media`, show it to the user, then ask the question. Use `get_media_info` first if
you only need type, size or pixel dimensions (it does not download). Handle each type like this:

- **SVG**: `get_media` returns the SVG source as text. Render it inline for the user with the
  visualizer (`show_widget`): wrap it as a nested `<svg>` inside a 680-wide wrapper
  (`<svg width="100%" viewBox="0 0 680 H" role="img"><title/><desc/><svg x=... width=... viewBox=...>...</svg></svg>`),
  keeping the original width/height/viewBox. ALWAYS keep or add a solid white background `<rect>`
  behind the drawing: many SVGs have dark text on a transparent background and become unreadable
  in dark mode otherwise. Use a neutral `<desc>`; it must not name the answer. Read the source,
  not just the picture: `<title>`, `<desc>`, comments, `id`/`class` names and `aria-label` can
  contain the answer, so remove them when you render it.
- **PNG / JPG / GIF / WEBP**: `get_media` returns the image to you and prints an
  `[Image source: /tmp/...]` path. Send that path to the user with `SendUserFile`
  (`display: render`, `status: normal`). Never say "above" or "below". If the user asks to see it
  again, just send it again.
- **Audio (mp3, ogg, wav, m4a)**: `get_media` saves the file to a path and you cannot listen to it.
  Send it with `SendUserFile` (`display: attach`) so the user can play it. `get_media` downloads
  the whole file (up to 10 MB), so call it only when the card really has a clip. You may run
  `ffprobe` for duration or format, but you cannot judge or describe the sound. Grade the user's
  answer against the card's answer text only, and say so if the user asks you what the clip
  contains. You cannot verify what a clip says, so never paraphrase around it: if the question
  side is only a clip, ask the card's question near-verbatim, or with no text ask for what the
  answer side expects ("Listen and answer in <language>"). Never claim what the audio contains.

Rules for media cards:

1. Show the question-side media first, then ask the paraphrased question in the same or next
   message. Say "the image/diagram/clip" in the question without describing what it depicts,
   and never name the file: file names often give the answer away (`mars.svg`). Check the name
   as part of the leak check; if it gives the answer away, still show the file but never
   mention its name.
2. Leak check applies to the media itself: look at what you fetched. If the image or SVG
   contains the answer (a label, a caption, a visible value), do not paraphrase around it: show
   the card as written or skip it. Also never describe the picture in your question.
3. Never fetch or show answer-side media before the user has attempted the card. After the
   attempt, show it only if it helps feedback or the user asks (this includes `c`, which shows
   answer-side media only once the user has attempted the card).
4. If the user says they cannot see the image (e.g. dark mode, too small), fix the rendering
   (add the white background, enlarge) and re-show it before grading; don't penalise them.
5. Don't create, upload or delete media during a review session. Adding images and audio to
   cards is a separate task (`add_svg_media`, `request_media_upload`, `create_note`) and only
   on the user's explicit request.

Only if the media cannot be fetched or shown at all (fetch fails, unsupported type), say so,
skip it, and leave it unanswered (do not call `answer_card`). Cases:

- `get_media` says the file is not found: the card references a file that isn't in the user's
  collection. Tell them the card is broken (not their answer) and offer to continue.
- `show_widget` or `SendUserFile` is unavailable, or `get_media` prints no file path: say you
  can't display this media here and move on to the next card.

### 2. Wait for the user's answer

Do not hint, do not reveal anything. If they ask for a hint, give a small nudge and note that
the grade should then be at most Hard. "I don't know" is a valid answer: grade Again.

### 3. Give feedback and propose a grade

Show, compactly:
- a one-or-two-line verdict in your own words: what the user got right and what was missing or wrong
  (do not quote the card verbatim and do not paste its `answer`),
- your suggested grade with a one-line reason, as its own line in plain chat text, e.g.
  `Suggested: **Good**, correct core idea, missed the edge case.`

This feedback is a normal chat message that you write **before** calling the question tool. It
is mandatory: never fold the verdict or suggestion into the tool call only, and never ask for
the grade without having shown them first.

Debug mode only: additionally print the original card, labelled `[debug]`:
the original `question` and the card's `answer`.

Normal mode: mention that `c` under "Other" shows the original card. Then ask for the grade (step 4).

Grade the user's recall against the **original card**, not against your paraphrase. If you
notice after the fact that your question gave away part of the answer (or was easier than the
card), say so in one line, never suggest Easy for that card, and cap the suggestion at Good.
Do not use this as a reason to skip the card: the user already answered.

Grading guide (be fair but strict on technical accuracy):

| Grade | When |
|---|---|
| **1 Again** | Wrong, blank, or missed the key point. |
| **2 Hard** | Essentially right but incomplete, hesitant, needed a hint, or one notable error. |
| **3 Good** | Correct core idea; at most minor omissions. The default for a correct answer. |
| **4 Easy** | Complete, precise and effortless; the card is too easy for them. Use sparingly. |

### 4. Confirm the grade

Ask for the grade with your **interactive question tool** (in Claude Code / Claude Desktop:
`AskUserQuestion`, a clickable multiple-choice prompt), not with a typed list. Rules:

- One single-select question. Put the suggestion in the question text itself, because the
  prompt UI can hide the chat message above it: `Grade for this card? (suggested: Good)`.
- One option per grade the scheduler offers for this card: build them from the keys present in
  `nextIntervals` (`again`, `hard`, `good`, `easy`). Anki offers 4; if a card ever returns
  fewer or more, show exactly those, never invent a grade.
- **Fixed order, same as the Anki app**: Again, Hard, Good, Easy. Never reorder to put your
  suggestion first.
- Option label: grade name and interval only, e.g. `Good (3d)`. The prompt already numbers the
  options, so do not write the number yourself. Mark your suggestion by appending
  ` ← suggested` to its label and put the one-line reason in its description.
- If the tool allows fewer options than the card has grades, drop the least useful one rather
  than splitting the question.
- The tool's built-in "Other" free-text field covers everything else. Tell the user once at
  the start of the session: "Pick a grade; or type `c` (show card), `s` (skip), `q` (quit)
  under Other."

Interpreting the reply:

- A grade option: record exactly that grade.
- A bare `1`-`4` typed under Other: the grade at that position in the fixed order
  (1 Again, 2 Hard, 3 Good, 4 Easy). The user's choice always wins over your suggestion or cap
  (e.g. Easy after you capped at Good): record exactly what they chose.
- `c` (via Other): show the original card (question and answer), then ask the question again.
  Does not record anything.
- `s`: skip this card (record nothing), `q`: end the session.
- Any other text is a comment or disagreement: discuss briefly, then ask again.

If no interactive question tool is available (or the user ignores it and types), fall back to
plain text: show `1 Again (10m) · 2 Hard (1d) · **3 Good (3d)** ← suggested · 4 Easy (7d)` and
accept `1`-`4`, `y`/`ok`/`.` (accept the suggestion), `c`, `s`, `q`.

Only after the user has chosen call `answer_card` with the confirmed rating, and say nothing
more than the interval it returned (e.g. "Good → back in 3d"), then move straight to the
next card.

## Continue and finish

When the batch is used up, call `get_due_cards` again for the next 5 (answered cards are gone
from the queue; cards you're relearning may come back after a few minutes). When nothing is
due, or the user ends the session, give a short summary: cards reviewed, grade breakdown, the
topics they struggled with, and what is still due (`get_review_counts`).
