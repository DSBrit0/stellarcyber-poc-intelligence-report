import { STAFF, type HelpGuide, type Ui } from './types'

export const guideEn = (ui: Ui): HelpGuide => ({
  sections: [
    {
      id: 'overview',
      title: 'Overview',
      roles: 'all',
      summary: 'What the tool does, who uses it and the path of a PoC from start to Report.',
      blocks: [
        {
          kind: 'p',
          text: 'PoC Intelligence Report follows a customer’s evaluation (PoC) of Stellar Cyber. It organises the work with the customer in the PoC Notebook, collects the evidence from the Stellar Cyber Instance through its API and produces the PoC Final Report: a responsive HTML page that is also available as a PDF, in pt-BR, en or es.',
        },
        { kind: 'h3', text: 'The path of a PoC' },
        {
          kind: 'steps',
          items: [
            'The Sales Engineer registers the customer’s **Company** and hands over the access key at the first meeting.',
            'They start a **PoC Notebook**: success criteria, data sources, meeting notes, process and schedule, filled in together with the customer.',
            'At the end of the period, they connect the Stellar Cyber Instance, pick the Tenant and the period and run a **Sync**, which collects the data.',
            'The Report is ready in three layouts (Technical, Executive and Insight). It can be presented on screen, downloaded as a PDF and commented on by the customer.',
          ],
        },
        { kind: 'h3', text: 'Roles' },
        {
          kind: 'table',
          head: ['Role', 'Who', 'What they do'],
          rows: [
            [ui('role.admin'), 'The tool’s administrator', 'Approves registrations, manages users and settings, sees every PoC and the Audit.'],
            [ui('role.sales_engineer'), 'A Stellar Cyber Sales Engineer', 'Registers Companies, runs PoCs and follows the PoCs of the resellers they registered.'],
            [ui('role.partner'), 'A reseller’s staff member', 'Runs their own PoCs and registers their own customers.'],
            [ui('role.customer'), 'Someone from the customer under evaluation', 'Views, downloads and comments on the Reports of their company’s PoCs and fills in the PoC Notebook.'],
          ],
        },
        { kind: 'tip', text: `This page shows the topics for your role first. Use ${ui('guide.allTopics')} at the top to see the whole guide.` },
      ],
    },
    {
      id: 'example',
      title: 'Complete example: from the first meeting to the Report',
      roles: STAFF,
      summary: 'A real walkthrough with the fictitious company Nébula Logística, from registration to a commented Report.',
      blocks: [
        { kind: 'p', text: 'Follow this script on your first PoC. The names are examples: use the real company and people.' },
        { kind: 'h3', text: '1. Before the first meeting' },
        {
          kind: 'steps',
          items: [
            `Open ${ui('nav.customers')} and click ${ui('customers.new')}.`,
            `Type the name \`Nébula Logística\`, choose the ${ui('customers.profile.customer')} profile and save.`,
            `Copy the key shown under ${ui('customers.keyOnce')}. It is not shown again. If you lose it, create another with ${ui('customers.rotate')}.`,
          ],
        },
        { kind: 'h3', text: '2. At the first meeting' },
        {
          kind: 'steps',
          items: [
            'Give the customer the tool’s address, the exact company name and the access key.',
            `Each person from the customer clicks ${ui('auth.register')}, checks ${ui('auth.iamCustomer')} and enters the company name and the key.`,
            `Go back to ${ui('nav.customers')}: the registrations show as ${ui('customers.pending')} inside the company. Click ${ui('admin.approve')}.`,
          ],
        },
        { kind: 'h3', text: '3. Plan the PoC in the Notebook' },
        {
          kind: 'steps',
          items: [
            `In the PoC list, click ${ui('poc.create')} and choose ${ui('newpoc.notebook')}.`,
            `Pick the company in ${ui('newpoc.chooseCustomer')}, enter the ${ui('newpoc.startDate')} and click ${ui('newpoc.start')}.`,
            `In ${ui('nb.overview')}, fill in the sizing (GB/day), the PoC URL and the business and technical contacts.`,
            `In ${ui('nb.criteria')}, write down what the customer must see to approve, for example \`Detect lateral movement\` and \`Reduce alert noise by 80%\`. Use ${ui('nb.suggestions')} to start faster.`,
            `In ${ui('nb.sources')}, search for the customer’s products (for example \`fortigate\`, \`office 365\`, \`crowdstrike\`) and add each one.`,
          ],
        },
        { kind: 'h3', text: '4. During the PoC' },
        {
          kind: 'list',
          items: [
            `After each meeting, click ${ui('nb.addMeeting')} and record the date, recording, notes and next steps.`,
            `Update the status of each data source (${ui('nb.ds.in_progress')}, ${ui('nb.ds.ingesting')}, ${ui('nb.ds.ticket_open')}) and of each item of ${ui('nb.process')}.`,
            `Check ${ui('nb.schedule')} for milestones marked ${ui('sch.late')}.`,
            `Give each success criterion a status: ${ui('nb.cs.completed_success')}, ${ui('nb.cs.completed_partial')} or ${ui('nb.cs.completed_failed')}.`,
          ],
        },
        { kind: 'h3', text: '5. Create the Final Report' },
        {
          kind: 'steps',
          items: [
            `In the PoC, click ${ui('nb.createReport')}.`,
            'Enter the Instance URL and the Scoped API Key, pick Nébula’s Tenant and the period (up to 30 days, ending yesterday at the latest).',
            `Click ${ui('wiz.runSync')} and follow the five collection phases. Meanwhile, fill in ${ui('wiz.detailsTitle')}: verdict, comments and effort premises.`,
            `When the collection ends, open the ${ui('tab.report')} tab, choose the **Executive** layout and click ${ui('report.open')} to present.`,
          ],
        },
        { kind: 'h3', text: '6. After the presentation' },
        {
          kind: 'list',
          items: [
            `The customer signs in with their own account, opens the Report and leaves ${ui('report.comments')}.`,
            `If the Report’s text must change, record a ${ui('report.commentReport')}: it creates the next version (1.1, 1.2…) and goes into the version history.`,
            `If the data changes, run a ${ui('sync.new')}: it creates a new Report (2.0) and keeps the previous one.`,
          ],
        },
      ],
    },
    {
      id: 'access',
      title: 'Access: registration, sign-in and two-factor authentication',
      roles: 'all',
      summary: 'Requesting access, signing in with 2FA, changing the language and recovering your password.',
      blocks: [
        { kind: 'h3', text: 'Request access' },
        {
          kind: 'steps',
          items: [
            `On the sign-in screen, click ${ui('auth.register')}.`,
            'Enter your full name, company, e-mail and a password of at least 12 characters.',
            `If a Sales Engineer gave you an access key, check ${ui('auth.iamCustomer')} and enter the company name exactly as registered, and the key. The person who registered the company approves you.`,
            'Without a key, the request goes to an Administrator, who chooses your role when approving it.',
          ],
        },
        { kind: 'p', text: 'You see a confirmation message, and you can sign in once the request is approved.' },
        { kind: 'h3', text: 'First sign-in and 2FA' },
        {
          kind: 'steps',
          items: [
            'Sign in with your e-mail and password.',
            'The first time, a QR code appears. Scan it with Google Authenticator, Microsoft Authenticator or another TOTP app.',
            'Type the 6-digit code. From then on, the tool asks only for the app’s current code.',
          ],
        },
        { kind: 'list', items: ['A session lasts up to 12 hours and ends after 30 minutes without use.', 'Too many failed attempts lock the account for a few minutes.'] },
        { kind: 'h3', text: 'Language and signing out' },
        {
          kind: 'p',
          text: `The language selector at the top (pt-BR, en, es) changes the tool and is remembered in this browser. A Report’s language is chosen separately, on each Report. To leave, open the menu with your name in the top-right corner and use ${ui('nav.signOut')}.`,
        },
        { kind: 'h3', text: 'Forgot your password or lost your phone' },
        {
          kind: 'p',
          text: `Ask an Administrator. They create a ${ui('admin.passwordLink')} for you to set a new password, or use ${ui('admin.resetMfa')} so you set up 2FA again on your next sign-in.`,
        },
      ],
    },
    {
      id: 'pocs',
      title: 'The PoC list',
      roles: 'all',
      summary: 'The home screen: one card per PoC, with badges that show where it stands.',
      blocks: [
        { kind: 'p', text: 'The home screen lists the PoCs you can see. Click a card to open the PoC.' },
        {
          kind: 'table',
          head: ['Badge', 'Meaning'],
          rows: [
            [ui('poc.phase.notebook'), 'The PoC is in the PoC Notebook and has no Report yet.'],
            [ui('poc.phase.report'), 'It started as a Notebook and already has at least one Report.'],
            [ui('poc.draft'), 'A Sync was started but the details were never saved. Open it to continue, or delete it.'],
            [ui('poc.syncing'), 'A collection is running. The PoC cannot be deleted until it ends or is cancelled.'],
          ],
        },
        {
          kind: 'list',
          items: [
            'A Sales Engineer sees their own PoCs and those of the resellers they registered. A Partner sees only their own. A Customer sees their company’s PoCs.',
            `Administrators see all of them and can filter by owner in the selector next to the heading (${ui('poc.mine')} or one person).`,
            'The trash icon in the card’s corner deletes the PoC for good, with its Reports, Notebook, Syncs and comments. Only the owner or an Administrator sees it.',
          ],
        },
      ],
    },
    {
      id: 'companies',
      title: 'Companies and customer access',
      roles: STAFF,
      summary: 'Registering the customer or reseller, handing over the access key and approving its people.',
      blocks: [
        { kind: 'p', text: `In ${ui('nav.customers')} you register the organisations you work with. The company’s profile sets the access of everyone who joins through it.` },
        {
          kind: 'table',
          head: ['Profile', 'The company’s people…'],
          rows: [
            [ui('customers.profile.customer'), 'follow the PoCs linked to the company: they view, download and comment on the Reports and fill in the Notebook.'],
            [ui('customers.profile.partner'), 'become Partners: they run their own PoCs. Whoever registered the reseller follows those PoCs.'],
          ],
        },
        { kind: 'h3', text: 'Register a company' },
        {
          kind: 'steps',
          items: [
            `Click ${ui('customers.new')}, type the name and choose the profile.`,
            'Copy the access key shown. It appears only once: the tool keeps only a fingerprint of it.',
            'Hand over the exact company name and the key at the first meeting.',
          ],
        },
        { kind: 'h3', text: 'Approve its people' },
        {
          kind: 'p',
          text: `People who register with the key show on the company’s row, under ${ui('customers.users')}, as ${ui('customers.pending')}. Use ${ui('admin.approve')} or ${ui('admin.reject')}. To remove someone’s access later, use ${ui('del.disable')}.`,
        },
        { kind: 'tip', text: 'A leaked key alone grants nothing: every registration still needs your approval.' },
        { kind: 'h3', text: 'Change the key or the profile, or delete' },
        {
          kind: 'list',
          items: [
            `${ui('customers.rotate')} voids the previous key. People who already joined keep their access.`,
            'Changing the profile changes the role of everyone in the company, and they must sign in again. A reseller whose people already own PoCs or companies cannot turn back into a Customer.',
            `${ui('del.companyTitle')} removes the company and everything that depends on it (people, PoCs, Reports). To confirm, type the company name. It cannot be undone.`,
          ],
        },
      ],
    },
    {
      id: 'new-poc',
      title: 'Create a PoC',
      roles: STAFF,
      summary: 'Three paths: start with the Notebook, start with a Stellar Experience, or go straight to the Final Report.',
      blocks: [
        { kind: 'p', text: `Click ${ui('poc.create')}. The tool asks ${ui('newpoc.choose')}` },
        {
          kind: 'table',
          head: ['Path', 'When to use it'],
          rows: [
            [ui('newpoc.experience'), 'You will present the platform to the customer live. Creates the Notebook together with its first Stellar Experience and opens the Experience tab. Sales Engineers and Admins only. It requires a company with the Customer profile.'],
            [ui('newpoc.notebook'), 'The PoC is starting. You want to plan and follow it with the customer. The Final Report is created later, from the Notebook. It requires a company with the Customer profile.'],
            [ui('newpoc.report'), 'The PoC already happened and you only need the Report. Linking a customer is optional.'],
          ],
        },
        { kind: 'h3', text: 'Start a PoC Notebook' },
        {
          kind: 'steps',
          items: [
            `Pick the company in ${ui('newpoc.chooseCustomer')}. If it does not exist yet, use ${ui('wiz.newCustomer')}.`,
            `Enter the ${ui('newpoc.startDate')}: the schedule is computed from it.`,
            `Click ${ui('newpoc.start')}.`,
          ],
        },
        { kind: 'h3', text: 'Start with a Stellar Experience' },
        {
          kind: 'steps',
          items: [
            `Pick the company and the ${ui('newpoc.startDate')}, as for a Notebook.`,
            `Give the Experience a ${ui('exp.name')} and choose the ${ui('exp.profile')}: ${ui('exp.profile.technical')} or ${ui('exp.profile.executive')}.`,
            `Click ${ui('newpoc.experienceStart')}. The PoC opens on the Experience tab, ready to start the session.`,
          ],
        },
        { kind: 'h3', text: 'Create the Final Report directly' },
        { kind: 'p', text: 'Follow steps 1 to 6 of the wizard, described in "Collecting the data: Sync".' },
      ],
    },
    {
      id: 'notebook',
      title: 'PoC Notebook',
      roles: 'all',
      summary: 'The PoC’s working record, shared with the customer and saved automatically.',
      blocks: [
        {
          kind: 'p',
          text: `The ${ui('tab.notebook')} tab gathers everything that happens in the PoC. Each field saves itself a few seconds after a change: the indicator at the top shows ${ui('nb.saving')} and then ${ui('nb.savedAt', { time: '2:32 PM' })}. Use ${ui('nb.expandAll')} and ${ui('nb.collapseAll')} to open or close the sections.`,
        },
        {
          kind: 'table',
          head: ['Section', 'What to record'],
          rows: [
            [ui('nb.overview'), 'Customer, department, analysts, business and technical contacts, Sales Engineer, reseller, sizing in GB/day, PoC URL and business requirements. It also links to the Stellar Cyber documentation (sensor requirements, firewall ports, connectors).'],
            [ui('nb.sources'), 'The PoC’s log sources (parsers, with their port) and connectors, picked from the Data Source Catalog. Each has a status and notes.'],
            [ui('nb.criteria'), 'What the customer must see to approve. Each criterion has a status, evaluation notes and a weight from 1 to 5 (the weight is not in the Report).'],
            [ui('nb.meetings'), 'One row per meeting: date, recording link and passcode, notes and next steps.'],
            [ui('nb.process'), 'The PoC checklist, by phase. Each item is in progress, completed or N/A, and the bar shows the progress.'],
            [ui('nb.schedule'), 'The PoC milestones on the calendar (see "PoC Schedule").'],
          ],
        },
        { kind: 'h3', text: 'Data sources' },
        {
          kind: 'list',
          items: [
            'Search by product, category or port, for example `fortigate`, `firewall` or `5143`.',
            `If the product is not in the catalog, use ${ui('nb.addOutside', { name: '…' })}. The row is marked ${ui('nb.outsideCatalog')}.`,
            `An entry that left the official documentation stays in the PoC, marked ${ui('nb.removedFromDocs')}.`,
          ],
        },
        { kind: 'h3', text: 'Who can do what' },
        {
          kind: 'list',
          items: [
            'The Sales Engineer, the PoC’s owner and the Administrators fill in everything and also shape the Notebook: they hide, delete and add process items and milestones.',
            'The Partner and the customer’s people fill in fields, statuses and notes.',
            `Hiding an item (${ui('nb.hide')}) affects only this Notebook. To change what every new Notebook starts from, an Administrator edits the ${ui('tpl.title')}.`,
          ],
        },
        {
          kind: 'tip',
          text: `The success criteria, with their statuses at that moment, are frozen at every Sync and printed in the Report. Update the statuses before running a ${ui('sync.new')}.`,
        },
      ],
    },
    {
      id: 'schedule',
      title: 'PoC Schedule',
      roles: 'all',
      summary: 'Milestones computed from the start date and tied to the process phases.',
      blocks: [
        {
          kind: 'p',
          text: 'The schedule runs from the start day to the PoC’s completion. Dates are suggested from the start date, always on a Monday, Wednesday or Friday. Every milestone after the start stands for one process phase and is done once every item of that phase is completed or N/A.',
        },
        {
          kind: 'table',
          head: ['Colour', 'Group'],
          rows: [
            [ui('sch.tone.start'), 'The start day'],
            [ui('sch.tone.pre'), 'Preparation: requirements, sensors, connectors'],
            [ui('sch.tone.poc'), 'Follow-up meetings'],
            [ui('sch.tone.close'), 'Closeout and Report presentation'],
          ],
        },
        { kind: 'h3', text: 'Adjust dates' },
        {
          kind: 'steps',
          items: [
            `Click ${ui('sch.edit')}.`,
            `Change a milestone’s date: only that one moves. To go back to the computed date, use ${ui('sch.auto')}.`,
            `To add a step, use ${ui('sch.addMilestone')}.`,
            `Click ${ui('sch.doneEditing')}.`,
          ],
        },
        { kind: 'tip', text: 'Below the schedule you see the suggested Final Report period, from the kickoff to the completion, up to 30 days.' },
      ],
    },
    {
      id: 'sync',
      title: 'Collecting the data: Sync',
      roles: STAFF,
      summary: 'Connecting the Instance, picking the Tenant and period, and following the collection.',
      blocks: [
        {
          kind: 'p',
          text: 'A Sync reads the period’s data from the Stellar Cyber Instance through its API and stores it as the Report’s data. From then on, the Report can be generated again, in any layout and language, without contacting the Instance.',
        },
        { kind: 'h3', text: 'The wizard' },
        {
          kind: 'steps',
          items: [
            `${ui('wiz.customerTitle')}: link the customer company if its people should see the Report.`,
            `${ui('wiz.instanceTitle')}: enter the URL (https://…) and the credential: a Scoped API Key, or a username and token. Check ${ui('wiz.remember')} to avoid typing it again.`,
            `${ui('wiz.tenantTitle')}: the list loads by itself. Use ${ui('wiz.searchTenant')} when there are many.`,
            `${ui('wiz.autoTriageTitle')}: check only if Auto Triage was tested in the PoC. You must type the confirmation phrase.`,
            `${ui('wiz.periodTitle')}: up to 30 days, ending yesterday at the latest. Click ${ui('wiz.runSync')}.`,
            `${ui('wiz.detailsTitle')}: fill in the details while the collection runs and click ${ui('common.save')}.`,
          ],
        },
        {
          kind: 'warn',
          text: `The credential is never written to the database. If you ask to remember it, it is kept in a sealed cookie in this browser only, for your account, for 90 days. Use ${ui('wiz.forget')} to clear it at once.`,
        },
        { kind: 'h3', text: 'Collection phases' },
        { kind: 'list', items: [ui('sync.phase.connect'), ui('sync.phase.collect'), ui('sync.phase.alerts'), ui('sync.phase.process'), ui('sync.phase.save')] },
        {
          kind: 'p',
          text: `You can leave the screen: the collection keeps running on the server. To stop it, use ${ui('sync.cancel')}. What was collected is discarded and no Report is created.`,
        },
        { kind: 'h3', text: 'New Sync' },
        {
          kind: 'list',
          items: [
            `In the PoC, ${ui('sync.new')} collects again and creates a Report with the next major version (2.0, 3.0…). The previous ones stay available.`,
            `By default it uses the PoC’s period. Change the dates to produce the Report for a specific period: only this Sync uses it. ${ui('sync.periodReset')} undoes the change.`,
            'Assets and licensing volume exist only for the Instance’s most recent days. If the period starts earlier, the tool warns that the Report will lack those figures.',
          ],
        },
      ],
    },
    {
      id: 'reports',
      title: 'Reports: open, present and download',
      roles: 'all',
      summary: 'Choosing layout and language, presenting on screen and exporting to PDF.',
      blocks: [
        {
          kind: 'p',
          text: `The ${ui('tab.report')} tab has one card per Report, newest first. Each card shows the version, date, period, how long the Report stays available and four figures: assets (daily average and peak), total ingestion, Cases and alerts.`,
        },
        {
          kind: 'table',
          head: ['Layout', 'For whom'],
          rows: [
            [ui('template.technical'), 'The technical team and SOC: architecture, data sources, sensors, license compliance, MITRE ATT&CK in detail.'],
            [ui('template.executive'), 'Managers and decision makers: the five-part detection story, effort avoided and verdict.'],
            [ui('template.insight'), 'The new redesigned layout, more visual, for a quick read of the results.'],
          ],
        },
        { kind: 'h3', text: 'Present' },
        {
          kind: 'steps',
          items: [
            'Choose the layout and language in the card’s selectors.',
            `Click ${ui('report.open')}. The Report opens in a new tab.`,
            'Hover over the charts for details and click the legends to switch series on and off.',
            'Use the ← and → keys (or the ◀ ▶ buttons in the corner) to move between sections. There are buttons for full screen and printing.',
          ],
        },
        { kind: 'h3', text: 'Download' },
        { kind: 'p', text: `${ui('report.pdf')} produces the same content as the page, in the chosen layout and language.` },
        {
          kind: 'warn',
          text: 'Each Report’s data is kept for the Retention Period (90 days by default) and then deleted for good. Download the PDF of anything you need to keep.',
        },
        { kind: 'p', text: `The PoC’s owner can delete a Report with the card’s trash icon (${ui('report.delete')}). That Report’s data, PDFs and comments cease to exist.` },
        { kind: 'tip', text: `If you see ${ui('report.outdated')}, the data was collected by an older version of the tool: run a new Sync.` },
      ],
    },
    {
      id: 'comments',
      title: 'Comments and versions',
      roles: 'all',
      summary: 'Internal, Report and private comments, and how the version changes.',
      blocks: [
        { kind: 'p', text: `Click ${ui('report.comments')} on the Report’s card and choose the type.` },
        {
          kind: 'table',
          head: ['Type', 'Who sees it', 'Printed in the Report?'],
          rows: [
            [ui('report.commentInternal'), 'Everyone with access to the Report, the customer included', 'No'],
            [`${ui('report.commentInternal')} + ${ui('report.commentPrivateBadge')}`, 'Only Stellar Cyber staff and resellers', 'No'],
            [ui('report.commentReport'), 'Everyone', 'Yes: it creates a new version and goes into the version history (Appendix B)'],
          ],
        },
        { kind: 'h3', text: 'How the version is counted' },
        {
          kind: 'list',
          items: [
            'The number before the dot counts the PoC’s Reports (collections): 1.0, 2.0, 3.0…',
            'The number after the dot counts that collection’s Report comments: 1.1, 1.2…',
            'Example: the second Sync, with one Report comment, is version 2.1.',
          ],
        },
      ],
    },
    {
      id: 'details',
      title: 'PoC details: verdict, comments and premises',
      roles: STAFF,
      summary: 'The fields printed in the Report, which can be changed at any time.',
      blocks: [
        {
          kind: 'p',
          text: `Click ${ui('poc.editDetails')}. Changes apply to every Report of the PoC the next time it is opened, with no new Sync: the figures are frozen, the details are not.`,
        },
        {
          kind: 'table',
          head: ['Block', 'What it is for'],
          rows: [
            [ui('form.sectionCustomer'), 'Company name, department, e-mail, analysts and success criteria (in a PoC with a Notebook, the criteria live in the Notebook).'],
            [ui('form.sectionGeneral'), 'Platform version, Instance region and linked customer.'],
            [`${ui('form.sectionSe')} / ${ui('form.sectionPartner')}`, 'Contacts printed on the cover.'],
            [ui('form.verdict'), `${ui('form.verdict.approved')}, ${ui('form.verdict.conditional')}, ${ui('form.verdict.rejected')} or ${ui('form.verdictNone')}. The "?" next to it opens the verdict guide.`],
            [ui('form.comments'), 'Your assessment: strengths, limitations, open items and next steps. Printed in the Report exactly as written.'],
            [ui('form.sectionEffort'), 'Triage and investigation minutes used to estimate the work correlation avoided (Executive Report).'],
            [ui('form.sectionAutoTriage'), 'Whether Auto Triage was tested. The change applies from the next Sync.'],
            [ui('form.sectionArch'), 'A PNG or JPEG of the PoC architecture, for the Technical Report.'],
          ],
        },
        { kind: 'tip', text: 'Fields with errors turn red, and Save works only once they are fixed.' },
      ],
    },
    {
      id: 'customer',
      title: 'Customer guide',
      roles: ['customer'],
      summary: 'What you, as the customer under evaluation, can do in the tool.',
      blocks: [
        { kind: 'p', text: 'Your Sales Engineer gave you your company’s name and an access key. Once they approve your registration, you see your company’s PoCs.' },
        {
          kind: 'list',
          items: [
            `In the ${ui('tab.notebook')} tab, follow and fill in the PoC: success criteria, data source statuses, meeting notes and checklist. Everything saves automatically.`,
            `In the ${ui('tab.report')} tab, open the Report (${ui('report.open')}) or download the PDF, in the language you prefer.`,
            `Leave ${ui('report.comments')} with questions or changes. The Sales Engineer answers in the tool.`,
          ],
        },
        { kind: 'p', text: 'You do not create PoCs, run collections or see other companies’ data.' },
      ],
    },
    {
      id: 'admin',
      title: 'Administration',
      roles: ['admin'],
      summary: 'Approving registrations, managing users, settings, the Data Source Catalog and the Notebook Template.',
      blocks: [
        { kind: 'h3', text: ui('admin.pending') },
        { kind: 'p', text: `Requests without an access key arrive here. Choose the role in the selector and click ${ui('admin.approve')} or ${ui('admin.reject')}.` },
        { kind: 'h3', text: ui('admin.users') },
        {
          kind: 'list',
          items: [
            'Change the role in the row’s selector. The PoCs column opens that person’s PoC list.',
            `${ui('admin.mfaExempt')} waives 2FA for the account. Use it only when justified.`,
            `${ui('admin.resetMfa')} makes the person set up 2FA again. ${ui('admin.passwordLink')} creates a link to set a new password: copy it and send it to the person.`,
            `${ui('del.userTitle')}: if the account owns PoCs or companies, choose who receives them before deleting.`,
            `The **Root** account (administrator@stellarcyber.ai) comes with the installation. Its role never changes, it cannot be disabled or deleted, and it is the only account that changes its own password on screen, with ${ui('root.changePassword')} in the user menu.`,
          ],
        },
        { kind: 'h3', text: ui('catalog.title') },
        {
          kind: 'p',
          text: `The list of parsers and connectors the Notebooks use. It is read every Monday from the official documentation pages. ${ui('catalog.updateNow')} opens the two URLs: ${ui('catalog.validate')} shows what changes, and nothing is saved before ${ui('catalog.confirm')}.`,
        },
        {
          kind: 'p',
          text: `The ${ui('catalog.historyButton')} button opens the ${ui('catalog.history')}: every update written, manual or weekly, naming each parser and connector that came in (+, green) or left (−, red). A large update shows its first names and opens the full list; the search finds the updates where an item came in or left.`,
        },
        { kind: 'h3', text: ui('tpl.title') },
        {
          kind: 'p',
          text: `The phases, items and milestones every new Notebook copies. In ${ui('tpl.open')}, hide, delete, add and reorder. Only the pt-BR text is required. Changes apply to Notebooks started afterwards.`,
        },
        { kind: 'h3', text: ui('admin.settings') },
        {
          kind: 'list',
          items: [
            `${ui('admin.retentionDays')}: how long Report data is kept (default 90).`,
            `${ui('admin.allowedDomains')}: restricts who can request access, for example \`stellarcyber.ai, reseller.com\`.`,
          ],
        },
      ],
    },
    {
      id: 'audit',
      title: 'Audit',
      roles: ['admin'],
      summary: 'Who did what, the communication with the Instances, the collections and the application logs.',
      blocks: [
        {
          kind: 'table',
          head: ['Tab', 'What it shows'],
          rows: [
            [ui('audit.tab.overview'), 'Indicators for 24 hours and 7 days: sign-ins, failures, active users, Syncs, API calls, latency and errors.'],
            [ui('audit.tab.activity'), 'Every relevant action: sign-ins, approvals, PoCs created, Reports generated, deletions.'],
            [ui('audit.tab.api'), 'Every call to the Instances’ API, with outcome, latency and volume, per Instance and endpoint.'],
            [ui('audit.tab.syncs'), 'Every collection: duration, time per phase, result and the calls it made.'],
            [ui('audit.tab.logs'), 'The application’s technical log, filtered by level, source and category.'],
          ],
        },
        { kind: 'p', text: `Every tab has a period filter and search, and ${ui('audit.export')} downloads what is on screen.` },
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Common problems',
      roles: 'all',
      summary: 'The most frequent error messages and what to do.',
      blocks: [
        {
          kind: 'table',
          head: ['Message', 'What to do'],
          rows: [
            [ui('auth.pending'), 'Wait for the person who registered your company, or an Administrator, to approve you.'],
            [ui('auth.customerKeyInvalid'), 'Check the exact company name and key with your Sales Engineer. They can create a new key.'],
            [ui('auth.locked'), 'Wait a few minutes and try again.'],
            [ui('err.stellar_auth_failed'), 'The API key is wrong, expired or lacks the required scope. Create another in the Stellar Cyber console.'],
            [ui('err.stellar_forbidden'), 'The key cannot read this data. Use a key with access to the Tenant.'],
            [ui('err.stellar_network'), 'Check the Instance URL (https://…) and that the tool’s server can reach it.'],
            [ui('err.period'), 'Choose up to 30 days, start before end, ending yesterday at the latest.'],
            [ui('err.sync_in_progress'), 'Wait for the current collection to end, or cancel it.'],
            [ui('nb.saveError'), 'Check your connection. The next change tries to save again.'],
          ],
        },
        { kind: 'p', text: 'If the problem persists, contact your Sales Engineer or a tool Administrator.' },
      ],
    },
    {
      id: 'glossary',
      title: 'Glossary',
      roles: 'all',
      summary: 'The terms used in the tool and in the Reports.',
      blocks: [
        {
          kind: 'table',
          head: ['Term', 'Meaning'],
          rows: [
            ['PoC', 'A customer’s evaluation of Stellar Cyber.'],
            ['PoC Notebook', 'The PoC’s working record, from planning to closeout, shared with the customer.'],
            ['Instance', 'One Stellar Cyber deployment, identified by its URL.'],
            ['Tenant', 'A data partition inside the Instance. Each collection reads exactly one Tenant.'],
            ['Sync', 'One collection of the period’s data from the Instance.'],
            ['Case', 'A correlated incident, made of one or more alerts and rated by severity.'],
            ['Alert', 'A single detection inside a Case, tagged with MITRE ATT&CK or XDR Kill Chain tactics and techniques.'],
            ['Auto Triage', 'Stellar Cyber’s AI verdict on a Case. It requires an add-on license.'],
            ['Licensing Volume', 'GB per day stored after enrichment and compression. It is the figure used for license compliance.'],
            ['Retention Period', 'How long Report data is kept before it is deleted.'],
            ['Verdict', 'The PoC outcome: approved, approved with conditions or not approved.'],
          ],
        },
      ],
    },
  ],
})
