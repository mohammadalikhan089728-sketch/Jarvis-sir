# JARVIS Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Strict Owner Isolation**: Every user document and subcollection (`/users/{userId}/conversations`, `/memories`, `/tasks`, `/projects`) may only be read, listed, created, updated, or deleted by the authenticated owner whose `request.auth.uid == userId` and `request.auth.token.email_verified == true`.
2. **Parent Existence & Identity Integrity**: Subcollection records must enforce `incoming().userId == request.auth.uid` and `incoming().userId == userId`.
3. **Immutable Audit Fields**: `userId` and `createdAt` are immutable after creation; `createdAt == request.time` on create, `updatedAt == request.time` on create and update.
4. **Terminal State Locking**: Tasks in terminal states (`completed`, `cancelled`) cannot transition back to `running` unless explicitly retried via a controlled retry action on `failed`/`paused` tasks; `completed` tasks are locked from arbitrary mutation.
5. **Bounded Payloads**: All strings, arrays (`tags.size() <= 10`), and document IDs (`^[a-zA-Z0-9_-]+$`, `<= 128` chars) are bounded to prevent resource exhaustion.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `GET /users/uid_1/memories/mem_1` with `auth = null`.
2. **Cross-Tenant Read**: `GET /users/uid_mozahid/memories/mem_1` signed in as `uid_attacker`.
3. **Unverified Email Write**: `CREATE /users/uid_1/memories/mem_1` with `email_verified = false`.
4. **Shadow Ghost Field Injection**: `CREATE /users/uid_1/memories/mem_1` with extra field `isAdmin: true`.
5. **Identity Spoofing on Create**: `CREATE /users/uid_1/tasks/task_1` with `userId: "uid_other"`.
6. **ID Poisoning**: `CREATE /users/uid_1/memories/bad$id..with..slashes` or >128 char ID.
7. **Timestamp Forgery**: `CREATE /users/uid_1/memories/mem_1` with client-forged `createdAt` not equal to `request.time`.
8. **Immutable Field Tampering**: `UPDATE /users/uid_1/tasks/task_1` changing `userId` or `createdAt`.
9. **Terminal State Mutation**: `UPDATE /users/uid_1/tasks/task_1` where `existing().status == "completed"` trying to set `status: "running"`.
10. **Unbounded Array Bomb**: `CREATE /users/uid_1/memories/mem_1` with `tags` array containing 25 elements (> 10 max) or non-string element `[123]`.
11. **Value Type Poisoning**: `UPDATE /users/uid_1/projects/proj_1` setting `name` to boolean `true` or > 160 chars.
12. **Blanket List Query Scraping**: `LIST /users/uid_mozahid/conversations` executed by `uid_attacker` or without matching `userId`.
