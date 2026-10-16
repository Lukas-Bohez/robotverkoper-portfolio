/** The GraphQL operations the tests use, in one place (the PWA has its own, typed, in src/graphql) */

// ---- who am I, and our own staff ----
export const ME = `query { me { email role { key name(language: "nl") } permissions } }`
export const ACCOUNTS = `query ($withDeleted: Boolean) {
  accounts(withDeleted: $withDeleted) { id email createdBy deletedAt role { key name(language: "nl") } }
}`
export const ADD_ACCOUNT = `mutation ($input: AddAccountInput!) {
  addAccount(input: $input) { email createdBy deletedAt role { key } }
}`
export const REMOVE_ACCOUNT = `mutation ($email: String!) { removeAccount(email: $email) { email deletedAt } }`
export const RESTORE_ACCOUNT = `mutation ($email: String!) { restoreAccount(email: $email) { email deletedAt } }`

export const SELLER_ROLES = `query ($withDeleted: Boolean) {
  sellerRoles(withDeleted: $withDeleted) {
    id key locked permissions deletedAt names { nl en fr de }
    nl: name(language: "nl") fr: name(language: "fr") de: name(language: "de")
  }
}`
export const SELLER_PERMISSIONS = `query { sellerPermissions { key group } }`
export const CREATE_SELLER_ROLE = `mutation ($input: CreateSellerRoleInput!) {
  createSellerRole(input: $input) { id key permissions names { nl en fr de } }
}`
export const UPDATE_SELLER_ROLE = `mutation ($id: ID!, $input: UpdateSellerRoleInput!) {
  updateSellerRole(id: $id, input: $input) { id key permissions names { nl en fr de } }
}`
export const REMOVE_SELLER_ROLE = `mutation ($id: ID!) { removeSellerRole(id: $id) { id key deletedAt } }`
export const RESTORE_SELLER_ROLE = `mutation ($id: ID!) { restoreSellerRole(id: $id) { id key deletedAt } }`

// ---- companies ----
export const COMPANIES = `query ($withDeleted: Boolean) {
  companies(withDeleted: $withDeleted) { source items { id name subdomain createdAt robotCount openDefects deletedAt } }
}`
export const COMPANY = `query ($id: ID!) { company(id: $id) { id name subdomain robotCount openDefects } }`
export const CREATE_COMPANY = `mutation ($input: CreateCompanyInput!) {
  createCompany(input: $input) { id name subdomain robotCount openDefects }
}`
export const REMOVE_COMPANY = `mutation ($id: ID!) { removeCompany(id: $id) { id deletedAt } }`
export const RESTORE_COMPANY = `mutation ($id: ID!) { restoreCompany(id: $id) { id deletedAt } }`

// ---- robots ----
export const ROBOT_MODELS = `query { robotModels { id name kind description } }`

export const ROBOTS = `query ($companyId: ID!, $withDeleted: Boolean) {
  robots(companyId: $companyId, withDeleted: $withDeleted) {
    source
    items { id companyId name serial qrCode apiKeyPrefix online battery status openDefectId lastSeenAt deletedAt model { id name kind } }
  }
}`
export const ROBOT = `query ($id: ID!, $withDeleted: Boolean) {
  robot(id: $id, withDeleted: $withDeleted) {
    id name serial qrCode status inStock battery deletedAt
    condition {
      tilted tiltDegrees hasCargo cargoSummary compartmentTemp lid battery errorCode errorText
      location { address geometry { type coordinates } }
    }
  }
}`
export const ROBOT_BY_CODE = `query ($code: String!) { robotByCode(code: $code) { id name serial status inStock model { kind } } }`
export const STOCK_ROBOTS = `query { stockRobots { id name serial status inStock model { id kind } } }`

