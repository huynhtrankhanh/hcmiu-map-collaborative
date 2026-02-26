# HCMIU Map Collaborative — Detailed Tutorial

Welcome to the HCMIU Map platform! This tutorial walks you through every feature of the website, from basic navigation to advanced collaborative tools.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Exploring the Campus Map](#exploring-the-campus-map)
3. [Finding the Shortest Path](#finding-the-shortest-path)
4. [Traveling Salesman Optimizer](#traveling-salesman-optimizer)
5. [HCMIU Collaborative](#hcmiu-collaborative)
   - [Hub Overview](#hub-overview)
   - [Authentication](#authentication)
   - [Entities (Posts & Comments)](#entities-posts--comments)
   - [Court of Justice (Trials)](#court-of-justice-trials)
   - [Deep Research](#deep-research)
   - [Notifications](#notifications)
   - [Activity Feed](#activity-feed)
6. [Map Integration with Collaborative](#map-integration-with-collaborative)
7. [Tips & Tricks](#tips--tricks)

---

## Getting Started

When you first visit the website, you'll see the **Landing Page** with four main actions:

| Action | Description |
|--------|-------------|
| 🗺️ **View Map** | Browse the 7-floor campus map interactively |
| 🧭 **Find Shortest Path** | Compute optimal routes between two locations |
| 📍 **Solve Traveling Salesman** | Optimize multi-stop visit orders |
| 🤝 **HCMIU Collaborative** | Open the community discussion and collaboration platform |

Click any button to navigate to that feature. Each page has an **Exit** button to return to the landing page.

---

## Exploring the Campus Map

1. Click **View Map** from the landing page.
2. You'll see a two-column layout:
   - **Left:** Interactive floor-by-floor map showing rooms, stairs, gates, and facilities.
   - **Right:** Collaboration panel showing selected entity details.
3. Click on any **room** or **stairs** on the map.
4. The right panel will show:
   - The location name and entity ID
   - Number of entities referencing this location
   - Comments thread
5. Click **Open in HCMIU Collaborative** to jump directly into the full collaborative view for that location.

---

## Finding the Shortest Path

1. Click **Find Shortest Path** from the landing page.
2. **Stage 1 — Form:** Enter the source and destination names, or click **Choose on Map** to select locations visually.
3. **Stage 2 — Choose Source on Map:** Click a point on the map, then click **Confirm**.
4. **Stage 3 — Choose Destination on Map:** Same process for the destination.
5. **Stage 4 — Results:** View the computed route displayed floor-by-floor. Use the collapsible list to inspect each segment.

The algorithm supports inter-floor routing through stairs and lifts automatically.

---

## Traveling Salesman Optimizer

1. Click **Solve Traveling Salesman** from the landing page.
2. Add multiple destination fields using the **Add** button.
3. For each destination, type the name or click **Choose on Map** to select visually.
4. Click **Solve** to compute the optimal visit order.
5. If you have more than 20 locations, the system will suggest **HCMIU Map Pro** (a fun Easter egg).

---

## HCMIU Collaborative

The Collaborative platform is organized into **separate pages** accessible via the navigation bar at the top. This keeps each feature focused and easy to use.

### Hub Overview

The Hub is the main dashboard showing:
- **Statistics:** Total entities, trials, notifications, and authentication status.
- **Quick navigation:** Buttons to jump to any sub-page.
- **Focused entity:** If you came from the map view, you'll see the focused entity details here.

### Authentication

1. Navigate to the **Auth** page (🔐).
2. **Sign Up:** Enter a username and password, then click **Sign up**.
   - Your password is securely hashed client-side using `sodium.crypto_pwhash` before being sent to the server.
   - The server applies an additional SHA256 hash with a random salt.
3. **Log In:** Enter your credentials and click **Log in**.
4. Once authenticated, you can create content across all collaborative pages.

### Entities (Posts & Comments)

Navigate to the **Entities** page (📡).

**Creating an Entity:**
1. Fill in the **Title** and **Body** fields.
2. **Adding references:** Instead of manually typing entity IDs, use the **search box** to find entities:
   - Type at least 2 characters to search.
   - Click a result to add it as a reference.
   - Selected references appear as blue tags that can be removed.
   - For advanced users: Expand the **Expert: Add by ID** section to enter IDs directly.
3. Click **Create** to publish.

**Interacting with Entities:**
- **Follow:** Click to receive notifications when someone comments.
- **Unfollow:** Stop receiving notifications.
- **Find references:** See all entities that reference this one.
- **Edit:** Modify the entity body (creator only).
- **Delete:** Remove the entity (creator only).
- **Comment:** Add a comment to any entity.

### Court of Justice (Trials)

Navigate to the **Trials** page (⚖️).

**Creating a Trial:**
1. Enter the **Trial title**.
2. Enter the **Defendant username**.
3. Write the **Trial description**.
4. Click **Create Trial**.

**Interactive Judge Agreement:**

The judge agreement process is a back-and-forth dialogue:

1. **Plaintiff proposes judges:** Enter judge usernames (comma-separated) and click **Propose Judges**.
2. **Defendant responds:** The defendant sees the proposal and can:
   - Click **Accept Judges** to agree — the trial becomes active.
   - Enter different judges and click **Counter-propose Judges** to suggest alternatives.
3. **Plaintiff responds:** If the defendant counter-proposed, the plaintiff can:
   - Click **Accept Judges** to agree to the counter-proposal.
   - Click **Counter-propose Judges** to suggest yet another set.
4. This continues until one party accepts.

**Viewing Negotiation History:** Each trial has a collapsible negotiation history showing all proposals and acceptances.

**Voting:**
Once judges are agreed upon, each judge can vote:
- `plaintiff` — rule in favor of the plaintiff
- `defendant` — rule in favor of the defendant
- `no_winner` — declare no winner

The trial is resolved when all judges have voted. Discussion can continue after resolution.

### Deep Research

Navigate to the **Research** page (🔎).

**Find Referencing Entities:**
1. Use the search box to find entities, or use the Expert mode to enter IDs.
2. Click **Find Referencing Entities** to see all entities that reference your selection.

**Full-text Search:**
1. Enter a text query.
2. Click **Full-text Search** to find all entities matching the query.

**Degree of Separation:**
1. Search for or enter the **From** entity.
2. Search for or enter the **To** entity.
3. Click **Find Degree of Separation** to see the shortest reference-path between them.

### Notifications

Navigate to the **Notifications** page (🔔).

- See all in-app notifications.
- Notifications are triggered when someone comments on an entity you follow.
- 🔔 indicates unread, ✅ indicates read.

### Activity Feed

Navigate to the **Activity** page (📰).

- View a chronological feed of all recent activity across the platform.
- Items are color-coded by type (posts, comments, trial updates).
- Use this to stay informed about community activity.

---

## Map Integration with Collaborative

The map and collaborative features are deeply integrated:

1. **View Map** → Click a room/stairs → See the collaborative thread.
2. Click **Open in HCMIU Collaborative** → Jump to the entities page with the map entity pre-focused.
3. Research results show entity IDs that you can use to navigate between related locations.

---

## Tips & Tricks

- **Real-time updates:** All changes are reflected instantly via WebSocket. No need to refresh!
- **Everything is an entity:** Rooms, stairs, users, posts, comments, and trials are all entities that can be referenced and discussed.
- **Search instead of typing IDs:** Use the search-based reference selection for a better experience. Manual ID input is available as an "Expert" option.
- **Mobile-friendly:** The entire interface is responsive and works on mobile devices.
- **Follow strategically:** Follow entities you care about to get notified of new comments.
- **Activity feed:** Check the Activity page regularly to discover new discussions and contributions.
