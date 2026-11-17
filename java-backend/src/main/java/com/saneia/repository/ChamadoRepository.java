package com.saneia.repository;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.FieldValue;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.WriteBatch;
import com.saneia.dto.ChamadoDtos.AnaliseIAResponse;
import com.saneia.dto.ChamadoDtos.ChamadoResponse;
import com.saneia.dto.ChamadoDtos.FotoResponse;
import com.saneia.model.StatusChamado;
import com.saneia.model.UrgenciaIA;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Repository;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
@ConditionalOnBean(Firestore.class)
public class ChamadoRepository {

    private static final String COLLECTION = "chamados";
    private static final String SUBCOLLECTION_FOTOS = "fotos";
    private static final String SUBCOLLECTION_ANALISE = "analise";
    private static final String ANALISE_DOC_ID = "atual";

    private final Firestore firestore;

    public ChamadoRepository(Firestore firestore) {
        this.firestore = firestore;
    }

    public List<ChamadoResponse> findAllByUsuarioId(String uid) {
        List<QueryDocumentSnapshot> docs = FirestoreSupport.await(
                firestore.collection(COLLECTION).whereEqualTo("usuarioId", uid).get(),
                "listar chamados do usuário"
        ).getDocuments();

        return docs.stream()
                .map(this::toChamadoResponse)
                .sorted(Comparator.comparing(
                        c -> c.dataAbertura() != null ? c.dataAbertura().toEpochMilli() : 0L,
                        Comparator.reverseOrder()
                ))
                .toList();
    }

    public Optional<ChamadoResponse> findById(String chamadoId) {
        DocumentSnapshot snap = FirestoreSupport.await(
                firestore.collection(COLLECTION).document(chamadoId).get(),
                "buscar chamado"
        );
        if (!snap.exists()) {
            return Optional.empty();
        }
        return Optional.of(toChamadoResponse(snap));
    }

    public ChamadoResponse create(Map<String, Object> fields) {
        DocumentReference ref = firestore.collection(COLLECTION).document();
        Map<String, Object> payload = new HashMap<>(fields);
        payload.put("dataAbertura", FieldValue.serverTimestamp());
        payload.put("updatedAt", FieldValue.serverTimestamp());
        FirestoreSupport.await(ref.set(payload), "criar chamado");

        DocumentSnapshot created = FirestoreSupport.await(ref.get(), "recarregar chamado criado");
        return toChamadoResponse(created);
    }

    public ChamadoResponse updateStatus(String chamadoId, StatusChamado status) {
        DocumentReference ref = firestore.collection(COLLECTION).document(chamadoId);
        FirestoreSupport.await(
                ref.update(Map.of(
                        "status", status.name(),
                        "updatedAt", FieldValue.serverTimestamp()
                )),
                "atualizar status do chamado"
        );
        DocumentSnapshot updated = FirestoreSupport.await(ref.get(), "recarregar chamado atualizado");
        return toChamadoResponse(updated);
    }

    public List<FotoResponse> findFotosByChamadoId(String chamadoId) {
        List<QueryDocumentSnapshot> docs = FirestoreSupport.await(
                firestore.collection(COLLECTION).document(chamadoId).collection(SUBCOLLECTION_FOTOS).get(),
                "listar fotos do chamado"
        ).getDocuments();

        return docs.stream()
                .map(this::toFotoResponse)
                .sorted(Comparator.comparing(
                        f -> f.createdAt() != null ? f.createdAt().toEpochMilli() : 0L
                ))
                .toList();
    }

    public FotoResponse attachFotoAndIncrementCount(
            String chamadoId,
            String uid,
            String nomeArquivo,
            String mimeType,
            String imagemDataUrl
    ) {
        DocumentReference chamadoRef = firestore.collection(COLLECTION).document(chamadoId);
        DocumentReference fotoRef = chamadoRef.collection(SUBCOLLECTION_FOTOS).document();

        WriteBatch batch = firestore.batch();
        Map<String, Object> fotoPayload = new HashMap<>();
        fotoPayload.put("nomeArquivo", nomeArquivo);
        fotoPayload.put("mimeType", mimeType);
        fotoPayload.put("imagemDataUrl", imagemDataUrl);
        fotoPayload.put("chamadoId", chamadoId);
        fotoPayload.put("usuarioId", uid);
        fotoPayload.put("createdAt", FieldValue.serverTimestamp());

        batch.set(fotoRef, fotoPayload);
        batch.update(chamadoRef, Map.of(
                "fotosCount", FieldValue.increment(1),
                "updatedAt", FieldValue.serverTimestamp()
        ));

        FirestoreSupport.await(batch.commit(), "anexar foto ao chamado");
        DocumentSnapshot saved = FirestoreSupport.await(fotoRef.get(), "recarregar foto salva");
        return toFotoResponse(saved);
    }

