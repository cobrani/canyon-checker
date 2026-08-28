import { JSDOM } from "jsdom"
import { describe, expect, it } from "vitest"
import { isSelectable } from "../src/checker.js"

describe("isSelectable", () => {
  it("accepts Canyon's purchasable option", () => {
    const { document } = new JSDOM(`
      <button class="productConfiguration__selectVariant productConfiguration__selectVariant--purchasable"
        data-product-size="L">L</button>
    `).window
    expect(isSelectable(document.querySelector("button"))).toBe(true)
  })

  it("rejects Canyon's notify-me option", () => {
    const { document } = new JSDOM(
      '<button class="productConfiguration__selectVariant productConfiguration__selectVariant--unpurchasable productConfiguration__selectVariant--notifyMe">L</button>',
    ).window
    expect(isSelectable(document.querySelector("button"))).toBe(false)
  })

  it("rejects a disabled purchasable option", () => {
    const { document } = new JSDOM(
      '<button disabled class="productConfiguration__selectVariant productConfiguration__selectVariant--purchasable">L</button>',
    ).window
    expect(isSelectable(document.querySelector("button"))).toBe(false)
  })
})
