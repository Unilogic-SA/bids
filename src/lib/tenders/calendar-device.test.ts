import assert from "node:assert/strict"
import test from "node:test"
import { detectCalendarDevice, getCalendarChoices } from "./calendar-device"

test("recognises Apple mobile including iPad desktop mode without treating a Mac as an iPad", () => {
  assert.equal(
    detectCalendarDevice({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      platform: "iPhone",
    }),
    "ios"
  )
  assert.equal(
    detectCalendarDevice({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
      platform: "MacIntel",
      maxTouchPoints: 5,
    }),
    "ios"
  )
  assert.equal(
    detectCalendarDevice({ platform: "MacIntel", maxTouchPoints: 0 }),
    "mac"
  )
})

test("recognises Android and Windows with a safe unknown-device fallback", () => {
  assert.equal(
    detectCalendarDevice({
      userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9)",
      platform: "Linux aarch64",
    }),
    "android"
  )
  assert.equal(
    detectCalendarDevice({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    }),
    "windows"
  )
  assert.equal(detectCalendarDevice({}), "other")
})

test("device hints reorder choices while keeping every provider and file fallback", () => {
  assert.equal(getCalendarChoices("ios")[0], "file")
  assert.equal(getCalendarChoices("android")[0], "google")
  assert.equal(getCalendarChoices("windows")[0], "outlook")
  for (const device of ["ios", "android", "mac", "windows", "other"] as const) {
    assert.deepEqual([...getCalendarChoices(device)].sort(), [
      "file",
      "google",
      "microsoft365",
      "outlook",
    ])
  }
})
