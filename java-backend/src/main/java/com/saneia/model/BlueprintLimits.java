package com.saneia.model;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * Limites volumétricos e expressões regulares sincronizados com firebase-blueprint.json e firestore.rules.
 */
public final class BlueprintLimits {

    private BlueprintLimits() {}

    public static final String ID_REGEX = "^[a-zA-Z0-9_\\-]+$";
    public static final String UF_REGEX = "^[A-Z]{2}$";
    public static final String CEP_REGEX = "^([0-9]{8})?$";

    public static final Pattern ID_PATTERN = Pattern.compile(ID_REGEX);
    public static final Pattern UF_PATTERN = Pattern.compile(UF_REGEX);
    public static final Pattern CEP_PATTERN = Pattern.compile(CEP_REGEX);

    public static final int USUARIO_NOME_MIN = 2;
    public static final int USUARIO_NOME_MAX = 120;
    public static final int USUARIO_EMAIL_MIN = 3;
    public static final int USUARIO_EMAIL_MAX = 120;
    public static final int USUARIO_TELEFONE_MAX = 20;

    public static final int REGIAO_BAIRRO_MIN = 2;
    public static final int REGIAO_BAIRRO_MAX = 100;
    public static final int REGIAO_CIDADE_MIN = 2;
    public static final int REGIAO_CIDADE_MAX = 100;

    public static final int ENDERECO_APELIDO_MIN = 1;
    public static final int ENDERECO_APELIDO_MAX = 40;
    public static final int ENDERECO_CEP_MAX = 8;
    public static final int ENDERECO_LOGRADOURO_MIN = 2;
    public static final int ENDERECO_LOGRADOURO_MAX = 160;
    public static final int ENDERECO_NUMERO_MAX = 20;
    public static final int ENDERECO_COMPLEMENTO_MAX = 80;
    public static final int ENDERECO_REFERENCIA_MAX = 140;

    public static final int CHAMADO_TITULO_MIN = 3;
    public static final int CHAMADO_TITULO_MAX = 150;
    public static final int CHAMADO_DESCRICAO_MAX = 2000;
    public static final int CHAMADO_REGIAO_RESUMO_MAX = 220;
    public static final int CHAMADO_ENDERECO_RESUMO_MAX = 300;
    public static final int CHAMADO_MAX_FOTOS = 20;

    public static final long FOTO_MAX_BYTES = 5L * 1024 * 1024;
    public static final int FOTO_DATA_URL_MAX_CHARS = 900_000;
    public static final Set<String> FOTO_ALLOWED_MIME_TYPES = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    public static final int ANALISE_ORIENTACAO_MAX = 2000;
    public static final int ANALISE_RESPOSTA_BRUTA_MAX = 4000;
}
