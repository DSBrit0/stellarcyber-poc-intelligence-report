import { STAFF, type HelpGuide, type Ui } from './types'

export const guideEs = (ui: Ui): HelpGuide => ({
  sections: [
    {
      id: 'overview',
      title: 'Visión general',
      roles: 'all',
      summary: 'Qué hace la herramienta, quién la usa y el camino de una PoC desde el inicio hasta el Reporte.',
      blocks: [
        {
          kind: 'p',
          text: 'PoC Intelligence Report acompaña la evaluación (PoC) que un cliente hace de Stellar Cyber. Organiza el trabajo con el cliente en el PoC Notebook, recopila la evidencia de la Instancia Stellar Cyber por la API y produce el Reporte Final de la PoC: una página HTML adaptable que también se descarga en PDF, en pt-BR, en o es.',
        },
        { kind: 'h3', text: 'El camino de una PoC' },
        {
          kind: 'steps',
          items: [
            'El Sales Engineer registra la **Empresa** del cliente y entrega la clave de acceso en la primera reunión.',
            'Inicia un **PoC Notebook**: criterios de éxito, fuentes de datos, actas de reunión, proceso y cronograma, completados junto con el cliente.',
            'Al final del período conecta la Instancia Stellar Cyber, elige el Tenant y el período y ejecuta un **Sync**, que recopila los datos.',
            'El Reporte queda listo en tres diseños (Technical, Executive e Insight). Se puede presentar en pantalla, descargar en PDF y el cliente puede comentarlo.',
          ],
        },
        { kind: 'h3', text: 'Perfiles de acceso' },
        {
          kind: 'table',
          head: ['Perfil', 'Quién es', 'Qué hace'],
          rows: [
            [ui('role.admin'), 'Administrador de la herramienta', 'Aprueba registros, gestiona usuarios y configuraciones, ve todas las PoCs y la Auditoría.'],
            [ui('role.sales_engineer'), 'Sales Engineer de Stellar Cyber', 'Registra Empresas, conduce PoCs y sigue las PoCs de los revendedores que registró.'],
            [ui('role.partner'), 'Persona de un revendedor', 'Conduce sus propias PoCs y registra sus propios clientes.'],
            [ui('role.customer'), 'Persona del cliente en evaluación', 'Ve, descarga y comenta los Reportes de las PoCs de su empresa y completa el PoC Notebook.'],
          ],
        },
        { kind: 'tip', text: `Esta página muestra primero los temas de su perfil. Use ${ui('guide.allTopics')} arriba para ver la guía completa.` },
      ],
    },
    {
      id: 'example',
      title: 'Ejemplo completo: de la primera reunión al Reporte',
      roles: STAFF,
      summary: 'Un paso a paso real, con la empresa ficticia Nébula Logística, del registro al Reporte comentado.',
      blocks: [
        { kind: 'p', text: 'Siga este guion en su primera PoC. Los nombres son de ejemplo: use la empresa y las personas reales.' },
        { kind: 'h3', text: '1. Antes de la primera reunión' },
        {
          kind: 'steps',
          items: [
            `Abra ${ui('nav.customers')} y haga clic en ${ui('customers.new')}.`,
            `Escriba el nombre \`Nébula Logística\`, elija el perfil ${ui('customers.profile.customer')} y guarde.`,
            `Copie la clave que aparece en ${ui('customers.keyOnce')}. No se vuelve a mostrar. Si la pierde, genere otra con ${ui('customers.rotate')}.`,
          ],
        },
        { kind: 'h3', text: '2. En la primera reunión' },
        {
          kind: 'steps',
          items: [
            'Entregue al cliente la dirección de la herramienta, el nombre exacto de la empresa y la clave de acceso.',
            `Cada persona del cliente hace clic en ${ui('auth.register')}, marca ${ui('auth.iamCustomer')} e informa el nombre de la empresa y la clave.`,
            `Vuelva a ${ui('nav.customers')}: los registros aparecen como ${ui('customers.pending')} dentro de la empresa. Haga clic en ${ui('admin.approve')}.`,
          ],
        },
        { kind: 'h3', text: '3. Planificar la PoC en el Notebook' },
        {
          kind: 'steps',
          items: [
            `En la lista de PoCs, haga clic en ${ui('poc.create')} y elija ${ui('newpoc.notebook')}.`,
            `Elija la empresa en ${ui('newpoc.chooseCustomer')}, informe la ${ui('newpoc.startDate')} y haga clic en ${ui('newpoc.start')}.`,
            `En ${ui('nb.overview')}, complete el dimensionamiento (GB/día), la URL de la PoC y los contactos de negocio y técnico.`,
            `En ${ui('nb.criteria')}, registre lo que el cliente necesita ver para aprobar, por ejemplo \`Detectar movimiento lateral\` y \`Reducir el ruido de alertas en un 80%\`. Use ${ui('nb.suggestions')} para empezar más rápido.`,
            `En ${ui('nb.sources')}, busque los productos del cliente (por ejemplo \`fortigate\`, \`office 365\`, \`crowdstrike\`) y agregue cada uno.`,
          ],
        },
        { kind: 'h3', text: '4. Durante la PoC' },
        {
          kind: 'list',
          items: [
            `Después de cada reunión, haga clic en ${ui('nb.addMeeting')} y registre fecha, grabación, notas y próximos pasos.`,
            `Actualice el estado de cada fuente de datos (${ui('nb.ds.in_progress')}, ${ui('nb.ds.ingesting')}, ${ui('nb.ds.ticket_open')}) y de cada ítem de ${ui('nb.process')}.`,
            `Revise en ${ui('nb.schedule')} los hitos marcados como ${ui('sch.late')}.`,
            `Dé a cada criterio de éxito un estado: ${ui('nb.cs.completed_success')}, ${ui('nb.cs.completed_partial')} o ${ui('nb.cs.completed_failed')}.`,
          ],
        },
        { kind: 'h3', text: '5. Generar el Reporte Final' },
        {
          kind: 'steps',
          items: [
            `En la PoC, haga clic en ${ui('nb.createReport')}.`,
            'Informe la URL de la Instancia y la Scoped API Key, elija el Tenant de Nébula y el período (hasta 30 días, terminando como máximo ayer).',
            `Haga clic en ${ui('wiz.runSync')} y siga las cinco fases de la recopilación. Mientras tanto, complete ${ui('wiz.detailsTitle')}: veredicto, comentarios y premisas de esfuerzo.`,
            `Cuando termine, abra la pestaña ${ui('tab.report')}, elija el diseño **Executive** y haga clic en ${ui('report.open')} para presentar.`,
          ],
        },
        { kind: 'h3', text: '6. Después de la presentación' },
        {
          kind: 'list',
          items: [
            `El cliente entra con su propio usuario, abre el Reporte y deja ${ui('report.comments')}.`,
            `Si el texto del Reporte debe cambiar, registre un ${ui('report.commentReport')}: genera la versión siguiente (1.1, 1.2…) y entra en el historial de versiones.`,
            `Si los datos cambian, ejecute un ${ui('sync.new')}: crea un nuevo Reporte (2.0) y conserva el anterior.`,
          ],
        },
      ],
    },
    {
      id: 'access',
      title: 'Acceso: registro, ingreso y verificación en dos pasos',
      roles: 'all',
      summary: 'Solicitar acceso, ingresar con 2FA, cambiar el idioma y recuperar la contraseña.',
      blocks: [
        { kind: 'h3', text: 'Solicitar acceso' },
        {
          kind: 'steps',
          items: [
            `En la pantalla de ingreso, haga clic en ${ui('auth.register')}.`,
            'Informe nombre completo, empresa, correo y una contraseña de al menos 12 caracteres.',
            `Si un Sales Engineer le dio una clave de acceso, marque ${ui('auth.iamCustomer')} e informe el nombre de la empresa exactamente como fue registrado, y la clave. Lo aprueba quien registró la empresa.`,
            'Sin clave, la solicitud va a un Administrador, que elige su perfil al aprobarla.',
          ],
        },
        { kind: 'p', text: 'Verá un mensaje de confirmación y podrá ingresar cuando la solicitud sea aprobada.' },
        { kind: 'h3', text: 'Primer ingreso y 2FA' },
        {
          kind: 'steps',
          items: [
            'Ingrese con correo y contraseña.',
            'La primera vez aparece un código QR. Léalo con Google Authenticator, Microsoft Authenticator u otra app TOTP.',
            'Escriba el código de 6 dígitos. En los próximos ingresos, la herramienta pide solo el código actual de la app.',
          ],
        },
        { kind: 'list', items: ['La sesión dura hasta 12 horas y termina tras 30 minutos sin uso.', 'Muchos intentos fallidos bloquean la cuenta por unos minutos.'] },
        { kind: 'h3', text: 'Idioma y salida' },
        {
          kind: 'p',
          text: `El selector de idioma arriba (pt-BR, en, es) cambia la herramienta y queda guardado en este navegador. El idioma del Reporte se elige aparte, en cada Reporte. Para salir, abra el menú con su nombre, en la esquina superior derecha, y use ${ui('nav.signOut')}.`,
        },
        { kind: 'h3', text: 'Olvidé la contraseña o perdí el teléfono' },
        {
          kind: 'p',
          text: `Pida ayuda a un Administrador. Genera un ${ui('admin.passwordLink')} para que cree una contraseña nueva, o usa ${ui('admin.resetMfa')} para que configure el 2FA de nuevo en el próximo ingreso.`,
        },
      ],
    },
    {
      id: 'pocs',
      title: 'La lista de PoCs',
      roles: 'all',
      summary: 'La pantalla inicial: una tarjeta por PoC, con etiquetas que muestran en qué punto está.',
      blocks: [
        { kind: 'p', text: 'La pantalla inicial lista las PoCs que usted puede ver. Haga clic en una tarjeta para abrir la PoC.' },
        {
          kind: 'table',
          head: ['Etiqueta', 'Significado'],
          rows: [
            [ui('poc.phase.notebook'), 'La PoC está en el PoC Notebook y aún no tiene Reporte.'],
            [ui('poc.phase.report'), 'Empezó como Notebook y ya tiene al menos un Reporte.'],
            [ui('poc.draft'), 'Se inició un Sync, pero los detalles nunca se guardaron. Ábrala para continuar o elimínela.'],
            [ui('poc.syncing'), 'Hay una recopilación en curso. La PoC no se puede eliminar hasta que termine o se cancele.'],
          ],
        },
        {
          kind: 'list',
          items: [
            'El Sales Engineer ve sus PoCs y las de los revendedores que registró. El Partner ve solo las suyas. El Cliente ve las PoCs de su empresa.',
            `Los Administradores ven todas y pueden filtrar por dueño en el selector junto al título (${ui('poc.mine')} o una persona).`,
            'El icono de papelera en la esquina de la tarjeta elimina la PoC para siempre, con Reportes, Notebook, Syncs y comentarios. Solo el dueño o un Administrador lo ve.',
          ],
        },
      ],
    },
    {
      id: 'companies',
      title: 'Empresas y acceso del cliente',
      roles: STAFF,
      summary: 'Registrar al cliente o al revendedor, entregar la clave de acceso y aprobar a sus personas.',
      blocks: [
        { kind: 'p', text: `En ${ui('nav.customers')} registra las organizaciones con las que trabaja. El perfil de la empresa define el acceso de todas las personas que entran por ella.` },
        {
          kind: 'table',
          head: ['Perfil', 'Las personas de la empresa…'],
          rows: [
            [ui('customers.profile.customer'), 'siguen las PoCs vinculadas a la empresa: ven, descargan y comentan los Reportes y completan el Notebook.'],
            [ui('customers.profile.partner'), 'pasan a ser Partners: conducen sus propias PoCs. Quien registró al revendedor sigue esas PoCs.'],
          ],
        },
        { kind: 'h3', text: 'Registrar una empresa' },
        {
          kind: 'steps',
          items: [
            `Haga clic en ${ui('customers.new')}, escriba el nombre y elija el perfil.`,
            'Copie la clave de acceso mostrada. Aparece una sola vez: la herramienta guarda solo una huella de ella.',
            'Entregue el nombre exacto de la empresa y la clave en la primera reunión.',
          ],
        },
        { kind: 'h3', text: 'Aprobar a las personas' },
        {
          kind: 'p',
          text: `Quienes se registran con la clave aparecen en la fila de la empresa, en ${ui('customers.users')}, como ${ui('customers.pending')}. Use ${ui('admin.approve')} o ${ui('admin.reject')}. Para quitar el acceso de alguien después, use ${ui('del.disable')}.`,
        },
        { kind: 'tip', text: 'Una clave filtrada no da acceso por sí sola: todo registro sigue necesitando su aprobación.' },
        { kind: 'h3', text: 'Cambiar la clave o el perfil, o eliminar' },
        {
          kind: 'list',
          items: [
            `${ui('customers.rotate')} invalida la clave anterior. Quienes ya entraron conservan el acceso.`,
            'Cambiar el perfil cambia el perfil de todas las personas de la empresa, que deben ingresar de nuevo. Un revendedor cuyas personas ya tienen PoCs o empresas no puede volver a ser Cliente.',
            `${ui('del.companyTitle')} elimina la empresa y todo lo que depende de ella (personas, PoCs, Reportes). Para confirmar, escriba el nombre de la empresa. No se puede deshacer.`,
          ],
        },
      ],
    },
    {
      id: 'new-poc',
      title: 'Crear una PoC',
      roles: STAFF,
      summary: 'Tres caminos: empezar por el Notebook, empezar con una Stellar Experience o ir directo al Reporte Final.',
      blocks: [
        { kind: 'p', text: `Haga clic en ${ui('poc.create')}. La herramienta pregunta ${ui('newpoc.choose')}` },
        {
          kind: 'table',
          head: ['Camino', 'Cuándo usarlo'],
          rows: [
            [ui('newpoc.experience'), 'Va a presentar la plataforma al cliente en vivo. Crea el Notebook junto con la primera Stellar Experience y abre la pestaña Experience. Solo Sales Engineers y Admins. Exige una empresa con perfil Cliente.'],
            [ui('newpoc.notebook'), 'La PoC está empezando. Quiere planificarla y seguirla con el cliente. El Reporte Final se crea después, desde el Notebook. Exige una empresa con perfil Cliente.'],
            [ui('newpoc.report'), 'La PoC ya ocurrió y solo necesita el Reporte. Vincular un cliente es opcional.'],
          ],
        },
        { kind: 'h3', text: 'Iniciar un PoC Notebook' },
        {
          kind: 'steps',
          items: [
            `Elija la empresa en ${ui('newpoc.chooseCustomer')}. Si aún no existe, use ${ui('wiz.newCustomer')}.`,
            `Informe la ${ui('newpoc.startDate')}: el cronograma se calcula a partir de ella.`,
            `Haga clic en ${ui('newpoc.start')}.`,
          ],
        },
        { kind: 'h3', text: 'Empezar con una Stellar Experience' },
        {
          kind: 'steps',
          items: [
            `Elija la empresa y la ${ui('newpoc.startDate')}, como en el Notebook.`,
            `Dé un ${ui('exp.name')} a la Experience y elija el ${ui('exp.profile')}: ${ui('exp.profile.technical')} o ${ui('exp.profile.executive')}.`,
            `Haga clic en ${ui('newpoc.experienceStart')}. La PoC se abre en la pestaña Experience, lista para empezar la sesión.`,
          ],
        },
        { kind: 'h3', text: 'Crear el Reporte Final directamente' },
        { kind: 'p', text: 'Siga los pasos 1 a 6 del asistente, descritos en "Recopilar los datos: Sync".' },
      ],
    },
    {
      id: 'notebook',
      title: 'PoC Notebook',
      roles: 'all',
      summary: 'El registro de trabajo de la PoC, compartido con el cliente y guardado automáticamente.',
      blocks: [
        {
          kind: 'p',
          text: `La pestaña ${ui('tab.notebook')} reúne todo lo que ocurre en la PoC. Cada campo se guarda solo unos segundos después del cambio: el indicador arriba muestra ${ui('nb.saving')} y luego ${ui('nb.savedAt', { time: '14:32' })}. Use ${ui('nb.expandAll')} y ${ui('nb.collapseAll')} para abrir o cerrar las secciones.`,
        },
        {
          kind: 'table',
          head: ['Sección', 'Qué registrar'],
          rows: [
            [ui('nb.overview'), 'Cliente, departamento, analistas, contactos de negocio y técnico, Sales Engineer, revendedor, dimensionamiento en GB/día, URL de la PoC y requisitos de negocio. También enlaza a la documentación de Stellar Cyber (requisitos del sensor, puertos de firewall, conectores).'],
            [ui('nb.sources'), 'Las fuentes de log (parsers, con su puerto) y los conectores de la PoC, elegidos del Catálogo de Fuentes de Datos. Cada uno tiene estado y notas.'],
            [ui('nb.criteria'), 'Lo que el cliente necesita ver para aprobar. Cada criterio tiene estado, notas de evaluación y un peso de 1 a 5 (el peso no va al Reporte).'],
            [ui('nb.meetings'), 'Una fila por reunión: fecha, enlace y contraseña de la grabación, notas y próximos pasos.'],
            [ui('nb.process'), 'El checklist de la PoC, por fases. Cada ítem está en curso, completado o N/A, y la barra muestra el progreso.'],
            [ui('nb.schedule'), 'Los hitos de la PoC en el calendario (vea "Cronograma de la PoC").'],
          ],
        },
        { kind: 'h3', text: 'Fuentes de datos' },
        {
          kind: 'list',
          items: [
            'Busque por producto, categoría o puerto, por ejemplo `fortigate`, `firewall` o `5143`.',
            `Si el producto no está en el catálogo, use ${ui('nb.addOutside', { name: '…' })}. La fila queda marcada como ${ui('nb.outsideCatalog')}.`,
            `Una entrada que salió de la documentación oficial sigue en la PoC, marcada como ${ui('nb.removedFromDocs')}.`,
          ],
        },
        { kind: 'h3', text: 'Quién puede hacer qué' },
        {
          kind: 'list',
          items: [
            'El Sales Engineer, el dueño de la PoC y los Administradores completan todo y además dan forma al Notebook: ocultan, eliminan y agregan ítems del proceso e hitos.',
            'El Partner y las personas del cliente completan campos, estados y notas.',
            `Ocultar un ítem (${ui('nb.hide')}) afecta solo a este Notebook. Para cambiar lo que copian todos los Notebooks nuevos, un Administrador edita la ${ui('tpl.title')}.`,
          ],
        },
        {
          kind: 'tip',
          text: `Los criterios de éxito, con sus estados de ese momento, se congelan en cada Sync y se imprimen en el Reporte. Actualice los estados antes de ejecutar un ${ui('sync.new')}.`,
        },
      ],
    },
    {
      id: 'schedule',
      title: 'Cronograma de la PoC',
      roles: 'all',
      summary: 'Hitos calculados a partir de la fecha de inicio y ligados a las fases del proceso.',
      blocks: [
        {
          kind: 'p',
          text: 'El cronograma va del día de inicio a la conclusión de la PoC. Las fechas se sugieren a partir de la fecha de inicio, siempre un lunes, miércoles o viernes. Cada hito después del inicio representa una fase del proceso y queda completado cuando todos los ítems de esa fase están completados o N/A.',
        },
        {
          kind: 'table',
          head: ['Color', 'Grupo'],
          rows: [
            [ui('sch.tone.start'), 'El día de inicio'],
            [ui('sch.tone.pre'), 'Preparación: requisitos, sensores, conectores'],
            [ui('sch.tone.poc'), 'Reuniones de seguimiento'],
            [ui('sch.tone.close'), 'Cierre y presentación del Reporte'],
          ],
        },
        { kind: 'h3', text: 'Ajustar fechas' },
        {
          kind: 'steps',
          items: [
            `Haga clic en ${ui('sch.edit')}.`,
            `Cambie la fecha de un hito: solo ese se mueve. Para volver a la fecha calculada, use ${ui('sch.auto')}.`,
            `Para agregar una etapa, use ${ui('sch.addMilestone')}.`,
            `Haga clic en ${ui('sch.doneEditing')}.`,
          ],
        },
        { kind: 'tip', text: 'Debajo del cronograma aparece el período sugerido para el Reporte Final, del kickoff a la conclusión, con un máximo de 30 días.' },
      ],
    },
    {
      id: 'sync',
      title: 'Recopilar los datos: Sync',
      roles: STAFF,
      summary: 'Conectar la Instancia, elegir Tenant y período y seguir la recopilación.',
      blocks: [
        {
          kind: 'p',
          text: 'Un Sync lee los datos del período en la Instancia Stellar Cyber por la API y los guarda como los datos del Reporte. A partir de ahí, el Reporte se puede generar de nuevo, en cualquier diseño e idioma, sin acceder a la Instancia.',
        },
        { kind: 'h3', text: 'El asistente' },
        {
          kind: 'steps',
          items: [
            `${ui('wiz.customerTitle')}: vincule la empresa cliente si quiere que sus personas vean el Reporte.`,
            `${ui('wiz.instanceTitle')}: informe la URL (https://…) y la credencial: una Scoped API Key, o usuario y token. Marque ${ui('wiz.remember')} para no escribirla de nuevo.`,
            `${ui('wiz.tenantTitle')}: la lista se carga sola. Use ${ui('wiz.searchTenant')} cuando haya muchos.`,
            `${ui('wiz.autoTriageTitle')}: marque solo si el Auto Triage se probó en la PoC. Debe escribir la frase de confirmación.`,
            `${ui('wiz.periodTitle')}: hasta 30 días, terminando como máximo ayer. Haga clic en ${ui('wiz.runSync')}.`,
            `${ui('wiz.detailsTitle')}: complete los detalles mientras corre la recopilación y haga clic en ${ui('common.save')}.`,
          ],
        },
        {
          kind: 'warn',
          text: `La credencial nunca se graba en la base de datos. Si pide recordarla, queda en una cookie sellada solo en este navegador, para su usuario, por 90 días. Use ${ui('wiz.forget')} para borrarla al instante.`,
        },
        { kind: 'h3', text: 'Fases de la recopilación' },
        { kind: 'list', items: [ui('sync.phase.connect'), ui('sync.phase.collect'), ui('sync.phase.alerts'), ui('sync.phase.process'), ui('sync.phase.save')] },
        {
          kind: 'p',
          text: `Puede salir de la pantalla: la recopilación sigue en el servidor. Para detenerla, use ${ui('sync.cancel')}. Lo recopilado se descarta y no se crea ningún Reporte.`,
        },
        { kind: 'h3', text: 'Nuevo Sync' },
        {
          kind: 'list',
          items: [
            `En la PoC, ${ui('sync.new')} recopila de nuevo y crea un Reporte con la siguiente versión principal (2.0, 3.0…). Los anteriores siguen disponibles.`,
            `Por defecto usa el período de la PoC. Cambie las fechas para generar el Reporte de un período específico: solo este Sync lo usa. ${ui('sync.periodReset')} deshace el cambio.`,
            'Los activos y el volumen de licenciamiento solo existen para los días más recientes de la Instancia. Si el período empieza antes, la herramienta avisa que el Reporte tendrá esas cifras incompletas.',
          ],
        },
      ],
    },
    {
      id: 'reports',
      title: 'Reportes: abrir, presentar y descargar',
      roles: 'all',
      summary: 'Elegir diseño e idioma, presentar en pantalla y exportar a PDF.',
      blocks: [
        {
          kind: 'p',
          text: `En la pestaña ${ui('tab.report')} hay una tarjeta por Reporte, del más nuevo al más antiguo. Cada tarjeta muestra la versión, la fecha, el período, hasta cuándo está disponible y cuatro cifras: activos (promedio diario y pico), ingesta total, Cases y alertas.`,
        },
        {
          kind: 'table',
          head: ['Diseño', 'Para quién'],
          rows: [
            [ui('template.technical'), 'Equipo técnico y SOC: arquitectura, fuentes de datos, sensores, cumplimiento de licencia, MITRE ATT&CK en detalle.'],
            [ui('template.executive'), 'Gerentes y decisores: la historia de la detección en cinco partes, esfuerzo evitado y veredicto.'],
            [ui('template.insight'), 'El nuevo diseño rediseñado, más visual, para una lectura rápida de los resultados.'],
          ],
        },
        { kind: 'h3', text: 'Presentar' },
        {
          kind: 'steps',
          items: [
            'Elija el diseño y el idioma en los selectores de la tarjeta.',
            `Haga clic en ${ui('report.open')}. El Reporte se abre en una nueva pestaña.`,
            'Pase el mouse sobre los gráficos para ver detalles y haga clic en las leyendas para activar o desactivar series.',
            'Use las flechas ← y → (o los botones ◀ ▶ en la esquina) para pasar de una sección a otra. Hay botones para pantalla completa e imprimir.',
          ],
        },
        { kind: 'h3', text: 'Descargar' },
        { kind: 'p', text: `${ui('report.pdf')} genera el mismo contenido de la página, en el diseño y el idioma elegidos.` },
        {
          kind: 'warn',
          text: 'Los datos de cada Reporte se guardan durante el Período de Retención (90 días por defecto) y luego se eliminan para siempre. Descargue el PDF de todo lo que necesite conservar.',
        },
        { kind: 'p', text: `El dueño de la PoC puede eliminar un Reporte con la papelera de la tarjeta (${ui('report.delete')}). Los datos, PDFs y comentarios de ese Reporte dejan de existir.` },
        { kind: 'tip', text: `Si aparece ${ui('report.outdated')}, los datos fueron recopilados por una versión antigua de la herramienta: ejecute un nuevo Sync.` },
      ],
    },
    {
      id: 'comments',
      title: 'Comentarios y versiones',
      roles: 'all',
      summary: 'Comentario interno, de Reporte y privado, y cómo cambia la versión.',
      blocks: [
        { kind: 'p', text: `Haga clic en ${ui('report.comments')} en la tarjeta del Reporte y elija el tipo.` },
        {
          kind: 'table',
          head: ['Tipo', 'Quién lo ve', '¿Va al Reporte?'],
          rows: [
            [ui('report.commentInternal'), 'Todos con acceso al Reporte, incluido el cliente', 'No'],
            [`${ui('report.commentInternal')} + ${ui('report.commentPrivateBadge')}`, 'Solo el equipo de Stellar Cyber y los revendedores', 'No'],
            [ui('report.commentReport'), 'Todos', 'Sí: crea una nueva versión y entra en el historial de versiones (Apéndice B)'],
          ],
        },
        { kind: 'h3', text: 'Cómo se cuenta la versión' },
        {
          kind: 'list',
          items: [
            'El número antes del punto cuenta los Reportes (recopilaciones) de la PoC: 1.0, 2.0, 3.0…',
            'El número después del punto cuenta los comentarios de Reporte de esa recopilación: 1.1, 1.2…',
            'Ejemplo: el segundo Sync, con un comentario de Reporte, es la versión 2.1.',
          ],
        },
      ],
    },
    {
      id: 'details',
      title: 'Detalles de la PoC: veredicto, comentarios y premisas',
      roles: STAFF,
      summary: 'Los campos que se imprimen en el Reporte y se pueden cambiar en cualquier momento.',
      blocks: [
        {
          kind: 'p',
          text: `Haga clic en ${ui('poc.editDetails')}. Los cambios valen para todos los Reportes de la PoC la próxima vez que se abran, sin nuevo Sync: las cifras quedan congeladas, los detalles no.`,
        },
        {
          kind: 'table',
          head: ['Bloque', 'Para qué sirve'],
          rows: [
            [ui('form.sectionCustomer'), 'Nombre de la empresa, departamento, correo, analistas y criterios de éxito (en una PoC con Notebook, los criterios están en el Notebook).'],
            [ui('form.sectionGeneral'), 'Versión de la plataforma, región de la Instancia y cliente vinculado.'],
            [`${ui('form.sectionSe')} / ${ui('form.sectionPartner')}`, 'Contactos que aparecen en la portada.'],
            [ui('form.verdict'), `${ui('form.verdict.approved')}, ${ui('form.verdict.conditional')}, ${ui('form.verdict.rejected')} o ${ui('form.verdictNone')}. El "?" al lado abre la guía de veredicto.`],
            [ui('form.comments'), 'Su evaluación: puntos fuertes, limitaciones, pendientes y próximos pasos. Se imprime en el Reporte tal como se escribió.'],
            [ui('form.sectionEffort'), 'Minutos de triaje e investigación usados para estimar el trabajo que la correlación evitó (Reporte Executive).'],
            [ui('form.sectionAutoTriage'), 'Si se probó el Auto Triage. El cambio vale a partir del próximo Sync.'],
            [ui('form.sectionArch'), 'Una imagen PNG o JPEG de la arquitectura de la PoC, para el Reporte Technical.'],
          ],
        },
        { kind: 'tip', text: 'Los campos con error quedan en rojo, y Guardar solo funciona después de corregirlos.' },
      ],
    },
    {
      id: 'customer',
      title: 'Guía del cliente',
      roles: ['customer'],
      summary: 'Lo que usted, cliente en evaluación, puede hacer en la herramienta.',
      blocks: [
        { kind: 'p', text: 'Su Sales Engineer le dio el nombre de su empresa y una clave de acceso. Cuando apruebe su registro, verá las PoCs de su empresa.' },
        {
          kind: 'list',
          items: [
            `En la pestaña ${ui('tab.notebook')}, siga y complete la PoC: criterios de éxito, estado de las fuentes de datos, actas de reunión y checklist. Todo se guarda automáticamente.`,
            `En la pestaña ${ui('tab.report')}, abra el Reporte (${ui('report.open')}) o descargue el PDF, en el idioma que prefiera.`,
            `Deje ${ui('report.comments')} con dudas o ajustes. El Sales Engineer responde en la propia herramienta.`,
          ],
        },
        { kind: 'p', text: 'Usted no crea PoCs, no ejecuta recopilaciones ni ve datos de otras empresas.' },
      ],
    },
    {
      id: 'admin',
      title: 'Administración',
      roles: ['admin'],
      summary: 'Aprobar registros, gestionar usuarios, configuraciones, el Catálogo de Fuentes de Datos y la Plantilla del Notebook.',
      blocks: [
        { kind: 'h3', text: ui('admin.pending') },
        { kind: 'p', text: `Las solicitudes sin clave de acceso llegan aquí. Elija el perfil en el selector y haga clic en ${ui('admin.approve')} o ${ui('admin.reject')}.` },
        { kind: 'h3', text: ui('admin.users') },
        {
          kind: 'list',
          items: [
            'Cambie el perfil en el selector de la fila. La columna PoCs abre la lista de PoCs de esa persona.',
            `${ui('admin.mfaExempt')} exime a la cuenta del 2FA. Úselo solo cuando esté justificado.`,
            `${ui('admin.resetMfa')} hace que la persona configure el 2FA de nuevo. ${ui('admin.passwordLink')} genera un enlace para crear una contraseña nueva: cópielo y envíelo a la persona.`,
            `${ui('del.userTitle')}: si la cuenta tiene PoCs o empresas, elija quién las recibe antes de eliminar.`,
            `La cuenta **Root** (administrator@stellarcyber.ai) viene con la instalación. No cambia de perfil, no se desactiva ni se elimina, y es la única que cambia su propia contraseña en pantalla, con ${ui('root.changePassword')} en el menú del usuario.`,
          ],
        },
        { kind: 'h3', text: ui('catalog.title') },
        {
          kind: 'p',
          text: `La lista de parsers y conectores que usan los Notebooks. Se lee cada lunes de las páginas oficiales de la documentación. ${ui('catalog.updateNow')} abre las dos URLs: ${ui('catalog.validate')} muestra qué cambia, y nada se guarda antes de ${ui('catalog.confirm')}.`,
        },
        { kind: 'h3', text: ui('tpl.title') },
        {
          kind: 'p',
          text: `Las fases, ítems e hitos que copia todo Notebook nuevo. En ${ui('tpl.open')}, oculte, elimine, agregue y reordene. Solo el texto en pt-BR es obligatorio. Los cambios valen para los Notebooks creados después.`,
        },
        { kind: 'h3', text: ui('admin.settings') },
        {
          kind: 'list',
          items: [
            `${ui('admin.retentionDays')}: cuánto tiempo se guardan los datos de los Reportes (90 por defecto).`,
            `${ui('admin.allowedDomains')}: restringe quién puede solicitar acceso, por ejemplo \`stellarcyber.ai, revendedor.com\`.`,
          ],
        },
      ],
    },
    {
      id: 'audit',
      title: 'Auditoría',
      roles: ['admin'],
      summary: 'Quién hizo qué, la comunicación con las Instancias, las recopilaciones y los logs de la aplicación.',
      blocks: [
        {
          kind: 'table',
          head: ['Pestaña', 'Qué muestra'],
          rows: [
            [ui('audit.tab.overview'), 'Indicadores de 24 horas y 7 días: ingresos, fallos, usuarios activos, Syncs, llamadas de API, latencia y errores.'],
            [ui('audit.tab.activity'), 'Cada acción relevante: ingresos, aprobaciones, PoCs creadas, Reportes generados, eliminaciones.'],
            [ui('audit.tab.api'), 'Cada llamada a la API de las Instancias, con resultado, latencia y volumen, por Instancia y endpoint.'],
            [ui('audit.tab.syncs'), 'Cada recopilación: duración, tiempo por fase, resultado y las llamadas que hizo.'],
            [ui('audit.tab.logs'), 'El log técnico de la aplicación, filtrable por nivel, origen y categoría.'],
          ],
        },
        { kind: 'p', text: `Todas las pestañas tienen filtro de período y búsqueda, y ${ui('audit.export')} descarga lo que está en pantalla.` },
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Problemas comunes',
      roles: 'all',
      summary: 'Los mensajes de error más frecuentes y qué hacer.',
      blocks: [
        {
          kind: 'table',
          head: ['Mensaje', 'Qué hacer'],
          rows: [
            [ui('auth.pending'), 'Espere la aprobación de quien registró su empresa, o de un Administrador.'],
            [ui('auth.customerKeyInvalid'), 'Confirme con su Sales Engineer el nombre exacto de la empresa y la clave. Puede generar una clave nueva.'],
            [ui('auth.locked'), 'Espere unos minutos e intente de nuevo.'],
            [ui('err.stellar_auth_failed'), 'La clave de API es incorrecta, expiró o no tiene el alcance necesario. Genere otra en la consola de Stellar Cyber.'],
            [ui('err.stellar_forbidden'), 'La clave no puede leer estos datos. Use una clave con acceso al Tenant.'],
            [ui('err.stellar_network'), 'Revise la URL de la Instancia (https://…) y que el servidor de la herramienta pueda alcanzarla.'],
            [ui('err.period'), 'Elija hasta 30 días, con inicio antes del fin, terminando como máximo ayer.'],
            [ui('err.sync_in_progress'), 'Espere a que termine la recopilación actual o cancélela.'],
            [ui('nb.saveError'), 'Revise su conexión. El próximo cambio intenta guardar de nuevo.'],
          ],
        },
        { kind: 'p', text: 'Si el problema continúa, hable con su Sales Engineer o con un Administrador de la herramienta.' },
      ],
    },
    {
      id: 'glossary',
      title: 'Glosario',
      roles: 'all',
      summary: 'Los términos usados en la herramienta y en los Reportes.',
      blocks: [
        {
          kind: 'table',
          head: ['Término', 'Significado'],
          rows: [
            ['PoC', 'La evaluación de Stellar Cyber por un cliente.'],
            ['PoC Notebook', 'El registro de trabajo de la PoC, de la planificación al cierre, compartido con el cliente.'],
            ['Instancia', 'Una instalación de Stellar Cyber, identificada por su URL.'],
            ['Tenant', 'Una partición de datos dentro de la Instancia. Cada recopilación lee un único Tenant.'],
            ['Sync', 'Una recopilación de los datos del período en la Instancia.'],
            ['Case', 'Un incidente correlacionado, formado por una o más alertas y clasificado por severidad.'],
            ['Alerta', 'Una detección dentro de un Case, marcada con tácticas y técnicas MITRE ATT&CK o de la XDR Kill Chain.'],
            ['Auto Triage', 'El veredicto de IA de Stellar Cyber sobre un Case. Requiere una licencia adicional.'],
            ['Volumen de licenciamiento', 'GB por día almacenados tras el enriquecimiento y la compresión. Es la cifra usada en el cumplimiento de licencia.'],
            ['Período de Retención', 'Cuánto tiempo se guardan los datos de los Reportes antes de eliminarse.'],
            ['Veredicto', 'El resultado de la PoC: aprobada, aprobada con condiciones o no aprobada.'],
          ],
        },
      ],
    },
  ],
})
