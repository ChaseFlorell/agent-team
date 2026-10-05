---
name: manage-ef-core-migrations
description: Write, review, and apply an EF Core migration safely — model first, generated not hand-written, never editing a past migration, working on empty and current databases — and seed data, baseline an existing database, or squash every migration into one before first release. Use when adding a table, column, index, constraint, or seed, when changing how a migration is applied, or when squashing migrations.
---

# Manage an EF Core migration

**Project rules.** A project may extend this skill with a companion skill that
names this one; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's schema conventions, paths, and commands, and wins
where they differ.

- Model design: [`design-ef-core-model`](../design-ef-core-model/SKILL.md).
  Relational design and safe DDL: [`postgres-dba`](../postgres-dba/SKILL.md).

## Rules

1. **A migration is the only way the schema changes.** No hand-written DDL, no
   hand-applied `psql` fix, no second `DbContext`.
2. **A past migration is never edited.** Fix a mistake with a new one. Do not
   retrofit new conventions onto old files. The only exception is a sanctioned
   squash ("Squash to one baseline").
3. **Both paths work**: an empty database and one at current `main`. A new
   column is nullable, defaulted, or backfilled by the same migration — never
   `NOT NULL` with no value for existing rows.
4. **Seed data is a migration**: idempotent, with fixed identifiers so a re-run
   cannot duplicate it. Synthetic only; never real user content or personal
   data.

## Generate

1. Change the model first: the entity, its `IEntityTypeConfiguration`, and its
   `DbSet` and `ApplyConfiguration` call in the `DbContext`. Never write the
   migration by hand.
2. Generate with `dotnet ef migrations add <DescriptiveName>`, passing the
   project and startup project that hold the `DbContext` and a design-time
   factory.
   - Name it for the change (`AddInvoiceDueDate`), not the ticket.
   - The startup project needs `Microsoft.EntityFrameworkCore.Design`, or the
     context project supplies an `IDesignTimeDbContextFactory<T>`.
   - Undo an uncommitted migration: `dotnet ef migrations remove` with the
     same project arguments.
3. Other commands, same project arguments:
   - `dotnet ef migrations list` — applied and pending;
   - `dotnet ef migrations has-pending-model-changes` — fails when the model
     and snapshot differ (EF 8+; run it in CI);
   - `dotnet ef migrations script <from> <to>` — the SQL; `--idempotent` for a
     script safe at any state;
   - `dotnet ef database update [<target>]` — local databases only.

## Review what it generated

Never commit a migration unread. Read the `.cs` and its SQL
(`dotnet ef migrations script <previous> <new>`). Check it:

- adds and never drops data the project keeps;
- does not turn a rename into drop + add — EF warns "may result in the loss of
  data"; rewrite it as `RenameColumn` / `RenameTable`;
- makes new columns nullable or defaulted, or backfills them
  (`migrationBuilder.Sql("UPDATE ...")`) before `NOT NULL`;
- gives every foreign key a chosen delete behavior — `Restrict` when a child
  outlives its parent's retirement, `SetNull` for a provenance pointer,
  `Cascade` only for rows genuinely part of the parent;
- matches the intended design: types, lengths, precision, keys, indexes, check
  constraints;
- does not lock or rewrite a large table unannounced — type changes, new
  constraints, and indexes follow [`postgres-dba`](../postgres-dba/SKILL.md)
  "Change a schema safely". A concurrent index uses `.IsCreatedConcurrently()`
  (Npgsql) or `migrationBuilder.Sql(..., suppressTransaction: true)`;
- has a correct `Down`, or one that throws when reversal would lose data;
- uses raw SQL only for what the model cannot express (views, functions,
  triggers, extensions, data moves);
- leaves the model snapshot consistent, committed in the same change, with
  `has-pending-model-changes` passing;
- follows the project's type and raw-SQL conventions.

## Seed data

Classify first ([`postgres-dba`](../postgres-dba/SKILL.md) "Seed data"), then
pick the mechanism:

| Data | Mechanism |
|---|---|
| Small, static reference rows | `HasData`: fixed keys, scalar foreign keys (no navigations), deterministic values (no `DateTime.Now`, no `Guid.NewGuid()`). Every change scaffolds a migration. |
| Reference data too large or computed for the snapshot | a dedicated migration: `InsertData`, or `Sql("INSERT ... ON CONFLICT DO NOTHING")`, with ids from one constants class |
| Development or demo data | `UseSeeding` / `UseAsyncSeeding` (EF 9+) or a startup seeder, gated to development and idempotent |
| Test data | built by each test; never shared |

