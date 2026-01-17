# Changelog

## [2.1.1] - 2026-01-17

### Fixed
- WebSocket routes in `unauthenticatedServices` no longer call `loadSession`. Previously, all WebSocket routes called `loadSession` regardless of which array they were defined in.
