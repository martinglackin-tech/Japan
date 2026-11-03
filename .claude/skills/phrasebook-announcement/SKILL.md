---
name: phrasebook-announcement
description: Write the "What's new" message announcing an update to Josey & Frankie's Japanese phrasebook (https://martinglackin-tech.github.io/Japan/), ready to paste into a chat or email to friends and family. Use when asked to announce, summarise or write up phrasebook changes for its users, write release notes or a "what's new", or combine several sets of changes into one message.
---

# Phrasebook update announcement

Produces a short, friendly message for the people who use the phrasebook (non-technical travellers on their phones), telling them what's new and how to save the app. It is not a changelog for developers.

## 1. Gather the changes

Collect every source, then merge them into one list:

- **Changes the user gives you** in their message (pasted notes, another session's summary). Include them even if you can't see them in the code.
- **Changes in this repository since the last announcement.** Fetch `main` and read the merged pull requests and commits:
  ```sh
  git fetch origin main
  git log --merges --first-parent --format='%h %s%n%b' origin/main
  git log --no-merges --format='%h %s' origin/main
  ```
  If the user doesn't say where the last announcement left off, look for a tag named `announced-*` (`git tag -l 'announced-*' --sort=-creatordate | head -1`) and use the commits after it. If there's no tag, ask the user which changes are already announced rather than guessing.
- **Changes you made in this conversation**, if any.

Check each claim against the code on `main` before writing it down. Use the labels the app actually shows (settings names such as "Natural", "This device", "Auto", "Izakaya"; tab names; button names). Drop anything that isn't on `main` yet, and tell the user it was left out and why.

## 2. Turn changes into benefits

Write each bullet as what the traveller can now do or notice, not how it was built.

- "Proper Japanese voice recordings for every phrase, which work offline too", not "added pre-generated MP3s and a service worker cache".
- Leave out purely internal work (refactors, build tooling, dependency updates, tests) unless it changes something people see.
- A bug fix earns a bullet only if people would have noticed the bug. If the fix needs them to do something (reload, reopen), say so in plain words.
- One idea per bullet, one or two short sentences. Combine overlapping items from different sources into a single bullet.
- Order: biggest visible change first. Then the coeliac and food-safety items, since those matter most when eating out. Then everything else.
- Aim for 5 to 10 bullets. If there are more, fold the minor ones into a final "Plus …" bullet.
- British spelling (colour, practise, favourite). No emoji. No jargon: say "works offline", not "PWA" or "service worker".

## 3. Write the message

Use exactly this structure. Keep the "Save it as an app" section word for word unless the user asks to change it or the app's install steps have changed.

```markdown
**The Japan phrasebook has had an upgrade:** https://martinglackin-tech.github.io/Japan/

**What's new**

* <benefit>
* <benefit>
* …

**Save it as an app**

* **iPhone (Safari):** open the link, tap the Share button, then "Add to Home Screen", then Add.
* **Android (Chrome):** open the link, tap the ⋮ menu, then "Add to Home screen" or "Install app", then Install.

Open it once on Wi-Fi so everything downloads, then it's ready for the trip. If the voice is silent offline, switch the voice to Natural in settings.
```

If the update first reaches some phones as a blank or broken page until they reload (for example after an offline-cache change), add one line after the install section: "If the app looks blank after the update, reload it once."

## 4. Hand it over

- Put the finished message in your reply between `---` lines so it's easy to copy. It's short and meant for pasting, so don't publish it as a page or file unless the user asks.
- Underneath, list in one or two lines anything you left out (not merged yet, or couldn't verify), and anything the user should do before sending, such as merging an open pull request the message describes.
- Offer to mark the announcement as sent with a tag, so the next one starts from here: `git tag announced-YYYY-MM-DD origin/main && git push origin announced-YYYY-MM-DD`. Only create or push the tag once the user says yes.