## How it is applied

- Nobody applies it by hand. The project documents the one mechanism that
  applies migrations, and a change never adds a second.
- The mechanisms, for a project choosing one:
  - **At startup**: `Database.MigrateAsync()`. Serialize instances — EF 9+
    takes a migration lock where the provider supports it; otherwise hold a
    PostgreSQL advisory lock and re-check pending migrations once it is held.
  - **Deploy step**: an idempotent script or a migration bundle
    (`dotnet ef migrations bundle`), run before the new code starts.
- Never `EnsureCreated()` alongside migrations; it bypasses them.
- EF 9+ `Migrate` fails on pending model changes, so a missing migration is a
  deploy failure; catch it in CI.
- Old code runs against the new schema until rollout finishes. Destructive
  changes follow expand → migrate → contract across releases.

## Baseline an existing database

To put a database built without migrations under them: build the model
(`dotnet ef dbcontext scaffold` to read it), generate the initial migration,
prove it matches (step 7 of the squash below), then insert its row into
`__EFMigrationsHistory` instead of running it.

## Squash to one baseline

Collapse every migration into one initial migration of the final schema.
Allowed only while no database whose data must be kept has applied the
migrations — typically before the first production release — and only with
the project owner's recorded decision (an ADR), since it breaks rule 2.

1. **Freeze.** Start from a clean, current main branch. Note the last
   migration id. No schema change merges until the squash does.
2. **Capture the reference.** Apply the existing chain to an empty database
   and dump it:

   ```sh
   pg_dump --schema-only --no-owner --no-privileges \
     --exclude-table=__EFMigrationsHistory "$DB" > before-schema.sql
   pg_dump --data-only --no-owner \
     --exclude-table-data=__EFMigrationsHistory "$DB" > before-data.sql
   ```

   The data dump holds seed rows only; the database is otherwise empty.
3. **Inventory what the model cannot regenerate.** Find every `Sql(...)`,
   `InsertData`, `UpdateData`, and loaded `.sql` file. Classify each:
   - schema objects (extensions, types, functions, views, triggers, constraints
     outside the model) → carry the **final** definition forward;
   - seed rows → carry the **final** rows forward;
   - transforms of existing rows (backfills, copies, fixes) → drop; an empty
     database has nothing to transform.
4. **Delete** every migration, its `.Designer.cs`, and the snapshot. Remove
   `.sql` files that only served dropped steps. Git history keeps the chain.
5. **Generate** the baseline with `dotnet ef migrations add` (the project's
   name for it, e.g. `InitialSchema`).
6. **Re-add** step 3's objects and seeds in the baseline's `Up`, in dependency
   order: extensions → types → the model's tables → functions → views →
   triggers → seed rows. Reverse them in `Down`. Final definitions only, never
   the history of `CREATE OR REPLACE` steps.
7. **Prove equivalence.** Apply the baseline to a fresh empty database, dump it
   the same way, and diff:

   ```sh
   diff <(grep -v '^--' before-schema.sql) <(grep -v '^--' after-schema.sql)
   diff before-data.sql after-data.sql
   ```

   Both diffs are empty, or every difference is explained (column order from
   historical `ADD COLUMN`s is the usual one). Then
   `has-pending-model-changes` passes and the full test suite is green.
8. **Reset disposable databases** (local, CI, development): drop and recreate.
   Only a database that must keep its data, with its schema proven identical:
   empty `__EFMigrationsHistory` and insert the baseline's row.
9. **Update references**: migration lists, schema diagrams, and anything
   citing an old migration name.
10. **Ship it alone**: one pull request holding only the squash.

## Before the pull request

- Run the tests that boot a real database, so a migration that cannot apply to
  an empty database fails there.
- **An entity-relationship diagram in the PR body** for any change that adds,
  removes, or restructures a table, column, relationship, or constraint:
  - the resulting shape of the **affected** tables only, not the whole
    database;
  - database names, primary and foreign keys, cardinality;
  - omit columns that do not help a reviewer see the change;
  - put it in the ADR too when the change warrants one.
- Update the project's migration list and schema documentation when the shape
  or the logical record changed. Add an ADR for a rejected alternative or a
  durable trade-off.
