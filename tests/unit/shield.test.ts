import { describe, expect, it } from "vitest";
import { screenMessage } from "@/lib/moderation/shield";

describe("Deal Room & Escrow Shield", () => {
  it("allows standard, friendly buyer and breeder communication", async () => {
    const messages = [
      "Hi! Is this puppy still available?",
      "Can we schedule a FaceTime or visit to meet the parents?",
      "What is the pup's temperament and current weight?",
      "I love the contract terms. Placing my deposit through Scrlpets now!",
      "The adoption fee is $1500 and the carrier fee is $250.",
    ];

    for (const msg of messages) {
      const res = await screenMessage(msg);
      expect(res.allowed).toBe(true);
    }
  });

  it("intercepts CashApp cashtags and direct payment steering", async () => {
    const attempts = [
      "Hey, don't pay on here, just send it to my CashApp $puppymaster247",
      "Send deposit to $topdogs so we can skip the platform fee",
      "pay outside the app and I'll give you a $200 discount",
      "My cash app is $dailenbreeder",
    ];

    for (const msg of attempts) {
      const res = await screenMessage(msg);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe("off_platform_payment");
      expect(res.warningMessage).toContain("Escrow Shield Protection");
    }
  });

  it("intercepts Venmo, Zelle, and Wire transfer attempts", async () => {
    const attempts = [
      "Send the money to my Venmo @breeder-john",
      "Can you Zelle the remaining balance before pickup?",
      "Please do a wire transfer directly to my bank",
      "Let's avoid the fee and pay direct via Western Union",
    ];

    for (const msg of attempts) {
      const res = await screenMessage(msg);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe("off_platform_payment");
    }
  });

  it("intercepts underage separation animal welfare violations", async () => {
    const attempts = [
      "The pups are eating food already and ready at 4 weeks to go home",
      "You can take home at 5 weeks, mom is done nursing",
    ];

    for (const msg of attempts) {
      const res = await screenMessage(msg);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe("welfare_violation");
      expect(res.warningMessage).toContain("Animal Welfare Shield");
    }
  });
});
