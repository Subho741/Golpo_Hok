# গল্প হোক!

A compact, responsive one-to-one chat application built with **React + Vite + Tailwind CSS + React Router**, **Express + Socket.IO**, and **MongoDB + Mongoose**. Authentication uses signed JWTs in HttpOnly cookies and bcrypt password hashing through the `bcryptjs` implementation.

**Delivery status:** the complete source is included. The frontend builds and six focused security/validation tests pass. This workspace denied a system operation required to start MongoDB, so database integration and the two-browser real-time test could not be verified here. This is not a claim of a production deployment or a completed production security audit. See `VERIFICATION.md` for exact results.

## Quick start (Node.js)

Requirements: Node.js 22 or newer, npm, and a reachable MongoDB 7+ instance (local or Atlas).

1. Open this folder in VS Code, then open a terminal here.
2. Install packages:

   ```sh
   npm ci
   ```

3. Copy `.env.example` to `.env` (`cp .env.example .env` on macOS/Linux, `Copy-Item .env.example .env` in PowerShell).
4. Set `MONGODB_URI` to your MongoDB connection string. Set `JWT_SECRET` to a random secret, generated with:

   ```sh
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   Keep `CLIENT_URL=http://localhost:5173` for Vite development. Do not commit `.env`.

5. Start both services:

   ```sh
   npm run dev
   ```

6. Open **http://localhost:5173**. Create your account. Open a private/incognito window, create another account, and search for the second person's full email from **New conversation**. Both accounts must exist before they can message each other.

The database starts empty. There are no fake accounts, simulated replies, seeded private messages, or localStorage message persistence in the application.

## Quick start (Docker)

Docker Compose runs the real Node server and a persistent MongoDB instance together.

1. Copy `.env.example` to `.env`.
2. Generate separate random hexadecimal values for `JWT_SECRET` and `MONGO_PASSWORD` using the command above.
3. Set `CLIENT_URL=http://localhost:3001` and `NODE_ENV=development` for local HTTP testing. Compose uses its own internal MongoDB URI; `.env`'s `MONGODB_URI` is for the non-Docker path.
4. Run:

   ```sh
   docker compose up --build -d
   ```

5. Open **http://localhost:3001**.

The named `thread-data` volume preserves messages across application and container restarts. `docker compose down` preserves it; `docker compose down -v` deletes it. MongoDB is not published to a host port. Changing the MongoDB bootstrap password after initialization requires changing the existing database user's password too; changing the environment alone does not rotate it.

## Build and serve

```sh
npm run build
npm start
```

The Express server serves `dist/`, the REST API, and Socket.IO on port 3001. For this local flow set `CLIENT_URL=http://localhost:3001` in `.env`. For deployment, use one HTTPS origin, set `NODE_ENV=production`, set `CLIENT_URL` to the exact HTTPS origin without a trailing slash, and provide a strong `JWT_SECRET` and protected `MONGODB_URI`. Secure cookies require HTTPS in production.

Deploy the Node container to a host that supports long-running Node processes and WebSocket upgrades, with a MongoDB service. The available Sites/Cloudflare host in this task cannot run this native Express/Socket.IO/Mongoose stack. No frontend-only live URL has been supplied as if it were the finished application.

Run one Node instance with this implementation. Horizontal scaling requires a shared Socket.IO adapter, shared presence, and shared rate limiting. If you put the app behind a reverse proxy, preserve the external `Origin`, forward WebSocket upgrades and use idle timeouts greater than Socket.IO's heartbeat window. The application deliberately does not trust arbitrary forwarded IP headers. Configure Express `trust proxy` for only your known proxy topology before using per-client IP rate limiting behind that proxy. Until then, proxy users share the proxy's rate-limit bucket.

## Features

- Registration, login, protected routes, session restoration, logout and server-side session revocation.
- Passwords hashed with bcrypt at cost 12; passwords never returned by the API.
- User search by name or exact email, unique one-to-one conversation creation.
- Persistent messages and replies; delete your own messages for both participants.
- Socket.IO message submission and delivery, optimistic UI, idempotent retries, reconnect history synchronization.
- Delivered and read receipts, unread counts, typing indicators with expiry.
- Online presence across multiple tabs; last seen after a clean disconnect.
- Editable name/about text; optional profile image, cropped/resized before upload.
- Conversation search, loading/error/empty states and connection status.
- Fifty-message cursor pagination, automatic scrolling and a return-to-latest control.
- Enter sends, Shift + Enter adds a line, IME composition is respected.
- Desktop split view and separate mobile list/chat screens with back navigation.
- Semantic controls, native modal focus handling, keyboard focus states and reduced-motion support.

