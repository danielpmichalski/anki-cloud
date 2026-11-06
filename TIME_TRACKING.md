# Time Tracking

Time is tracked in [Toggl Track](https://track.toggl.com), not in this repository.
Toggl holds the time, GitHub holds scope and status, and the issue reference in each
entry's description links the two.

- Tracking started on **2026-11-06**. Effort before that date was not tracked and can only be
  estimated from git history.
- Toggl project: **Anki Cloud**. One project covers all repositories (see below).
- No time data is committed to the repo.

## Process

1. Start a timer in Toggl (web, desktop or mobile) and select the **Anki Cloud** project.
2. Set the description to the issue reference, followed by a short title (see
   [Description format](#description-format)).
3. When you switch tasks, start the next timer. Toggl stops the previous one.
4. Stop the timer at the end of the day.

Tips:

- Toggl autocompletes from earlier descriptions, so after the first entry for an issue you can
  pick it from the dropdown.
- Use "continue" on an old entry to resume the same task without retyping.

## Description format

The description always starts with `<repo>#<number>`, where `<repo>` is the exact GitHub
repository name and `<number>` is the issue (or PR) the work belongs to. Issue numbers repeat
across repositories, so the repo prefix is mandatory on every entry, including `anki-cloud`.
A newly created repo is tracked with its name as the prefix from the first entry.

| Work                      | Description                              |
|---------------------------|------------------------------------------|
| Issue in `anki-cloud`     | `anki-cloud#53 MCP e2e tests`            |
| Issue in `anki-cloud-sync`| `anki-cloud-sync#5 Pin upstream`         |
| Issue in another repo     | `anki-cloud-android#3 Login screen`      |
| No issue                  | `Plan M08 storage backends`              |

Rules:

- Always write the full repo name before `#`. Never write a bare `#53`.
- All repositories belong to the owner `danielpmichalski`, so the owner is omitted.
- Work with no issue (planning, research, admin) gets a plain description with no prefix. If it
  turns into an issue, rename the entry to the issue reference.
- A PR that closes an issue is tracked against the issue.

## Analysis

A script (not written yet) reads the Toggl Reports API, filtered to the **Anki Cloud** project, and
parses `<repo>#<number>` from each description. It joins the references with the GitHub issues and
milestones of each repo (`gh issue list --json number,title,milestone,labels`) to report:

- hours per repo
- hours per milestone
- hours per issue
- the share of time that went to work with no issue

Parsing pattern: `^([A-Za-z0-9._-]+)#(\d+)`. Entries that don't match count as work with no issue.

The script reads `TOGGL_API_TOKEN` from the environment and writes no time data into the repo.
