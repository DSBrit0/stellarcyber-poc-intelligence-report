import type { Briefings } from './types'

export const briefingsPtBR: Briefings = {
  data_sources: {
    how: [
      'Cada fonte entra por um dos três caminhos: log enviado por syslog (RFC 3164/5424, CEF, LEEF, JSON), telemetria coletada por sensor (rede e servidores) ou API consultada por um Connector (nuvem, SaaS, EDR, identidade).',
      'A plataforma reconhece a fonte pelo parser associado à porta ou ao Connector configurado, e cada registro já chega identificado com a origem, o tenant e o horário de recebimento.',
      'Fontes fora do catálogo podem ser ingeridas por um parser customizado, sem descartar o dado bruto.',
    ],
    value: [
      'O SOC deixa de depender de uma console por ferramenta: firewall, EDR, identidade e nuvem passam a responder na mesma investigação.',
      'Lacunas de visibilidade ficam explícitas: dá para ver quais ativos e quais etapas de um ataque nenhuma fonte cobre.',
    ],
    objectives: ['Cobertura de visibilidade', 'Inventário de fontes de log', 'Base para conformidade de auditoria', 'Redução de pontos cegos'],
    techniquesLead: 'Sem a fonte certa, estas técnicas passam sem deixar rastro no SOC:',
  },
  collection: {
    how: [
      'Modular Sensor: appliance físico ou virtual que recebe logs (log forwarder), coleta fluxos (NetFlow/IPFIX/sFlow) e faz DPI em portas SPAN/TAP.',
      'Server Sensor: agente leve para Windows e Linux que coleta eventos do sistema, processos, conexões e alterações de arquivos.',
      'Cloud Connectors: integrações por API com AWS, Azure, Google Cloud, Microsoft 365 e outros SaaS, incluindo fontes de detecção e resposta em nuvem (CDR) e EDRs.',
      'O sensor comprime o que coleta e envia ao Data Processor da plataforma por canal criptografado.',
    ],
    value: [
      'Um único modelo de coleta para on-premises, nuvem e OT, sem um coletor diferente por fabricante.',
      'A coleta perto da fonte reduz banda e perda de eventos em links de filial.',
    ],
    objectives: ['Centralização de logs', 'Visibilidade de nuvem e SaaS', 'Telemetria de rede leste-oeste', 'Escalar para novas filiais sem reprojeto'],
    techniquesLead: 'Coleta de nuvem e identidade é o que expõe técnicas como:',
  },
  normalization: {
    how: [
      'Cada registro bruto passa pelo parser da sua fonte e vira Interflow: um registro único, com os mesmos nomes de campo para endereço de origem e destino, portas, protocolo, aplicação, usuário e host, venha de onde vier.',
      'O registro guarda referência ao dado original, então nada do log bruto se perde na conversão.',
      'Como os campos são comuns, uma regra ou consulta escrita uma vez vale para todas as fontes, sem uma versão por fabricante.',
    ],
    value: [
      'A investigação deixa de exigir que o analista conheça o formato de cada fabricante.',
      'Correlação entre fontes passa a ser uma junção por campo, não um trabalho manual de tradução.',
    ],
    objectives: ['Reduzir o tempo de investigação', 'Consultas e regras independentes de fabricante', 'Base única para correlação'],
    techniquesLead: 'Normalizar é o que permite somar sinais fracos de fontes diferentes, como em:',
  },
  threat_intel: {
    how: [
      'Feeds de threat intelligence (comerciais, open source, MISP e STIX/TAXII) trazem indicadores: IPs, domínios, URLs e hashes de arquivo, com tipo e reputação.',
      'Cada registro é comparado com esses indicadores no momento da ingestão, e o resultado fica gravado no próprio Interflow, sem esperar uma busca manual.',
      'Indicadores ligados a uma mesma campanha aproximam eventos que, isolados, pareceriam ruído.',
    ],
    value: [
      'Ajuda a detectar campanhas: o mesmo domínio ou infraestrutura aparecendo em fontes diferentes vira um sinal único.',
      'O analista vê a reputação e o contexto do indicador já no alerta, sem consultar outra ferramenta.',
    ],
    objectives: ['Detecção de campanhas e infraestrutura conhecida', 'Priorização por reputação', 'Reduzir pesquisa manual de IoCs'],
    techniquesLead: 'Indicadores de infraestrutura maliciosa ajudam a pegar:',
  },
  enrichment: {
    how: [
      'Antes de armazenar, o Interflow ganha contexto: geolocalização e ASN dos IPs, nome e dono do ativo, sistema operacional e o usuário por trás de um IP (resolvido a partir dos logs de autenticação e do diretório).',
      'A criticidade que vocês atribuírem a ativos e usuários entra no cálculo de risco de cada alerta.',
    ],
    value: [
      'O alerta já diz quem, onde e qual ativo: o analista não começa a investigação montando contexto.',
      'Um evento num servidor crítico ou numa conta de administrador sobe de prioridade sozinho.',
    ],
    objectives: ['Priorização por risco de negócio', 'Atribuição a usuário e ativo', 'Reduzir tempo de triagem'],
    techniquesLead: 'Contexto de usuário, ativo e geografia expõe abusos como:',
  },
  ingestion_filters: {
    how: [
      'Filtros aplicados na coleta descartam ou reduzem registros antes que cheguem ao Data Lake, por fonte, tipo de evento, campo ou expressão.',
      'Descartar remove o registro; reduzir mantém só o que interessa para detecção, por exemplo agregando repetições.',
      'Eventos de segurança e de autenticação devem continuar entrando: o filtro é para ruído operacional, como debug e mensagens de status.',
    ],
    value: [
      'O volume armazenado, e portanto a licença, fica concentrado no que gera detecção.',
      'Menos ruído no Data Lake deixa buscas e caçadas mais rápidas.',
    ],
    objectives: ['Controle do volume licenciado', 'Relação sinal/ruído', 'Custo de armazenamento previsível'],
    techniquesLead: 'Filtros mal desenhados criam os pontos cegos que estas técnicas exploram, por isso a regra é nunca filtrar eventos de segurança:',
  },
  data_lake: {
    how: [
      'O Interflow normalizado e enriquecido é indexado num Data Lake único e pesquisável em todas as fontes ao mesmo tempo.',
      'A retenção é definida por política, de acordo com a exigência regulatória de cada cliente.',
      'As mesmas consultas servem para investigação, caça a ameaças e relatórios de conformidade.',
    ],
    value: [
      'Investigações retroativas: quando surge um novo indicador, dá para procurar meses para trás.',
      'Uma única fonte de verdade para auditoria e resposta a incidentes.',
    ],
    objectives: ['Retenção para conformidade', 'Caça a ameaças retroativa', 'Investigação forense'],
    techniquesLead: 'Ameaças com longo tempo de permanência só aparecem com retenção suficiente:',
  },
  ndr: {
    how: [
      'O Modular Sensor recebe uma cópia do tráfego (SPAN, TAP ou vTAP) e faz Deep Packet Inspection: identifica a aplicação independentemente da porta e extrai metadados de sessão, como volumes, duração, DNS, HTTP e TLS.',
      'Esses metadados viram Interflow e alimentam modelos que detectam varreduras, uso anômalo de protocolos administrativos, beaconing de C2, tunelamento DNS e exfiltração.',
      'Arquivos que atravessam a rede podem ser extraídos e enviados ao Sandbox.',
    ],
    value: [
      'Detecta movimento lateral (MITRE TA0008), que não passa pelo perímetro e muitas vezes não gera log em servidor.',
      'Cobre o que não aceita agente: OT, IoT, appliances e máquinas não gerenciadas.',
    ],
    objectives: ['Visibilidade leste-oeste', 'Detecção de movimento lateral e C2', 'Cobertura de ativos sem agente'],
    techniquesLead: 'Tráfego de rede é a melhor evidência para:',
  },
  sandbox: {
    how: [
      'Arquivos suspeitos, vindos do tráfego, de e-mail ou enviados pelo analista, são executados num ambiente isolado.',
      'A análise dinâmica registra o que o arquivo faz: processos criados, alterações de registro e sistema de arquivos, conexões de rede e arquivos que ele baixa.',
      'O veredito e os indicadores extraídos voltam para a plataforma e passam a ser procurados em todas as fontes.',
    ],
    value: [
      'Pega malware novo ou ofuscado pelo comportamento, não por assinatura.',
      'Transforma uma detecção em indicadores reutilizáveis para caçar o mesmo artefato em outros hosts.',
    ],
    objectives: ['Detecção de malware desconhecido', 'Geração de IoCs próprios', 'Validação rápida de anexos e downloads'],
    techniquesLead: 'A análise dinâmica cobre a entrega e a execução de:',
  },
  fim: {
    how: [
      'O Server Sensor monitora arquivos, pastas e chaves de registro definidos como críticos e registra criação, alteração, exclusão e mudança de permissão, com hash, usuário e processo responsável.',
      'As mudanças viram Interflow e podem gerar alerta quando ocorrem fora do processo esperado, por exemplo um arquivo novo no diretório de uma aplicação web.',
    ],
    value: [
      'Detecta adulteração de sistemas críticos e persistência que não aparece em log de aplicação.',
      'Atende ao requisito de monitoramento de integridade do PCI DSS sem uma ferramenta separada.',
    ],
    objectives: ['Integridade de sistemas críticos', 'Conformidade PCI DSS', 'Detecção de persistência e adulteração'],
    techniquesLead: 'Mudança de arquivo é o rastro destas técnicas:',
  },
  itdr_ueba: {
    how: [
      'Modelos não supervisionados aprendem a linha de base de cada usuário, host e processo: horários, origens, volumes, aplicações e privilégios usados.',
      'Os desvios recebem uma pontuação, comparada também com o grupo de pares, o que separa o incomum do simplesmente raro.',
      'Sinais de identidade, como logons, MFA, Kerberos e mudanças de grupo privilegiado, vêm do diretório e do provedor de identidade.',
    ],
    value: [
      'Detecta o atacante que já tem uma credencial válida, quando nenhuma regra de assinatura dispara.',
      'Cobre ameaça interna e conta de serviço usada fora do padrão.',
    ],
    objectives: ['Detecção de credenciais comprometidas', 'Ameaça interna', 'Abuso de privilégio'],
    techniquesLead: 'Comportamento de identidade é o que revela:',
  },
  detection: {
    how: [
      'Três camadas rodam sobre o mesmo Interflow: regras, machine learning supervisionado treinado com padrões maliciosos conhecidos e machine learning não supervisionado que detecta anomalias.',
      'Cada alerta é mapeado em táticas e técnicas do MITRE ATT&CK e na XDR Kill Chain, e recebe uma pontuação de risco.',
      'Coleta, triagem e correlação, que hoje consomem tempo do analista, passam a ser feitas pela plataforma.',
    ],
    value: [
      'Reduz o MTTD: a detecção acontece na ingestão, não quando alguém procura.',
      'A cobertura vira mensurável: dá para mostrar quais técnicas ATT&CK estão cobertas e por quais fontes.',
    ],
    objectives: ['Redução do MTTD', 'Cobertura MITRE ATT&CK mensurável', 'Menos falsos positivos'],
    techniquesLead: 'Exemplos de técnicas detectadas pelas camadas combinadas:',
  },
  correlation: {
    how: [
      'O Graph ML liga alertas que compartilham entidades, como usuário, host, IP, arquivo ou domínio, e proximidade no tempo, montando o grafo do incidente.',
      'O grafo vira um Case, pontuado pela gravidade dos alertas e pelo avanço na kill chain.',
      'Novos alertas relacionados entram no mesmo Case em vez de abrir outro.',
    ],
    value: [
      'Dezenas ou centenas de alertas viram poucos Cases: o analista trabalha incidentes, não uma fila de eventos.',
      'O Case mostra a história completa do ataque, da entrada à exfiltração.',
    ],
    objectives: ['Reduzir a fadiga de alertas', 'Entender escopo e impacto', 'Priorizar pelo risco real'],
    techniquesLead: 'Um ataque de várias etapas, como este, vira um único Case:',
  },
  agentic_soc: {
    how: [
      'O AI Investigator responde em linguagem natural sobre um Case: o que aconteceu, quais ativos foram afetados e quais evidências sustentam a conclusão.',
      'O Auto Triage atribui um veredito a cada Case (True Positive, False Positive, Benign ou Inconclusive), com a justificativa. É um add-on licenciado à parte.',
      'O analista confirma ou corrige: a decisão final continua humana.',
    ],
    value: [
      'O analista começa de uma conclusão justificada, não de uma fila.',
      'O mesmo time atende mais Cases, com qualidade de triagem consistente entre turnos.',
    ],
    objectives: ['Reduzir o tempo de triagem', 'Escalar o SOC sem aumentar o time', 'Consistência de análise'],
    techniquesLead: 'Exemplos de Cases que a triagem automática acelera:',
  },
  response: {
    how: [
      'Playbooks disparam ações nas ferramentas que vocês já têm, por meio dos Connectors: bloquear um IP no firewall, isolar um host no EDR, desabilitar uma conta no diretório, colocar um e-mail em quarentena, abrir um chamado.',
      'Cada playbook tem condições (tipo de alerta, gravidade, ativo) e pode exigir aprovação humana antes de agir.',
      'As ações e seus resultados ficam registrados no Case, como trilha de auditoria.',
    ],
    value: [
      'Contenção em segundos para os cenários definidos, inclusive fora do horário comercial.',
      'Reduz o MTTR e a exposição durante um ataque em andamento.',
    ],
    objectives: ['Redução do MTTR', 'Contenção automática', 'Trilha de auditoria da resposta'],
    techniquesLead: 'Resposta automática limita o impacto de:',
  },
}
