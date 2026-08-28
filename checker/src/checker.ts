import { JSDOM } from "jsdom"

export async function fetchWithTimeout(
  url: string,
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "canyon-stock-watcher/0.1" },
    })
  } finally {
    clearTimeout(timeout)
  }
}

export function isSelectable(element: Element | null): boolean {
  if (!element) return false
  if (
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true"
  )
    return false

  return element.classList.contains(
    "productConfiguration__selectVariant--purchasable",
  )
}

export async function checkStock(
  url: string,
  selector: string,
): Promise<boolean> {
  const response = await fetchWithTimeout(url)
  if (!response.ok) throw new Error(`Canyon returned HTTP ${response.status}`)

  const html = await response.text()
  const { document } = new JSDOM(html).window
  return isSelectable(document.querySelector(selector))
}
