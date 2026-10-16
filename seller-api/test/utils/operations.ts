/** The GraphQL operations the tests use, in one place (the PWA has its own, typed, in src/graphql) */

export const COMPANIES = `query { companies { source items { id name subdomain createdAt robotCount openDefects } } }`

export const COMPANY = `query ($id: ID!) { company(id: $id) { id name subdomain robotCount openDefects } }`

export const CREATE_COMPANY = `mutation ($input: CreateCompanyInput!) {
  createCompany(input: $input) { id name subdomain robotCount openDefects }
}`

export const ROBOT_MODELS = `query { robotModels { id name kind description } }`

export const ROBOTS = `query ($companyId: ID!) {
  robots(companyId: $companyId) {
    source
    items { id companyId name apiKeyPrefix online battery status openDefectId lastSeenAt model { id name kind } }
  }
}`

export const CREATE_ROBOT = `mutation ($companyId: ID!, $input: CreateRobotInput!) {
  createRobot(companyId: $companyId, input: $input) {
    apiKey
    robot { id name apiKeyPrefix status model { name } }
  }
}`

export const DEFECTS = `query ($onlyOpen: Boolean) {
  defects(onlyOpen: $onlyOpen) {
    id summary severity status reportedBy replacementRobotId
    robot { id name } company { id name }
  }
}`

export const REPORT_DEFECT = `mutation ($robotId: ID!, $input: ReportDefectInput!) {
  reportDefect(robotId: $robotId, input: $input) {
    id status severity summary robot { id name } company { id name }
  }
}`

export const CLOSE_DEFECT = `mutation ($id: ID!) { closeDefect(id: $id) { id status } }`

export const REPLACE_ROBOT = `mutation ($defectId: ID!, $input: ReplaceRobotInput) {
  replaceRobot(defectId: $defectId, input: $input) {
    apiKey
    defect { id status replacementRobotId }
    robot { id name model { kind } }
  }
}`

export const COMPANY_ROLES = `query ($companyId: ID!) { companyRoles(companyId: $companyId) { id name permissions locked } }`
export const COMPANY_PERMISSIONS = `query { companyPermissions }`
export const CREATE_COMPANY_ROLE = `mutation ($companyId: ID!, $input: CreateCompanyRoleInput!) {
  createCompanyRole(companyId: $companyId, input: $input) { id name permissions locked }
}`
export const DELETE_COMPANY_ROLE = `mutation ($companyId: ID!, $roleId: ID!) { deleteCompanyRole(companyId: $companyId, roleId: $roleId) }`

export const ME = `query { me { email role permissions } }`
export const ACCOUNTS = `query { accounts { email role createdBy } }`
export const ADD_ACCOUNT = `mutation ($input: AddAccountInput!) { addAccount(input: $input) { email role createdBy } }`
export const REMOVE_ACCOUNT = `mutation ($email: String!) { removeAccount(email: $email) }`
export const AUDIT = `query { auditLog { action actor target detail } }`

export const CREATE_PAIRING = `mutation ($input: CreatePairingInput) { createPairing(input: $input) { id secret code } }`
export const COLLECT_PAIRING = `mutation ($id: ID!, $secret: String!) {
  collectPairing(id: $id, secret: $secret) { status apiKey robotName platformUrl }
}`
export const CANCEL_PAIRING = `mutation ($id: ID!, $secret: String!) { cancelPairing(id: $id, secret: $secret) }`
export const WAITING_PAIRINGS = `query { waitingPairings { id device code loopback } }`
export const DELIVER = `mutation ($pairingId: ID!, $input: DeliverKeyInput!) {
  deliverToSimulator(pairingId: $pairingId, input: $input)
}`
