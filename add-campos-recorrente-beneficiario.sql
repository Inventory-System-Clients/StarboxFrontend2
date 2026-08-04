-- =============================================
-- Script: Adicionar campos Recorrente e Beneficiário
-- Descrição: Adiciona as colunas recorrente e beneficiario na tabela contas_financeiro
-- Data: 11/03/2026
-- =============================================

-- Adicionar coluna RECORRENTE (boolean - padrão false)
-- Indica se a conta se repete todo mês na mesma data
ALTER TABLE contas_financeiro 
ADD COLUMN IF NOT EXISTS recorrente BOOLEAN DEFAULT FALSE;

-- Adicionar coluna BENEFICIARIO (texto - até 255 caracteres)
-- Armazena o nome da pessoa ou empresa que receberá o pagamento
ALTER TABLE contas_financeiro 
ADD COLUMN IF NOT EXISTS beneficiario VARCHAR(255) NULL;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN contas_financeiro.recorrente IS 'Indica se a conta é recorrente (repete mensalmente na mesma data)';
COMMENT ON COLUMN contas_financeiro.beneficiario IS 'Nome da pessoa ou empresa que receberá o pagamento';

-- Visualizar estrutura atualizada (opcional - para conferir)
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'contas_financeiro'
-- ORDER BY ordinal_position;

-- =============================================
-- Exemplos de uso após a execução
-- =============================================

-- Exemplo 1: Criar conta recorrente mensal
-- INSERT INTO contas_financeiro (name, value, due_date, category, city, status, bill_type, recorrente, beneficiario)
-- VALUES ('Aluguel Escritório', 3500.00, '2026-04-15', 'Aluguel', 'São Paulo', 'pending', 'company', TRUE, 'Imobiliária XYZ Ltda');

-- Exemplo 2: Criar conta única com beneficiário
-- INSERT INTO contas_financeiro (name, value, due_date, category, city, status, bill_type, recorrente, beneficiario)
-- VALUES ('Manutenção Máquina', 850.00, '2026-03-20', 'Manutenção', 'São Paulo', 'pending', 'company', FALSE, 'João da Silva - Técnico');

-- Exemplo 3: Atualizar conta existente
-- UPDATE contas_financeiro 
-- SET recorrente = TRUE, beneficiario = 'Empresa de Energia S.A.'
-- WHERE id = 123;
