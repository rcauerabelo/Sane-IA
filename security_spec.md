# Security Specification — SaneIA Firestore Rules

## 1. Data Invariants

1. **PII Isolation (`usuarios/{userId}`)**: Only the authenticated owner (`request.auth.uid == userId`) with verified email can read, create, or update their profile document. `uid` and `createdAt` are immutable.
2. **Ticket Ownership (`chamados/{chamadoId}`)**: A ticket cannot be created without valid existing `regiaoId` and `tipoProblemaId` references, must set `usuarioId == request.auth.uid`, and must start with `status == 'ABERTO'` and `fotosCount == 0`. List queries are strictly constrained to `resource.data.usuarioId == request.auth.uid`.
3. **Subcollections (`fotos` and `analise`)**: Both subcollections derive ownership synchronously via `get(/databases/$(database)/documents/chamados/$(chamadoId)).data.usuarioId == request.auth.uid`.
4. **Terminal State Lock**: Once `chamados/{chamadoId}.status == 'RESOLVIDO'`, further status or field updates on the ticket are blocked.
5. **Strict Payload Boundaries**: Every string, enum, boolean, integer, number, bounded array (`passosResolucao <= 8`), and timestamp is strictly type-checked and length-bounded, and every document enforces `keys().hasAll(...)` + `keys().hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update.
6. **Saved Addresses PII Isolation (`usuarios/{userId}/enderecos/{enderecoId}`)**: Saved street addresses, CEP, and exact coordinates are strictly private to the owner (`request.auth.uid == userId` with verified email). `usuarioId` and `createdAt` are immutable; coordinates are strictly bounded (`lat` in `[-90, 90]`, `lng` in `[-180, 180]`).

## 2. The "Dirty Dozen" Adversarial Payloads

1. Unauthenticated read on `/usuarios/user1` -> `PERMISSION_DENIED`
2. Authenticated User A reading User B's PII `/usuarios/userB` or `/usuarios/userB/enderecos/e1` -> `PERMISSION_DENIED`
3. User creating `/usuarios/userA` with `uid: "userB"` or `/usuarios/userA/enderecos/e1` with `usuarioId: "userB"` (Identity Spoofing) -> `PERMISSION_DENIED`
4. User updating `/usuarios/userA` with a ghost field `{ isAdmin: true }` (Shadow Update) -> `PERMISSION_DENIED`
5. User with `email_verified: false` creating `/chamados/c1` or `/usuarios/userA/enderecos/e1` (Email Spoofing) -> `PERMISSION_DENIED`
6. User creating `/chamados/c1` with nonexistent `regiaoId: "fake"` (Orphaned Reference) -> `PERMISSION_DENIED`
7. User creating `/chamados/c1` with `status: "RESOLVIDO"` initially (State Shortcutting) -> `PERMISSION_DENIED`
8. User listing `/chamados` without `where('usuarioId', '==', uid)` (Blanket List Scrape) -> `PERMISSION_DENIED`
9. User injecting a 2MB string into `chamados/c1.titulo` or invalid coordinates (`latitude: 999`) (Resource Poisoning) -> `PERMISSION_DENIED`
10. User updating a `RESOLVIDO` ticket back to `ABERTO` (Terminal State Bypass) -> `PERMISSION_DENIED`
11. User B adding a photo to User A's ticket `/chamados/c1/fotos/f1` (Subcollection Hijack) -> `PERMISSION_DENIED`
12. Client spoofing `createdAt` or `dataAbertura` with an arbitrary past timestamp instead of `request.time` (Temporal Tampering) -> `PERMISSION_DENIED`
