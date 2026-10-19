import { STAFF, type HelpGuide, type Ui } from './types'

export const guidePtBR = (ui: Ui): HelpGuide => ({
  sections: [
    {
      id: 'overview',
      title: 'Visão geral',
      roles: 'all',
      summary: 'O que a ferramenta faz, quem usa e o caminho de uma PoC do início ao Relatório.',
      blocks: [
        {
          kind: 'p',
          text: 'O PoC Intelligence Report acompanha a avaliação (PoC) que um cliente faz da Stellar Cyber. Ele organiza o trabalho com o cliente no PoC Notebook, coleta as evidências da Instância Stellar Cyber pela API e produz o Relatório Final da PoC: uma página HTML responsiva que também sai em PDF, em pt-BR, en ou es.',
        },
        { kind: 'h3', text: 'O caminho de uma PoC' },
        {
          kind: 'steps',
          items: [
            'O Sales Engineer cadastra a **Empresa** do cliente e entrega a chave de acesso na primeira reunião.',
            'Ele começa um **PoC Notebook**: critérios de sucesso, fontes de dados, atas de reunião, processo e cronograma, preenchidos junto com o cliente.',
            'Ao final do período, ele conecta a Instância Stellar Cyber, escolhe o Tenant e o período e roda um **Sync**, que coleta os dados.',
            'O Relatório fica pronto em três layouts (Technical, Executive e Insight). Ele pode ser apresentado na tela, baixado em PDF e comentado pelo cliente.',
          ],
        },
        { kind: 'h3', text: 'Perfis de acesso' },
        {
          kind: 'table',
          head: ['Perfil', 'Quem é', 'O que faz'],
          rows: [
            [ui('role.admin'), 'Administrador da ferramenta', 'Aprova cadastros, gerencia usuários e configurações, vê todas as PoCs e a Auditoria.'],
            [ui('role.sales_engineer'), 'Sales Engineer da Stellar Cyber', 'Cadastra Empresas, conduz PoCs e acompanha as PoCs das revendas que cadastrou.'],
            [ui('role.partner'), 'Pessoa de uma revenda', 'Conduz as próprias PoCs e cadastra os próprios clientes.'],
            [ui('role.customer'), 'Pessoa do cliente em avaliação', 'Vê, baixa e comenta os Relatórios das PoCs da sua empresa e preenche o PoC Notebook.'],
          ],
        },
        { kind: 'tip', text: `Esta página mostra primeiro os tópicos do seu perfil. Use ${ui('guide.allTopics')} no topo para ver o guia inteiro.` },
      ],
    },
    {
      id: 'example',
      title: 'Exemplo completo: da primeira reunião ao Relatório',
      roles: STAFF,
      summary: 'Um passo a passo real, com a empresa fictícia Nébula Logística, do cadastro ao Relatório comentado.',
      blocks: [
        {
          kind: 'p',
          text: 'Siga este roteiro na sua primeira PoC. Os nomes são de exemplo: troque pela empresa e pelas pessoas reais.',
        },
        { kind: 'h3', text: '1. Antes da primeira reunião' },
        {
          kind: 'steps',
          items: [
            `Abra ${ui('nav.customers')} e clique em ${ui('customers.new')}.`,
            `Digite o nome \`Nébula Logística\`, escolha o perfil ${ui('customers.profile.customer')} e salve.`,
            `Copie a chave que aparece em ${ui('customers.keyOnce')}. Ela não aparece de novo. Se perder, gere outra com ${ui('customers.rotate')}.`,
          ],
        },
        { kind: 'h3', text: '2. Na primeira reunião' },
        {
          kind: 'steps',
          items: [
            'Entregue ao cliente o endereço da ferramenta, o nome exato da empresa e a chave de acesso.',
            `Cada pessoa do cliente clica em ${ui('auth.register')}, marca ${ui('auth.iamCustomer')} e informa o nome da empresa e a chave.`,
            `Volte em ${ui('nav.customers')}: os cadastros aparecem como ${ui('customers.pending')} dentro da empresa. Clique em ${ui('admin.approve')}.`,
          ],
        },
        { kind: 'h3', text: '3. Planejar a PoC no Notebook' },
        {
          kind: 'steps',
          items: [
            `Na lista de PoCs, clique em ${ui('poc.create')} e escolha ${ui('newpoc.notebook')}.`,
            `Escolha a empresa em ${ui('newpoc.chooseCustomer')}, informe a ${ui('newpoc.startDate')} e clique em ${ui('newpoc.start')}.`,
            `Em ${ui('nb.overview')}, preencha o dimensionamento (GB/dia), a URL da PoC e os contatos de negócio e técnico.`,
            `Em ${ui('nb.criteria')}, registre o que o cliente precisa ver para aprovar, por exemplo: \`Detectar movimentação lateral\` e \`Reduzir o ruído de alertas em 80%\`. Use ${ui('nb.suggestions')} para começar mais rápido.`,
            `Em ${ui('nb.sources')}, busque os produtos do cliente (por exemplo \`fortigate\`, \`office 365\`, \`crowdstrike\`) e adicione cada um.`,
          ],
        },
        { kind: 'h3', text: '4. Durante a PoC' },
        {
          kind: 'list',
          items: [
            `Depois de cada reunião, clique em ${ui('nb.addMeeting')} e registre data, gravação, notas e próximos passos.`,
            `Atualize o status de cada fonte de dados (${ui('nb.ds.in_progress')}, ${ui('nb.ds.ingesting')}, ${ui('nb.ds.ticket_open')}) e de cada item de ${ui('nb.process')}.`,
            `Confira em ${ui('nb.schedule')} os marcos atrasados, marcados como ${ui('sch.late')}.`,
            `Dê a cada critério de sucesso um status: ${ui('nb.cs.completed_success')}, ${ui('nb.cs.completed_partial')} ou ${ui('nb.cs.completed_failed')}.`,
          ],
        },
        { kind: 'h3', text: '5. Gerar o Relatório Final' },
        {
          kind: 'steps',
          items: [
            `Na PoC, clique em ${ui('nb.createReport')}.`,
            'Informe a URL da Instância e a chave de API (Scoped API Key), escolha o Tenant da Nébula e o período (até 30 dias, terminando no máximo ontem).',
            `Clique em ${ui('wiz.runSync')} e acompanhe as cinco fases da coleta. Enquanto isso, preencha ${ui('wiz.detailsTitle')}: veredito, comentários e premissas de esforço.`,
            `Quando a coleta terminar, abra a aba ${ui('tab.report')}, escolha o layout **Executive** e clique em ${ui('report.open')} para apresentar.`,
          ],
        },
        { kind: 'h3', text: '6. Depois da apresentação' },
        {
          kind: 'list',
          items: [
            `O cliente entra com o próprio usuário, abre o Relatório e deixa ${ui('report.comments')}.`,
            `Se algo precisar mudar no texto do Relatório, registre um ${ui('report.commentReport')}: ele gera a versão seguinte (1.1, 1.2…) e entra no histórico de versões.`,
            `Se os dados mudarem, rode um ${ui('sync.new')}: ele cria um novo Relatório (2.0) e mantém o anterior.`,
          ],
        },
      ],
    },
    {
      id: 'access',
      title: 'Acesso: cadastro, entrada e verificação em duas etapas',
      roles: 'all',
      summary: 'Pedir acesso, entrar com 2FA, trocar o idioma e recuperar a senha.',
      blocks: [
        { kind: 'h3', text: 'Pedir acesso' },
        {
          kind: 'steps',
          items: [
            `Na tela de entrada, clique em ${ui('auth.register')}.`,
            'Informe nome completo, empresa, e-mail e uma senha com pelo menos 12 caracteres.',
            `Se você recebeu uma chave de acesso de um Sales Engineer, marque ${ui('auth.iamCustomer')} e informe o nome da empresa exatamente como foi cadastrado e a chave. Quem aprova é a pessoa que cadastrou a empresa.`,
            'Sem chave, o pedido vai para um Administrador, que escolhe o seu perfil ao aprovar.',
          ],
        },
        { kind: 'p', text: 'Você recebe a mensagem de pedido enviado e só consegue entrar depois da aprovação.' },
        { kind: 'h3', text: 'Primeira entrada e 2FA' },
        {
          kind: 'steps',
          items: [
            'Entre com e-mail e senha.',
            'Na primeira vez aparece um QR code. Leia com o Google Authenticator, Microsoft Authenticator ou outro app de TOTP.',
            'Digite o código de 6 dígitos. Nas próximas entradas, a ferramenta pede só o código atual do app.',
          ],
        },
        { kind: 'list', items: ['A sessão dura até 12 horas e termina após 30 minutos sem uso.', 'Muitas tentativas erradas bloqueiam a conta por alguns minutos.'] },
        { kind: 'h3', text: 'Idioma e saída' },
        {
          kind: 'p',
          text: `O seletor de idioma no topo (pt-BR, en, es) muda a ferramenta e fica salvo neste navegador. O idioma do Relatório é escolhido à parte, em cada Relatório. Para sair, abra o menu com o seu nome, no canto superior direito, e use ${ui('nav.signOut')}.`,
        },
        { kind: 'h3', text: 'Esqueci a senha ou perdi o celular' },
        {
          kind: 'p',
          text: `Peça a um Administrador. Ele gera um ${ui('admin.passwordLink')} para você criar uma senha nova, ou usa ${ui('admin.resetMfa')} para você configurar o 2FA de novo no próximo acesso.`,
        },
      ],
    },
    {
      id: 'pocs',
      title: 'A lista de PoCs',
      roles: 'all',
      summary: 'A tela inicial: um cartão por PoC, com selos que mostram em que ponto ela está.',
      blocks: [
        { kind: 'p', text: 'A tela inicial lista as PoCs que você pode ver. Clique em um cartão para abrir a PoC.' },
        {
          kind: 'table',
          head: ['Selo', 'Significado'],
          rows: [
            [ui('poc.phase.notebook'), 'A PoC está no PoC Notebook e ainda não tem Relatório.'],
            [ui('poc.phase.report'), 'Começou como Notebook e já tem pelo menos um Relatório.'],
            [ui('poc.draft'), 'Um Sync foi iniciado, mas os detalhes nunca foram salvos. Abra para continuar ou exclua.'],
            [ui('poc.syncing'), 'Há uma coleta em andamento. A PoC não pode ser excluída até ela terminar ou ser cancelada.'],
          ],
        },
        {
          kind: 'list',
          items: [
            'Sales Engineer vê as próprias PoCs e as das revendas que cadastrou. Partner vê só as próprias. Cliente vê as PoCs da sua empresa.',
            `Administradores veem todas e podem filtrar por dono no seletor ao lado do título (${ui('poc.mine')} ou uma pessoa).`,
            'O ícone de lixeira no canto do cartão exclui a PoC para sempre, com Relatórios, Notebook, Syncs e comentários. Só o dono ou um Administrador vê esse ícone.',
          ],
        },
      ],
    },
    {
      id: 'companies',
      title: 'Empresas e acesso do cliente',
      roles: STAFF,
      summary: 'Cadastrar o cliente ou a revenda, entregar a chave de acesso e aprovar as pessoas.',
      blocks: [
        {
          kind: 'p',
          text: `Em ${ui('nav.customers')} você cadastra as organizações com que trabalha. O perfil da empresa define o acesso de todas as pessoas que entram por ela.`,
        },
        {
          kind: 'table',
          head: ['Perfil', 'As pessoas da empresa…'],
          rows: [
            [ui('customers.profile.customer'), 'acompanham as PoCs vinculadas à empresa: veem, baixam e comentam os Relatórios e preenchem o Notebook.'],
            [ui('customers.profile.partner'), 'viram Partners: conduzem as próprias PoCs. Quem cadastrou a revenda acompanha as PoCs delas.'],
          ],
        },
        { kind: 'h3', text: 'Cadastrar uma empresa' },
        {
          kind: 'steps',
          items: [
            `Clique em ${ui('customers.new')}, digite o nome e escolha o perfil.`,
            'Copie a chave de acesso exibida. Ela aparece uma única vez: a ferramenta guarda só uma assinatura dela.',
            'Entregue o nome exato da empresa e a chave na primeira reunião.',
          ],
        },
        { kind: 'h3', text: 'Aprovar as pessoas' },
        {
          kind: 'p',
          text: `Quem se cadastra com a chave aparece na linha da empresa, em ${ui('customers.users')}, como ${ui('customers.pending')}. Use ${ui('admin.approve')} ou ${ui('admin.reject')}. Para tirar o acesso de alguém depois, use ${ui('del.disable')}.`,
        },
        { kind: 'tip', text: 'Uma chave vazada não dá acesso sozinha: todo cadastro ainda precisa da sua aprovação.' },
        { kind: 'h3', text: 'Trocar chave, perfil ou excluir' },
        {
          kind: 'list',
          items: [
            `${ui('customers.rotate')} invalida a chave anterior. Quem já entrou continua com acesso.`,
            'Mudar o perfil muda o perfil de todas as pessoas da empresa, e elas precisam entrar de novo. Uma revenda cujas pessoas já têm PoCs ou empresas não pode voltar a ser Cliente.',
            `${ui('del.companyTitle')} apaga a empresa e tudo o que depende dela (pessoas, PoCs, Relatórios). Para confirmar, digite o nome da empresa. Não há como desfazer.`,
          ],
        },
      ],
    },
    {
      id: 'new-poc',
      title: 'Criar uma PoC',
      roles: STAFF,
      summary: 'Três caminhos: começar pelo Notebook, começar com uma Stellar Experience ou ir direto ao Relatório Final.',
      blocks: [
        { kind: 'p', text: `Clique em ${ui('poc.create')}. A ferramenta pergunta ${ui('newpoc.choose')}` },
        {
          kind: 'table',
          head: ['Caminho', 'Quando usar'],
          rows: [
            [ui('newpoc.experience'), 'Você vai apresentar a plataforma ao cliente ao vivo. Cria o Notebook junto com a primeira Stellar Experience e abre a aba Experience. Só Sales Engineers e Admins. Exige uma empresa com perfil Cliente.'],
            [ui('newpoc.notebook'), 'A PoC está começando. Você quer planejar e acompanhar com o cliente. O Relatório Final é criado depois, a partir do Notebook. Exige uma empresa com perfil Cliente.'],
            [ui('newpoc.report'), 'A PoC já aconteceu e você só precisa do Relatório. Vincular um cliente é opcional.'],
          ],
        },
        { kind: 'h3', text: 'Começar um PoC Notebook' },
        {
          kind: 'steps',
          items: [
            `Escolha a empresa em ${ui('newpoc.chooseCustomer')}. Se ela ainda não existe, use ${ui('wiz.newCustomer')}.`,
            `Informe a ${ui('newpoc.startDate')}: o cronograma é calculado a partir dela.`,
            `Clique em ${ui('newpoc.start')}.`,
          ],
        },
        { kind: 'h3', text: 'Começar com uma Stellar Experience' },
        {
          kind: 'steps',
          items: [
            `Escolha a empresa e a ${ui('newpoc.startDate')}, como no Notebook.`,
            `Dê um ${ui('exp.name')} à Experience e escolha o ${ui('exp.profile')}: ${ui('exp.profile.technical')} ou ${ui('exp.profile.executive')}.`,
            `Clique em ${ui('newpoc.experienceStart')}. A PoC abre na aba Experience, pronta para começar a sessão.`,
          ],
        },
        { kind: 'h3', text: 'Criar o Relatório Final direto' },
        { kind: 'p', text: 'Siga os passos 1 a 6 do assistente, descritos em "Coletar os dados: Sync".' },
      ],
    },
    {
      id: 'notebook',
      title: 'PoC Notebook',
      roles: 'all',
      summary: 'O registro de trabalho da PoC, compartilhado com o cliente e salvo automaticamente.',
      blocks: [
        {
          kind: 'p',
          text: `A aba ${ui('tab.notebook')} reúne tudo o que acontece na PoC. Cada campo é salvo sozinho segundos depois da alteração: o indicador no topo mostra ${ui('nb.saving')} e depois ${ui('nb.savedAt', { time: '14:32' })}. Use ${ui('nb.expandAll')} e ${ui('nb.collapseAll')} para abrir ou fechar as seções.`,
        },
        {
          kind: 'table',
          head: ['Seção', 'O que registrar'],
          rows: [
            [ui('nb.overview'), 'Cliente, departamento, analistas, contatos de negócio e técnico, Sales Engineer, revenda, dimensionamento em GB/dia, URL da PoC e requisitos de negócio. Traz também links para a documentação da Stellar Cyber (requisitos do sensor, portas de firewall, conectores).'],
            [ui('nb.sources'), 'As fontes de log (parsers, com porta) e os conectores da PoC, escolhidos no Catálogo de Fontes de Dados. Cada um tem status e notas.'],
            [ui('nb.criteria'), 'O que o cliente precisa ver para aprovar. Cada critério tem status, notas de avaliação e peso de 1 a 5 (o peso não vai para o Relatório).'],
            [ui('nb.meetings'), 'Uma linha por reunião: data, link e senha da gravação, notas e próximos passos.'],
            [ui('nb.process'), 'O checklist da PoC, por fases. Cada item fica como em andamento, concluído ou N/A, e a barra mostra o progresso.'],
            [ui('nb.schedule'), 'Os marcos da PoC no calendário (veja "Cronograma da PoC").'],
          ],
        },
        { kind: 'h3', text: 'Fontes de dados' },
        {
          kind: 'list',
          items: [
            'Busque por produto, categoria ou porta, por exemplo `fortigate`, `firewall` ou `5143`.',
            `Se o produto não estiver no catálogo, use ${ui('nb.addOutside', { name: '…' })}. A linha fica marcada como ${ui('nb.outsideCatalog')}.`,
            `Uma entrada que saiu da documentação oficial continua na PoC, marcada como ${ui('nb.removedFromDocs')}.`,
          ],
        },
        { kind: 'h3', text: 'Quem pode fazer o quê' },
        {
          kind: 'list',
          items: [
            'O Sales Engineer, o dono da PoC e os Administradores preenchem tudo e também moldam o Notebook: ocultam, excluem e adicionam itens do processo e marcos.',
            'O Partner e as pessoas do cliente preenchem os campos, status e notas.',
            `Ocultar um item (${ui('nb.hide')}) vale só para este Notebook. Para mudar o modelo de todos os Notebooks novos, um Administrador edita o ${ui('tpl.title')}.`,
          ],
        },
        {
          kind: 'tip',
          text: `Os critérios de sucesso, com os status do momento, são congelados em cada Sync e saem no Relatório. Atualize os status antes de rodar o ${ui('sync.new')}.`,
        },
      ],
    },
    {
      id: 'schedule',
      title: 'Cronograma da PoC',
      roles: 'all',
      summary: 'Marcos calculados a partir da data de início e ligados às fases do processo.',
      blocks: [
        {
          kind: 'p',
          text: 'O cronograma vai do dia de início à conclusão da PoC. As datas são sugeridas a partir da data de início, sempre numa segunda, quarta ou sexta-feira. Cada marco depois do início representa uma fase do processo e fica concluído quando todos os itens daquela fase estiverem concluídos ou N/A.',
        },
        {
          kind: 'table',
          head: ['Cor', 'Grupo'],
          rows: [
            [ui('sch.tone.start'), 'O dia de início'],
            [ui('sch.tone.pre'), 'Preparação: requisitos, sensores, conectores'],
            [ui('sch.tone.poc'), 'Reuniões de acompanhamento'],
            [ui('sch.tone.close'), 'Encerramento e apresentação do Relatório'],
          ],
        },
        { kind: 'h3', text: 'Ajustar datas' },
        {
          kind: 'steps',
          items: [
            `Clique em ${ui('sch.edit')}.`,
            `Mude a data de um marco: só ele se move. Para voltar ao cálculo automático, use ${ui('sch.auto')}.`,
            `Para incluir uma etapa, use ${ui('sch.addMilestone')}.`,
            `Clique em ${ui('sch.doneEditing')}.`,
          ],
        },
        { kind: 'tip', text: 'Abaixo do cronograma aparece o período sugerido para o Relatório Final, do kickoff à conclusão, com no máximo 30 dias.' },
      ],
    },
    {
      id: 'sync',
      title: 'Coletar os dados: Sync',
      roles: STAFF,
      summary: 'Conectar a Instância, escolher Tenant e período e acompanhar a coleta.',
      blocks: [
        {
          kind: 'p',
          text: 'Um Sync lê os dados do período na Instância Stellar Cyber pela API e os guarda como os dados do Relatório. Depois disso, o Relatório pode ser gerado de novo, em qualquer layout e idioma, sem acessar a Instância.',
        },
        { kind: 'h3', text: 'O assistente' },
        {
          kind: 'steps',
          items: [
            `${ui('wiz.customerTitle')}: vincule a empresa cliente, se quiser que as pessoas dela vejam o Relatório.`,
            `${ui('wiz.instanceTitle')}: informe a URL (https://…) e a credencial: uma Scoped API Key, ou usuário e token. Marque ${ui('wiz.remember')} para não digitar de novo.`,
            `${ui('wiz.tenantTitle')}: a lista aparece sozinha. Use ${ui('wiz.searchTenant')} quando houver muitos.`,
            `${ui('wiz.autoTriageTitle')}: marque só se o Auto Triage foi testado na PoC. É preciso digitar a frase de confirmação.`,
            `${ui('wiz.periodTitle')}: até 30 dias, terminando no máximo ontem. Clique em ${ui('wiz.runSync')}.`,
            `${ui('wiz.detailsTitle')}: preencha os detalhes enquanto a coleta roda e clique em ${ui('common.save')}.`,
          ],
        },
        {
          kind: 'warn',
          text: `A credencial nunca é gravada no banco de dados. Se você pedir para lembrar, ela fica num cookie lacrado só neste navegador, para o seu usuário, por 90 dias. Use ${ui('wiz.forget')} para apagá-la na hora.`,
        },
        { kind: 'h3', text: 'As fases da coleta' },
        {
          kind: 'list',
          items: [ui('sync.phase.connect'), ui('sync.phase.collect'), ui('sync.phase.alerts'), ui('sync.phase.process'), ui('sync.phase.save')],
        },
        {
          kind: 'p',
          text: `Você pode sair da tela: a coleta continua no servidor. Para interromper, use ${ui('sync.cancel')}. O que foi coletado é descartado e nenhum Relatório é criado.`,
        },
        { kind: 'h3', text: 'Novo Sync' },
        {
          kind: 'list',
          items: [
            `Na PoC, ${ui('sync.new')} coleta de novo e cria um Relatório com a próxima versão principal (2.0, 3.0…). Os anteriores continuam disponíveis.`,
            `Por padrão ele usa o período da PoC. Mude as datas para gerar o Relatório de um período específico: só este Sync usa esse período. ${ui('sync.periodReset')} desfaz a mudança.`,
            'Ativos e volume de licenciamento só existem para os últimos dias da Instância. Se o período começar antes disso, a ferramenta avisa que o Relatório terá esses números incompletos.',
          ],
        },
      ],
    },
    {
      id: 'reports',
      title: 'Relatórios: abrir, apresentar e baixar',
      roles: 'all',
      summary: 'Escolher layout e idioma, apresentar na tela e exportar em PDF.',
      blocks: [
        {
          kind: 'p',
          text: `Na aba ${ui('tab.report')} há um cartão por Relatório, do mais novo ao mais antigo. Cada cartão mostra a versão, a data, o período, até quando o Relatório fica disponível e quatro números: ativos (média diária e pico), ingestão total, Cases e alertas.`,
        },
        {
          kind: 'table',
          head: ['Layout', 'Para quem'],
          rows: [
            [ui('template.technical'), 'Equipe técnica e SOC: arquitetura, fontes de dados, sensores, conformidade de licença, MITRE ATT&CK em detalhe.'],
            [ui('template.executive'), 'Gestores e decisores: a história da detecção em cinco partes, esforço evitado e veredito.'],
            [ui('template.insight'), 'O novo layout redesenhado, mais visual, para uma leitura rápida dos resultados.'],
          ],
        },
        { kind: 'h3', text: 'Apresentar' },
        {
          kind: 'steps',
          items: [
            'Escolha o layout e o idioma nos seletores do cartão.',
            `Clique em ${ui('report.open')}. O Relatório abre numa nova aba.`,
            'Passe o mouse sobre os gráficos para ver detalhes e clique nas legendas para ligar ou desligar séries.',
            'Use as setas ← e → (ou os botões ◀ ▶ no canto) para ir de uma seção à outra. Há botões para tela cheia e para imprimir.',
          ],
        },
        { kind: 'h3', text: 'Baixar' },
        { kind: 'p', text: `${ui('report.pdf')} gera o mesmo conteúdo da página, no layout e no idioma escolhidos.` },
        {
          kind: 'warn',
          text: 'Uma PoC e seus Relatórios ficam guardados enquanto ela está Ativa. Quando a PoC terminar, use Encerrar PoC e escolha o resultado (Ganha, Perdida, Sem decisão): ela deixa de aceitar Syncs e, passado o Período de Retenção (90 dias por padrão), é apagada para sempre com tudo o que contém. Você pode reabri-la até lá. Baixe o PDF de tudo o que precisar guardar.',
        },
        {
          kind: 'p',
          text: `O dono da PoC pode excluir um Relatório pela lixeira do cartão (${ui('report.delete')}). Dados, PDFs e comentários desse Relatório deixam de existir.`,
        },
        { kind: 'tip', text: `Se aparecer ${ui('report.outdated')}, os dados foram coletados por uma versão antiga da ferramenta: rode um novo Sync.` },
      ],
    },
    {
      id: 'comments',
      title: 'Comentários e versões',
      roles: 'all',
      summary: 'Comentário interno, comentário de Relatório, comentário privado e como a versão muda.',
      blocks: [
        { kind: 'p', text: `Clique em ${ui('report.comments')} no cartão do Relatório e escolha o tipo.` },
        {
          kind: 'table',
          head: ['Tipo', 'Quem vê', 'Vai para o Relatório?'],
          rows: [
            [ui('report.commentInternal'), 'Todos com acesso ao Relatório, inclusive o cliente', 'Não'],
            [`${ui('report.commentInternal')} + ${ui('report.commentPrivateBadge')}`, 'Só a equipe Stellar Cyber e as revendas', 'Não'],
            [ui('report.commentReport'), 'Todos', 'Sim: cria uma nova versão e entra no histórico de versões (Apêndice B)'],
          ],
        },
        { kind: 'h3', text: 'Como a versão é contada' },
        {
          kind: 'list',
          items: [
            'O número antes do ponto conta os Relatórios (coletas) da PoC: 1.0, 2.0, 3.0…',
            'O número depois do ponto conta os comentários de Relatório daquela coleta: 1.1, 1.2…',
            'Exemplo: o segundo Sync, com um comentário de Relatório, é a versão 2.1.',
          ],
        },
      ],
    },
    {
      id: 'details',
      title: 'Detalhes da PoC: veredito, comentários e premissas',
      roles: STAFF,
      summary: 'Os campos que entram no Relatório e podem ser mudados a qualquer momento.',
      blocks: [
        {
          kind: 'p',
          text: `Clique em ${ui('poc.editDetails')}. As mudanças valem para todos os Relatórios da PoC na próxima vez que forem abertos, sem novo Sync: os números ficam congelados, os detalhes não.`,
        },
        {
          kind: 'table',
          head: ['Bloco', 'Para que serve'],
          rows: [
            [ui('form.sectionCustomer'), 'Nome da empresa, departamento, e-mail, analistas e critérios de sucesso (numa PoC com Notebook, os critérios ficam no Notebook).'],
            [ui('form.sectionGeneral'), 'Versão da plataforma, região da Instância e cliente vinculado.'],
            [`${ui('form.sectionSe')} / ${ui('form.sectionPartner')}`, 'Contatos que aparecem na capa.'],
            [ui('form.verdict'), `${ui('form.verdict.approved')}, ${ui('form.verdict.conditional')}, ${ui('form.verdict.rejected')} ou ${ui('form.verdictNone')}. O "?" ao lado abre o guia de veredito.`],
            [ui('form.comments'), 'Seu parecer: pontos fortes, limitações, pendências e próximos passos. Sai no Relatório exatamente como escrito.'],
            [ui('form.sectionEffort'), 'Minutos de triagem e investigação usados para estimar o trabalho que a correlação evitou (Relatório Executive).'],
            [ui('form.sectionAutoTriage'), 'Se o Auto Triage foi testado. A mudança vale a partir do próximo Sync.'],
            [ui('form.sectionArch'), 'Uma imagem PNG ou JPEG da arquitetura da PoC, para o Relatório Technical.'],
          ],
        },
        { kind: 'tip', text: 'Campos com erro ficam em vermelho e o botão Salvar só funciona depois de corrigi-los.' },
      ],
    },
    {
      id: 'customer',
      title: 'Guia do cliente',
      roles: ['customer'],
      summary: 'O que você, cliente em avaliação, pode fazer na ferramenta.',
      blocks: [
        {
          kind: 'p',
          text: 'Você recebeu do Sales Engineer o nome da sua empresa e uma chave de acesso. Depois que ele aprovar o seu cadastro, você vê as PoCs da sua empresa.',
        },
        {
          kind: 'list',
          items: [
            `Na aba ${ui('tab.notebook')}, acompanhe e preencha a PoC: critérios de sucesso, status das fontes de dados, atas de reunião e checklist. Tudo é salvo automaticamente.`,
            `Na aba ${ui('tab.report')}, abra o Relatório (${ui('report.open')}) ou baixe o PDF, no idioma que preferir.`,
            `Deixe ${ui('report.comments')} com dúvidas ou ajustes. O Sales Engineer responde na própria ferramenta.`,
          ],
        },
        { kind: 'p', text: 'Você não cria PoCs, não roda coletas e não vê dados de outras empresas.' },
      ],
    },
    {
      id: 'admin',
      title: 'Administração',
      roles: ['admin'],
      summary: 'Aprovar cadastros, gerenciar usuários, configurações, Catálogo de Fontes de Dados e Modelo do Notebook.',
      blocks: [
        { kind: 'h3', text: ui('admin.pending') },
        { kind: 'p', text: `Pedidos sem chave de acesso chegam aqui. Escolha o perfil no seletor e clique em ${ui('admin.approve')} ou ${ui('admin.reject')}.` },
        { kind: 'h3', text: ui('admin.users') },
        {
          kind: 'list',
          items: [
            'Mude o perfil no seletor da linha. A coluna PoCs leva à lista de PoCs daquela pessoa.',
            `${ui('admin.mfaExempt')} dispensa o 2FA da conta. Use só em casos justificados.`,
            `${ui('admin.resetMfa')} faz a pessoa configurar o 2FA de novo. ${ui('admin.passwordLink')} gera um link para criar senha nova: copie e envie à pessoa.`,
            `${ui('del.userTitle')}: se a conta tem PoCs ou empresas, escolha quem as recebe antes de excluir.`,
            `A conta **Root** (administrator@stellarcyber.ai) já vem com a instalação. Ela não muda de perfil, não é desativada nem excluída, e é a única que troca a própria senha pela tela, em ${ui('root.changePassword')} no menu do usuário.`,
          ],
        },
        { kind: 'h3', text: ui('catalog.title') },
        {
          kind: 'p',
          text: `A lista de parsers e conectores que os Notebooks usam. É lida toda segunda-feira das páginas oficiais da documentação. ${ui('catalog.updateNow')} abre as duas URLs: ${ui('catalog.validate')} mostra o que muda, e nada é salvo antes de ${ui('catalog.confirm')}.`,
        },
        {
          kind: 'p',
          text: `O botão ${ui('catalog.historyButton')} abre o ${ui('catalog.history')}: cada atualização gravada, manual ou semanal, com o nome de cada parser e conector que entrou (+, em verde) ou saiu (−, em vermelho). Uma atualização grande mostra os primeiros nomes e abre a lista completa; a busca acha em quais atualizações um item entrou ou saiu.`,
        },
        { kind: 'h3', text: ui('tpl.title') },
        {
          kind: 'p',
          text: `As fases, itens e marcos que todo Notebook novo copia. Em ${ui('tpl.open')}, oculte, exclua, adicione e reordene. Só o texto em pt-BR é obrigatório. As mudanças valem para os Notebooks criados depois.`,
        },
        { kind: 'h3', text: ui('admin.settings') },
        {
          kind: 'list',
          items: [
            `${ui('admin.retentionDays')}: por quanto tempo uma PoC encerrada fica guardada antes de ser apagada, contado do encerramento (padrão 90).`,
            `${ui('admin.allowedDomains')}: restringe quem pode pedir acesso, por exemplo \`stellarcyber.ai, revenda.com\`.`,
          ],
        },
      ],
    },
    {
      id: 'audit',
      title: 'Auditoria',
      roles: ['admin'],
      summary: 'Quem fez o quê, a comunicação com as Instâncias, as coletas e os logs da aplicação.',
      blocks: [
        {
          kind: 'table',
          head: ['Aba', 'O que mostra'],
          rows: [
            [ui('audit.tab.overview'), 'Indicadores de 24 horas e 7 dias: entradas, falhas, usuários ativos, Syncs, chamadas de API, latência e erros.'],
            [ui('audit.tab.activity'), 'Cada ação relevante: entradas, aprovações, PoCs criadas, Relatórios gerados, exclusões.'],
            [ui('audit.tab.api'), 'Cada chamada à API das Instâncias, com resultado, latência e volume, por Instância e endpoint.'],
            [ui('audit.tab.syncs'), 'Cada coleta: duração, tempo por fase, resultado e as chamadas que ela fez.'],
            [ui('audit.tab.logs'), 'O log técnico da aplicação, filtrável por nível, origem e categoria.'],
          ],
        },
        { kind: 'p', text: `Todas as abas têm filtro de período e busca, e ${ui('audit.export')} baixa o que está na tela.` },
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Problemas comuns',
      roles: 'all',
      summary: 'As mensagens de erro mais frequentes e o que fazer.',
      blocks: [
        {
          kind: 'table',
          head: ['Mensagem', 'O que fazer'],
          rows: [
            [ui('auth.pending'), 'Aguarde a aprovação de quem cadastrou a sua empresa, ou de um Administrador.'],
            [ui('auth.customerKeyInvalid'), 'Confira com o Sales Engineer o nome exato da empresa e a chave. Ele pode gerar uma chave nova.'],
            [ui('auth.locked'), 'Espere alguns minutos e tente de novo.'],
            [ui('err.stellar_auth_failed'), 'A chave de API está errada, expirou ou não tem o escopo necessário. Gere outra no console da Stellar Cyber.'],
            [ui('err.stellar_forbidden'), 'A chave não pode ler esses dados. Use uma chave com acesso ao Tenant.'],
            [ui('err.stellar_network'), 'Confira a URL da Instância (https://…) e se ela está acessível a partir do servidor da ferramenta.'],
            [ui('err.period'), 'Escolha até 30 dias, com início antes do fim, terminando no máximo ontem.'],
            [ui('err.sync_in_progress'), 'Espere a coleta atual terminar ou cancele-a.'],
            [ui('nb.saveError'), 'Verifique a conexão. A próxima alteração tenta salvar de novo.'],
          ],
        },
        { kind: 'p', text: 'Se o problema continuar, fale com o Sales Engineer responsável ou com um Administrador da ferramenta.' },
      ],
    },
    {
      id: 'glossary',
      title: 'Glossário',
      roles: 'all',
      summary: 'Os termos usados na ferramenta e nos Relatórios.',
      blocks: [
        {
          kind: 'table',
          head: ['Termo', 'Significado'],
          rows: [
            ['PoC', 'A avaliação da Stellar Cyber por um cliente.'],
            ['PoC Notebook', 'O registro de trabalho da PoC, do planejamento ao encerramento, compartilhado com o cliente.'],
            ['Instância', 'Uma instalação da Stellar Cyber, identificada pela URL.'],
            ['Tenant', 'Uma partição de dados dentro da Instância. Cada coleta lê um único Tenant.'],
            ['Sync', 'Uma coleta dos dados do período na Instância.'],
            ['Case', 'Um incidente correlacionado, formado por um ou mais alertas e classificado por severidade.'],
            ['Alerta', 'Uma detecção dentro de um Case, marcada com táticas e técnicas MITRE ATT&CK ou da XDR Kill Chain.'],
            ['Auto Triage', 'O veredito de IA da Stellar Cyber sobre um Case. Exige licença adicional.'],
            ['Volume de licenciamento', 'GB por dia armazenados após enriquecimento e compressão. É o número usado na conformidade de licença.'],
            ['Período de Retenção', 'Por quanto tempo uma PoC encerrada fica guardada, a partir do encerramento, antes de ser apagada com tudo o que contém. PoCs ativas nunca são apagadas por ele.'],
            ['Veredito', 'O resultado da PoC: aprovada, aprovada com condições ou não aprovada.'],
          ],
        },
      ],
    },
  ],
})

