# SaneIA — Backend REST em Java 21 + Spring Boot 3

Projeto **Java 21 + Spring Boot 3 (Maven)** exportável do **SaneIA**, estruturado em camadas limpas (`controller`, `service`, `repository`, `client`, `security`, `exception`, `dto`, `model`) e conectado ao mesmo **Firebase Auth**, **Cloud Firestore** (`ai-studio-saneia-7a98979b-e267-4f19-8dc1-db7bc22e3868`), **ViaCEP**, **Google Maps Geocoding API** e **Groq API** utilizados pela prévia do aplicativo.

---

## Pré-requisitos

- **JDK 21** (Eclipse Temurin, Oracle JDK ou OpenJDK 21)
- **Maven 3.9+** (ou IDE como IntelliJ IDEA / Eclipse / VS Code)
- **Credencial Service Account do Firebase** para o projeto `gen-lang-client-0625814070` (ou Application Default Credentials via `gcloud auth application-default login`)

---

## Configuração Rápida

1. Copie `.env.example` para `.env` (ou exporte as variáveis no seu terminal/IDE):

```bash
cp .env.example .env
```

2. Preencha as variáveis:
   - `FIREBASE_PROJECT_ID=gen-lang-client-0625814070`
   - `FIREBASE_DATABASE_ID=ai-studio-saneia-7a98979b-e267-4f19-8dc1-db7bc22e3868`
   - `FIREBASE_CREDENTIALS_PATH=/caminho/para/service-account.json` (ou `FIREBASE_CREDENTIALS_JSON`)
   - `GROQ_API_KEY=...`
   - `GOOGLE_MAPS_API_KEY=...`

3. Execute os testes unitários:

```bash
cd java-backend
mvn test
```

4. Execute o servidor Spring Boot localmente:

```bash
cd java-backend
mvn spring-boot:run
```

Ou via Docker:

```bash
cd java-backend
docker build -t saneia-java-backend .
docker run -p 8080:8080 --env-file .env saneia-java-backend
```

---

## Endpoints Disponíveis

### Públicos (Saúde, CEP e Mapas)
- `GET /api/health` — Status do serviço Java
- `GET /api/config/maps` — Chave do Google Maps configurada no servidor
- `GET /api/cep/{cep}?geocode=1` — Consulta CEP via ViaCEP + centralização no Google Maps
- `GET /api/geocode/reverse?lat=...&lng=...` — Geocodificação reversa (toque no mapa)
- `GET /api/geocode/address?q=...` — Busca de endereço no mapa

### Autenticados (`Authorization: Bearer <Firebase ID Token>`)
- `GET /api/me` / `PUT /api/me` — Consulta e atualização cadastral do morador (`usuarios/{uid}`)
- `GET /api/catalogos` — Carrega `tipos_problema`, `orgaos_responsaveis` e `regioes` (semeando dados iniciais caso vazio)
- `GET /api/regioes` / `POST /api/regioes` / `GET /api/tipos` / `GET /api/orgaos`
- `GET /api/enderecos` / `POST /api/enderecos` / `PUT /api/enderecos/{id}` / `PATCH /api/enderecos/{id}/principal` / `DELETE /api/enderecos/{id}` — Meus Endereços
- `GET /api/chamados?status=...` / `POST /api/chamados` / `GET /api/chamados/{id}` / `PATCH /api/chamados/{id}/status`
- `POST /api/chamados/{id}/fotos` (`multipart/form-data`, campo `arquivo`, até 5 MB)
- `POST /api/chamados/{id}/analisar` — Executa análise de urgência e órgão responsável via Groq IA
