#!/usr/bin/env -S deno run --allow-net --allow-read
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

let WAIT_TOKEN: string = "?" + crypto.randomUUID();
const WAIT_CLIENTS: ((value: Response | PromiseLike<Response>) => void)[] = [];
const WAIT_PATH: string = "/:" + crypto.randomUUID().substring(24);
const SITE_PATH: string = Deno.args[0] ?? Deno.cwd();
const SITE_FILES = {};
const MIME_TYPES = {
	html: "text/html; charset=UTF-8",
	js: "application/javascript",
	css: "text/css",
	svg: "image/svg+xml",
	bin: "application/octet-stream",
};

async function httpRequestHandler(req: Request): Promise<Response> {
	const url = new URL(req.url);
	if (url.pathname == WAIT_PATH) {
		if (url.search != WAIT_TOKEN) return new Response();
		return await new Promise((resolve) => WAIT_CLIENTS.push(resolve));
	}
	const path = (SITE_PATH + decodeURIComponent(url.pathname))
		.replace(/\/+/g, "/").replace(/\/+$/, "/index.html");
	const { status, type, body } = await loadFile(path) ??
		{ status: 404, type: "text/plain", body: "Error 404" };
	return new Response(body, { status, headers: { "content-type": type } });
}

async function loadFile(path: string) {
	if (path in SITE_FILES) return SITE_FILES[path];
	try {
		let body = await Deno.readFile(path);
		const type = MIME_TYPES[getPathSuffix(path)] ?? MIME_TYPES.bin;
		if (type == "text/html; charset=UTF-8") body = augmentHtml(body);
		watchFile(path);
		return SITE_FILES[path] = { body, type };
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) return;
		console.error(path, error);
		Deno.exit(123);
	}
}

async function watchFile(path: string) {
	for await (const event of Deno.watchFs(path)) {
		if (event.kind == "modify" || event.kind == "remove") break;
	}
	delete SITE_FILES[path];
	WAIT_TOKEN = "?" + crypto.randomUUID();
	// TODO: is it infinity cycle?
	for (const send of WAIT_CLIENTS) send(new Response());
	WAIT_CLIENTS.length = 0;
}

function getPathSuffix(path: string) {
	return path.substring(path.lastIndexOf(".") + 1);
}

function augmentHtml(htmlBytes: Uint8Array) {
	const html = new TextDecoder().decode(htmlBytes);
	const head = html.indexOf("</head>\n");
	const script = Deno.readTextFileSync(
		new URL("./refresher.js", import.meta.url).pathname,
	).replace(/\n+$/, "").replace("WAITREQUEST", WAIT_PATH + WAIT_TOKEN);
	return new TextEncoder().encode([
		html.substring(0, head),
		"\t<script>\n" + script.replace(/^/gm, "\t\t") + "\n\t</script>\n",
		html.substring(head),
	].join(""));
}

let port = 8000;
while (true) {
	try {
		const onListen = () => console.log(`http://localhost:${port}`);
		await serve(httpRequestHandler, { port, onListen });
	} catch {
		port = (port + 7952) * 257 % 8976 + 1024;
	}
}
