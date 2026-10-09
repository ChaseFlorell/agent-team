---
name: postgres-dba
description: PostgreSQL database administration — read, design, audit, evolve, seed, and operate a schema. Use when designing tables or relationships (one-to-one, one-to-many, many-to-many), choosing column types, constraints, or indexes, auditing a schema, planning a safe schema change, writing seed data, or diagnosing a slow query or lock. Generic PostgreSQL 14+.
---

# PostgreSQL DBA

**Project rules.** A project may extend this skill with a companion skill that
names this one; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's schema conventions and wins where they differ;
name any conflict rather than silently choosing.

- Expressing a design in EF Core:
  [`design-ef-core-model`](../design-ef-core-model/SKILL.md). Shipping it as a
  migration: [`manage-ef-core-migrations`](../manage-ef-core-migrations/SKILL.md).

## Working rules

- **Read before you write.** Inspect the live schema (see "Read a schema") and
  the repository's persistence docs before proposing anything.
- **Model the data, then the code.** Decide tables, keys, and constraints in
  SQL terms first; the ORM expresses that design, not the reverse.
- **The database enforces invariants.** If a rule must always hold, make it a
  constraint (`NOT NULL`, `CHECK`, `UNIQUE`, `FOREIGN KEY`, exclusion), not only
  application code.
- **Never run DDL or bulk DML against a shared or production database** without
  an explicit instruction naming that database. Default to a local or
  disposable one.
- **Never put real personal data** in seeds, fixtures, examples, or logs.
- **Show evidence.** Every design choice or audit finding cites the query,
  plan, or rule behind it.
- **A missing rule is a question, not a guess.** Cardinality, optionality, and
  retention come from the requirement served; ask when it does not say.

## Deliver

- **Design**: an ER diagram and the intended DDL; every key, type,
  relationship, delete behavior, and index justified in one line.
- **Audit**: findings by severity, each with evidence, fix, and migration risk
  (see "Audit a schema").
- **Migration**: the model change, the generated migration, and the completed
  review checklist.
- **Seed**: idempotent, synthetic, and classed as reference, development, or
  test (see "Seed data").

## Read a schema

- `psql`: `\dn` schemas, `\dt+ schema.*` tables, `\d+ table` columns,
  constraints, indexes, and triggers; `\dv` views, `\df` functions, `\dT+`
  types, `\dx` extensions.
- Whole shape: `pg_dump --schema-only --no-owner --no-privileges <db>`.
- Relationships at a glance:

  ```sql
  SELECT c.conrelid::regclass AS child, c.confrelid::regclass AS parent,
         c.conname, pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  WHERE c.contype = 'f'
  ORDER BY 1, 3;
  ```

- Summarize what you read as a Mermaid `erDiagram`: tables, primary and
  foreign keys, and cardinality. Omit columns that do not explain the shape.

## Design a schema

Work in this order; each step's output feeds the next.

1. **Entities.** One table per thing with its own identity and lifecycle.
   Plural or singular names — follow the repository; `snake_case`, no quoted
   identifiers, no reserved words.
2. **Keys.**
   - Every table has a primary key. Prefer a surrogate key; enforce any
     natural key (email, code, slug) with a `UNIQUE` constraint beside it.
   - Surrogate type: `bigint GENERATED ALWAYS AS IDENTITY` by default; `uuid`
     (v7 for index locality; v4 when creation time must not leak) when ids are
     minted outside the database or must not be guessable. Never `serial`
     (legacy) or `int` for a table that can grow.
   - Foreign-key columns have exactly the referenced column's type.
3. **Relationships** — see the next section.
4. **Columns and types** — see "Choose a data type".
5. **Constraints.** `NOT NULL` unless absence is a real, meaningful state.
   Add `CHECK` for ranges, formats, and cross-column rules. Name constraints
   (`ck_<table>_<rule>`, `uq_<table>_<cols>`, `fk_<child>_<parent>`) when the
   repository has no convention.
6. **Indexes** — see "Index".
7. **Normalize to 3NF,** then denormalize only for a measured read problem, and
   keep the copy correct with a trigger, generated column, or materialized
   view.
   - 1NF: one value per column; no `phone1, phone2, phone3` — that is a child
     table.
   - 2NF/3NF: every non-key column depends on the whole key and nothing but
     the key. A column that depends on another non-key column moves to its own
     table.
