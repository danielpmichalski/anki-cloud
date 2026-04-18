# anki-sync-server

Rust Cargo workspace containing the Anki sync server binary, forked from
[`ankitects/anki@25.09`](https://github.com/ankitects/anki/tree/25.09).

## What's in here

```
anki-sync-server/
├── Cargo.toml          ← workspace root — the only file NOT from upstream
├── Cargo.lock          ← copied from upstream for reproducible builds
├── README.md           ← this file
├── ftl/                ← verbatim copy of ankitects/anki ftl/ (Fluent translations, required by anki_i18n build script)
└── rslib/              ← verbatim copy of ankitects/anki rslib/ at 25.09
    ├── Cargo.toml      ← the `anki` library crate
    ├── build.rs        ← generates Rust code from .proto files (requires protoc)
    ├── src/
    │   └── sync/
    │       └── http_server/   ← ADR-0003 hook points (fetch/commit) will live here
    ├── sync/
    │   ├── Cargo.toml  ← `anki-sync-server` binary crate
    │   └── main.rs
    ├── proto/          ← anki_proto crate (.proto definitions)
    ├── proto_gen/      ← anki_proto_gen (build-dep, not a workspace member)
    ├── i18n/           ← anki_i18n
    ├── io/             ← anki_io
    └── process/        ← anki_process
```

`rslib/` is a pure upstream copy — do not modify files inside it directly.
Our changes (GDrive storage adapter, CollectionStorage trait) will be added
as a separate layer once the fork is validated. See [ADR-0003](../docs/decisions/0003-fork-rust-ankitects-sync-server.md).

## Prerequisites

- Rust stable ≥ 1.80 (`rustup update stable`)
- Protocol Buffers compiler: `brew install protobuf` (macOS) or `apt install protobuf-compiler` (Linux)

## Build

```bash
source ~/.cargo/env   # if cargo isn't on PATH yet
cd anki-sync-server
cargo build --bin anki-sync-server
```

The binary lands at `target/debug/anki-sync-server`.

## Run

```bash
SYNC_USER1=user:password ./target/debug/anki-sync-server
# Listens on 0.0.0.0:8080 by default. See https://docs.ankiweb.net/sync-server.html
```

Key environment variables:

| Variable | Default | Description |
|---|---|---|
| `SYNC_USER1` | — | `username:password` (repeat for SYNC_USER2, etc.) |
| `SYNC_BASE` | `~/.syncserver` | Directory for user collection files |
| `SYNC_HOST` | `0.0.0.0` | Bind address |
| `SYNC_PORT` | `8080` | Bind port |

## Test

```bash
cargo test -p anki-sync-server
```

## Upgrading to a new Anki release

Run the fork script with the new tag. It replaces `rslib/` and `Cargo.lock`
while leaving `Cargo.toml` and this `README.md` untouched.

```bash
./scripts/fork-anki-sync-server.zsh 25.12
```

After upgrading, rebuild and re-run tests to verify compatibility.
