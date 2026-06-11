# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> signed-out user sees the public feed + sign-in CTA (G1-A)
- Location: tests/e2e/auth.spec.ts:3:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e3]:
      - generic [ref=e4]:
        - heading "Scrlpets" [level=1] [ref=e5]
        - link "Sign in" [ref=e6] [cursor=pointer]:
          - /url: /login
      - tablist [ref=e8]:
        - tab "Following" [selected] [ref=e9]
        - tab "For You" [ref=e10]
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e14]: 🐾 Biscuit
        - paragraph [ref=e15]: Biscuit's first beach day. He ate sand. Twice.
        - img "Biscuit's first beach day. He ate sand. Twice." [ref=e16]
      - generic [ref=e17]:
        - generic [ref=e19]: 🐾 Max
        - paragraph [ref=e20]: Max learned to sit today.
        - img "Max learned to sit today." [ref=e21]
      - generic [ref=e22]:
        - generic [ref=e23]:
          - generic [ref=e24]: 🐾 Luna
          - generic [ref=e25]: Reel
        - paragraph [ref=e26]: 15s of Luna being dramatic.
        - img "15s of Luna being dramatic." [ref=e27]
      - generic [ref=e28]:
        - generic [ref=e29]:
          - generic [ref=e30]: 🐾 Max
          - generic [ref=e31]: Video
        - paragraph [ref=e32]: Full grooming walkthrough.
        - img "Full grooming walkthrough." [ref=e33]
      - generic [ref=e34]:
        - generic [ref=e35]:
          - generic [ref=e36]: 🐾 Max
          - generic [ref=e37]: For sale
        - paragraph [ref=e38]: AKC Golden pup — health tested
        - img "AKC Golden pup — health tested" [ref=e39]
      - generic [ref=e40]:
        - generic [ref=e41]:
          - generic [ref=e42]: breeder_jane
          - generic [ref=e43]: Promo
        - paragraph [ref=e44]: 20% off first vet-check
      - generic [ref=e45]:
        - generic [ref=e47]: 🐾 Mango
        - paragraph [ref=e48]: Mango learned to say "treat" and now negotiates.
        - img "Mango learned to say \"treat\" and now negotiates." [ref=e49]
      - generic [ref=e50]:
        - generic [ref=e51]:
          - generic [ref=e52]: 🐾 Kiwi
          - generic [ref=e53]: For sale
        - paragraph [ref=e54]: Hand-raised parakeet pair — DNA sexed
        - img "Hand-raised parakeet pair — DNA sexed" [ref=e55]
      - generic [ref=e56]:
        - generic [ref=e57]:
          - generic [ref=e58]: 🐾 Kiwi
          - generic [ref=e59]: Reel
        - paragraph [ref=e60]: Kiwi vs. the mirror — round 47.
        - img "Kiwi vs. the mirror — round 47." [ref=e61]
      - generic [ref=e62]:
        - generic [ref=e63]:
          - generic [ref=e64]: sunny_paws_aviary
          - generic [ref=e65]: Promo
        - paragraph [ref=e66]: Free starter seed mix with first bird purchase
        - img "Free starter seed mix with first bird purchase" [ref=e67]
      - generic [ref=e68]:
        - generic [ref=e70]: 🐾 Rex
        - paragraph [ref=e71]: Rex shed perfectly in one piece. Frame-worthy.
        - img "Rex shed perfectly in one piece. Frame-worthy." [ref=e72]
      - generic [ref=e73]:
        - generic [ref=e74]:
          - generic [ref=e75]: 🐾 Cleo
          - generic [ref=e76]: Reel
        - paragraph [ref=e77]: Cleo discovered the heating vent. She lives there now.
        - img "Cleo discovered the heating vent. She lives there now." [ref=e78]
      - generic [ref=e79]:
        - generic [ref=e80]:
          - generic [ref=e81]: 🐾 Rex
          - generic [ref=e82]: For sale
        - paragraph [ref=e83]: Leopard gecko, proven breeder line
        - img "Leopard gecko, proven breeder line" [ref=e84]
      - generic [ref=e85]:
        - generic [ref=e86]:
          - generic [ref=e87]: 🐾 Biscuit
          - generic [ref=e88]: Video
        - paragraph [ref=e89]: Puppy socialization basics — full 20min walkthrough.
        - img "Puppy socialization basics — full 20min walkthrough." [ref=e90]
      - generic [ref=e91]:
        - generic [ref=e92]: sunny_paws_aviary
        - paragraph [ref=e93]: Morning chorus at the aviary. Volume warning.
        - img "Morning chorus at the aviary. Volume warning." [ref=e94]
      - generic [ref=e95]:
        - generic [ref=e96]:
          - generic [ref=e97]: 🐾 Cleo
          - generic [ref=e98]: For sale
        - paragraph [ref=e99]: Maine Coon kittens — health certs ready
        - img "Maine Coon kittens — health certs ready" [ref=e100]
  - button "Open Next.js Dev Tools" [ref=e106] [cursor=pointer]:
    - img [ref=e107]
  - alert [ref=e110]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test("signed-out user sees the public feed + sign-in CTA (G1-A)", async ({ page }) => {
> 4  |   await page.goto("/");
     |              ^ Error: page.goto: Test timeout of 30000ms exceeded.
  5  |   await expect(page.getByTestId("feed-list")).toBeVisible();
  6  |   await expect(page.getByTestId("signin-cta")).toBeVisible();
  7  | });
  8  | 
  9  | test("email sign-in lands on the feed", async ({ page }) => {
  10 |   await page.goto("/login");
  11 |   await page.getByPlaceholder("email").fill(process.env.E2E_EMAIL!);
  12 |   await page.getByPlaceholder("password").fill(process.env.E2E_PASSWORD!);
  13 |   await page.getByRole("button", { name: "Sign in" }).click();
  14 |   await expect(page).toHaveURL("http://localhost:3000/");
  15 |   await expect(page.getByTestId("feed-list")).toBeVisible();
  16 |   await expect(page.getByTestId("signin-cta")).toHaveCount(0);
  17 | });
  18 | 
```