8. **Lifecycle.** Decide per table: hard delete, soft delete
   (`deleted_at timestamptz`), or append-only. Add `created_at timestamptz NOT
   NULL DEFAULT now()`; add `updated_at` only when something reads it.
9. **Draw it.** Mermaid `erDiagram` of the result before any migration.

## Relationships

Cardinality notation: `||` exactly one, `o|` zero or one, `|{` one or more,
`o{` zero or more.

### One-to-many

- The foreign key lives on the **many** side: `child.parent_id → parent.id`.
- `NOT NULL` when a child cannot exist without its parent.
- **Index the foreign key.** PostgreSQL does not do it for you; without it,
  joins and every parent delete or key update scan the child table.
- Choose `ON DELETE` deliberately:

  | Behavior | Use when |
  |---|---|
  | `RESTRICT` / `NO ACTION` (default) | the child must outlive or block its parent's removal; the safe default |
  | `CASCADE` | the child is genuinely part of the parent (order lines of an order) |
  | `SET NULL` | the link is optional provenance (`created_by`) |

- With soft delete, the database never sees a delete; cascade the
  `deleted_at` stamp in the application, one timestamp for the whole graph.

### One-to-one

- Two shapes; pick by ownership:
  - **Shared primary key**: `child.id` is both PK and FK to `parent.id`. Best
    when the child is an extension of the parent (profile of a user, detail of
    a report). Cannot exist without the parent.
  - **Unique foreign key**: `child.parent_id` with `UNIQUE`. Use when the child
    has its own identity or the link is optional.
- The foreign key goes on the side that is **optional or created later**.
- Before splitting, ask why it is not one table. Valid reasons: different
  lifecycle, different access or privacy tier, large rarely-read columns,
  or a subtype. Otherwise merge.
- "Exactly one on both sides" cannot be enforced by plain constraints; use a
  deferrable FK pair or accept "zero or one" on one side.

### Many-to-many

- A junction table: `a_b(a_id, b_id)` with `PRIMARY KEY (a_id, b_id)`, both FKs
  `NOT NULL`, and a second index on `(b_id)` for the reverse lookup (the PK
  covers `a_id`-first lookups).
- Name it after the relationship when one exists (`enrollments`, not
  `student_courses`).
- Once the link carries its own data (role, quantity, `created_at`, status),
  it is an entity: give it a surrogate key only if other tables reference it,
  and keep the `UNIQUE (a_id, b_id)` rule unless duplicates are meaningful.
- Junction foreign keys usually `CASCADE` on hard delete of either side.

### Other shapes

- **Self-reference / hierarchy**: `parent_id` to the same table; query with a
  recursive CTE. Deep, read-heavy trees: consider `ltree` or a closure table.
- **Polymorphic** ("comment belongs to a post or a photo"): never a
  `(target_type, target_id)` pair — it cannot have a foreign key. Use one
  nullable FK per target with `CHECK (num_nonnulls(post_id, photo_id) = 1)`,
  or a supertype table both targets share.
- **Subtypes**: shared-PK one-to-one tables per subtype, or one table with a
  `kind` column and `CHECK`s when subtypes differ by a few columns.
- **Enumerations**: a lookup table when values carry data or change at run
  time; a `text` column with a `CHECK (col IN (...))` when the set is fixed and
  small; a native `ENUM` type only when values are append-only (removing or
  renaming a value is painful).

## Choose a data type