    public Optional<AnaliseIAResponse> findAnaliseAtual(String chamadoId) {
        DocumentSnapshot snap = FirestoreSupport.await(
                firestore.collection(COLLECTION)
                        .document(chamadoId)
                        .collection(SUBCOLLECTION_ANALISE)
                        .document(ANALISE_DOC_ID)
                        .get(),
                "buscar análise da IA"
        );
        if (!snap.exists()) {
            return Optional.empty();
        }
        return Optional.of(toAnaliseResponse(snap));
    }

    public AnaliseIAResponse saveAnaliseAndUpdateStatus(
            String chamadoId,
            StatusChamado currentStatus,
            Map<String, Object> analiseFields
    ) {
        DocumentReference chamadoRef = firestore.collection(COLLECTION).document(chamadoId);
        DocumentReference analiseRef = chamadoRef.collection(SUBCOLLECTION_ANALISE).document(ANALISE_DOC_ID);

        WriteBatch batch = firestore.batch();
        Map<String, Object> payload = new HashMap<>(analiseFields);
        payload.put("dataAnalise", FieldValue.serverTimestamp());
        batch.set(analiseRef, payload);

        if (currentStatus != StatusChamado.RESOLVIDO) {
            batch.update(chamadoRef, Map.of(
                    "status", StatusChamado.EM_ANALISE.name(),
                    "updatedAt", FieldValue.serverTimestamp()
            ));
        }

        FirestoreSupport.await(batch.commit(), "salvar análise da IA");
        DocumentSnapshot saved = FirestoreSupport.await(analiseRef.get(), "recarregar análise salva");
        return toAnaliseResponse(saved);
    }

    private ChamadoResponse toChamadoResponse(DocumentSnapshot snap) {
        String rawStatus = FirestoreSupport.stringOrEmpty(snap.get("status"));
        StatusChamado status;
        try {
            status = StatusChamado.valueOf(rawStatus);
        } catch (IllegalArgumentException ex) {
            status = StatusChamado.ABERTO;
        }

        return new ChamadoResponse(
                snap.getId(),
                FirestoreSupport.stringOrEmpty(snap.get("titulo")),
                FirestoreSupport.stringOrEmpty(snap.get("descricao")),
                FirestoreSupport.toInstant(snap.get("dataAbertura")),
                status,
                FirestoreSupport.stringOrEmpty(snap.get("usuarioId")),
                FirestoreSupport.stringOrEmpty(snap.get("usuarioNome")),
                FirestoreSupport.stringOrEmpty(snap.get("regiaoId")),
                FirestoreSupport.stringOrEmpty(snap.get("regiaoResumo")),
                FirestoreSupport.stringOrEmpty(snap.get("tipoProblemaId")),
                FirestoreSupport.stringOrEmpty(snap.get("tipoProblemaNome")),
                FirestoreSupport.intOrZero(snap.get("fotosCount")),
                FirestoreSupport.stringOrEmpty(snap.get("enderecoId")),
                FirestoreSupport.stringOrEmpty(snap.get("enderecoResumo")),
                FirestoreSupport.doubleOrNull(snap.get("latitude")),
                FirestoreSupport.doubleOrNull(snap.get("longitude")),
                FirestoreSupport.toInstant(snap.get("updatedAt"))
        );
    }

    private FotoResponse toFotoResponse(DocumentSnapshot snap) {
        return new FotoResponse(
                snap.getId(),
                FirestoreSupport.stringOrEmpty(snap.get("nomeArquivo")),
                FirestoreSupport.stringOrEmpty(snap.get("mimeType")),
                FirestoreSupport.stringOrEmpty(snap.get("imagemDataUrl")),
                FirestoreSupport.stringOrEmpty(snap.get("chamadoId")),
                FirestoreSupport.stringOrEmpty(snap.get("usuarioId")),
                FirestoreSupport.toInstant(snap.get("createdAt"))
        );
    }

    private AnaliseIAResponse toAnaliseResponse(DocumentSnapshot snap) {
        String rawUrgencia = FirestoreSupport.stringOrEmpty(snap.get("urgencia")).toUpperCase();
        UrgenciaIA urgencia;
        try {
            urgencia = UrgenciaIA.valueOf(rawUrgencia);
        } catch (IllegalArgumentException ex) {
            urgencia = UrgenciaIA.INDEFINIDA;
        }

        return new AnaliseIAResponse(
                snap.getId(),
                urgencia,
                FirestoreSupport.stringOrEmpty(snap.get("orientacao")),
                FirestoreSupport.stringOrEmpty(snap.get("respostaBruta")),
                FirestoreSupport.toInstant(snap.get("dataAnalise")),
                FirestoreSupport.stringOrEmpty(snap.get("chamadoId")),
                FirestoreSupport.stringOrEmpty(snap.get("usuarioId")),
                FirestoreSupport.stringOrEmpty(snap.get("orgaoId")),
                FirestoreSupport.stringOrEmpty(snap.get("orgaoNome")),
                FirestoreSupport.stringOrEmpty(snap.get("orgaoContato"))
        );
    }
}
