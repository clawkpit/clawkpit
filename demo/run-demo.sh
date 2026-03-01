#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 || -z "${1:-}" ]]; then
  echo "Usage: ./run-demo.sh YOUR_API_KEY"
  exit 1
fi

API_KEY="$1"
BASE_URL="${CLAWKPIT_BASE_URL:-http://localhost:5137}"
API_BASE="${BASE_URL%/}/api"

declare -A ITEM_IDS

json_escape() {
  local input="${1-}"
  input=${input//\\/\\\\}
  input=${input//\"/\\\"}
  input=${input//$'\n'/\\n}
  input=${input//$'\r'/\\r}
  input=${input//$'\t'/\\t}
  printf '%s' "$input"
}

extract_json_value() {
  local json="$1"
  local key="$2"
  printf '%s' "$json" | sed -n "s/.*\"${key}\":\"\\([^\"]*\\)\".*/\\1/p"
}

api_request() {
  local method="$1"
  local path="$2"
  local payload="${3:-}"
  local response
  local status
  local body

  if [[ -n "$payload" ]]; then
    response=$(curl -sS -X "$method" \
      -H "Authorization: Bearer ${API_KEY}" \
      -H "Content-Type: application/json" \
      -w $'\n%{http_code}' \
      "${API_BASE}${path}" \
      --data "$payload")
  else
    response=$(curl -sS -X "$method" \
      -H "Authorization: Bearer ${API_KEY}" \
      -H "Content-Type: application/json" \
      -w $'\n%{http_code}' \
      "${API_BASE}${path}")
  fi

  status="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [[ ! "$status" =~ ^2 ]]; then
    echo "Request failed: ${method} ${path} -> HTTP ${status}" >&2
    echo "$body" >&2
    exit 1
  fi

  printf '%s' "$body"
}

announce() {
  printf '[demo] %s\n' "$1"
}

require_item_id() {
  local key="$1"
  if [[ -z "${ITEM_IDS[$key]:-}" ]]; then
    echo "Failed to capture item ID for key: ${key}" >&2
    exit 1
  fi
}

sleep_step() {
  local seconds="$1"
  sleep "$seconds"
}

create_item() {
  local key="$1"
  local title="$2"
  local description="$3"
  local urgency="$4"
  local tag="$5"
  local importance="$6"
  local deadline="$7"

  local payload
  payload=$(printf '{"title":"%s","description":"%s","urgency":"%s","tag":"%s","importance":"%s","deadline":"%s"}' \
    "$(json_escape "$title")" \
    "$(json_escape "$description")" \
    "$urgency" \
    "$tag" \
    "$importance" \
    "$deadline")

  local body
  body=$(api_request POST "/v1/items" "$payload")
  ITEM_IDS["$key"]="$(extract_json_value "$body" "id")"
  require_item_id "$key"
  announce "Created item: $title"
}

create_markdown_item() {
  local key="$1"
  local title="$2"
  local markdown="$3"
  local payload
  payload=$(printf '{"title":"%s","markdown":"%s","externalId":"%s"}' \
    "$(json_escape "$title")" \
    "$(json_escape "$markdown")" \
    "$(json_escape "demo-${key}")")

  local body
  body=$(api_request POST "/agent/markdown" "$payload")
  ITEM_IDS["$key"]="$(extract_json_value "$body" "itemId")"
  require_item_id "$key"
  announce "Created markdown item: $title"
}

create_form_item() {
  local key="$1"
  local title="$2"
  local form_markdown="$3"
  local payload
  payload=$(printf '{"title":"%s","formMarkdown":"%s","externalId":"%s"}' \
    "$(json_escape "$title")" \
    "$(json_escape "$form_markdown")" \
    "$(json_escape "demo-${key}")")

  local body
  body=$(api_request POST "/agent/form" "$payload")
  ITEM_IDS["$key"]="$(extract_json_value "$body" "itemId")"
  require_item_id "$key"
  announce "Created form item: $title"
}

enrich_item() {
  local key="$1"
  local description="$2"
  local urgency="$3"
  local tag="$4"
  local importance="$5"
  local deadline="$6"
  local payload
  payload=$(printf '{"description":"%s","urgency":"%s","tag":"%s","importance":"%s","deadline":"%s"}' \
    "$(json_escape "$description")" \
    "$urgency" \
    "$tag" \
    "$importance" \
    "$deadline")
  api_request PATCH "/v1/items/${ITEM_IDS[$key]}" "$payload" >/dev/null
  announce "Enriched item details: $key"
}

update_urgency() {
  local key="$1"
  local urgency="$2"
  local payload
  payload=$(printf '{"urgency":"%s"}' "$urgency")
  api_request PATCH "/v1/items/${ITEM_IDS[$key]}" "$payload" >/dev/null
  announce "Adjusted urgency: $key -> $urgency"
}

add_note() {
  local key="$1"
  local author="$2"
  local content="$3"
  local payload
  payload=$(printf '{"author":"%s","content":"%s"}' \
    "$author" \
    "$(json_escape "$content")")
  api_request POST "/v1/items/${ITEM_IDS[$key]}/notes" "$payload" >/dev/null
  announce "Added ${author} note to: $key"
}

api_request GET "/me" >/dev/null
announce "Starting Clawkpit founder demo against ${API_BASE}"
sleep_step 4

MARKDOWN_CONTENT=$(cat <<'EOF'
# The Next Operating Model for Human and Agent Teams

Most teams still treat AI as a **faster search box**.
That framing *undersells* the shift that is already underway.
The real change is **operational, not conversational**.
Agents are becoming persistent collaborators.
Humans are becoming *editors*, *navigators*, and *exception handlers*.

## The division of work

In the near term, strong teams will *not* replace people with agents.
They will redesign **workflows** so each side handles the work it is best at.

- **Agents** can watch queues, summarize patterns, draft options, and keep state.
- **Humans** can make tradeoffs, judge credibility, and repair the plan when reality changes.

That combination is more resilient than either side working alone.

### Why solo founders feel it first

A founder rarely suffers from lack of ideas.
They suffer from **fragmented attention**.
Marketing, shipping, support, recruiting, and finance all compete at once.
An agent can continuously shape the board so the founder sees the right next move.
That is not magic—it is *disciplined operational leverage*.

## Trust and observability

The important design question is not whether an agent *sounds smart*.
It is whether the agent **improves throughput without reducing trust**.
Trust comes from:

- visible actions
- explicit notes
- reversible changes
- clean handoffs

When an agent moves a priority, the human should see *why*.
When a human adds context, the agent should react in a legible way.
This is what collaboration looks like in practice.

### Pacing matters

Humans do not make ten perfect decisions in one second.
Healthy systems should show work **unfolding over time**:

```
Agent drafts → Person edits → Agent tightens the plan
```

Priorities move as deadlines and evidence change.
The sequence matters because it mirrors real execution.

## Specialization and coordination

Over time, agents will likely *specialize*:

| Focus   | Role                    |
|---------|-------------------------|
| One     | watch customers         |
| Another | watch the roadmap       |
| Another | outreach or checkpoints |

The human coordinates across them and sets the **operating intent**.
That model looks less like `prompting` and more like *management*.

## Structured documentation

The teams that benefit most will document decisions in **structured ways**.
Forms, notes, and short briefs make the system observable.

> Observability makes automation safer. Safer automation increases adoption. Adoption creates better feedback loops.

The compound effect is substantial.

## The premium skill

**Human judgment** will remain the scarce resource.
**Agent effort** will become abundant.
That means the premium skill is not typing faster—it is *defining quality*, *sequencing work*, and *noticing what deserves escalation*.
The best products for this future will feel less like chat windows and more like **shared control rooms**.

---

That is why human and agent collaboration should be designed as a **workflow, not a feature**.
The winning systems will make priorities visible, history inspectable, and action easy to revise.
When that happens, AI stops being a novelty.
It becomes part of the operating cadence.
EOF
)

FORM_CONTENT=$(cat <<'EOF'
# Partner Lead Intake

Capture enough context for a fast founder decision without turning outreach into paperwork.

### Opportunity Snapshot [same]

## Lead name [text]
Full name of the partner or advisor driving the conversation.
- required: true
- placeholder: Maya Chen

## Company [text]
Brand or organization connected to the opportunity.
- required: true
- placeholder: GrowthStack Media

## ICP fit [select]
How closely does this audience match the ideal user for OrbitMint?
- required: true
- options: Excellent | Good | Stretch

## Channel [select]
Where would the partnership show up first?
- required: true
- options: Newsletter | Podcast | Community | Referral swap | Affiliate

### Commercial Potential [next]

## Expected ROI [textarea]
Estimate the upside in terms of signups, trials, or revenue and explain the logic.
- required: true
- placeholder: Shared webinar could drive 150 trial signups from founders already using analytics tools.

## Warm intro available [radio]
Can someone make the first introduction?
- required: true
- options: Yes | No

## Follow up date [date]
When should the next touchpoint happen?
- required: true

## Confidence score [scale]
How likely is this to turn into a meaningful channel?
- required: true
- min: 1
- max: 5

## Risks or blockers [textarea]
Capture the main caveat before spending more time.
- placeholder: Audience overlap is strong, but their sponsorship calendar is already full for April.
EOF
)

create_item "launch_plan" \
  "Tighten OrbitMint launch positioning" \
  "Draft a sharper one-line promise for OrbitMint, a playful analytics coach for indie app founders. Focus on the before-and-after outcome, then turn that into hero copy and a short founder intro for the landing page." \
  "DoToday" "ToDo" "High" "2026-03-04T15:00:00.000Z"
sleep_step 5

create_item "customer_quotes" \
  "Pull three beta customer quotes for the homepage" \
  "Review the last two weeks of support threads, isolate the most credible language about clarity and speed, and trim each quote into a one-sentence testimonial with company context." \
  "DoThisWeek" "ToDo" "High" "2026-03-06T18:00:00.000Z"
sleep_step 4

create_item "daily_brief" \
  "Prepare Monday founder brief" \
  "Assemble a concise morning brief covering MRR movement, trial-to-paid conversions, the top support risk, and the one decision that would unblock acquisition this week." \
  "DoNow" "ToDo" "High" "2026-03-02T13:30:00.000Z"
sleep_step 6

create_item "reply_affiliate" \
  "Draft reply to analytics newsletter partnership email" \
  "Write a warm response to Beacon Growth asking for audience size, recent clickthrough benchmarks, and whether they can bundle a founder case study into the sponsored slot. Tag this so it is ready to use verbatim." \
  "DoToday" "ToUse" "Medium" "2026-03-03T17:00:00.000Z"
sleep_step 5

create_item "launch_checklist" \
  "Build launch day checklist for OrbitMint v1.1" \
  "Map the sequence for product launch day: changelog post, founder tweet thread, customer email, in-app banner, metrics dashboard check, and two-hour post-launch review." \
  "DoThisWeek" "ToDo" "High" "2026-03-07T16:00:00.000Z"
sleep_step 4

create_form_item "partner_form" "Log partner leads for launch week" "$FORM_CONTENT"
enrich_item "partner_form" \
  "Use this intake form during partnership outreach so every opportunity gets the same fast evaluation before time disappears into vague follow-ups." \
  "DoThisWeek" "ToDo" "High" "2026-03-06T12:00:00.000Z"
sleep_step 7

add_note "launch_plan" "User" "I want the positioning to feel more founder-to-founder and less like generic B2B analytics. Keep the tone playful, but the promise needs to land in under ten words."
sleep_step 6

add_note "launch_plan" "AI" "Noted. I’ll bias toward concrete transformation language and keep anything abstract out of the hero. A tighter direction is: 'Your weekly growth coach for indie app revenue.'"
sleep_step 6

create_item "founder_thread" \
  "Outline founder launch thread" \
  "Sketch a seven-post thread that tells the OrbitMint story: why the product exists, what changed in the latest release, one founder lesson, and a clear CTA to join the waitlist." \
  "DoThisWeek" "ToDo" "Medium" "2026-03-05T19:00:00.000Z"
sleep_step 4

create_item "ugc_hunt" \
  "Collect two user workflow screenshots for social proof" \
  "Message power users who already share dashboards publicly, ask permission to feature their workflow, and prepare a simple image set for X and LinkedIn." \
  "DoLater" "ToDo" "Medium" "2026-03-10T20:00:00.000Z"
sleep_step 5

create_item "podcast_pitch" \
  "Pitch OrbitMint to three bootstrapped founder podcasts" \
  "Create a short outreach angle focused on how a solo founder uses AI to stay consistent in growth work without hiring a full marketing team." \
  "DoThisWeek" "ToDo" "Medium" "2026-03-11T17:00:00.000Z"
sleep_step 4

create_item "retention_review" \
  "Review churn feedback from the last 30 days" \
  "Cluster recent cancellation reasons into patterns, identify the top messaging gap, and decide whether onboarding or pricing explanation is the more urgent fix." \
  "DoToday" "ToThinkAbout" "High" "2026-03-04T20:00:00.000Z"
sleep_step 4

create_markdown_item "ai_article" "Read: the next operating model for human and agent teams" "$MARKDOWN_CONTENT"
enrich_item "ai_article" \
  "Queue this for the founder's evening review. It frames how AI agents should support execution without obscuring decision-making or trust." \
  "DoLater" "ToRead" "Medium" "2026-03-09T21:00:00.000Z"
sleep_step 7

add_note "reply_affiliate" "AI" "Suggested angle: lead with the fact that OrbitMint helps solo founders turn scattered growth ideas into a visible weekly plan. That makes the sponsorship more relatable than a generic productivity pitch."
sleep_step 5

create_item "investor_update" \
  "Prepare March investor update bullets" \
  "Draft a crisp update with MRR, activation rate, one product win, one challenge, and the specific intro ask for partners who reach indie SaaS founders." \
  "DoLater" "ToDo" "Medium" "2026-03-12T18:00:00.000Z"
sleep_step 4

create_item "welcome_email" \
  "Draft onboarding email for new trial users" \
  "Write a plainspoken welcome email that shows new users how to set up one weekly review ritual in Clawkpit and how OrbitMint ties revenue signals back to task momentum." \
  "DoThisWeek" "ToUse" "High" "2026-03-06T14:00:00.000Z"
sleep_step 4

create_item "community_post" \
  "Write IndieHackers launch prep post" \
  "Share the behind-the-scenes build story, ask for launch feedback, and include one honest section about where AI support helped keep the roadmap moving." \
  "DoLater" "ToRead" "Low" "2026-03-14T15:30:00.000Z"
sleep_step 4

create_item "metrics_cleanup" \
  "Clean up trial activation dashboard before recording demo" \
  "Make sure the activation chart highlights time-to-value, rename two confusing metrics, and remove one noisy experiment card so the screen recording is easier to follow." \
  "DoToday" "ToDo" "High" "2026-03-03T16:00:00.000Z"
sleep_step 5

update_urgency "launch_plan" "DoNow"
sleep_step 3

update_urgency "ugc_hunt" "DoThisWeek"
sleep_step 3

update_urgency "reply_affiliate" "DoNow"
sleep_step 3

update_urgency "retention_review" "DoThisWeek"
sleep_step 3

update_urgency "investor_update" "DoToday"
sleep_step 3

update_urgency "community_post" "Unclear"
sleep_step 3

announce "Demo complete. Fifteen items created with notes, urgency shifts, form content, and markdown content."
