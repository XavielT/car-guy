import type { Dict } from '../dict';

export const enPart3: Pick<
  Dict,
  | 'placeholder'
  | 'guide'
  | 'boot'
  | 'more'
  | 'backup'
  | 'onboarding'
  | 'notFound'
  | 'stats'
  | 'costs'
  | 'sync'
  | 'account'
  | 'report'
  | 'export'
  | 'fuel'
  | 'fuelReview'
  | 'prices'
  | 'common'
  | 'identity'
> = {
  placeholder: {
    comingSoonTitle: 'Next phase',
    service: 'Logging services, repairs and upgrades comes in the next phase.',
    expense: 'Expense logging comes in the next phase.',
    back: 'Back',
  },

  guide: {
    title: 'What to check and how',

    overheating: {
      title: 'Overheating',
      body: [
        {
          text:
            'Check the coolant once a week, engine cold, before the first start of the day. ' +
            'Look at the translucent plastic tank: the level sits between Min and Max.\n\n',
        },
        { text: 'Never open the radiator cap or the tank cap with the engine hot.', strong: true },
        { text: ' The system is pressurized and it comes out boiling.' },
      ],
    },

    signs: {
      title: 'Signs something is wrong',
      bullets: [
        'The temperature warning light or coolant gauge light is on.',
        'The temperature needle climbing past halfway.',
        'A sweet smell, or steam coming from under the hood.',
        'A puddle under the car where it sat overnight.',
        'The heater blows cold with the engine hot.',
        'Having to top up coolant more than once a month.',
      ],
    },

    ifItOverheats: {
      title: 'If it overheats',
      bullets: [
        'Turn off the A/C and put the heater on full: it pulls heat away from the engine.',
        'Pull over as soon as it is safe and shut the engine off.',
        'Wait for it to cool down completely before opening anything.',
        'Never pour cold water on a hot engine or a hot radiator.',
      ],
    },

    whyCoolant: {
      title: 'Why coolant and not water',
      body: [
        { text: 'It never freezes here, so water seems like enough. It is not, for three reasons:\n\n· 50/50 coolant ' },
        { text: 'boils later', strong: true },
        { text: ' (about 106–108 °C against 100 °C for water, and higher still under pressure).\n· It carries ' },
        { text: 'corrosion inhibitors', strong: true },
        {
          text:
            ' that protect the aluminum head, the radiator and the water pump. Tap water ' +
            'corrodes and leaves scale.\n· ',
        },
        { text: 'It lubricates the water pump seal.', strong: true },
        {
          text:
            '\n\nIf it is concentrate, mix it with distilled water, never tap water. Adding water ' +
            'to get home is fine; fix it back to 50/50 afterwards.',
        },
      ],
    },

    whyHere: {
      title: 'Why they run hotter here',
      body: [
        {
          text:
            '30–35 °C outside, traffic jams, the A/C on all the time and the climbs on the ' +
            'Duarte. A weak fan, a stuck thermostat or a low level forgive a lot less here ' +
            'than in a cold country.',
        },
      ],
    },

    fluids: {
      title: 'Fluids, every week',
      bullets: [
        'Engine oil: engine cold, level ground, dipstick between Min and Max. Milky = coolant in the oil.',
        'Coolant: engine cold, between Min and Max.',
        'Washer fluid: top it up. No antifreeze needed here.',
        'Brake fluid (monthly): clear or amber. Dark brown or dropping = worn pads or a leak.',
      ],
    },

    tyres: {
      title: 'Tires',
      bullets: [
        'Pressure cold, all 4 plus the spare, per the sticker on the door jamb.',
        'You lose ~1 psi a month. A tire 2–3 psi under the rest is a slow leak.',
        'Tread: coin test or the wear bars. Minimum is 1.6 mm.',
        'Wear on the edges = alignment. In the middle = too much air.',
      ],
    },

    lightsBrakes: {
      title: 'Lights and brakes',
      bullets: [
        'Lights: test headlights, brake, reverse and turn signals against a wall.',
        'Brakes: on the first stop of the day, firm pedal, no pulling, no noise.',
        'Spongy pedal, squeal or vibration: to the shop, not next week.',
      ],
    },

    diesel: {
      title: 'If it is a diesel',
      bullets: [
        'Drain the water separator when the light comes on and at every oil change.',
        'Air filter: check it more often if you drive in dust. The turbo is sensitive.',
        'Intercooler and radiator faces free of mud and leaves.',
        'The glow plug light should go out before you crank it.',
      ],
    },

    motorcycle: {
      title: 'If it is a motorcycle',
      bullets: [
        'T-CLOCS before you ride: tires, controls, lights, oil and fluids, chassis, stands.',
        'The throttle should move freely and snap shut on its own, with the bars in any position.',
        'Lube the chain every ~500 km or after rain.',
      ],
    },

    source:
      "Source: your vehicle's owner's manual, RAC, NHTSA, Michelin and the MSF (T-CLOCS). " +
      'When the manual says otherwise, the manual wins.',
  },

  boot: {
    brand: 'CAR GUY',
    lockedTitle: 'Your data is busy',
    lockedBody:
      'Another tab or the previous app still has the database open. Close the other Car Guy tabs and try again. Nothing was lost.',
    crashTitle: 'Something broke on startup',
    crashBody:
      'Your data is still saved on this device. Try again; if it keeps happening, close the app and open it again.',
    retry: 'Try again',
  },

  more: {
    garageOpen: 'Open the garage',
    garageOpenCaption: (active: number, archived: number) =>
      `${active} ${active === 1 ? 'vehicle' : 'vehicles'}${archived ? ` · ${archived} stored or sold` : ''}`,
    activeVehicle: (name: string) => `${name}'s profile`,
    activeVehicleCaption: 'Summary, history, documents and status.',
    checksSection: 'Checks',
    checks: 'Checks and templates',
    checksCaption: 'Daily, weekly and monthly. Edit what you check.',
    checkGuide: 'Check guide',
    checkGuideCaption: 'How to check each thing, step by step.',
    title: 'More',
    subtitle: 'Your garage, your papers and the data that lives on this phone.',

    garage: 'Garage',
    garageCaption: 'Tap a vehicle to see its full profile.',
    archivedGroup: 'Archived',
    active: 'active',
    activate: 'Activate',
    addVehicle: 'Add vehicle',

    maintenance: 'Maintenance',
    service: 'Log a service',
    serviceCaption: 'An oil change, a repair or an upgrade.',
    history: 'See the history',
    historyCaption: "Everything you've done to the car, in order.",
    reminders: 'Reminders',
    remindersCaption: "What's due and when, by your kilometers.",
    tasks: 'Pending tasks',
    tasksCaption: "What the car needs and you haven't done yet.",

    fuelSection: 'Fuel',
    newFillUp: 'Log a fill-up',
    newFillUpCaption: 'Gallons, price and odometer at the gas station.',
    prices: 'MICM reference prices',
    pricesCaption: (week: string) => `${week}. Good for comparing; each fill-up keeps what you paid.`,

    expense: 'Log an expense',
    expenseCaption: 'Insurance, marbete, tolls, car wash and the rest.',

    documents: 'Documents',
    documentsCaption: 'Insurance, marbete, registration and invoices.',

    account: 'Account',
    accountSoon: 'Coming soon',
    accountBody:
      'Without an account the app works the same. With one, if you switch phones, your data follows you.',

    data: 'Data',
    dataCaption: 'Everything lives on this device. No account, no cloud.',
    dataCaptionSynced: 'Everything lives on this device and is backed up to your account.',
    backup: 'Create JSON backup',
    restore: 'Restore or import backup',
    restoreCaption:
      'Takes backups from Car Guy and from Tu Combustible RD. Save the file to Drive, email or your computer before uninstalling the app.',
    wipe: 'Delete all data',
    wipeTitle: 'Delete everything',
    wipeBody: 'Vehicles, fill-ups, services and checks all go. There is no undo.',
    backupTitle: 'Backup',
    backupUnsupported: "This device can't share files.",
    backupFailed: "Couldn't create the backup file. Try again.",
    restoreFailed: "Couldn't read that backup. Try again.",
    restoredTitle: 'Data restored',
    restoredLegacy: (counts: string) => `We imported your data from Tu Combustible RD: ${counts}.`,
    restoredMerge: (merged: number, tables: number) =>
      `We merged the backup: ${merged} ${merged === 1 ? 'record' : 'records'} across ${tables} ${tables === 1 ? 'table' : 'tables'}.`,
    restoreTitle: 'Restore data',

    appearance: 'Appearance',
    appearanceCaption: "Dark is Car Guy's identity; light is there for the midday sun.",
    themes: { system: 'System', dark: 'Dark', light: 'Light' },

    notifications: 'Notifications',
    notificationsCaption: 'When and at what time the car gives you a heads-up.',

    about: 'About',
    version: (version: string) => `Version ${version}`,
    build: (sha: string) => `Build ${sha}`,
    aboutBody: 'Car Guy · Your car, up to date. Made in the Dominican Republic.',
    aboutCredits: 'Partial make and model data: us-car-models-data (Abhilash Reddy), CC BY 4.0.',
  },

  backup: {
    notJson: "That file isn't a valid backup: it's empty, damaged or not a .json file.",
    notBackup: "The file doesn't look like a Car Guy or Tu Combustible RD backup.",
    unknownVersion: (version: string) =>
      `This backup is from another version of Car Guy (format ${version}). Update the app and try again.`,
    legacyEmpty: "The file is empty or isn't valid JSON.",
    legacyNotBackup: "The file doesn't look like a Tu Combustible RD backup: it has no vehicles or fill-ups.",
    legacyCounts: {
      vehicles: (n: number) => (n === 1 ? '1 vehicle' : `${n} vehicles`),
      fuelLogs: (n: number) => (n === 1 ? '1 fill-up' : `${n} fill-ups`),
      serviceRecords: (n: number) => (n === 1 ? '1 service' : `${n} services`),
      expenses: (n: number) => (n === 1 ? '1 expense' : `${n} expenses`),
      reminders: (n: number) => (n === 1 ? '1 reminder' : `${n} reminders`),
    },
  },

  onboarding: {
    welcome: 'Checks, services and fuel in one place, so nothing slips past you.',
    markLabel: 'Car Guy',
    createFirst: 'Create my first vehicle',
    formTitle: 'Your first vehicle',
    backToWelcome: 'Back',
    accountTitle: 'Already have an account?',
    accountBody: 'Sign in and your garage comes back with its whole history.',
    accountAction: 'Sign in',
    legacyPrompt: 'Coming from Tu Combustible RD? Bring your full history over from the JSON backup.',
    legacyAction: 'Import Tu Combustible RD backup',
    importedTitle: 'Data imported',
    importedLegacy: (counts: string) => `Done: ${counts}.`,
    importedMerge: (merged: number) => `Done: ${merged} ${merged === 1 ? 'record' : 'records'} restored.`,
    importFailedTitle: 'Import',
  },

  notFound: {
    title: "That screen doesn't exist.",
    body: 'The link is broken or the screen moved.',
    back: 'Back to the dashboard',
  },

  stats: {
    modsInvested: 'Invested in mods',
    modsInvestedHint: 'The whole build, not just the period.',
    trackDays: 'Track days',
    trackDaysHint: (spend: string) => `${spend} in the period`,
    title: 'Numbers',
    subtitle: (vehicle: string) => `${vehicle} · real spend and economy, not the car's computer.`,

    periods: { mes: 'Month', trimestre: '3 months', ano: 'Year', todo: 'All' },
    periodHint: {
      mes: 'Last 30 days',
      trimestre: 'Last 90 days',
      ano: 'Last 365 days',
      todo: 'Since the first fill-up',
    },

    categories: {
      combustible: 'Fuel',
      mantenimiento: 'Maintenance',
      reparacion: 'Repairs',
      mejora: 'Upgrades',
      pista: 'Track',
      legal: 'Insurance and marbete',
      otros: 'Other',
    },

    total: 'Total',
    spend: 'Spend',
    costPerKm: 'RD$ / km',
    distance: 'Km driven',
    economy: 'Economy',
    average: 'Average',

    vsPrevious: 'vs. previous period',
    deltaUp: (percent: number) => `↑ ${percent} %`,
    deltaDown: (percent: number) => `↓ ${Math.abs(percent)} %`,
    deltaFlat: 'same',
    deltaNew: 'nothing to compare',
    noDistance: 'Log the odometer to know',

    byMonth: 'Spend month by month',
    byMonthCaption: 'Stacked by category.',
    byMonthEmpty: 'Once you log expenses, this shows where the money goes month by month.',

    byCategory: 'Spend by category',
    byCategoryCaption: 'Within the chosen period.',
    byCategoryEmpty: 'Nothing spent in this period.',

    economyTitle: 'Economy per tank',
    economyCaption: (unit: string) => `${unit} per tank, and per partial fill with the gauge. The dotted line is your average.`,
    economyEmpty: 'You need two full tanks, or fill-ups with the gauge level, to see the line.',

    kmPerMonth: 'Kilometers per month',
    kmPerMonthCaption: 'From your odometer readings.',
    kmPerMonthEmpty: "Log the odometer at every fill-up and you'll see how much you drive.",

    ownership: 'Cost of owning the car',
    ownershipCaption: "Purchase minus sale, plus everything you've put into it.",
    ownershipPurchase: 'Purchase',
    ownershipSold: 'Sale',
    ownershipSpend: 'Expenses',
    ownershipTotal: 'Total',
    ownershipPerMonth: 'Per month owned',
    ownershipMonths: (n: number) => (n === 1 ? '1 month' : `${n} months`),
    ownershipHint: "Add the purchase price in the vehicle's profile to see it.",

    upcoming: 'Upcoming estimated costs',
    upcomingCaption: 'With your own prices, not averages.',
    upcomingEmpty: 'Nothing planned. Once a task has an estimated cost, it shows up here.',
    upcomingBasis: { estimado: 'estimated', ultimo_costo: 'what it cost last time' },

    lastTank: 'Last tank reading',
    lastTankValues: { low: 'Low', great: 'Excellent', normal: 'Steady' },
    lastTankHint: (average: string) =>
      `Compared with the average of your previous tanks (${average}).`,

    report: 'PDF report',
    csv: 'Export CSV',
    empty: 'Log a fill-up or an expense and your numbers show up here.',
  },

  costs: {
    title: "What it's cost me",
    caption: "Since you've had it: purchase, mods, maintenance, fuel, track and the rest.",
    purchase: 'Purchase',
    sold: 'Sale of the car',
    categories: {
      mods: 'Mods',
      mantenimiento: 'Maintenance',
      combustible: 'Fuel',
      pista: 'Track',
      otros: 'Other',
    },
    modsSold: (amount: string) => `Already taken off: ${amount} in mods sold`,
    total: 'Total',
    perKm: 'Per km',
    perKmHint: (running: string) => `${running}/km not counting the purchase`,
    noDistance: 'Log the odometer to see the cost per km.',
    since: (date: string) => `Since ${date}`,
    sinceFirst: (date: string) => `Since the first record, ${date}`,
    perMonth: (amount: string, months: string) => `${amount} per month · ${months}`,
    noPurchase: "No purchase price: add it in the vehicle's profile so it counts.",
    garage: 'The whole garage',
    garageCaption: (n: number) => (n === 1 ? '1 vehicle with expenses.' : `${n} vehicles, added up.`),
    garageTotal: 'Garage total',
    csv: "What it's cost me",
    csvCaption: 'One row per category and per vehicle, with the garage total.',
    dossierTitle: "What it's cost",
  },

  sync: {
    signedOut: 'Sign in to sync.',
    never: 'Never',
    syncing: 'Syncing…',
    syncNow: 'Sync now',
    pendingLabel: 'Not uploaded',
    pending: (n: number) => (n === 1 ? '1 change not uploaded' : `${n} changes not uploaded`),
    upToDate: 'All uploaded',
    lastSync: (when: string) => `Last sync: ${when}`,
    wipeCloud: 'Delete cloud data',
    wipeCloudCaption:
      "Deletes your data from the server and signs you out. This phone isn't touched — what's here stays here.",
    wipeCloudTitle: 'Delete cloud data',
    wipeCloudBody:
      "Your vehicles, fill-ups, services, checks and photos leave the server, and this phone gets signed out so they don't upload again. What's saved here isn't touched.",
    wipeCloudConfirm: "This can't be undone. Sure?",
    wipeCloudDone: (n: number) =>
      `Done. We deleted ${n} ${n === 1 ? 'record' : 'records'} from the server and signed you out.`,
    wipeCloudFailed: "Couldn't delete on the server. Try again.",
    doneTitle: 'Done',
    doneBody: (pushed: number, pulled: number) =>
      `We uploaded ${pushed} and downloaded ${pulled}.`,
    firstLoginTitle: 'Syncing your garage…',
    firstLoginBody: 'This only happens once. You can keep using the app.',
    firstLoginDoneTitle: 'Your garage is in the cloud',
    vehiclesAdded: (n: number) =>
      n === 1 ? 'Added 1 vehicle from the cloud.' : `Added ${n} vehicles from the cloud.`,
    uploaded: (n: number) =>
      n === 0 ? 'Everything was already up to date.' : n === 1 ? 'We uploaded 1 change to your account.' : `We uploaded ${n} changes to your account.`,

    errors: {
      network: "No connection. We'll try again on our own.",
      expired: 'Your session expired. Sign in again — your data is still here.',
      forbidden: 'The server rejected the change. Your data is still saved on the phone.',
      generic: "Couldn't sync. We'll try again on our own.",
    },
  },

  account: {
    title: 'Account',
    subtitle: 'Optional. The app works the same without it.',

    pitch: 'Without an account the app works the same. With one, if you switch phones, your data follows you.',
    pitchMore:
      "Nothing gets uploaded until you sign in, and signing out doesn't delete anything from this phone.",

    signIn: 'Sign in',
    signUp: 'Create account',
    signOut: 'Sign out',
    haveAccount: 'Already have an account? Sign in',
    needAccount: "Don't have an account? Create one",

    email: 'Email',
    emailPlaceholder: 'you@example.com',
    password: 'Password',
    passwordHint: 'At least 8 characters.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    displayName: 'Your name (optional)',

    forgot: 'Forgot your password?',
    resetSentTitle: 'Check your email',
    resetSentBody: (email: string) => `We sent a link to ${email} to change your password.`,
    resetNeedsEmail: 'Type your email first.',

    reset: {
      title: 'New password',
      reading: 'Checking the link…',
      body: 'Type the new password for your Car Guy account.',
      newPassword: 'New password',
      confirm: 'Repeat the password',
      mismatch: "The two passwords don't match.",
      save: 'Save password',
      doneTitle: 'Password changed',
      doneBody: "You're signed in with the new password.",
      invalid: "This link doesn't work anymore: it expired or was already used. Ask for another from Account → Forgot your password?",
      toAccount: 'Go to Account',
    },

    working: 'One moment…',
    signedInAs: 'Signed in',
    lastSync: 'Last sync',
    lastSyncNever: '—',

    createdTitle: 'Account created',
    createdBody: 'You can now sign in on another phone with this email.',

    dangerZone: 'Danger zone',
    wipeLocal: 'Delete local data',
    wipeLocalCaption: "Deletes vehicles, fill-ups and photos from this phone. The account isn't touched.",
    wipeLocalTitle: 'Delete local data',
    wipeLocalBody: 'Vehicles, fill-ups, services and checks leave this phone. There is no undo.',

    notConfigured: "Accounts aren't available in this version. Update the app.",
    notConfiguredPill: 'Not available in this version',
    notConfiguredCaption: 'Update Car Guy to the latest version to create your account.',
    versionLine: (version: string, build: string | null) => `Car Guy ${version}${build ? ` · build ${build}` : ''}`,
    newerChanges: (n: number) =>
      `There ${n === 1 ? 'is' : 'are'} ${n} ${n === 1 ? 'change' : 'changes'} from a newer version of Car Guy. Update the app to see ${n === 1 ? 'it' : 'them'}.`,

    onboardingTitle: 'With an account your data follows you',
    onboardingBody: 'If you switch phones, your history comes with you. You can create one later.',
    onboardingAction: 'Create account',
    onboardingDismiss: 'Not now',

    errors: {
      invalidCredentials: 'Wrong email or password.',
      userExists:
        'There is already an account with that email. If you created it in Car Guy, sign in; if it belongs to another app, use a different email.',
      otherApp: "That account belongs to another app and doesn't work in Car Guy. Create your Car Guy account with a different email.",
      weakPassword: 'The password needs at least 8 characters.',
      invalidEmail: "That email doesn't look valid.",
      rateLimited: 'Too many attempts. Wait a moment.',
      network: 'No connection. Your data is still saved on the phone.',
      inviteOnly: "Car Guy accounts aren't open right now. Try again later.",
      generic: "Couldn't finish. Try again.",
      emailRequired: 'Type your email.',
      passwordRequired: 'Type your password.',
      emailNotConfirmed: "Your email isn't confirmed yet. Look for the link in your inbox.",
      schemaNotExposed: "Accounts aren't available right now. Try again later.",
    },
  },

  report: {
    title: 'Vehicle report',
    subtitle: 'A summary you can save, print or send to the shop.',
    documentTitle: (vehicle: string) => `Car Guy · ${vehicle}`,
    period: 'Period',
    historyTitle: 'History for the period',
    historyEmpty: 'No records in this period.',
    columns: {
      date: 'Date',
      kind: 'Type',
      title: 'Detail',
      odometer: 'Odometer',
      amount: 'Amount',
    },
    economySummary: (tanks: number, average: string, min: string, max: string, unit = 'km/gal') =>
      `${tanks} ${tanks === 1 ? 'tank' : 'tanks'} measured · average ${average} ${unit} · between ${min} and ${max}.`,
    footer: 'Made with Car Guy',

    generate: 'Generate report',
    generating: 'Preparing the report…',
    rows: (n: number) => (n === 1 ? '1 record in the period' : `${n} records in the period`),
    webHint: 'Save as PDF from the print dialog.',
    sharedTitle: 'Report ready',
    sharedBody: 'We shared it as a PDF.',
    unavailableTitle: 'Report',
    unavailableBody: "This device can't share files.",
    failed: "Couldn't generate the report. Try again.",
  },

  export: {
    title: 'Export data',
    subtitle: 'Your records as CSV, to open in Excel or LibreOffice.',
    history: 'Full history',
    historyCaption: 'One row per record: fill-ups, services, expenses and checks.',
    fuel: 'Fuel',
    fuelCaption: 'Every column of each fill-up, with km driven and km/gal.',
    period: 'Period',
    download: 'Download CSV',
    share: 'Share CSV',
    rows: (n: number) => (n === 1 ? '1 row' : `${n} rows`),
    wipeCloud: 'Delete cloud data',
    wipeCloudCaption:
      "Deletes your data from the server and signs you out. This phone isn't touched — what's here stays here.",
    wipeCloudTitle: 'Delete cloud data',
    wipeCloudBody:
      "Your vehicles, fill-ups, services, checks and photos leave the server, and this phone gets signed out so they don't upload again. What's saved here isn't touched.",
    wipeCloudConfirm: "This can't be undone. Sure?",
    wipeCloudDone: (n: number) =>
      `Done. We deleted ${n} ${n === 1 ? 'record' : 'records'} from the server and signed you out.`,
    wipeCloudFailed: "Couldn't delete on the server. Try again.",
    doneTitle: 'Done',
    sharedBody: (file: string) => `We shared ${file}.`,
    downloadedBody: (file: string) => `We downloaded ${file}.`,
    unavailableBody: "This device can't share files.",
    failed: "Couldn't export. Try again.",
    encodingHint:
      'UTF-8 with BOM and comma separator. Excel opens it with the accents intact.',
  },

  fuel: {
    duplicateTitle: 'This fill-up is already saved',
    duplicateBody: "A moment ago you saved an identical one (same odometer, volume and total). It wasn't saved again.",
    duplicateOpen: 'View',
    savedNotice: 'Fill-up saved',
    stationPick: 'Pick station',
    stationRecent: 'Your stations',
    stationBrands: 'Brands',
    detailTitle: 'Fill-up',
    edit: 'Edit',
    fullTankShort: 'Full tank',
    partialShort: 'Partial',
    newTitle: 'At the gas station',
    editTitle: 'Edit fill-up',
    unitWord: (unit: 'gal' | 'l' | 'm3') => (unit === 'm3' ? 'cubic meters' : unit === 'l' ? 'liters' : 'gallons'),
    intro: (units: string) =>
      `Enter two of three (${units}, price, total) and the third one works itself out. Economy shows up when you mark full tank.`,
    date: 'Date',
    odometer: 'Odometer (km)',
    odometerHint: (last: string) => `Last fill-up: ${last}`,
    type: 'Fuel',
    volume: (unit: string) => `Volume (${unit})`,
    total: 'Total paid (RD$)',
    calcPending: 'One more number to close the math.',
    loadKind: 'Fill-up type',
    fullTank: 'Full tank',
    partial: 'Partial fill',
    partialHint: (unit: string) =>
      `Between two full tanks the km/${unit} is measured. A partial adds to the next full one; with the gauge level before and after, it also gives an estimate.`,
    missedPrevious: 'I forgot to log an earlier fill-up',
    missedPreviousHint: (units: string) =>
      `If a fill-up is missing in between, the kilometers won't line up with the ${units}. Checking this restarts the count from here, like with the first full tank.`,
    station: 'Station',
    stationOther: 'Station name',
    notes: 'Note (optional)',
    notesPlaceholder: 'Trip to Santiago, traffic…',
    save: 'Save fill-up',
    saveChanges: 'Save changes',
    delete: 'Delete this fill-up',
    deleteTitle: 'Delete fill-up',
    deleteBody: 'It comes off the history and economy gets recalculated.',
    odometerRequired: 'Enter the mileage on the dash.',
    odometerTooLow: (last: number) =>
      `The last fill-up was at ${last.toLocaleString('en-US')} km. The new value can't be lower.`,
    odometerTooHigh: (next: number) =>
      `The next fill-up reads ${next.toLocaleString('en-US')} km. This one can't be higher.`,
    amountsRequired: 'Fill in two of these three: volume, price per unit, or total.',
  },

  fuelReview: {
    titles: {
      low: 'Low economy',
      great: 'Good economy',
      normal: 'Steady economy',
      first: 'First reading',
      partial: 'Partial fill',
    },
    chainBrokenTitle: 'The count starts over',
    statusLabels: {
      low: 'Below your average',
      great: 'Above your average',
      normal: 'On your average',
      first: 'Nothing to compare yet',
      partial: 'Measured with the next full tank',
    },
    price: (unit: string) => `Price per ${unit}`,
    distance: 'Km driven',
    economy: 'Economy',
    costPerKm: 'Cost per km',
    noPrevious: 'an earlier fill-up is missing',
    pending: 'worked out with more data',
    lowBody: (average: string) =>
      `It's below your average of ${average}. Check traffic, tire pressure or possible leaks.`,
    greatBody: (average: string) => `It's above your average of ${average}.`,
    firstBody: 'Save another fill-up to start comparing your real economy.',
    partialBody:
      "A partial fill isn't measured on its own: its fuel goes into the count for the next full tank.",
    chainBroken:
      'You marked that an earlier fill-up was missing, so the economy count starts over from this one.',
    seeHistory: 'See history',
    close: 'Done',
  },

  prices: {
    title: 'MICM prices',
    intro:
      "Seed: week of Aug 15–21, 2026. Update them when the new notice comes out. They don't download on their own.",
    boardEyebrow: 'Reference prices',
    boardCaption: 'What you paid on each fill-up wins over this table.',
    week: 'Week / source',
    save: 'Save reference',
    reset: 'Back to seed prices',
  },

  common: {
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    ok: 'Got it',
    optional: '(optional)',
    today: 'Today',
    pickDate: 'Pick date',
    takePhoto: 'Take photo',
    choosePhoto: 'Choose from gallery',
    close: 'Close',
    removeItem: (what: string) => `Remove ${what}`,
    removePhoto: 'Remove photo',
    edit: 'Edit',
    photoError: "Couldn't use that photo.",
    photoErrorTitle: 'Photo',
    photoErrorRetry: "Couldn't save the photo. Try again.",
    photoPickError: "Couldn't open the camera or the gallery. Try again.",
    photoSaving: 'Saving the photo…',
    retry: 'Retry',
    back: 'Back',
    missingTitle: "That record doesn't exist anymore",
    missingBody: "It was deleted here or on another device, or the link points to something that's gone.",
    missingAction: 'Go home',
    invalidNumber: (field: string) => `Check “${field}”: it has to be a number zero or greater.`,
    minutes: (n: number) => `${n} min`,
    loading: 'Loading…',
  },

  identity: {
    stamped: 'Logged',
  },
};
