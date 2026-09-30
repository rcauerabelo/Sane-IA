INSERT INTO tipo_problema (nome) VALUES
 ('Falta de água'), ('Vazamento de água'), ('Esgoto a céu aberto'),
 ('Falta de rede de esgoto'), ('Lixo acumulado / drenagem'), ('Qualidade da água');

INSERT INTO orgao_responsavel (nome, contato) VALUES
 ('Companhia de Saneamento', '0800-000-0000'),
 ('Prefeitura - Secretaria de Obras', '156'),
 ('Vigilância Sanitária', '0800-111-1111');

INSERT INTO regiao (bairro, cidade, estado) VALUES ('Jardim Exemplo', 'São Paulo', 'SP');

INSERT INTO usuario (nome, email, telefone) VALUES ('Morador Teste', 'teste@email.com', '11999999999');
