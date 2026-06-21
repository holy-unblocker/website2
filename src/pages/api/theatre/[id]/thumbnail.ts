import { theatreAPI } from "@lib/theatre";
import { requireTheatreAdmin } from "@lib/admin";
import { theatreFilesEnabled, theatreFilesPath } from "@config/apis";
import type { APIRoute } from "astro";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";

// thumbnails live at <theatreFilesPath>/thumbnails/<id>.webp and are served
// publicly under /cdn/thumbnails/<id>.webp by the runtime
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/webp"];

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function thumbnailFile(id: string) {
  // keep the id filesystem-safe; ids are random base36 but be defensive
  if (!/^[a-z0-9]+$/i.test(id)) return undefined;
  return join(theatreFilesPath as string, "thumbnails", `${id}.webp`);
}

export const PUT: APIRoute = async (context) => {
  const denied = requireTheatreAdmin(context);
  if (denied) return denied;

  if (!theatreFilesEnabled)
    return jsonError("Theatre files are not hosted locally.", 400);

  const id = context.params.id!;
  if (!(await theatreAPI.show(id)))
    return jsonError("Theatre entry not found.", 404);

  const file = thumbnailFile(id);
  if (!file) return jsonError("Invalid theatre entry id.", 400);

  const form = await context.request.formData();
  const upload = form.get("thumbnail");

  if (!(upload instanceof File))
    return jsonError("No thumbnail uploaded.", 400);
  if (upload.size === 0) return jsonError("Uploaded file is empty.", 400);
  if (upload.size > MAX_BYTES)
    return jsonError("Thumbnail must be 5 MB or smaller.", 400);
  if (!ALLOWED_TYPES.includes(upload.type))
    return jsonError("Thumbnail must be a webp image.", 400);

  try {
    const bytes = Buffer.from(await upload.arrayBuffer());
    await mkdir(join(theatreFilesPath as string, "thumbnails"), {
      recursive: true,
    });
    await writeFile(file, bytes);
  } catch (err) {
    console.error("thumbnail upload error:", err);
    return jsonError("Unable to save the thumbnail.", 500);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};

export const DELETE: APIRoute = async (context) => {
  const denied = requireTheatreAdmin(context);
  if (denied) return denied;

  if (!theatreFilesEnabled)
    return jsonError("Theatre files are not hosted locally.", 400);

  const file = thumbnailFile(context.params.id!);
  if (!file) return jsonError("Invalid theatre entry id.", 400);

  try {
    await rm(file, { force: true });
  } catch (err) {
    console.error("thumbnail delete error:", err);
    return jsonError("Unable to remove the thumbnail.", 500);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
};
