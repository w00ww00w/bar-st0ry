# Project operating guide

Read `docs/brain/README.md` before changing product code. It is the project index.

Keep the product web-first and iOS-ready: domain data and progress rules must not depend on browser UI APIs. Prefer platform features and installed dependencies; add packages only when the existing stack cannot solve the task safely.

When a change adds, removes, or renames a module, public function, route, or storage key, update `docs/brain/graph.md`. Record durable architectural choices in `docs/brain/decisions.md`; do not log routine implementation details.

