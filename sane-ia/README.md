# SANE IA

Back-end (API REST) em Java + Spring Boot para abertura de chamados sobre falta de saneamento e água nas periferias, com análise por Inteligência Artificial.

## Como rodar

1. Instale o **JDK 17+** e o **Maven** (ou abra a pasta no IntelliJ/Eclipse/VS Code).
2. Crie uma conta gratuita em https://console.groq.com e gere uma chave de API.
3. Defina a chave como variável de ambiente (nunca coloque no código nem suba no GitHub):
   - Windows (PowerShell): `$env:GROQ_API_KEY="sua_chave"`
   - Linux/Mac: `export GROQ_API_KEY="sua_chave"`
4. Na pasta do projeto: `mvn spring-boot:run`
5. A API sobe em http://localhost:8080 (console do banco em http://localhost:8080/h2-console, URL `jdbc:h2:mem:saneia`, usuário `sa`, senha vazia).

Já existem dados de exemplo (tipos de problema, órgãos, uma região e um usuário) para testar de imediato.

## Testando (Postman/Insomnia ou curl)

**1. Abrir chamado** - `POST /api/chamados`
```json
{
  "titulo": "Esgoto vazando na rua",
  "descricao": "Há duas semanas o esgoto corre a céu aberto na rua principal e as crianças brincam perto.",
  "usuarioId": 1,
  "regiaoId": 1,
  "tipoProblemaId": 3
}
```

**2. Anexar foto** - `POST /api/chamados/1/fotos` (form-data, campo `arquivo` do tipo File)

**3. Enviar para a IA e salvar a resposta** - `POST /api/chamados/1/analisar`

**4. Consultar** - `GET /api/chamados/1` (retorna o chamado com fotos e a análise da IA)

Outros: `GET /api/chamados`, `GET /api/tipos`, `GET /api/orgaos`, `GET /api/regioes`, `POST /api/usuarios`, `POST /api/regioes`.

## Estrutura (9 classes principais)

`Usuario`, `Regiao`, `TipoProblema`, `OrgaoResponsavel`, `Chamado`, `Foto`, `AnaliseIA`, `StatusChamado` (enum) e `IAClient` (integração com a IA). O restante (repositories, service, controllers) é apoio.

## Funcionalidades do MVP (3)

1. Abrir chamado com fotos e região
2. Enviar o chamado para a IA (monta o prompt e chama a API)
3. Salvar a resposta da IA no banco e exibi-la depois

## Próximas iterações

Login de usuário, painel para os órgãos, análise de imagem pela IA, mapa por região, troca do H2 por MySQL/PostgreSQL.

O diagrama MER e o script SQL estão em `docs/MER.md`.
