import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createDefaultVault,
  defaultVaultId,
  deleteIndexedDatabase,
  IndexedDBAdapter,
} from "../indexeddb.adapter";

const defaultVaultName = "Vault";
const updatedVaultName = "Vault Updated";

describe("IndexedDBAdapter vault persistence", () => {
  beforeEach(async () => {
    await deleteIndexedDatabase();
  });

  afterEach(async () => {
    await deleteIndexedDatabase();
  });

  it("writes, reads, and updates the vault", async () => {
    const adapter = new IndexedDBAdapter();
    await adapter.init();

    const vault = createDefaultVault();
    expect(vault.name).toBe(defaultVaultName);
    expect(vault.id).toBe(defaultVaultId);

    await adapter.writeVault(vault);

    const storedVault = await adapter.readVault();
    expect(storedVault).toEqual(vault);

    const updatedVault = {
      ...vault,
      name: updatedVaultName,
      updatedAt: vault.updatedAt + 1,
    };

    await adapter.writeVault(updatedVault);

    const refreshedVault = await adapter.readVault();
    expect(refreshedVault?.name).toBe(updatedVaultName);
  });
});
