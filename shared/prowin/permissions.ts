/** Account capability, independent of instance administration and workspace membership. */
export interface AccountCapabilities {
  creator: boolean
  canCreateWorkspace: boolean
}

export interface PermissionIdentity {
  userId: string
  creator: boolean
  admin: boolean
}

export interface CanvasCapabilities {
  manageLocks: boolean
  publish: boolean
  localAgent: boolean
}
