import { test } from "node:test"
import assert from "node:assert/strict"
import { keyboardVerticalOffset, IOS_KEYBOARD_VERTICAL_OFFSET } from "./keyboard-offset.ts"

test("keyboardVerticalOffset: returns fixed 90 for iOS", () => {
  assert.equal(keyboardVerticalOffset("ios", 0), IOS_KEYBOARD_VERTICAL_OFFSET)
  assert.equal(keyboardVerticalOffset("ios", 48), IOS_KEYBOARD_VERTICAL_OFFSET)
})

test("keyboardVerticalOffset: returns insetTop for Android", () => {
  assert.equal(keyboardVerticalOffset("android", 48.857), 48.857)
  assert.equal(keyboardVerticalOffset("android", 0), 0)
  assert.equal(keyboardVerticalOffset("android", -10), 0)
})
