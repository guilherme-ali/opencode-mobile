// KeyboardAvoidingView's `keyboardVerticalOffset`, per platform.
//
// Why Android needs a non-zero value under edge-to-edge:
//
// RN's KeyboardAvoidingView derives its padding from
//
//     keyboardY = keyboardFrame.screenY - keyboardVerticalOffset
//     padding   = max(frame.y + frame.height - keyboardY, 0)
//
// `frame` comes from the view's own onLayout, which is in **window**
// coordinates — the origin sits below the status bar. `keyboardFrame.screenY`
// is in **screen** coordinates, measured from the true top of the display.
// Before Expo's mandatory edge-to-edge those two origins coincided, because
// the app window started below the status bar and the OS resized it
// (adjustResize) when the keyboard opened. Under edge-to-edge the window spans
// the full display, the two spaces no longer agree, and the computed padding
// comes up short by exactly the status-bar inset.
//
// In addition, vendor keyboards (notably Samsung Keyboard in One UI) render
// an accessory toolbar (clipboard, emojis, settings) at the top of the
// keyboard. Adding an extra offset (56dp) ensures the composer and send button
// sit comfortably above this toolbar.
//
// iOS keeps its existing empirical 90.

export const IOS_KEYBOARD_VERTICAL_OFFSET = 90
export const ANDROID_KEYBOARD_EXTRA_OFFSET = 56

export function keyboardVerticalOffset(platform: string, insetTop: number): number {
  if (platform === "ios") return IOS_KEYBOARD_VERTICAL_OFFSET
  // Guard against a bogus/unmeasured inset so we never push content down.
  // Add ANDROID_KEYBOARD_EXTRA_OFFSET to clear Samsung/vendor keyboard toolbars.
  return Math.max(0, insetTop) + ANDROID_KEYBOARD_EXTRA_OFFSET
}
