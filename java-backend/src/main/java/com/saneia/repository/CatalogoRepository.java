package com.saneia.repository;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.FieldValue;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.saneia.dto.CatalogoDtos.OrgaoResponsavelResponse;
import com.saneia.dto.CatalogoDtos.RegiaoResponse;
import com.saneia.dto.CatalogoDtos.TipoProblemaResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
@ConditionalOnBean(Firestore.class)
public class CatalogoRepository {

    private static final Map<String, String> DEFAULT_TIPOS = Map.of(
            "1", "Falta de água",
            "2", "Vazamento de água",
            "3", "Esgoto a céu aberto",
            "4", "Falta de rede de esgoto",
            "5", "Lixo acumulado / drenagem",
            "6", "Qualidade da água"
    );

    private static final List<Map.Entry<String, OrgaoSeed>> DEFAULT_ORGAOS = List.of(
            Map.entry("1", new OrgaoSeed("Companhia de Saneamento", "0800-000-0000")),
            Map.entry("2", new OrgaoSeed("Prefeitura - Secretaria de Obras", "156")),
            Map.entry("3", new OrgaoSeed("Vigilância Sanitária", "0800-111-1111"))
    );

    private record OrgaoSeed(String nome, String contato) {}

    private final Firestore firestore;

    public CatalogoRepository(Firestore firestore) {
        this.firestore = firestore;
    }

    public void ensureInitialCatalogs(String uid) {
        List<QueryDocumentSnapshot> tiposDocs = FirestoreSupport.await(
                firestore.collection("tipos_problema").get(),
                "verificar tipos_problema"
        ).getDocuments();

        if (tiposDocs.isEmpty()) {
            for (var entry : DEFAULT_TIPOS.entrySet()) {
                DocumentReference ref = firestore.collection("tipos_problema").document(entry.getKey());
                DocumentSnapshot snap = FirestoreSupport.await(ref.get(), "verificar tipo padrão");
                if (!snap.exists()) {
                    FirestoreSupport.await(ref.set(Map.of("nome", entry.getValue())), "semear tipo padrão");
                }
            }
        }

        List<QueryDocumentSnapshot> orgaosDocs = FirestoreSupport.await(
                firestore.collection("orgaos_responsaveis").get(),
                "verificar orgaos_responsaveis"
        ).getDocuments();

        if (orgaosDocs.isEmpty()) {
            for (var entry : DEFAULT_ORGAOS) {
                DocumentReference ref = firestore.collection("orgaos_responsaveis").document(entry.getKey());
                DocumentSnapshot snap = FirestoreSupport.await(ref.get(), "verificar órgão padrão");
                if (!snap.exists()) {
                    FirestoreSupport.await(
                            ref.set(Map.of("nome", entry.getValue().nome(), "contato", entry.getValue().contato())),
                            "semear órgão padrão"
                    );
                }
            }
        }

        List<QueryDocumentSnapshot> regioesDocs = FirestoreSupport.await(
                firestore.collection("regioes").get(),
                "verificar regioes"
        ).getDocuments();

        if (regioesDocs.isEmpty()) {
            DocumentReference ref = firestore.collection("regioes").document("regiao_padrao");
            DocumentSnapshot snap = FirestoreSupport.await(ref.get(), "verificar região padrão");
            if (!snap.exists()) {
                Map<String, Object> data = new HashMap<>();
                data.put("bairro", "Jardim Exemplo");
                data.put("cidade", "São Paulo");
                data.put("estado", "SP");
                data.put("criadoPorUid", uid);
                data.put("createdAt", FieldValue.serverTimestamp());
                FirestoreSupport.await(ref.set(data), "semear região padrão");
            }
        }
    }

    public List<TipoProblemaResponse> findAllTipos() {
        return FirestoreSupport.await(
                firestore.collection("tipos_problema").get(),
                "listar tipos de problema"
        ).getDocuments().stream()
                .map(d -> new TipoProblemaResponse(d.getId(), FirestoreSupport.stringOrEmpty(d.get("nome"))))
                .sorted(Comparator.comparing(TipoProblemaResponse::id))
                .toList();
    }

    public Optional<TipoProblemaResponse> findTipoById(String tipoId) {
        DocumentSnapshot snap = FirestoreSupport.await(
                firestore.collection("tipos_problema").document(tipoId).get(),
                "buscar tipo de problema"
        );
        if (!snap.exists()) {
            return Optional.empty();
        }
        return Optional.of(new TipoProblemaResponse(snap.getId(), FirestoreSupport.stringOrEmpty(snap.get("nome"))));
    }

    public List<OrgaoResponsavelResponse> findAllOrgaos() {
        return FirestoreSupport.await(
                firestore.collection("orgaos_responsaveis").get(),
                "listar órgãos responsáveis"
        ).getDocuments().stream()
                .map(d -> new OrgaoResponsavelResponse(
                        d.getId(),
                        FirestoreSupport.stringOrEmpty(d.get("nome")),
                        FirestoreSupport.stringOrEmpty(d.get("contato"))
                ))
                .sorted(Comparator.comparing(OrgaoResponsavelResponse::id))
                .toList();
    }

    public List<RegiaoResponse> findAllRegioes() {
        return FirestoreSupport.await(
                firestore.collection("regioes").get(),
                "listar regiões"
        ).getDocuments().stream()
                .map(this::toRegiaoResponse)
                .sorted(Comparator.comparing(RegiaoResponse::bairro, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public Optional<RegiaoResponse> findRegiaoById(String regiaoId) {
        DocumentSnapshot snap = FirestoreSupport.await(
                firestore.collection("regioes").document(regiaoId).get(),
                "buscar região"
        );
        if (!snap.exists()) {
            return Optional.empty();
        }
        return Optional.of(toRegiaoResponse(snap));
    }

    public RegiaoResponse createRegiao(String uid, String bairro, String cidade, String estado) {
        DocumentReference ref = firestore.collection("regioes").document();
        Map<String, Object> data = new HashMap<>();
        data.put("bairro", bairro);
        data.put("cidade", cidade);
        data.put("estado", estado);
        data.put("criadoPorUid", uid);
        data.put("createdAt", FieldValue.serverTimestamp());
        FirestoreSupport.await(ref.set(data), "criar região");

        DocumentSnapshot created = FirestoreSupport.await(ref.get(), "recarregar região criada");
        return toRegiaoResponse(created);
    }

    private RegiaoResponse toRegiaoResponse(DocumentSnapshot snap) {
        return new RegiaoResponse(
                snap.getId(),
                FirestoreSupport.stringOrEmpty(snap.get("bairro")),
                FirestoreSupport.stringOrEmpty(snap.get("cidade")),
                FirestoreSupport.stringOrEmpty(snap.get("estado")),
                FirestoreSupport.stringOrEmpty(snap.get("criadoPorUid")),
                FirestoreSupport.toInstant(snap.get("createdAt"))
        );
    }
}
