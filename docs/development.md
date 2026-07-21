# Development

Run `npm run dev` for Node's watch mode. The app builder in `src/http/create-app.js` opens no ports, so contract tests can construct an isolated Express application. Runtime integration tests should use ephemeral ports and always close returned services.

Primary checks:

```powershell
npm run config:check
npm test
```

Add business behavior to the owning domain service, then expose it through v2 and, when required, a thin legacy adapter. Routers must not export service state or import other routers. Integrations may depend on external APIs; domain services receive or import integration adapters, never HTTP route modules.

Keep `docs/openapi.yaml` synchronized with every canonical v2 route. Tests validate the specification and representative response contracts.
