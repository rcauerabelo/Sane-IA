package com.saneia.repository;

import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.FieldValue;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.WriteBatch;
import com.saneia.dto.EnderecoDtos.EnderecoResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
@ConditionalOnBean(Firestore.class)
public class EnderecoRepository {

    private final Firestore firestore;

    public EnderecoRepository(Firestore firestore) {
        this.firestore = firestore;
    }

    private CollectionReference enderecosCollection(String uid) {
        return firestore.collection("usuarios").document(uid).collection("enderecos");
    }

    public List<EnderecoResponse> findAllByUser(String uid) {
        List<QueryDocumentSnapshot> docs = FirestoreSupport.await(
                enderecosCollection(uid).get(),
                "listar endereços do usuário"
        ).getDocuments();

        return docs.stream()
                .map(this::toResponse)
                .sorted(Comparator
                        .comparing(EnderecoResponse::principal).reversed()
                        .thenComparing(
                                e -> e.updatedAt() != null ? e.updatedAt().toEpochMilli() : 0L,
                                Comparator.reverseOrder()
                        ))
                .toList();
    }

    public Optional<EnderecoResponse> findById(String uid, String enderecoId) {
        DocumentSnapshot snap = FirestoreSupport.await(
                enderecosCollection(uid).document(enderecoId).get(),
                "buscar endereço"
        );
        if (!snap.exists()) {
            return Optional.empty();
        }
        return Optional.of(toResponse(snap));
    }

    public EnderecoResponse saveWithPrincipalBatch(
            String uid,
            String existingId,
            Map<String, Object> fields,
            boolean shouldBePrincipal
    ) {
        CollectionReference colRef = enderecosCollection(uid);
        DocumentReference targetRef = existingId != null && !existingId.isBlank()
                ? colRef.document(existingId)
                : colRef.document();

        WriteBatch batch = firestore.batch();

        if (shouldBePrincipal) {
            List<QueryDocumentSnapshot> currentDocs = FirestoreSupport.await(
                    colRef.get(),
                    "carregar endereços atuais"
            ).getDocuments();

            for (QueryDocumentSnapshot doc : currentDocs) {
                if (!doc.getId().equals(targetRef.getId())
                        && FirestoreSupport.booleanOrFalse(doc.get("principal"))) {
                    batch.update(doc.getReference(), Map.of(
                            "principal", false,
                            "updatedAt", FieldValue.serverTimestamp()
                    ));
                }
            }
        }

        Map<String, Object> payload = new HashMap<>(fields);
        payload.put("principal", shouldBePrincipal);
        payload.put("updatedAt", FieldValue.serverTimestamp());

        if (existingId != null && !existingId.isBlank()) {
            batch.update(targetRef, payload);
        } else {
            payload.put("createdAt", FieldValue.serverTimestamp());
            batch.set(targetRef, payload);
        }

        FirestoreSupport.await(batch.commit(), "salvar endereço");

        DocumentSnapshot saved = FirestoreSupport.await(targetRef.get(), "recarregar endereço salvo");
        return toResponse(saved);
    }

    public void setPrincipal(String uid, String enderecoId) {
        CollectionReference colRef = enderecosCollection(uid);
        List<QueryDocumentSnapshot> currentDocs = FirestoreSupport.await(
                colRef.get(),
                "carregar endereços para definir principal"
        ).getDocuments();

        WriteBatch batch = firestore.batch();
        for (QueryDocumentSnapshot doc : currentDocs) {
            boolean isTarget = doc.getId().equals(enderecoId);
            boolean currentlyPrincipal = FirestoreSupport.booleanOrFalse(doc.get("principal"));
            if (isTarget && !currentlyPrincipal) {
                batch.update(doc.getReference(), Map.of(
                        "principal", true,
                        "updatedAt", FieldValue.serverTimestamp()
                ));
            } else if (!isTarget && currentlyPrincipal) {
                batch.update(doc.getReference(), Map.of(
                        "principal", false,
                        "updatedAt", FieldValue.serverTimestamp()
                ));
            }
        }
        FirestoreSupport.await(batch.commit(), "atualizar endereço principal");
    }

    public void delete(String uid, String enderecoId) {
        FirestoreSupport.await(
                enderecosCollection(uid).document(enderecoId).delete(),
                "excluir endereço"
        );
    }

    private EnderecoResponse toResponse(DocumentSnapshot snap) {
        Double lat = FirestoreSupport.doubleOrNull(snap.get("latitude"));
        Double lng = FirestoreSupport.doubleOrNull(snap.get("longitude"));
        return new EnderecoResponse(
                snap.getId(),
                FirestoreSupport.stringOrEmpty(snap.get("usuarioId")),
                FirestoreSupport.stringOrEmpty(snap.get("apelido")),
                FirestoreSupport.stringOrEmpty(snap.get("cep")),
                FirestoreSupport.stringOrEmpty(snap.get("logradouro")),
                FirestoreSupport.stringOrEmpty(snap.get("numero")),
                FirestoreSupport.stringOrEmpty(snap.get("complemento")),
                FirestoreSupport.stringOrEmpty(snap.get("bairro")),
                FirestoreSupport.stringOrEmpty(snap.get("cidade")),
                FirestoreSupport.stringOrEmpty(snap.get("estado")),
                FirestoreSupport.stringOrEmpty(snap.get("referencia")),
                lat != null ? lat : 0.0,
                lng != null ? lng : 0.0,
                FirestoreSupport.booleanOrFalse(snap.get("principal")),
                FirestoreSupport.toInstant(snap.get("createdAt")),
                FirestoreSupport.toInstant(snap.get("updatedAt"))
        );
    }
}
