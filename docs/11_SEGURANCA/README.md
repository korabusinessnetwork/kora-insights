# 11 — Seguranca

## Classificacao do dado
| Dado | Sensibilidade | Tratamento |
|---|---|---|
| Token OAuth da Meta | Critico | Supabase Vault. Nunca no front, em log ou URL. Tabela guarda so a referencia |
| Metricas da conta do cliente | Confidencial | Isolado por RLS via tenant |
| Demografia agregada de audiencia | Pessoal (LGPD) | Somente agregado. Nunca individualizado |
| Diagnostico gerado | Confidencial | Isolado por RLS |

## Controles por camada
**Front (React):** apenas chave anon; nenhuma regra de negocio sensivel; auth antes
de qualquer rota protegida; sem token de terceiro em memoria do cliente.

**Banco (Supabase):** RLS habilitado em toda tabela, sem excecao. Acesso derivado de
`tenant_membros`. Escrita de snapshots exclusiva da Edge Function com `service_role`.
Teste automatizado de vazamento entre tenants na definicao de pronto.

**Edge Functions:** unico ponto que toca a Graph API e o Vault. Valida entrada,
trata `rate_limit` e `token_expirado` como estados de negocio, nao como excecao
silenciosa. Nunca loga payload de token.

**Meta:** solicitar o minimo de permissoes (ADR-002). Refresh de token antes do
vencimento, com aviso ao cliente quando a reconexao for necessaria.

## LGPD (exigido tambem pelo App Review)
- [ ] Politica de privacidade publicada, com finalidade e base legal
- [ ] Fluxo de exclusao de dados por solicitacao, com endpoint documentado
- [ ] Exportacao do proprio historico pelo cliente
- [ ] Desconexao remove token e interrompe coleta imediatamente
- [ ] Retencao definida: quanto tempo guardamos apos o cancelamento

## Checklist de pronto
- [ ] RLS em toda tabela nova, com teste
- [ ] Sem `service_role` em qualquer bundle de front
- [ ] Nenhum dado sensivel em log
- [ ] Inputs validados na borda
- [ ] Rotas protegidas exigem sessao valida
