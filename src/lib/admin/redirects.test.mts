import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ADMIN_HOME_PATH,
  getSafeAdminNextPath,
  isAdminLoginPath,
} from "./redirects.ts"

describe("getSafeAdminNextPath", () => {
  it("keeps valid admin destinations", () => {
    assert.equal(getSafeAdminNextPath("/admin"), "/admin")
    assert.equal(
      getSafeAdminNextPath("/admin/syncs?status=failed"),
      "/admin/syncs?status=failed"
    )
  })

  it("rejects external and protocol-relative destinations", () => {
    assert.equal(getSafeAdminNextPath("https://example.com/admin"), ADMIN_HOME_PATH)
    assert.equal(getSafeAdminNextPath("//example.com/admin"), ADMIN_HOME_PATH)
    assert.equal(getSafeAdminNextPath("/\\example.com/admin"), ADMIN_HOME_PATH)
  })

  it("rejects non-admin paths and prefix lookalikes", () => {
    assert.equal(getSafeAdminNextPath("/"), ADMIN_HOME_PATH)
    assert.equal(getSafeAdminNextPath("/administrator"), ADMIN_HOME_PATH)
    assert.equal(getSafeAdminNextPath("/administer"), ADMIN_HOME_PATH)
  })

  it("rejects login loops, fragments, and normalized traversal", () => {
    assert.equal(getSafeAdminNextPath("/admin/login"), ADMIN_HOME_PATH)
    assert.equal(getSafeAdminNextPath("/admin/login/reset"), ADMIN_HOME_PATH)
    assert.equal(getSafeAdminNextPath("/admin#login"), ADMIN_HOME_PATH)
    assert.equal(getSafeAdminNextPath("/admin/%2e%2e/public"), ADMIN_HOME_PATH)
  })

  it("falls back for missing or malformed values", () => {
    assert.equal(getSafeAdminNextPath(), ADMIN_HOME_PATH)
    assert.equal(getSafeAdminNextPath("http://["), ADMIN_HOME_PATH)
  })
})

describe("isAdminLoginPath", () => {
  it("matches the login route and its descendants only", () => {
    assert.equal(isAdminLoginPath("/admin/login"), true)
    assert.equal(isAdminLoginPath("/admin/login/reset"), true)
    assert.equal(isAdminLoginPath("/admin/login-help"), false)
    assert.equal(isAdminLoginPath("/admin"), false)
  })
})