| Input | Type | Avoid |
|---|---|---|
| Free text, names, titles | `text`; add `CHECK (char_length(col) <= n)` only for a real limit | `varchar(255)` by habit; `char(n)` (pads with spaces) |
| Text with a true fixed or maximum length (codes, fixed-width ids) | `varchar(n)` or `char(n)` when every value is exactly n | — |
| Case-insensitive unique text (email) | `text` + unique index on `lower(col)`, or `citext` | plain `UNIQUE` on mixed case |
| Whole numbers | `integer`; `bigint` for keys, counters, anything that may pass 2.1 billion | `smallint` to save space (alignment eats it) |
| Money, exact decimals | `numeric(p, s)`, or `bigint` minor units (cents) | `money`, `real`, `double precision` |
| Measurements, scientific | `double precision` | `numeric` when exactness is not needed (slower) |
| Yes/no | `boolean NOT NULL` | `'Y'/'N'`, `0/1`, nullable booleans (three states) |
| A moment in time | `timestamptz` | `timestamp` (no time zone) — it loses the instant |
| Calendar date (birthday, due date) | `date` | `timestamptz` at midnight |
| Wall-clock time of day | `time` | `timetz` |
| Duration | `interval`, or `integer` seconds when summed | text |
| A period (booking, validity) | `tstzrange` / `daterange` + exclusion constraint to forbid overlap | two columns with no overlap rule |
| Identifier minted outside the DB | `uuid` (v7 for insert locality) | `text` holding a UUID |
| Semi-structured, schema-less payload | `jsonb` | `json` (no indexing, keeps duplicates); `jsonb` for data you filter or join on — make those columns |
| Small list of scalars, no referential integrity | array (`text[]`) + GIN index | arrays of foreign keys — use a junction table |
| IP address / network | `inet` / `cidr` | text |
| Binary | `bytea` for small values; object storage + key for files | large blobs in rows |
| Derived value | `GENERATED ALWAYS AS (...) STORED` | a column the app must keep in sync |
| Full-text search | `tsvector` generated column + GIN | `LIKE '%x%'` on large tables |

- Pick precision once: changing a type later usually rewrites the table.
- Store units in the column name (`duration_seconds`, `weight_kg`).

## Constraints

- `UNIQUE` treats NULLs as distinct; use `UNIQUE NULLS NOT DISTINCT` (15+) when
  NULL must also be unique.
- **Soft delete + uniqueness**: a partial unique index,
  `CREATE UNIQUE INDEX ... ON t (key) WHERE deleted_at IS NULL`.
- **At most one of a kind**: a partial unique index, e.g. one live revision per
  key, one default address per user.
- `EXCLUDE USING gist (room_id WITH =, during WITH &&)` forbids overlaps
  (needs `btree_gist` for the `=` on a scalar).
- `DEFERRABLE INITIALLY DEFERRED` foreign keys when rows referencing each other
  are inserted in one transaction.

## Index

- Index for the queries that exist, not for every column. Each index slows
  every write.
- B-tree (default) for `=`, ranges, `ORDER BY`. Composite column order:
  equality columns first, then the range or sort column. `(a, b)` serves `a`
  alone but not `b` alone.
- **Partial** (`WHERE deleted_at IS NULL`, `WHERE status = 'pending'`) when
  queries always filter the same way.
- **Expression** (`lower(email)`) when queries filter on the expression.
- **Covering** (`INCLUDE (col)`) for index-only scans of hot reads.
- GIN for `jsonb`, arrays, `tsvector`, trigram (`pg_trgm`) search. GiST for
  ranges, geometry, exclusion. BRIN for huge append-only tables ordered by
  time.
- Redundant: an index whose columns are a leading prefix of another's (unless
  it is unique or much smaller and hot).

## Audit a schema

Run each query; report every hit as a finding. Adjust the schema filter to the
application's schemas. A hit is evidence to judge, not an automatic defect —
a repository convention (fixed-width `char(n)` ids, deliberate `json`) may
explain it.

