import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadStepFile } from "./workpieceLoader";

describe("workpiece loader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts the preprocess choice with the uploaded STEP file", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ manifest: { id: "wp" }, manifestUrl: "/workpieces/wp/manifest.json" })
    });
    vi.stubGlobal("fetch", fetchMock);

    await uploadStepFile(new File(["ISO-10303-21;"], "fixture.step"), { preprocess: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workpieces",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData)
      })
    );
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("preprocess")).toBe("true");
    expect((body.get("file") as File).name).toBe("fixture.step");
  });
});
