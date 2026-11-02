import { describe, it, expect } from "vitest";
import {
  encodeVaultDocumentMessage,
  parseVaultDocumentMessage,
  type VaultDocument,
} from "@/lib/vault/documents";

describe("Unified Document Vault", () => {
  it("encodes and parses vault document message references across species", () => {
    const doc: VaultDocument = {
      id: "usda-ant-permit-123",
      ownerId: "user-456",
      title: "USDA Movement Permit PPQ 526",
      category: "permit",
      species: "insect",
      fileUrl: "https://example.com/vault/usda-permit.pdf",
      fileType: "application/pdf",
      issuer: "USDA APHIS",
      verified: true,
      createdAt: "2026-11-01T00:00:00Z",
    };

    const encoded = encodeVaultDocumentMessage(doc);
    expect(encoded).toContain("[vault-doc:");
    expect(encoded).toContain("usda-ant-permit-123");
    expect(encoded).toContain("permit");
    expect(encoded).toContain("insect");

    const parsed = parseVaultDocumentMessage(encoded);
    expect(parsed).not.toBeNull();
    expect(parsed?.id).toBe("usda-ant-permit-123");
    expect(parsed?.category).toBe("permit");
    expect(parsed?.title).toBe("USDA Movement Permit PPQ 526");
    expect(parsed?.species).toBe("insect");
    expect(parsed?.fileUrl).toBe("https://example.com/vault/usda-permit.pdf");
  });

  it("gracefully returns null for non-vault messages", () => {
    expect(parseVaultDocumentMessage("Hello, is the queen ant still available?")).toBeNull();
    expect(parseVaultDocumentMessage(null)).toBeNull();
    expect(parseVaultDocumentMessage("")).toBeNull();
  });
});
