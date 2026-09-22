import { useState, useCallback, useMemo } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native"
import { WebView, type WebViewMessageEvent } from "react-native-webview"
import * as Clipboard from "expo-clipboard"
import { Ionicons } from "@expo/vector-icons"

interface Props {
  math: string
  isDark: boolean
}

export function KatexBlock({ math, isDark }: Props) {
  const [copied, setCopied] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [webViewHeight, setWebViewHeight] = useState(65)
  const [loading, setLoading] = useState(true)

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(math)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (typeof data.height === "number" && data.height > 0) {
        setWebViewHeight(Math.min(Math.max(data.height, 40), 400))
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }, [])

  const htmlContent = useMemo(() => {
    const bgColor = isDark ? "#1a1a1a" : "#f8f8f8"
    const textColor = isDark ? "#e5e5e5" : "#0a0a0a"
    const cleanMath = math.trim()

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background-color: ${bgColor};
            color: ${textColor};
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100%;
            overflow-x: auto;
            padding: 8px 12px;
            font-family: -apple-system, Roboto, sans-serif;
          }
          #math-container {
            display: inline-block;
            text-align: center;
            max-width: 100%;
          }
          .katex-display {
            margin: 0 !important;
          }
          .katex {
            font-size: 1.15em !important;
            color: ${textColor} !important;
          }
        </style>
      </head>
      <body>
        <div id="math-container"></div>
        <script>
          function renderMath() {
            var container = document.getElementById("math-container");
            if (typeof katex !== "undefined") {
              try {
                katex.render(${JSON.stringify(cleanMath)}, container, {
                  displayMode: true,
                  throwOnError: false
                });
              } catch (e) {
                container.innerText = ${JSON.stringify(cleanMath)};
              }
            } else {
              container.innerText = ${JSON.stringify(cleanMath)};
            }
            setTimeout(function() {
              var h = document.body.scrollHeight || document.documentElement.scrollHeight;
              window.ReactNativeWebView.postMessage(JSON.stringify({ height: h }));
            }, 50);
          }

          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", renderMath);
          } else {
            renderMath();
          }
        </script>
      </body>
      </html>
    `
  }, [math, isDark])

  return (
    <View style={[styles.container, isDark && styles.containerDark]}>
      {/* Header with Equation label, Code toggle & Copy */}
      <View style={[styles.header, isDark && styles.headerDark]}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="calculator-outline" size={13} color={isDark ? "#a78bfa" : "#7c3aed"} />
          <Text style={[styles.label, isDark && styles.labelDark]}>EQUAÇÃO</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowCode((v) => !v)} hitSlop={8} style={styles.toggleBtn}>
            <Ionicons
              name={showCode ? "eye-outline" : "code-slash-outline"}
              size={13}
              color={isDark ? "#aaaaaa" : "#666666"}
            />
            <Text style={[styles.toggleText, isDark && styles.toggleTextDark]}>
              {showCode ? "Render" : "LaTeX"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={copy} hitSlop={8}>
            <Text style={[styles.copyBtn, isDark && styles.copyBtnDark]}>{copied ? "Copiado!" : "Copiar"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content: Either Rendered KaTeX or raw code */}
      {showCode ? (
        <View style={styles.rawCodeContainer}>
          <Text style={[styles.rawCodeText, isDark && styles.rawCodeTextDark]} selectable>
            {math.trim()}
          </Text>
        </View>
      ) : (
        <View style={[styles.webviewContainer, { height: webViewHeight }]}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="small" color="#8b5cf6" />
            </View>
          )}
          <WebView
            originWhitelist={["*"]}
            source={{ html: htmlContent }}
            onMessage={onMessage}
            style={[styles.webview, { backgroundColor: isDark ? "#1a1a1a" : "#f8f8f8" }]}
            scrollEnabled={true}
            showsHorizontalScrollIndicator={true}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    marginVertical: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e5e5",
  },
  containerDark: {
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#efedf5",
  },
  headerDark: {
    backgroundColor: "#252030",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6d28d9",
    letterSpacing: 0.5,
  },
  labelDark: {
    color: "#c4b5fd",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  toggleText: {
    fontSize: 11,
    color: "#666666",
    fontWeight: "500",
  },
  toggleTextDark: {
    color: "#aaaaaa",
  },
  copyBtn: {
    fontSize: 11,
    color: "#8b5cf6",
    fontWeight: "600",
  },
  copyBtnDark: {
    color: "#a78bfa",
  },
  webviewContainer: {
    width: "100%",
    position: "relative",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  webview: {
    flex: 1,
  },
  rawCodeContainer: {
    padding: 12,
  },
  rawCodeText: {
    fontFamily: "monospace",
    fontSize: 13,
    lineHeight: 18,
    color: "#1a1a1a",
  },
  rawCodeTextDark: {
    color: "#e5e5e5",
  },
})
