import React, { createRef } from "react"
import {
  View,
  Keyboard,
  Platform,
  StyleSheet,
  LayoutAnimation,
  type StyleProp,
  type ViewStyle,
  type KeyboardEvent,
  type KeyboardMetrics,
  type LayoutRectangle,
  type LayoutChangeEvent,
  type EventSubscription,
} from "react-native"

export interface KeyboardAvoidProps {
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
  behavior?: "height" | "position" | "padding"
  enabled?: boolean
  keyboardVerticalOffset?: number
  onLayout?: (event: LayoutChangeEvent) => void
}

interface KeyboardAvoidState {
  bottom: number
}

/**
 * Drop-in replacement for React Native's KeyboardAvoidingView that fixes the Android
 * dismiss bug.
 *
 * In standard RN KeyboardAvoidingView, `keyboardDidHide` calls `_onKeyboardChange`
 * instead of `_onKeyboardHide` on Android. When `keyboardVerticalOffset > 0`, this causes
 * `_relativeKeyboardHeight` to calculate `padding = keyboardVerticalOffset` on hide,
 * leaving an unwanted blank gap at the bottom of the screen.
 *
 * By calling `_onKeyboardHide` on `keyboardDidHide` (matching iOS behavior), this component
 * strictly resets `bottom` to 0 when the keyboard is dismissed, while preserving the exact
 * offset positioning when the keyboard is active.
 */
export class KeyboardAvoid extends React.Component<KeyboardAvoidProps, KeyboardAvoidState> {
  _frame: LayoutRectangle | null = null
  _keyboardEvent: KeyboardEvent | null = null
  _subscriptions: EventSubscription[] = []
  viewRef = createRef<View>()
  _initialFrameHeight = 0
  _bottom = 0

  constructor(props: KeyboardAvoidProps) {
    super(props)
    this.state = { bottom: 0 }
  }

  _relativeKeyboardHeight(keyboardFrame: KeyboardMetrics): number {
    const frame = this._frame
    if (!frame || !keyboardFrame) {
      return 0
    }

    const keyboardY = keyboardFrame.screenY - (this.props.keyboardVerticalOffset ?? 0)

    if (this.props.behavior === "height") {
      return Math.max(this.state.bottom + frame.y + frame.height - keyboardY, 0)
    }

    return Math.max(frame.y + frame.height - keyboardY, 0)
  }

  _onKeyboardChange = (event: KeyboardEvent) => {
    this._keyboardEvent = event
    this._updateBottomIfNecessary()
  }

  _onKeyboardHide = () => {
    this._keyboardEvent = null
    this._updateBottomIfNecessary()
  }

  _onLayout = (event: LayoutChangeEvent) => {
    const oldFrame = this._frame
    this._frame = event.nativeEvent.layout
    if (!this._initialFrameHeight) {
      this._initialFrameHeight = this._frame.height
    }

    if (!oldFrame || oldFrame.height !== this._frame.height) {
      this._updateBottomIfNecessary()
    }

    if (this.props.onLayout) {
      this.props.onLayout(event)
    }
  }

  _setBottom = (value: number) => {
    const enabled = this.props.enabled ?? true
    this._bottom = value
    if (enabled) {
      this.setState({ bottom: value })
    }
  }

  _updateBottomIfNecessary = () => {
    if (this._keyboardEvent == null) {
      this._setBottom(0)
      return
    }

    const { duration, easing, endCoordinates } = this._keyboardEvent
    const height = this._relativeKeyboardHeight(endCoordinates)

    if (this._bottom === height) {
      return
    }

    this._setBottom(height)

    const enabled = this.props.enabled ?? true
    if (enabled && duration && easing) {
      try {
        LayoutAnimation.configureNext({
          duration: duration > 10 ? duration : 10,
          update: {
            duration: duration > 10 ? duration : 10,
            type: LayoutAnimation.Types[easing] || "keyboard",
          },
        })
      } catch {}
    }
  }

  componentDidUpdate(prevProps: KeyboardAvoidProps, prevState: KeyboardAvoidState): void {
    const enabled = this.props.enabled ?? true
    if (enabled && this._bottom !== prevState.bottom) {
      this.setState({ bottom: this._bottom })
    }
  }

  componentDidMount(): void {
    if (!Keyboard.isVisible()) {
      this._keyboardEvent = null
      this._setBottom(0)
    }

    if (Platform.OS === "ios") {
      this._subscriptions = [
        Keyboard.addListener("keyboardWillHide", this._onKeyboardHide),
        Keyboard.addListener("keyboardWillShow", this._onKeyboardChange),
      ]
    } else {
      // FIX: Use _onKeyboardHide on keyboardDidHide so bottom resets to 0!
      this._subscriptions = [
        Keyboard.addListener("keyboardDidHide", this._onKeyboardHide),
        Keyboard.addListener("keyboardDidShow", this._onKeyboardChange),
      ]
    }
  }

  componentWillUnmount(): void {
    this._subscriptions.forEach((sub) => sub.remove())
  }

  render(): React.ReactNode {
    const {
      behavior,
      children,
      contentContainerStyle,
      enabled = true,
      keyboardVerticalOffset = 0,
      style,
      onLayout,
      ...props
    } = this.props

    const bottomHeight = enabled === true ? this.state.bottom : 0

    switch (behavior) {
      case "height": {
        let heightStyle
        if (this._frame != null && this.state.bottom > 0) {
          heightStyle = {
            height: this._initialFrameHeight - bottomHeight,
            flex: 0,
          }
        }
        return (
          <View
            ref={this.viewRef}
            style={StyleSheet.compose(style, heightStyle)}
            onLayout={this._onLayout}
            {...props}
          >
            {children}
          </View>
        )
      }

      case "position":
        return (
          <View ref={this.viewRef} style={style} onLayout={this._onLayout} {...props}>
            <View style={StyleSheet.compose(contentContainerStyle, { bottom: bottomHeight })}>
              {children}
            </View>
          </View>
        )

      case "padding":
        return (
          <View
            ref={this.viewRef}
            style={StyleSheet.compose(style, { paddingBottom: bottomHeight })}
            onLayout={this._onLayout}
            {...props}
          >
            {children}
          </View>
        )

      default:
        return (
          <View ref={this.viewRef} onLayout={this._onLayout} style={style} {...props}>
            {children}
          </View>
        )
    }
  }
}
