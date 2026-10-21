# Regras de diagnóstico — versão 0.1.0

O motor descreve observações, não diagnostica automaticamente defeitos físicos. Gravidade é uma prioridade de investigação. Confiança refere-se à observação registrada, não à certeza de uma hipótese sobre a causa.

## Cálculo de duração

A cadência é a mediana dos deltas positivos entre timestamps ordenados. Uma lacuna é um intervalo **maior que `max(3 × cadência, 5 segundos)`**. Leituras ausentes e lacunas encerram um episódio. Duração é a diferença entre a primeira e a última amostra válida do episódio; uma leitura isolada tem duração observada zero. Não se adiciona um intervalo fictício após a última leitura. Timestamps repetidos não aumentam a duração.

Por sensor/regra é mostrado o episódio de maior duração; empates usam o maior valor. Portanto, a lista é um resumo das ocorrências, não um catálogo de cada cruzamento de limiar. Os gráficos mantêm os dados necessários para explorar os demais episódios. Médias são aritméticas por amostra, não ponderadas pelo tempo; duplicatas contam nas estatísticas.

## Critérios padrão

| Regra | Evidência necessária | Gravidade / confiança | Limitação |
|---|---|---|---|
| Temperatura persistente | CPU ≥90 °C, GPU ≥85 °C, hotspot/junction ≥100 °C ou armazenamento ≥70 °C por ≥30 s | Atenção; Crítico se o pico no episódio chegar a 100/95/110/85 °C, respectivamente; Moderada | Limiares genéricos. Modelos diferentes têm limites diferentes. |
| Pico térmico | Episódio abaixo de 30 s atingindo o limiar crítico acima | Atenção / Moderada | Um pico não demonstra aquecimento persistente ou defeito. |
| Limitação explícita | Sensor de throttling/limitação booleana com valor ativo | Atenção / Alta | O nome diferencia limite térmico, elétrico ou operacional. Um limite em porcentagem não é interpretado como booleano. |
| Pressão de memória | Sensor de memória em porcentagem ≥90% por ≥30 s | Atenção / Moderada | Não é diagnóstico de defeito de RAM. Memória física e virtual permanecem identificadas pelo nome. |
| Queda de frequência | Queda >50%, leitura anterior >500 MHz, carga ≥70% nas duas amostras, mesmo dispositivo explícito, sem lacuna ou timestamp repetido | Atenção / Baixa | Correlação temporal, sem causalidade; clocks efetivos e solicitados diferem. |
| Variação de potência | Variação absoluta ≥50 W e relativa ≥50% em amostras consecutivas, sem lacuna; denominador mínimo 10 W | Atenção / Baixa | Transições de carga normais também podem disparar. Não avalia a fonte. |
| Flag de saúde de disco | Drive Failure/Drive Warning explícito ativo | Atenção / Alta | Confirma o indicador. Não determina a natureza/extensão do problema. |
| Lacuna | Delta acima de `max(3 × mediana, 5 s)` | Atenção / Alta | Pausa, suspensão e atraso de coleta também geram lacunas. |
| Dados insuficientes | Sem números válidos ou sem dois horários distintos | Dados insuficientes / Alta | Não há suporte para tendência. |
| Última leitura | Último timestamp aceito do arquivo | Dados insuficientes / Alta | Fim de arquivo não prova desligamento nem travamento. |

Sensores sem unidade conhecida não disparam regras dependentes de °C/MHz/W. Utilização de disco isolada nunca dispara alerta de integridade física. Sensor ausente não é zero. Indicadores desconhecidos ficam disponíveis na tabela, sem interpretação inventada.

As regras trabalham no intervalo selecionado, incluindo somente leituras dentro dele. Lacunas que cruzam a seleção são reportadas com seu intervalo original completo. A última leitura sempre se refere ao arquivo inteiro e é identificada dessa forma. Valores nas observações representam o pico dentro do episódio; em queda de frequência, o valor é a leitura após a queda.

## Investigar desligamento

A janela termina no horário aproximado informado e começa 2, 5, 10 ou 30 minutos antes. A última amostra é escolhida entre leituras com horário menor ou igual ao informado, mesmo se estiver fora da janela. A tela apresenta essa distância e a quantidade de leituras efetivamente dentro da janela. Leituras futuras não justificam observações sobre a falha.

Eventos Windows opcionais usam ISO 8601 com fuso explícito. Uma correção em segundos pode ser somada ao relógio dos eventos. Para contexto do reinício, eventos até 60 segundos após o horário aproximado são exibidos. Esse cruzamento é temporal e não estabelece causalidade.

Kernel-Power 41 indica que o sistema detectou um reinício sem desligamento adequado; **não comprova defeito na fonte**. O CSV pode perder amostras que ainda não tinham sido gravadas. A ferramenta não infere a temperatura durante uma lacuna nem a razão pela qual o arquivo acabou.

## Interpretação

- **Normal:** nenhum limiar implementado atingido nas medições disponíveis. Não equivale a estabilidade comprovada.
- **Atenção:** observação que merece contexto e verificações.
- **Crítico:** episódio térmico persistente que atingiu um limiar alto de triagem; verifique a especificação do fabricante.
- **Dados insuficientes:** o registro não sustenta uma conclusão.

Ao adicionar regras, inclua a evidência, a janela temporal, a unidade, hipóteses não confirmadas, verificações sugeridas e casos negativos nos testes. Não elevar correlação a causalidade.
