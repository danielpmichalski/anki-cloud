// Copyright 2026 Archont Soft Daniel Klimuntowski
// Licensed under the Elastic License 2.0 — see LICENSE in the repository root.
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as api from "../client.js";

const text = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

// MEDIA-LIMITS: the allowlist and size caps below repeat anki-cloud-sync/sync-storage-server/src/media.rs. Update them together.
const LIMITS =
  "Allowed types: png, jpg, gif, webp, svg, mp3, ogg, wav, m4a, 3gp, amr (detected from the bytes, not the name). " +
  "Size limits: images 5 MB, audio 10 MB, SVG 200 KB.";

export function registerMediaTools(server: McpServer): void {
  server.tool(
    "request_media_upload",
    "Get a one-time link where the USER can upload an image or audio file from their device (single use, valid for 5 minutes; treat it as a secret). " +
      "Use this for png, jpg, gif, webp and audio: you cannot send binary data through MCP. " +
      "Give the link to the user and ask them to tell you when they are done, then call list_media to find the stored name. " +
      "Reference the file in a note field with the html snippet (e.g. <img src=\"cat.png\"> or [sound:clip.mp3]). " +
      LIMITS,
    {},
    async () => text(await api.createMediaUploadLink())
  );

  server.tool(
    "add_svg_media",
    "Store an SVG image you write yourself (diagrams, charts, shapes) in the user's collection. " +
      "Scripts and external references are stripped. Returns the stored name, which may differ from the one you asked for " +
      "(use the returned name and html snippet in note fields, e.g. <img src=\"diagram.svg\">). " +
      "Other file types cannot be sent this way: use request_media_upload. " +
      LIMITS,
    {
      name: z.string().describe("File name ending in .svg"),
      content: z.string().describe("The SVG markup"),
    },
    async ({ name, content }) => text(await api.addSvgMedia(name, content))
  );

  server.tool(
    "list_media",
    "List the media files (images, audio) in the user's collection, with sizes. Paginated: pass nextCursor back as cursor for more.",
    {
      limit: z.number().int().min(1).max(1000).optional().describe("Page size (default 100)"),
      cursor: z.string().optional().describe("nextCursor from a previous call"),
    },
    async ({ limit, cursor }) => text(await api.listMedia({ limit, cursor }))
  );

  server.tool(
    "get_media_info",
    "Facts about one media file: detected type, size and, for raster images, pixel width and height. Cheap: does not download the file.",
    { name: z.string().describe("Stored file name (from list_media or add_svg_media)") },
    async ({ name }) => text(await api.getMediaMetadata(name))
  );

  server.tool(
    "get_media",
    "Fetch a media file so you can look at it (images are returned as images, SVG as text, audio as audio). " +
      "Downloads the whole file, so prefer get_media_info when you only need type or size.",
    { name: z.string().describe("Stored file name (from list_media or add_svg_media)") },
    async ({ name }) => {
      const { bytes, mimeType } = await api.getMediaBytes(name);
      if (mimeType === "image/svg+xml") {
        return { content: [{ type: "text" as const, text: new TextDecoder().decode(bytes) }] };
      }
      const data = Buffer.from(bytes).toString("base64");
      if (mimeType.startsWith("image/")) return { content: [{ type: "image" as const, data, mimeType }] };
      if (mimeType.startsWith("audio/")) return { content: [{ type: "audio" as const, data, mimeType }] };
      return text({ name, mimeType, size: bytes.length });
    }
  );

  server.tool(
    "delete_media",
    "Delete a media file from the user's collection (removed on their devices at the next sync). " +
      "Notes that reference it will show a broken image or no sound. Confirm with the user first: this is hard to undo.",
    { name: z.string().describe("Stored file name (from list_media)") },
    async ({ name }) => {
      await api.deleteMedia(name);
      return text({ ok: true });
    }
  );
}
