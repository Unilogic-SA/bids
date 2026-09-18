import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  ADMIN_HOME_PATH,
  getSafeAdminNextPath,
} from "./admin/redirects"

describe("getSafeAdminNextPath", () => {
  it("keeps admin destinations", () => {
    assert.equal(getSafeAdminNextPath("/admin"), "/admin")
    assert.equal(getSafeAdminNextPath("/admin/tenders/123?tab=files"), "/admin/tenders/123?tab=files")
    assert.equal(getSafeAdminNextPath("/admin?tab=activity"), "/admin?tab=activity")
  })

  it("rejects external and protocol-relative destinations", () => {
    for (const value of [
      "https://example.com/admin",
      "//example.com/admin",
      "/\\example.com/admin",
      "javascript:alert(1)",
    ]) {
      assert.equal(getSafeAdminNextPath(value), ADMIN_HOME_PATH)
    }
  })

  it("rejects non-admin destinations and lookalike prefixes", () => {
    for (const value of [
      "/",
      "/tenders",
      "/administrator",
      "/administer",
      "/admin%2Fsettings",
    ]) {
      assert.equal(getSafeAdminNextPath(value), ADMIN_HOME_PATH)
    }
  })

  it("rejects login loops", () => {
    for (const value of [
      "/admin/login",
      "/admin/login?next=/admin",
      "/admin/login/help",
      "/admin/login#form",
    ]) {
      assert.equal(getSafeAdminNextPath(value), ADMIN_HOME_PATH)
    }
  })

  it("uses the admin home for missing values", () => {
    assert.equal(getSafeAdminNextPath(), ADMIN_HOME_PATH)
    assert.equal(getSafeAdminNextPath(null), ADMIN_HOME_PATH)
    assert.equal(getSafeAdminNextPath(""), ADMIN_HOME_PATH)
  })
})