Profile pictures can be added after registration in **Your profile**. They are limited to 200 KB after resizing and stored with the profile for a self-contained deployment. Chat file/image attachments, calls, groups, reactions, email verification and password reset are not implemented. They were optional or outside this brief. Failed sends remain available for retry while the page is open; unsent drafts do not survive a full reload. Read receipts mean the conversation is visible at its latest messages, not proof that a person consciously read every message. The service does not implement end-to-end encryption.

## Structure

```text
src/
  components/      Sidebar, conversation, bubbles, composer, profile and search dialogs
  context/         Cookie-backed authentication state
  hooks/           Socket lifecycle, message lifecycle and receipts
  pages/           Login/register and chat workspace
  services/        JSON REST client
  main.jsx         Routes and render error boundary
  styles.css       Tailwind import and compact design system
server/
  config/          Environment validation
  controllers/     Authentication orchestration
  middleware/      Authentication, input validation and public errors
  models/          User, Conversation, Message and Session schemas
  routes/          REST resources
  services/        Authorized conversation and message operations
  socket/          Authenticated events, rate control and multi-tab presence
  tests/           Unit/security checks and real MongoDB/Socket.IO integration tests
  app.js           HTTP/Socket.IO application factory
  server.js        Database connection and process lifecycle
scripts/
  browser-test.mjs Real two-session browser acceptance test
```

## REST API

All writes require an `Origin` matching `CLIENT_URL`. Requests use JSON. Authenticated requests use the `thread_session` cookie; no JWT is stored in browser localStorage.

| Method | Path                                         | Purpose                                               |
| ------ | -------------------------------------------- | ----------------------------------------------------- |
| POST   | `/api/auth/register`                         | Create account and session                            |
| POST   | `/api/auth/login`                            | Start session                                         |
| GET    | `/api/auth/me`                               | Restore current user                                  |
| POST   | `/api/auth/logout`                           | Revoke session and disconnect its sockets             |
| PATCH  | `/api/users/me`                              | Update name, status and avatar                        |
| GET    | `/api/users?q=...`                           | Search users                                          |
| GET    | `/api/conversations`                         | List conversations with previews and unread counts    |
| POST   | `/api/conversations`                         | Create/reuse conversation, body `{ "userId": "..." }` |
| GET    | `/api/conversations/:id/messages?before=...` | Fetch latest/older messages                           |
| POST   | `/api/messages`                              | REST alternative to socket message submission         |
| DELETE | `/api/messages/:id`                          | Soft-delete own message                               |
| POST   | `/api/conversations/:id/read`                | Mark through a message, body `{ "throughId": "..." }` |

Message submission requires `conversationId`, `text`, a UUID `clientId`, and optional `replyTo` message ID. Retrying the same `clientId` does not create a duplicate. Soft-deleted messages retain their identity and receipt history but their text is cleared, including populated reply references.

## Socket events

Incoming events: `message:send`, `message:delivered`, `typing`. Each can receive an acknowledgment `{ok, ...data}` or `{ok: false, error, status}`. The server validates authentication for every event and conversation membership for every operation.

Outgoing events: `message:new`, `message:receipt`, `message:deleted`, `conversation:changed`, `presence`, `typing`, `profile:changed`. Data is scoped to participant user rooms, not broadcast to every account. Each session expires after seven days and its sockets disconnect at expiration. Reconnect refreshes conversations and the latest message page. The sender sees **Sent** when MongoDB accepted a message, **Delivered** after the recipient client acknowledges it, and **Read** after the visible conversation reports its read position.

## Verification

```sh
npm test
npm run build
npm run test:integration
npx playwright install chromium
npm run test:browser
```

The integration suite launches a real temporary MongoDB process using `mongodb-memory-server` (despite the package name, this is not a mocked database). If your platform cannot launch it, set `TEST_MONGODB_URI` to a test MongoDB service. The suite creates a unique `thread_test_*` database and drops only that database afterward. The browser test requires the application already running at `http://localhost:5173`, or `TEST_BASE_URL` set to its URL. It creates two unique test accounts in that application's database; use a nonproduction database.

The browser test opens two isolated cookie contexts and verifies instant message reception, typing, read receipts, page refresh, restored browser session, mobile navigation and logout. The integration suite also covers authorization failures, duplicate registration, idempotency, cross-user deletion protection, multi-tab presence, and server restart persistence.

Before production use, run these tests against your actual hosting configuration; verify HTTPS/cookie behavior, database backups and restore, monitoring and logs, proxy configuration, and rate limits appropriate to your traffic. For abrupt process crashes, online state resets on restart and `lastSeen` may reflect the last clean disconnect rather than the exact crash time.
