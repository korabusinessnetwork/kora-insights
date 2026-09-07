## O que muda, e por quê

<!-- Uma frase que alguém repetiria em voz alta. O "por quê" importa mais que o
     "o quê": o diff já mostra o quê. -->

## Como validei

<!-- Não basta "os testes passam". O que você viu funcionando? -->

- [ ] `npm test` verde
- [ ] `npm run lint` limpo
- [ ] `npm run build` limpo
- [ ] Rodei o app e vi a mudança na tela (quando muda tela)

## As regras que reprovam um PR sozinhas

Marque o que se aplica; risque o que não se aplica com um motivo.

- [ ] Nenhum diagnóstico calculado na tela — a tela lê `diagnosticos` (ADR-005)
- [ ] Nenhuma métrica persistida ou exibida com o nome que a Meta dá a ela (ADR-003)
- [ ] Nada de chave, secret, marca, cor ou regra de cliente no código
- [ ] Nenhum `select *` em tabela sensível
- [ ] CSS fora do JSX; estado visual por atributo de dado
- [ ] Tabela nova tem RLS **com política**, não só RLS ligada
- [ ] Lacuna de dado continua visível na tela
- [ ] Função pura nova nasceu com teste

## Documentação

- [ ] Contrato que atravessa camada mudou → `docs/01_ARQUITETURA/contratos.md` no mesmo commit
- [ ] Decisão de arquitetura → ADR em `docs/08_DECISOES/`
- [ ] Aprendi algo construindo → linha em `memory/learnings.md`

## O que este PR não faz

<!-- Escopo declarado é escopo defensável. Diga o que ficou de fora e por quê. -->
