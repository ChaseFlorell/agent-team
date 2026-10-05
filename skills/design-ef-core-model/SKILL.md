---
name: design-ef-core-model
description: Express a PostgreSQL schema design as an EF Core (Npgsql) model — entity configuration, one-to-one, one-to-many, and many-to-many mapping, delete behavior, type mapping, constraints, indexes, query filters, and efficient queries. Use when adding or changing an entity, DbContext, relationship, or query shape. Generic EF Core 8+.
---

# Design an EF Core model

**Project rules.** A project may extend this skill with a companion skill that
names this one; its agent instructions (`AGENTS.md`) list it. Read both. The
companion holds the project's conventions and wins where they differ.

- The relational design itself — tables, keys, relationships, types, indexes —
  comes from [`postgres-dba`](../postgres-dba/SKILL.md).
- Turning a model change into a migration:
  [`manage-ef-core-migrations`](../manage-ef-core-migrations/SKILL.md).

## Working rules

- **Design the table first, then the class.** Write the intended DDL or an
  entity-relationship diagram, map it, then check the generated SQL
  (`dotnet ef migrations script`) matches it.
- **The model is the source of truth for the schema.** Every constraint the
  database needs is in the model or in migration SQL, never only in
  application code.
- Match versions: `Microsoft.EntityFrameworkCore.*` and
  `Npgsql.EntityFrameworkCore.PostgreSQL` share a major version.

## Configure the model

- One `IEntityTypeConfiguration<T>` per entity, applied in `OnModelCreating`.
  Fluent API over data annotations: it keeps entities persistence-free and
  covers everything annotations cannot.
- Nullable reference types on: `string` is `NOT NULL`, `string?` is nullable.
  Required-ness follows the C# type, so get it right there.
- Names: `snake_case` through one convention (for example
  `UseSnakeCaseNamingConvention()` from `EFCore.NamingConventions`). Hand-name
  only exceptions.
- `ConfigureConventions` for types used everywhere: a value-object key,
  decimal precision, string-backed enums.
- Constraints and indexes:
  - unique: `HasIndex(...).IsUnique()` or `HasAlternateKey(...)`;
  - check: `ToTable(t => t.HasCheckConstraint("ck_name", "sql"))`;
  - partial: `HasIndex(...).HasFilter("deleted_at IS NULL")`;
  - covering: `.IncludeProperties(...)`; GIN: `.HasMethod("gin")`;
  - database default: `HasDefaultValueSql("now()")`; computed:
    `HasComputedColumnSql("...", stored: true)`.
- Soft delete: `HasQueryFilter(e => e.DeletedAt == null)`; bypass with
  `IgnoreQueryFilters()` only where a read must see removed rows. EF Core 10+
  can name filters and disable one at a time.
  - Cascade a soft delete explicitly, across the aggregate, with one timestamp.

## Map relationships

Configure each relationship once, from one side.

| Relationship | Configuration |
|---|---|
| One-to-many | `b.HasOne(c => c.Parent).WithMany(p => p.Children).HasForeignKey(c => c.ParentId)` |
| One-to-one, unique FK | `b.HasOne(u => u.Profile).WithOne(p => p.User).HasForeignKey<Profile>(p => p.UserId)` — EF adds the unique index |
| One-to-one, shared PK | `.HasForeignKey<Profile>(p => p.Id)` — the dependent's key is the FK |
| Many-to-many, no payload | skip navigations: `b.HasMany(p => p.Tags).WithMany(t => t.Posts).UsingEntity(j => j.ToTable("post_tags"))` |
| Many-to-many, with payload | an explicit join entity with its own configuration and `HasKey(e => new { e.AId, e.BId })`; prefer it whenever the link may ever carry data |
| Self-reference | `b.HasOne(n => n.Parent).WithMany(n => n.Children).HasForeignKey(n => n.ParentId)` |
| Value object in the same row | `ComplexProperty` (or `OwnsOne`) |
| Value object as `jsonb` | `OwnsOne(...).ToJson()` / `ComplexProperty(...).ToJson()` where the provider version supports it |

- **Set `OnDelete` on every relationship.** EF defaults to `Cascade` for a
  required relationship and `ClientSetNull` for an optional one; a silent
  cascade is the most common EF schema defect. Choose per
  [`postgres-dba`](../postgres-dba/SKILL.md) "One-to-many".
- EF indexes every foreign key by convention; keep it, or replace it with a
  composite index that leads on the FK.
- Initialize collection navigations in the entity; expose no setter for them.

## Map types (Npgsql)

| C# | PostgreSQL | Notes |
|---|---|---|
| `string` | `text` | `HasMaxLength(n)` → `varchar(n)`; `IsFixedLength()` → `char(n)` |
| `int` / `long` | `integer` / `bigint` | identity keys: `long` + `UseIdentityAlwaysColumn()` |
| `decimal` | `numeric` | always `HasPrecision(p, s)` |
| `bool` | `boolean` | |
| `DateTimeOffset` | `timestamptz` | Npgsql writes offset zero only; convert to UTC first |
| `DateTime` | `timestamptz` (Kind `Utc`) / `timestamp` (`Unspecified`) | prefer `DateTimeOffset`, `DateOnly`, `TimeOnly` |
| `DateOnly` / `TimeOnly` | `date` / `time` | |
| `TimeSpan` | `interval` | |
| `Guid` | `uuid` | `Guid.CreateVersion7()` (.NET 9+) when insert order matters |
| `enum` | `integer` by default | as text: `.HasConversion<string>()` plus a `CHECK`; or a PostgreSQL enum via `MapEnum<T>()` |
| `string[]` / `List<string>` | `text[]` | |
| `uint` + `.IsRowVersion()` | `xmin` system column | optimistic concurrency without a column |
| `NpgsqlRange<T>` | range types | |
| `IPAddress` | `inet` | |
| `JsonDocument` / POCO | `jsonb` | `.HasColumnType("jsonb")` or `ToJson()` |

- A custom value object: a `ValueConverter` (and a `ValueComparer` for mutable
  types), registered once in `ConfigureConventions`.

## Query

- Read paths: `AsNoTracking()` and a projection (`Select`) into a DTO holding
  exactly the fields the use case needs.
- Related data: `Include` for small graphs; `AsSplitQuery()` when several
  collection includes multiply rows. Never lazy loading in a loop (N+1).
- Bulk changes: `ExecuteUpdateAsync` / `ExecuteDeleteAsync` bypass the change
  tracker, interceptors, and soft-delete logic — use them deliberately.
- A read that applies a rule several callers share can be a database view,
  mapped read-only with `ToView(...)` and `HasNoKey()`.
- See the SQL: `ToQueryString()`, or `LogTo` in development. Never enable
  `EnableSensitiveDataLogging` outside a local machine. `EXPLAIN` the slow ones
  ([`postgres-dba`](../postgres-dba/SKILL.md) "Queries and performance").

## Database-first

- Read an existing database's shape with
  `dotnet ef dbcontext scaffold "<connection>" Npgsql.EntityFrameworkCore.PostgreSQL --output-dir Scaffolded`,
  then hand-shape the model rather than keeping generated code wholesale.
- Bringing an existing database under migrations:
  [`manage-ef-core-migrations`](../manage-ef-core-migrations/SKILL.md)
  "Baseline an existing database".