export const CREATE_ROBOT = `mutation ($companyId: ID!, $input: CreateRobotInput!) {
  createRobot(companyId: $companyId, input: $input) {
    apiKey
    robot { id name serial apiKeyPrefix status model { name } }
  }
}`
export const REMOVE_ROBOT = `mutation ($id: ID!) { removeRobot(id: $id) { id status deletedAt } }`
export const RESTORE_ROBOT = `mutation ($id: ID!) { restoreRobot(id: $id) { id status deletedAt } }`

// ---- defects ----
const DEFECT_FIELDS = `
  id summary severity status reportedBy assignedTo claimedAt onSiteAt checklistDone
  resolution resolvedAt resolutionNote replacementRobotId callRequestedAt calledBy helpRequestedAt deletedAt coldAt
  condition { tilted tiltDegrees hasCargo cargoSummary compartmentTemp lid errorCode errorText }
  location { address geometry { type coordinates } }
  robot { id name serial } company { id name }`

export const DEFECTS = `query ($onlyOpen: Boolean, $withDeleted: Boolean, $includeCold: Boolean, $mine: Boolean, $year: Int) {
  defects(onlyOpen: $onlyOpen, withDeleted: $withDeleted, includeCold: $includeCold, mine: $mine, year: $year) { ${DEFECT_FIELDS} }
}`
export const DEFECTS_BY_STATUS = `query ($statuses: [DefectStatusType!]!, $withDeleted: Boolean, $includeCold: Boolean, $year: Int) {
  defectsByStatus(statuses: $statuses, withDeleted: $withDeleted, includeCold: $includeCold, year: $year) { id status }
}`
export const DEFECT = `query ($id: ID!) { defect(id: $id) { ${DEFECT_FIELDS} } }`
export const NEARBY_DEFECTS = `query ($defectId: ID!, $radiusMeters: Int) {
  nearbyDefects(defectId: $defectId, radiusMeters: $radiusMeters) { distanceMeters defect { id robot { name } } }
}`
export const DEFECT_DISTANCE = `query ($id: ID!, $from: GeoPointInput!) { defect(id: $id) { distanceMeters(from: $from) } }`

export const REPORT_DEFECT = `mutation ($robotId: ID!, $input: ReportDefectInput!) {
  reportDefect(robotId: $robotId, input: $input) { ${DEFECT_FIELDS} }
}`
export const CLAIM_DEFECT = `mutation ($id: ID!) { claimDefect(id: $id) { id status assignedTo claimedAt } }`
export const RELEASE_DEFECT = `mutation ($id: ID!) { releaseDefect(id: $id) { id status assignedTo } }`
export const ARRIVE_AT_DEFECT = `mutation ($id: ID!) { arriveAtDefect(id: $id) { id status onSiteAt } }`
export const UPDATE_CHECKLIST = `mutation ($id: ID!, $done: [String!]!) { updateDefectChecklist(id: $id, done: $done) { id checklistDone } }`
export const CLOSE_DEFECT = `mutation ($id: ID!, $input: CloseDefectInput!) { closeDefect(id: $id, input: $input) { id status resolution resolutionNote } }`
export const REPLACE_ROBOT = `mutation ($defectId: ID!, $input: ReplaceRobotInput) {
  replaceRobot(defectId: $defectId, input: $input) {
    apiKey
    defect { id status resolution replacementRobotId }
    robot { id name serial status model { kind } }
  }
}`
export const CALL_TECHNICIAN = `mutation ($id: ID!) { callTechnician(id: $id) { id callRequestedAt calledBy } }`
export const REQUEST_HELP = `mutation ($id: ID!) { requestHelp(id: $id) { id helpRequestedAt } }`
export const REMOVE_DEFECT = `mutation ($id: ID!) { removeDefect(id: $id) { id status deletedAt } }`
export const RESTORE_DEFECT = `mutation ($id: ID!) { restoreDefect(id: $id) { id status deletedAt } }`