```sql
-- 1. Tables without a primary key
SELECT c.oid::regclass AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%'
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'p');

-- 2. Foreign keys with no index leading on their columns
SELECT c.conrelid::regclass AS table_name, c.conname,
       pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE c.contype = 'f'
  AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.conrelid
      AND (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] @> c.conkey
      AND (string_to_array(i.indkey::text, ' ')::int2[])[1:cardinality(c.conkey)] <@ c.conkey);

-- 3. Duplicate indexes
SELECT i.indrelid::regclass AS table_name,
       array_agg(i.indexrelid::regclass) AS duplicate_indexes
FROM pg_index i
GROUP BY i.indrelid, i.indkey::text, i.indclass::text, i.indcollation::text,
         coalesce(pg_get_expr(i.indexprs, i.indrelid), ''),
         coalesce(pg_get_expr(i.indpred, i.indrelid), '')
HAVING count(*) > 1;

-- 4. Suspicious column types
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
  AND data_type IN ('timestamp without time zone', 'time with time zone',
                    'money', 'json', 'character', 'real', 'double precision')
ORDER BY 1, 2, 3;

-- 5. "*_id" columns that are neither a key nor a foreign key
SELECT a.attrelid::regclass AS table_name, a.attname AS column_name
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND a.attnum > 0 AND NOT a.attisdropped
  AND a.attname LIKE '%\_id'
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint k
    WHERE k.conrelid = a.attrelid AND k.contype IN ('f', 'p')
      AND a.attnum = ANY (k.conkey));

-- 6. Identity or serial columns too small to grow
SELECT a.attrelid::regclass AS table_name, a.attname,
       format_type(a.atttypid, a.atttypmod) AS type
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND a.attnum > 0 AND NOT a.attisdropped
  AND (a.attidentity <> ''
       OR pg_get_serial_sequence(a.attrelid::regclass::text, a.attname) IS NOT NULL)
  AND a.atttypid IN ('int2'::regtype, 'int4'::regtype);

-- 7. Sequences near their limit
SELECT schemaname, sequencename, last_value, max_value,
       round(100.0 * last_value / max_value, 2) AS pct_used
FROM pg_sequences
WHERE last_value IS NOT NULL
ORDER BY pct_used DESC;

-- 8. Every foreign key's delete behavior (judge each against its relationship)
SELECT c.conrelid::regclass AS child, c.confrelid::regclass AS parent, c.conname,
       CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT'
         WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL'
         WHEN 'd' THEN 'SET DEFAULT' END AS on_delete
FROM pg_constraint c
WHERE c.contype = 'f'
ORDER BY 1, 3;

-- 9. Invalid indexes (a failed CREATE INDEX CONCURRENTLY leaves one)
SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;
```

Runtime checks, on a database with real traffic only:

```sql
-- Indexes never scanned since statistics reset (not unique, not PK)
SELECT s.relid::regclass AS table_name, s.indexrelid::regclass AS index_name,
       pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
ORDER BY pg_relation_size(s.indexrelid) DESC;

-- Dead tuples and vacuum health
SELECT relid::regclass AS table_name, n_live_tup, n_dead_tup,
       last_autovacuum, last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 20;
```

Then read the schema for what queries cannot see:

- nullable columns that are never null in practice (`SELECT count(*) FILTER
  (WHERE col IS NULL) FROM t`) — candidates for `NOT NULL`;
- a relationship implemented without a foreign key, or orphans behind one:
  `SELECT count(*) FROM child c LEFT JOIN parent p ON p.id = c.parent_id
  WHERE c.parent_id IS NOT NULL AND p.id IS NULL`;
- repeating column groups, comma-separated values, or a `jsonb` column that is
  queried like a table (1NF);
- missing uniqueness on a natural key; soft-deleted tables whose unique
  constraints are not partial;
- one-to-one splits with no reason; polymorphic `(type, id)` pairs;
- naming inconsistency (plural/singular, `id` vs `<table>_id`, casing).

When tables hold personal or sensitive data, an audit query returns counts and
shapes, never row content.

Report each finding as: **severity** (critical / high / medium / low),
**evidence** (query and result), **why it matters**, **fix** (the exact DDL),
and **migration risk** (lock, rewrite, backfill).

## Change a schema safely

Any change to a table that already holds data follows these rules.

- Set `lock_timeout` (e.g. `SET lock_timeout = '5s'`) so a blocked DDL fails
  fast instead of queuing every other query behind it.
- **Cheap** (catalog only): add a nullable column; add a column with a
  constant default (11+); drop a `NOT NULL`; `CREATE`/`DROP` a view.
- **Table rewrite or full scan under a strong lock** — plan them:
  - changing a column type (except widening `varchar(n)` or to `text`);
  - `ADD CONSTRAINT` on a large table → add it `NOT VALID`, then `VALIDATE
    CONSTRAINT` separately (weaker lock);
  - `SET NOT NULL` → first add `CHECK (col IS NOT NULL) NOT VALID`, validate
    it, then `SET NOT NULL` (12+ skips the scan), then drop the check;
  - `CREATE INDEX` → `CREATE INDEX CONCURRENTLY` (cannot run inside a
    transaction; check for an invalid index if it fails).
