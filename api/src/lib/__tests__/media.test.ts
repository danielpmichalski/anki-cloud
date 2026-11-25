// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { describe, expect, test } from "bun:test";
import { htmlSnippet } from "@/lib/media";

describe("htmlSnippet", () => {
  test.each(["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"])(
    "%s becomes an img tag",
    (mime) => {
      expect(htmlSnippet("cat.img", mime)).toBe('<img src="cat.img">');
    }
  );

  test.each(["audio/mpeg", "audio/ogg", "audio/wav", "audio/mp4", "audio/3gpp", "audio/amr"])(
    "%s becomes a [sound:] tag",
    (mime) => {
      expect(htmlSnippet("clip.snd", mime)).toBe("[sound:clip.snd]");
    }
  );

  test("keeps the stored (possibly hash-suffixed) name as is", () => {
    expect(htmlSnippet("cat-0a1b2c.png", "image/png")).toBe('<img src="cat-0a1b2c.png">');
  });

  test("escapes a double quote so the attribute cannot be closed early", () => {
    expect(htmlSnippet('a"b.png', "image/png")).toBe('<img src="a&quot;b.png">');
  });

  test("does not escape names in sound tags", () => {
    expect(htmlSnippet("my clip.mp3", "audio/mpeg")).toBe("[sound:my clip.mp3]");
  });

  test("unknown types fall back to an img tag", () => {
    expect(htmlSnippet("x.bin", "application/octet-stream")).toBe('<img src="x.bin">');
  });
});
