import type { Briefings } from './types'

export const briefingsEs: Briefings = {
  data_sources: {
    how: [
      'Cada fuente ingresa por una de tres vías: logs enviados por syslog (RFC 3164/5424, CEF, LEEF, JSON), telemetría recolectada por un sensor (red y servidores) o una API consultada por un Connector (nube, SaaS, EDR, identidad).',
      'La plataforma reconoce la fuente por el parser asociado al puerto o al Connector configurado, y cada registro llega ya identificado con su origen, el tenant y la hora de recepción.',
      'Las fuentes que no están en el catálogo pueden ingerirse con un parser personalizado, sin descartar el dato en bruto.',
    ],
    value: [
      'El SOC deja de depender de una consola por herramienta: firewall, EDR, identidad y nube responden en la misma investigación.',
      'Las brechas de visibilidad quedan a la vista: se puede ver qué activos y qué etapas de un ataque no cubre ninguna fuente.',
    ],
    objectives: ['Cobertura de visibilidad', 'Inventario de fuentes de logs', 'Base para el cumplimiento de auditoría', 'Reducción de puntos ciegos'],
    techniquesLead: 'Sin la fuente adecuada, estas técnicas pasan sin dejar rastro en el SOC:',
  },
  collection: {
    how: [
      'Modular Sensor: appliance físico o virtual que recibe logs (log forwarder), recolecta flujos (NetFlow/IPFIX/sFlow) y realiza DPI en puertos SPAN/TAP.',
      'Server Sensor: agente liviano para Windows y Linux que recolecta eventos del sistema, procesos, conexiones y cambios en archivos.',
      'Cloud Connectors: integraciones por API con AWS, Azure, Google Cloud, Microsoft 365 y otros SaaS, incluidas fuentes de detección y respuesta en la nube (CDR) y EDRs.',
      'El sensor comprime lo que recolecta y lo envía al Data Processor de la plataforma por un canal cifrado.',
    ],
    value: [
      'Un único modelo de recolección para on-premises, nube y OT, sin un recolector distinto por fabricante.',
      'La recolección cerca de la fuente reduce el ancho de banda y la pérdida de eventos en enlaces de sucursales.',
    ],
    objectives: ['Centralización de logs', 'Visibilidad de nube y SaaS', 'Telemetría de red este-oeste', 'Escalar a nuevas sucursales sin rediseño'],
    techniquesLead: 'La recolección de nube e identidad es lo que expone técnicas como:',
  },
  normalization: {
    how: [
      'Cada registro en bruto pasa por el parser de su fuente y se convierte en Interflow: un registro único, con los mismos nombres de campo para dirección de origen y destino, puertos, protocolo, aplicación, usuario y host, sin importar su procedencia.',
      'El registro guarda una referencia al dato original, por lo que nada del log en bruto se pierde en la conversión.',
      'Como los campos son comunes, una regla o consulta escrita una vez sirve para todas las fuentes, sin una versión por fabricante.',
    ],
    value: [
      'La investigación deja de exigir que el analista conozca el formato de cada fabricante.',
      'La correlación entre fuentes pasa a ser una unión por campo, no un trabajo manual de traducción.',
    ],
    objectives: ['Reducir el tiempo de investigación', 'Consultas y reglas independientes del fabricante', 'Base única para la correlación'],
    techniquesLead: 'Normalizar es lo que permite sumar señales débiles de fuentes distintas, como en:',
  },
  threat_intel: {
    how: [
      'Los feeds de threat intelligence (comerciales, de código abierto, MISP y STIX/TAXII) aportan indicadores: IPs, dominios, URLs y hashes de archivos, con su tipo y reputación.',
      'Cada registro se compara con esos indicadores en el momento de la ingesta, y el resultado queda grabado en el propio Interflow, sin esperar una búsqueda manual.',
      'Los indicadores vinculados a una misma campaña acercan eventos que, aislados, parecerían ruido.',
    ],
    value: [
      'Ayuda a detectar campañas: el mismo dominio o infraestructura que aparece en fuentes distintas se convierte en una única señal.',
      'El analista ve la reputación y el contexto del indicador en la propia alerta, sin consultar otra herramienta.',
    ],
    objectives: ['Detección de campañas e infraestructura conocida', 'Priorización por reputación', 'Reducir la búsqueda manual de IoCs'],
    techniquesLead: 'Los indicadores de infraestructura maliciosa ayudan a detectar:',
  },
  enrichment: {
    how: [
      'Antes de almacenarse, el Interflow recibe contexto: geolocalización y ASN de las IPs, nombre y propietario del activo, sistema operativo y el usuario detrás de una IP (resuelto a partir de los logs de autenticación y del directorio).',
      'La criticidad que ustedes asignen a activos y usuarios entra en el cálculo de riesgo de cada alerta.',
    ],
    value: [
      'La alerta ya indica quién, dónde y qué activo: el analista no empieza la investigación armando el contexto.',
      'Un evento en un servidor crítico o en una cuenta de administrador sube de prioridad por sí solo.',
    ],
    objectives: ['Priorización por riesgo de negocio', 'Atribución a usuario y activo', 'Reducir el tiempo de triaje'],
    techniquesLead: 'El contexto de usuario, activo y geografía expone abusos como:',
  },
  ingestion_filters: {
    how: [
      'Los filtros aplicados en la recolección descartan o reducen registros antes de que lleguen al Data Lake, por fuente, tipo de evento, campo o expresión.',
      'Descartar elimina el registro; reducir conserva solo lo que interesa para la detección, por ejemplo agregando repeticiones.',
      'Los eventos de seguridad y de autenticación deben seguir ingresando: el filtro es para ruido operativo, como mensajes de depuración y de estado.',
    ],
    value: [
      'El volumen almacenado, y por lo tanto la licencia, se concentra en lo que genera detección.',
      'Menos ruido en el Data Lake hace más rápidas las búsquedas y las cacerías.',
    ],
    objectives: ['Control del volumen licenciado', 'Relación señal/ruido', 'Costo de almacenamiento predecible'],
    techniquesLead: 'Los filtros mal diseñados crean los puntos ciegos que estas técnicas aprovechan, por eso la regla es nunca filtrar eventos de seguridad:',
  },
  data_lake: {
    how: [
      'El Interflow normalizado y enriquecido se indexa en un único Data Lake, consultable en todas las fuentes a la vez.',
      'La retención se define por política, según la exigencia regulatoria de cada cliente.',
      'Las mismas consultas sirven para investigación, búsqueda de amenazas e informes de cumplimiento.',
    ],
    value: [
      'Investigaciones retroactivas: cuando surge un nuevo indicador, se puede buscar meses hacia atrás.',
      'Una única fuente de verdad para auditoría y respuesta a incidentes.',
    ],
    objectives: ['Retención para cumplimiento', 'Búsqueda de amenazas retroactiva', 'Investigación forense'],
    techniquesLead: 'Las amenazas con largo tiempo de permanencia solo aparecen con retención suficiente:',
  },
  ndr: {
    how: [
      'El Modular Sensor recibe una copia del tráfico (SPAN, TAP o vTAP) y realiza Deep Packet Inspection: identifica la aplicación independientemente del puerto y extrae metadatos de sesión, como volúmenes, duración, DNS, HTTP y TLS.',
      'Esos metadatos se convierten en Interflow y alimentan modelos que detectan escaneos, uso anómalo de protocolos administrativos, beaconing de C2, tunelización DNS y exfiltración.',
      'Los archivos que atraviesan la red pueden extraerse y enviarse al Sandbox.',
    ],
    value: [
      'Detecta movimiento lateral (MITRE TA0008), que no pasa por el perímetro y muchas veces no genera logs en el servidor.',
      'Cubre lo que no admite agente: OT, IoT, appliances y equipos no gestionados.',
    ],
    objectives: ['Visibilidad este-oeste', 'Detección de movimiento lateral y C2', 'Cobertura de activos sin agente'],
    techniquesLead: 'El tráfico de red es la mejor evidencia para:',
  },
  sandbox: {
    how: [
      'Los archivos sospechosos, provenientes del tráfico, del correo electrónico o enviados por el analista, se ejecutan en un entorno aislado.',
      'El análisis dinámico registra lo que hace el archivo: procesos creados, cambios en el registro y en el sistema de archivos, conexiones de red y archivos que descarga.',
      'El veredicto y los indicadores extraídos vuelven a la plataforma y pasan a buscarse en todas las fuentes.',
    ],
    value: [
      'Detecta malware nuevo u ofuscado por su comportamiento, no por firma.',
      'Convierte una detección en indicadores reutilizables para buscar el mismo artefacto en otros hosts.',
    ],
    objectives: ['Detección de malware desconocido', 'Generación de IoCs propios', 'Validación rápida de adjuntos y descargas'],
    techniquesLead: 'El análisis dinámico cubre la entrega y la ejecución de:',
  },
  fim: {
    how: [
      'El Server Sensor monitorea archivos, carpetas y claves de registro definidos como críticos y registra creación, modificación, eliminación y cambio de permisos, con hash, usuario y proceso responsable.',
      'Los cambios se convierten en Interflow y pueden generar una alerta cuando ocurren fuera del proceso esperado, por ejemplo un archivo nuevo en el directorio de una aplicación web.',
    ],
    value: [
      'Detecta la alteración de sistemas críticos y la persistencia que no aparece en los logs de aplicación.',
      'Cumple el requisito de monitoreo de integridad de PCI DSS sin una herramienta aparte.',
    ],
    objectives: ['Integridad de sistemas críticos', 'Cumplimiento de PCI DSS', 'Detección de persistencia y alteración'],
    techniquesLead: 'El cambio de archivos es el rastro de estas técnicas:',
  },
  itdr_ueba: {
    how: [
      'Modelos no supervisados aprenden la línea base de cada usuario, host y proceso: horarios, orígenes, volúmenes, aplicaciones y privilegios utilizados.',
      'Las desviaciones reciben una puntuación, comparada también con el grupo de pares, lo que separa lo inusual de lo simplemente poco frecuente.',
      'Las señales de identidad, como inicios de sesión, MFA, Kerberos y cambios en grupos privilegiados, provienen del directorio y del proveedor de identidad.',
    ],
    value: [
      'Detecta al atacante que ya tiene una credencial válida, cuando ninguna regla de firma se activa.',
      'Cubre la amenaza interna y la cuenta de servicio usada fuera de su patrón.',
    ],
    objectives: ['Detección de credenciales comprometidas', 'Amenaza interna', 'Abuso de privilegios'],
    techniquesLead: 'El comportamiento de identidad es lo que revela:',
  },
  detection: {
    how: [
      'Tres capas se ejecutan sobre el mismo Interflow: reglas, machine learning supervisado entrenado con patrones maliciosos conocidos y machine learning no supervisado que detecta anomalías.',
      'Cada alerta se mapea a tácticas y técnicas de MITRE ATT&CK y a la XDR Kill Chain, y recibe una puntuación de riesgo.',
      'La recolección, el triaje y la correlación, que hoy consumen tiempo del analista, pasan a ser realizados por la plataforma.',
    ],
    value: [
      'Reduce el MTTD: la detección ocurre en la ingesta, no cuando alguien busca.',
      'La cobertura se vuelve medible: se puede mostrar qué técnicas de ATT&CK están cubiertas y por qué fuentes.',
    ],
    objectives: ['Reducción del MTTD', 'Cobertura MITRE ATT&CK medible', 'Menos falsos positivos'],
    techniquesLead: 'Ejemplos de técnicas detectadas por las capas combinadas:',
  },
  correlation: {
    how: [
      'El Graph ML vincula alertas que comparten entidades, como usuario, host, IP, archivo o dominio, y cercanía en el tiempo, y arma el grafo del incidente.',
      'El grafo se convierte en un Case, puntuado según la gravedad de las alertas y el avance en la kill chain.',
      'Las nuevas alertas relacionadas se suman al mismo Case en lugar de abrir otro.',
    ],
    value: [
      'Decenas o cientos de alertas se convierten en pocos Cases: el analista trabaja incidentes, no una cola de eventos.',
      'El Case muestra la historia completa del ataque, desde el ingreso hasta la exfiltración.',
    ],
    objectives: ['Reducir la fatiga de alertas', 'Entender el alcance y el impacto', 'Priorizar según el riesgo real'],
    techniquesLead: 'Un ataque de varias etapas, como este, se convierte en un único Case:',
  },
  agentic_soc: {
    how: [
      'El AI Investigator responde en lenguaje natural sobre un Case: qué ocurrió, qué activos fueron afectados y qué evidencias sustentan la conclusión.',
      'El Auto Triage asigna un veredicto a cada Case (True Positive, False Positive, Benign o Inconclusive), con su justificación. Es un add-on con licencia aparte.',
      'El analista confirma o corrige: la decisión final sigue siendo humana.',
    ],
    value: [
      'El analista parte de una conclusión justificada, no de una cola.',
      'El mismo equipo atiende más Cases, con una calidad de triaje consistente entre turnos.',
    ],
    objectives: ['Reducir el tiempo de triaje', 'Escalar el SOC sin aumentar el equipo', 'Consistencia de análisis'],
    techniquesLead: 'Ejemplos de Cases que el triaje automático acelera:',
  },
  response: {
    how: [
      'Los playbooks disparan acciones en las herramientas que ustedes ya tienen, por medio de los Connectors: bloquear una IP en el firewall, aislar un host en el EDR, deshabilitar una cuenta en el directorio, poner un correo en cuarentena, abrir un ticket.',
      'Cada playbook tiene condiciones (tipo de alerta, gravedad, activo) y puede exigir aprobación humana antes de actuar.',
      'Las acciones y sus resultados quedan registrados en el Case, como pista de auditoría.',
    ],
    value: [
      'Contención en segundos para los escenarios definidos, incluso fuera del horario laboral.',
      'Reduce el MTTR y la exposición durante un ataque en curso.',
    ],
    objectives: ['Reducción del MTTR', 'Contención automática', 'Pista de auditoría de la respuesta'],
    techniquesLead: 'La respuesta automática limita el impacto de:',
  },
}