- **Renames and removals break running code.** Use expand → migrate →
  contract: add the new shape, write both, backfill in batches, switch reads,
  then remove the old shape in a later release.
- Backfill large tables in batches (`UPDATE ... WHERE id IN (SELECT id ...
  LIMIT 5000)`), never one statement over millions of rows.
- Every change works on both an empty database and a populated one: a new
  `NOT NULL` column has a default or a backfill in the same migration.
- A destructive change (drop column/table, narrowing type, delete rows) needs
  explicit approval and a stated recovery path.

## Seed data

- Classify it first:
  - **Reference data** the application needs to run (lookup rows, system
    records): versioned with the schema, in a migration, in every environment.
  - **Development/demo data**: a separate, environment-gated seeder; never runs
    in production.
  - **Test data**: created by the test that needs it; never shared state.
- Seeds are **idempotent**: fixed, stable keys and
  `INSERT ... ON CONFLICT (key) DO NOTHING` (or `DO UPDATE` when the seed owns
  the row's content). Re-running changes nothing.
- After inserting explicit ids into an identity or serial column, advance the
  sequence: `SELECT setval(pg_get_serial_sequence('t', 'id'), (SELECT max(id)
  FROM t))`.
- Insert parents before children; or defer constraints within the transaction.
- Synthetic values only. Never production copies or real people.

## Queries and performance

- Diagnose with `EXPLAIN (ANALYZE, BUFFERS)` on realistic data, never guess.
  Look for: sequential scans on large tables under a selective filter,
  estimated vs actual row counts off by 10× or more (run `ANALYZE`, consider
  extended statistics), nested loops over large outer sets, sorts spilling to
  disk.
- `pg_stat_statements` finds the queries worth fixing:

  ```sql
  SELECT calls, round(total_exec_time) AS total_ms,
         round(mean_exec_time, 1) AS mean_ms, left(query, 120) AS query
  FROM pg_stat_statements
  ORDER BY total_exec_time DESC
  LIMIT 20;
  ```

- Keyset pagination (`WHERE (created_at, id) < ($1, $2) ORDER BY created_at
  DESC, id DESC LIMIT n`) over `OFFSET` on large sets.
- Avoid N+1 query patterns; fetch related rows in one query or a join.

## Operate

- **Transactions**: default `READ COMMITTED`. Use `SERIALIZABLE` (with retry)
  or `SELECT ... FOR UPDATE` for read-then-write invariants. Keep transactions
  short; never hold one open across a network call.
- **Queues in a table**: `SELECT ... FOR UPDATE SKIP LOCKED LIMIT n`.
- **Locks**: find blockers with

  ```sql
  SELECT pid, pg_blocking_pids(pid) AS blocked_by, wait_event_type, state,
         left(query, 80) AS query
  FROM pg_stat_activity
  WHERE cardinality(pg_blocking_pids(pid)) > 0;
  ```

- **Serialize one-off work across processes** with an advisory lock
  (`pg_advisory_lock(key)`), e.g. applying migrations at startup.
- **Vacuum**: leave autovacuum on; tune per table for hot update-heavy tables.
  Watch dead tuples and transaction-id age.
- **Roles** (the database administrator's, with every grant): the
  application connects as a least-privilege role that owns nothing it does not
  need; migrations run as the schema owner. No superuser application
  connections. Row-level security for tenant isolation.
- **Connections**: pool them (PgBouncer, RDS Proxy, or the driver pool); size
  the pool well below `max_connections`. Backend sizes the driver pool;
  infrastructure sizes a managed proxy's.
- **Backups**: point-in-time recovery (WAL archiving or the managed service's
  equivalent) is the backup; `pg_dump` is for copies and migrations. A backup
  never restored is not a backup.
- **Encryption**: TLS in transit; managed encryption at rest.
- **Upgrades**: read the major-version release notes for incompatibilities;
  run the test suite against the new version first.
