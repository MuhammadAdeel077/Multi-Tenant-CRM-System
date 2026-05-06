# Multi-Tenant CRM System

A full-stack CRM built with **NestJS**, **Next.js**, **PostgreSQL**, and **TypeORM**. It supports multiple organizations, role-based access, customer management, notes, and a full activity log — all in one clean setup.

---

## Quick Start

### Prerequisites
- Node.js v18+
- Docker & Docker Compose (for the local database)

### 1. Backend

```bash
cd backend
npm install
npx ts-node src/seed.ts     # Seeds orgs and users
npm run start:dev           # Runs on http://localhost:3001
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # Runs on http://localhost:3000
```

### Seeded Login Credentials (email only, no password)

| Email | Role | Org |
|---|---|---|
| `admin@megacorp.com(Admin)` | Admin | Megacorp Inc |
| `admin@bxtsolutions.com(User)` | Member | BXT Solutions |

---

## What It Does

- **Members** can create customers (auto-assigned to themselves) and add notes
- **Admins** can view all customers across all organizations, assign customers to team members, delete/restore customers, and create notes
- Every action (created, updated, deleted, note added, assigned) is recorded in an activity log shown as a datatable with color-coded labels on the customer detail page

---

## Architecture

### The Big Picture

```
[Browser / Next.js] → [NestJS REST API] → [PostgreSQL (Neon)]
```

Everything lives in a single PostgreSQL database. Tenants (organizations) share the same tables isolation is enforced in code, not in separate schemas or databases. This is called a **Shared Database, Shared Schema** approach.

### Why Shared Schema?

It's the simplest approach that still scales well to hundreds of organizations. Separate databases per tenant would make cross-tenant admin reporting impossible and multiply ops overhead. Shared schema keeps things simple while the `organizationId` column on every table acts as the tenant fence.

---

## How Multi-Tenancy Isolation Works

Every protected table (`users`, `customers`, `notes`, `activity_logs`) has an `organizationId` column.

**Step-by-step flow for a member request:**

1. Member logs in → gets a JWT containing their `userId`, `organizationId`, and `role`
2. JWT hits the `JwtStrategy` → the strategy validates it and attaches `{ id, email, organizationId, role }` to `req.user`
3. Every service method receives this `user` object and uses it to scope all database queries

Example from the customer service:
```ts
qb.where('customer.organizationId = :orgId', { orgId: user.organizationId })
  .andWhere('customer.assignedToId = :userId', { userId: user.id });

```

There is **no way** for a member to see another organization's data — it would require a different `organizationId` in their token, which they can't forge without the JWT secret.

---

## Concurrency Safety (The Assignment Problem)

The requirement: a user can be assigned a maximum of 5 active customers. Two concurrent requests could both count 4 assigned customers, both pass the check, and both assign — pushing the total to 6. This is a classic race condition.

**How we solve it — Pessimistic Locking:**

```ts
// 1. Start a DB transaction
await queryRunner.startTransaction();

// 2. Lock the target user row (SELECT ... FOR UPDATE)
const targetUser = await queryRunner.manager.findOne(User, {
  where: { id: userIdToAssign },
  lock: { mode: 'pessimistic_write' },
});

// 3. Count current assignments INSIDE the locked transaction
const count = await queryRunner.manager.count(Customer, {
  where: { assignedToId: userIdToAssign },
});

if (count >= 5) throw new BadRequestException('...');

// 4. Safe to assign — commit
await queryRunner.manager.save(customer);
await queryRunner.commitTransaction();
```

The `SELECT FOR UPDATE` makes any concurrent request wait until this transaction completes. The second request will then see the updated count and correctly reject if the limit is reached.

---

## Performance Strategy

### Indexes

| Table | Index | Why |
|---|---|---|
| `customers` | `(organizationId, deletedAt, name)` | Speeds up paginated search by org |
| `customers` | `(organizationId, deletedAt, email)` | Same for email search |
| `customers` | `organizationId` | Fast tenant filtering |
| `notes` | `(organizationId, customerId)` | Fast note lookups per customer |
| `activity_logs` | `(organizationId, entityType, entityId)` | Fast activity timeline per entity |

Without these, every query would do a full table scan — fine for 100 rows, unusable at 100,000.

### Avoiding N+1 Queries

When listing customers, we need to show the "Assigned To" user name. Without joins, that would be 1 query for the list + 1 query per customer to get the user = N+1 queries. We solve this with a single join:

```ts
qb.leftJoinAndSelect('customer.assignedTo', 'assignedTo')
```

One query, all data.

### Pagination

All list endpoints use limit/offset pagination. Returning all rows at once would kill performance as the database grows. The frontend gets `{ data, total, page, totalPages }` and renders only the current page.

### Soft Deletes

Deleted customers aren't actually removed from the database — TypeORM's `@DeleteDateColumn` sets a `deletedAt` timestamp. Standard queries automatically filter these out (`WHERE deletedAt IS NULL`). This means:
- Deleted customers can be restored
- Notes and activity logs linked to them stay intact
- No orphaned foreign key issues

---

## Scaling This System

The current architecture handles thousands of orgs comfortably. Here's how to grow beyond that:

**1. Read Replicas**
Most traffic is reads (list customers, view notes). Point all `GET` requests to a read replica while the primary handles writes. TypeORM supports this with `replication` config.

**2. Background Activity Logging**
Right now, activity logs are written synchronously — every `create`, `update`, or `assign` waits for the log to be written before responding. Under high load, this adds latency. Solution: push log events onto a queue (BullMQ or Kafka), respond immediately, and let a background worker write the log. The user gets a faster response; the log still gets written.

**3. Table Partitioning**
If one organization grows to millions of customers, PostgreSQL's native table partitioning by `organizationId` would keep queries fast even on massive data.

---

## Trade-offs Made

| Decision | Why | What's Given Up |
|---|---|---|
| Shared DB/Schema | Simple to operate, easy cross-org admin queries | A noisy neighbor org can affect DB performance |
| JWT-only auth (no sessions) | Stateless, easy to scale horizontally | Can't instantly revoke a specific token |
| Synchronous activity logging | Simpler code, strong consistency | Adds ~10-20ms latency per write |
| Soft deletes via TypeORM | Simple restore, maintains audit trail | `deletedAt IS NULL` on every query, slightly slower without the right indexes |
| Email-only login (no passwords for this assessment) | Fast to build for demo purposes | Not production-safe — needs bcrypt + password field |
| `synchronize: true` in TypeORM | Schema auto-updates on start, great for dev | Dangerous in production — should use migrations instead |

---

## Production Improvements Needed

Before shipping this to real users:

- **Add passwords** — hash with `bcrypt`, store in the `users` table, verify on login
- **Switch to migrations** — replace `synchronize: true` with TypeORM migration files so schema changes are explicit and reversible
- **Move secrets to a vault** — `JWT_SECRET` and DB credentials should come from AWS Secrets Manager or similar, not `.env` files

---

## Submission Details

- **GitHub Repository**: ** Backend [https://github.com/MuhammadAdeel077/Multi-Tenant-CRM-System-Backend] ** Frontend [https://github.com/MuhammadAdeel077/Multi-Tenant-CRM-System]
- **Deployed URL**: *(Deployed link [https://multi-tenant-crm-system-sigma.vercel.app/login])*