// ---- roles of a company and presets ----
export const COMPANY_ROLES = `query ($companyId: ID!, $withDeleted: Boolean) {
  companyRoles(companyId: $companyId, withDeleted: $withDeleted) { id name permissions locked archivedAt names { nl en fr de } }
}`
export const COMPANY_PERMISSIONS = `query { companyPermissions }`
export const CREATE_COMPANY_ROLE = `mutation ($companyId: ID!, $input: CreateCompanyRoleInput!) {
  createCompanyRole(companyId: $companyId, input: $input) { id name permissions locked names { nl en fr de } }
}`
export const UPDATE_COMPANY_ROLE = `mutation ($companyId: ID!, $roleId: ID!, $input: UpdateCompanyRoleInput!) {
  updateCompanyRole(companyId: $companyId, roleId: $roleId, input: $input) { id name permissions names { nl en fr de } }
}`
export const REMOVE_COMPANY_ROLE = `mutation ($companyId: ID!, $roleId: ID!) {
  removeCompanyRole(companyId: $companyId, roleId: $roleId) { id archivedAt }
}`
export const RESTORE_COMPANY_ROLE = `mutation ($companyId: ID!, $roleId: ID!) {
  restoreCompanyRole(companyId: $companyId, roleId: $roleId) { id archivedAt }
}`
export const COPY_COMPANY_ROLE = `mutation ($companyId: ID!, $roleId: ID!, $input: CopyCompanyRoleInput!) {
  copyCompanyRole(companyId: $companyId, roleId: $roleId, input: $input) { copied skipped }
}`

export const ROLE_PRESETS = `query ($withDeleted: Boolean) {
  rolePresets(withDeleted: $withDeleted) {
    id permissions deletedAt names { nl en fr de } nl: name(language: "nl") fr: name(language: "fr") missingLanguages
  }
}`
export const CREATE_ROLE_PRESET = `mutation ($input: CreateRolePresetInput!) { createRolePreset(input: $input) { id permissions names { nl en fr de } } }`
export const SAVE_ROLE_AS_PRESET = `mutation ($companyId: ID!, $roleId: ID!) { saveRoleAsPreset(companyId: $companyId, roleId: $roleId) { id permissions names { nl en } } }`
export const APPLY_ROLE_PRESET = `mutation ($id: ID!, $input: ApplyRolePresetInput!) { applyRolePreset(id: $id, input: $input) { copied skipped } }`
export const REMOVE_ROLE_PRESET = `mutation ($id: ID!) { removeRolePreset(id: $id) { id deletedAt } }`
export const RESTORE_ROLE_PRESET = `mutation ($id: ID!) { restoreRolePreset(id: $id) { id deletedAt } }`

// ---- archive, cold storage, log ----
export const ARCHIVE = `query ($kind: ArchiveKind, $year: Int) { archive(kind: $kind, year: $year) { id kind label detail archivedAt archivedBy } }`
export const RESTORE_ARCHIVED = `mutation ($kind: ArchiveKind!, $id: ID!) { restoreArchived(kind: $kind, id: $id) { id kind label } }`
export const COLD_STORAGE_YEARS = `query { coldStorageYears }`
export const MOVE_TO_COLD_STORAGE = `mutation ($months: Int) { moveToColdStorage(months: $months) { defects auditEntries } }`
export const AUDIT = `query ($year: Int, $includeCold: Boolean, $limit: Int) {
  auditLog(year: $year, includeCold: $includeCold, limit: $limit) { createdAt action actor target detail coldAt }
}`

// ---- the key goes to the simulator ----
export const CREATE_PAIRING = `mutation ($input: CreatePairingInput) { createPairing(input: $input) { id secret code } }`
export const COLLECT_PAIRING = `mutation ($id: ID!, $secret: String!) {
  collectPairing(id: $id, secret: $secret) { status apiKey robotName platformUrl }
}`
export const CANCEL_PAIRING = `mutation ($id: ID!, $secret: String!) { cancelPairing(id: $id, secret: $secret) }`
export const WAITING_PAIRINGS = `query { waitingPairings { id device code loopback } }`
export const DELIVER = `mutation ($pairingId: ID!, $input: DeliverKeyInput!) {
  deliverToSimulator(pairingId: $pairingId, input: $input)
}`
